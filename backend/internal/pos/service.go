package pos

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/donutshop/backend/internal/shared"
)

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

type POSProduct struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	CategoryID    *uuid.UUID `json:"category_id" db:"category_id"`
	CategoryName  *string    `json:"category_name" db:"category_name"`
	SKU           string     `json:"sku" db:"sku"`
	Name          string     `json:"name" db:"name"`
	ImageURL      *string    `json:"image_url" db:"image_url"`
	SellingPrice  int64      `json:"selling_price" db:"selling_price"`
	StockQuantity int        `json:"stock_quantity" db:"stock_quantity"`
	StockTracking bool       `json:"stock_tracking" db:"stock_tracking"`
	IsActive      bool       `json:"is_active" db:"is_active"`
}

type CashRegister struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	Name           string     `json:"name" db:"name"`
	OpeningBalance int64      `json:"opening_balance" db:"opening_balance"`
	ClosingBalance *int64     `json:"closing_balance" db:"closing_balance"`
	OpenedBy       uuid.UUID  `json:"opened_by" db:"opened_by"`
	ClosedBy       *uuid.UUID `json:"closed_by" db:"closed_by"`
	OpenedAt       string     `json:"opened_at" db:"opened_at"`
	ClosedAt       *string    `json:"closed_at" db:"closed_at"`
	Status         string     `json:"status" db:"status"`
}

func (s *Service) ListPOSProducts(ctx context.Context, search, categoryID string) ([]POSProduct, error) {
	query := "SELECT p.id, p.category_id, c.name as category_name, p.sku, p.name, p.image_url, p.selling_price, p.stock_quantity, p.stock_tracking, p.is_active FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = TRUE"
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.sku ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if categoryID != "" {
		query += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		args = append(args, categoryID)
		argIdx++
	}

	query += " ORDER BY c.name, p.name"

	var products []POSProduct
	err := s.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (s *Service) CreatePOSOrder(ctx context.Context, req POSOrderRequest, userID uuid.UUID) (interface{}, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var subtotal int64
	type itemData struct {
		ID        uuid.UUID
		Name      string
		SKU       string
		Price     int64
		CostPrice int64
		Qty       int
	}
	var items []itemData

	for _, item := range req.Items {
		var prod struct {
			ID            uuid.UUID `db:"id"`
			Name          string    `db:"name"`
			SKU           string    `db:"sku"`
			SellingPrice  int64     `db:"selling_price"`
			CostPrice     int64     `db:"cost_price"`
			StockTracking bool      `db:"stock_tracking"`
			StockQuantity int       `db:"stock_quantity"`
			IsActive      bool      `db:"is_active"`
		}
		if err := tx.GetContext(ctx, &prod, "SELECT id, name, sku, selling_price, cost_price, stock_tracking, stock_quantity, is_active FROM products WHERE id = $1 FOR UPDATE", item.ProductID); err != nil {
			return nil, fmt.Errorf("product not found: %s", item.ProductID)
		}
		if !prod.IsActive {
			return nil, fmt.Errorf("product %s is not available", prod.Name)
		}
		if prod.StockTracking && prod.StockQuantity < item.Quantity {
			return nil, fmt.Errorf("insufficient stock for %s", prod.Name)
		}
		subtotal += prod.SellingPrice * int64(item.Quantity)
		items = append(items, itemData{prod.ID, prod.Name, prod.SKU, prod.SellingPrice, prod.CostPrice, item.Quantity})
	}

	discountAmount := req.DiscountAmount
	var promoCodeID *uuid.UUID
	if req.PromoCodeID != nil {
		var pc struct {
			ID            uuid.UUID  `db:"id"`
			DiscountType  string     `db:"discount_type"`
			DiscountValue int64      `db:"discount_value"`
			MinOrder      int64      `db:"min_order"`
			MaxDiscount   *int64     `db:"max_discount"`
			UsageLimit    *int       `db:"usage_limit"`
			UsageCount    int        `db:"usage_count"`
			IsActive      bool       `db:"is_active"`
			ValidFrom     *time.Time `db:"valid_from"`
			ValidUntil    *time.Time `db:"valid_until"`
		}
		err := tx.GetContext(ctx, &pc,
			"SELECT id, discount_type, discount_value, min_order, max_discount, usage_limit, usage_count, is_active, valid_from, valid_until FROM promo_codes WHERE id = $1 FOR UPDATE", *req.PromoCodeID)
		if err != nil {
			return nil, fmt.Errorf("promo code not found")
		}
		if !pc.IsActive {
			return nil, fmt.Errorf("promo code is not active")
		}
		now := time.Now()
		if pc.ValidFrom != nil && now.Before(*pc.ValidFrom) {
			return nil, fmt.Errorf("promo code is not yet valid")
		}
		if pc.ValidUntil != nil && now.After(*pc.ValidUntil) {
			return nil, fmt.Errorf("promo code has expired")
		}
		if pc.UsageLimit != nil && pc.UsageCount >= *pc.UsageLimit {
			return nil, fmt.Errorf("promo code usage limit reached")
		}
		if subtotal < pc.MinOrder {
			return nil, fmt.Errorf("minimum order Rp %d for this promo", pc.MinOrder)
		}
		if pc.DiscountType == "PERCENTAGE" {
			discountAmount = subtotal * pc.DiscountValue / 100
			if pc.MaxDiscount != nil && discountAmount > *pc.MaxDiscount {
				discountAmount = *pc.MaxDiscount
			}
		} else {
			discountAmount = pc.DiscountValue
		}
		if discountAmount > subtotal {
			discountAmount = subtotal
		}
		promoCodeID = &pc.ID
	}

	total := subtotal - discountAmount
	if total < 0 {
		total = 0
	}

	orderNumber := shared.GenerateOrderNumber()
	accessToken := shared.GenerateAccessToken()

	var orderID uuid.UUID
	err = tx.QueryRowxContext(ctx,
		`INSERT INTO orders (order_number, source, order_type, customer_name, subtotal, discount_amount, total_amount, order_status, payment_status, notes, access_token)
		 VALUES ($1, 'POS', 'READY_STOCK', $2, $3, $4, $5, 'CONFIRMED', 'PAID', $6, $7) RETURNING id`,
		orderNumber, shared.NullStr(req.CustomerName), subtotal, discountAmount, total,
		shared.NullStr(req.Notes), accessToken).Scan(&orderID)
	if err != nil {
		return nil, err
	}

	for _, item := range items {
		_, err := tx.ExecContext(ctx,
			"INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, cost_price, subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
			orderID, item.ID, item.Name, item.SKU, item.Qty, item.Price, item.CostPrice, item.Price*int64(item.Qty))
		if err != nil {
			return nil, err
		}

		tx.ExecContext(ctx, "UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2 AND stock_tracking = TRUE", item.Qty, item.ID)
		tx.ExecContext(ctx, "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES ($1,'SALE',$2,'ORDER',$3,$4)",
			item.ID, -item.Qty, orderID, userID)
	}

	paymentNumber := shared.GeneratePaymentNumber()
	_, err = tx.ExecContext(ctx,
		"INSERT INTO payments (order_id, payment_number, method, amount, status, paid_at) VALUES ($1,$2,$3,$4,'PAID',NOW())",
		orderID, paymentNumber, req.PaymentMethod, total)
	if err != nil {
		return nil, err
	}

	tx.ExecContext(ctx, "INSERT INTO order_status_histories (order_id, new_status, changed_by, notes) VALUES ($1,'CONFIRMED',$2,'POS transaction')", orderID, userID)

	if promoCodeID != nil {
		tx.ExecContext(ctx,
			"INSERT INTO promo_usages (promo_code_id, order_id, discount_amount) VALUES ($1,$2,$3)",
			*promoCodeID, orderID, discountAmount)
		tx.ExecContext(ctx,
			"UPDATE promo_codes SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1",
			*promoCodeID)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	var order struct {
		ID          uuid.UUID `json:"id" db:"id"`
		OrderNumber string    `json:"order_number" db:"order_number"`
		TotalAmount int64     `json:"total_amount" db:"total_amount"`
		OrderStatus string    `json:"order_status" db:"order_status"`
		AccessToken string    `json:"access_token" db:"access_token"`
		CreatedAt   string    `json:"created_at" db:"created_at"`
	}
	s.db.GetContext(ctx, &order, "SELECT id, order_number, total_amount, order_status, access_token, created_at FROM orders WHERE id = $1", orderID)
	return order, nil
}

func (s *Service) ProcessPayment(ctx context.Context, orderID uuid.UUID, method string, amount int64, userID uuid.UUID) (interface{}, error) {
	var order struct {
		TotalAmount   int64  `db:"total_amount"`
		OrderStatus   string `db:"order_status"`
		PaymentStatus string `db:"payment_status"`
	}
	if err := s.db.GetContext(ctx, &order, "SELECT total_amount, order_status, payment_status FROM orders WHERE id = $1", orderID); err != nil {
		return nil, errors.New("order not found")
	}
	if order.PaymentStatus == "PAID" {
		return nil, errors.New("order already paid")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	paymentNumber := shared.GeneratePaymentNumber()
	tx.ExecContext(ctx, "INSERT INTO payments (order_id, payment_number, method, amount, status, paid_at) VALUES ($1,$2,$3,$4,'PAID',NOW())",
		orderID, paymentNumber, method, order.TotalAmount)
	tx.ExecContext(ctx, "UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=NOW() WHERE id=$1", orderID)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return fiber_map{"order_id": orderID, "payment_number": paymentNumber, "status": "PAID"}, nil
}

type fiber_map = map[string]interface{}

func (s *Service) ListTransactions(ctx context.Context, p shared.PaginationParams, dateFrom, dateTo string) (interface{}, int64, error) {
	query := "SELECT id, order_number, customer_name, total_amount, order_status, payment_status, created_at FROM orders WHERE source = 'POS'"
	countQuery := "SELECT COUNT(*) FROM orders WHERE source = 'POS'"
	args := []interface{}{}
	argIdx := 1

	if dateFrom != "" {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		query += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", argIdx)
		countQuery += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	rows, err := s.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var txns []map[string]interface{}
	for rows.Next() {
		m := make(map[string]interface{})
		rows.MapScan(m)
		txns = append(txns, m)
	}
	return txns, total, nil
}

func (s *Service) OpenRegister(ctx context.Context, req OpenRegisterRequest, userID uuid.UUID) (*CashRegister, error) {
	var existing int
	s.db.GetContext(ctx, &existing, "SELECT COUNT(*) FROM cash_registers WHERE opened_by=$1 AND status='OPEN'", userID)
	if existing > 0 {
		return nil, errors.New("you already have an open register")
	}

	var reg CashRegister
	err := s.db.QueryRowxContext(ctx,
		"INSERT INTO cash_registers (name, opening_balance, opened_by) VALUES ($1,$2,$3) RETURNING id, name, opening_balance, opened_by, opened_at, status",
		req.Name, req.OpeningBalance, userID).StructScan(&reg)
	if err != nil {
		return nil, err
	}

	s.db.ExecContext(ctx, "INSERT INTO cash_transactions (cash_register_id, transaction_type, amount, notes, created_by) VALUES ($1,'OPENING',$2,'Opening balance',$3)",
		reg.ID, req.OpeningBalance, userID)

	return &reg, nil
}

func (s *Service) CloseRegister(ctx context.Context, req CloseRegisterRequest, userID uuid.UUID) (*CashRegister, error) {
	var reg CashRegister
	err := s.db.GetContext(ctx, &reg, "SELECT id, name, opening_balance, opened_by, opened_at, status FROM cash_registers WHERE opened_by=$1 AND status='OPEN' ORDER BY opened_at DESC LIMIT 1", userID)
	if err != nil {
		return nil, errors.New("no open register found")
	}

	closedAt := shared.NowJakarta().Format(time.RFC3339)
	s.db.ExecContext(ctx, "UPDATE cash_registers SET status='CLOSED', closing_balance=$1, closed_by=$2, closed_at=NOW() WHERE id=$3",
		req.ClosingBalance, userID, reg.ID)
	s.db.ExecContext(ctx, "INSERT INTO cash_transactions (cash_register_id, transaction_type, amount, notes, created_by) VALUES ($1,'CLOSING',$2,$3,$4)",
		reg.ID, req.ClosingBalance, req.Notes, userID)

	reg.ClosingBalance = &req.ClosingBalance
	reg.ClosedBy = &userID
	reg.ClosedAt = &closedAt
	reg.Status = "CLOSED"
	return &reg, nil
}

type RegisterSummary struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	Name           string     `json:"name" db:"name"`
	OpeningBalance int64      `json:"opening_balance" db:"opening_balance"`
	ClosingBalance *int64     `json:"closing_balance" db:"closing_balance"`
	OpenedBy       uuid.UUID  `json:"opened_by" db:"opened_by"`
	OpenedByName   string     `json:"opened_by_name" db:"opened_by_name"`
	ClosedBy       *uuid.UUID `json:"closed_by" db:"closed_by"`
	OpenedAt       string     `json:"opened_at" db:"opened_at"`
	ClosedAt       *string    `json:"closed_at" db:"closed_at"`
	Status         string     `json:"status" db:"status"`
	TotalSales     int64      `json:"total_sales" db:"total_sales"`
	TotalOrders    int        `json:"total_orders" db:"total_orders"`
}

func (s *Service) ListRegisters(ctx context.Context, p shared.PaginationParams, dateFrom, dateTo string) ([]RegisterSummary, int64, error) {
	query := `
		SELECT cr.id, cr.name, cr.opening_balance, cr.closing_balance,
			cr.opened_by, u.name as opened_by_name, cr.closed_by,
			cr.opened_at, cr.closed_at, cr.status,
			COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.payment_status='PAID' AND o.created_at >= cr.opened_at AND (cr.closed_at IS NULL OR o.created_at <= cr.closed_at)), 0) as total_sales,
			COALESCE((SELECT COUNT(*) FROM orders o WHERE o.payment_status='PAID' AND o.created_at >= cr.opened_at AND (cr.closed_at IS NULL OR o.created_at <= cr.closed_at)), 0) as total_orders
		FROM cash_registers cr
		JOIN users u ON cr.opened_by = u.id
		WHERE 1=1`

	countQuery := "SELECT COUNT(*) FROM cash_registers cr WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if dateFrom != "" {
		filter := fmt.Sprintf(" AND cr.opened_at::date >= $%d", argIdx)
		query += filter
		countQuery += filter
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		filter := fmt.Sprintf(" AND cr.opened_at::date <= $%d", argIdx)
		query += filter
		countQuery += filter
		args = append(args, dateTo)
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY cr.opened_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var registers []RegisterSummary
	err := s.db.SelectContext(ctx, &registers, query, args...)
	return registers, total, err
}

func (s *Service) GetCurrentRegister(ctx context.Context, userID uuid.UUID) (*CashRegister, error) {
	var reg CashRegister
	err := s.db.GetContext(ctx, &reg, "SELECT id, name, opening_balance, closing_balance, opened_by, closed_by, opened_at, closed_at, status FROM cash_registers WHERE opened_by=$1 AND status='OPEN' ORDER BY opened_at DESC LIMIT 1", userID)
	if err != nil {
		return nil, errors.New("no open register")
	}
	return &reg, nil
}
