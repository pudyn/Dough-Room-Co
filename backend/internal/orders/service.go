package orders

import (
	"context"
	"database/sql"
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

type Order struct {
	ID              uuid.UUID   `json:"id" db:"id"`
	OrderNumber     string      `json:"order_number" db:"order_number"`
	CustomerID      *uuid.UUID  `json:"customer_id" db:"customer_id"`
	Source          string      `json:"source" db:"source"`
	OrderType       string      `json:"order_type" db:"order_type"`
	PreorderPeriodID *uuid.UUID `json:"preorder_period_id" db:"preorder_period_id"`
	CustomerName    *string     `json:"customer_name" db:"customer_name"`
	CustomerPhone   *string     `json:"customer_phone" db:"customer_phone"`
	PickupDate      *string     `json:"pickup_date" db:"pickup_date"`
	PickupTime      *string     `json:"pickup_time" db:"pickup_time"`
	Subtotal        int64       `json:"subtotal" db:"subtotal"`
	DiscountAmount  int64       `json:"discount_amount" db:"discount_amount"`
	TotalAmount     int64       `json:"total_amount" db:"total_amount"`
	OrderStatus     string      `json:"order_status" db:"order_status"`
	PaymentStatus   string      `json:"payment_status" db:"payment_status"`
	Notes           *string     `json:"notes" db:"notes"`
	AccessToken     string         `json:"access_token,omitempty" db:"access_token"`
	Items           []OrderItem    `json:"items,omitempty"`
	Payment         *OrderPayment  `json:"payment,omitempty"`
	CreatedAt       string         `json:"created_at" db:"created_at"`
	UpdatedAt       string         `json:"updated_at" db:"updated_at"`
}

type OrderPayment struct {
	ID            uuid.UUID `json:"id" db:"id"`
	PaymentMethod string    `json:"payment_method" db:"method"`
	Amount        int64     `json:"amount" db:"amount"`
	PaymentStatus string    `json:"payment_status" db:"status"`
	ProofURL      *string   `json:"proof_url" db:"proof_url"`
	ExpiresAt     *string   `json:"expired_at" db:"expires_at"`
	PaidAt        *string   `json:"paid_at" db:"paid_at"`
	BankName      *string   `json:"bank_name" db:"bank_name"`
	AccountNumber *string   `json:"account_number" db:"account_number"`
	AccountName   *string   `json:"account_name" db:"account_holder"`
}

type OrderItem struct {
	ID          uuid.UUID `json:"id" db:"id"`
	OrderID     uuid.UUID `json:"order_id" db:"order_id"`
	ProductID   uuid.UUID `json:"product_id" db:"product_id"`
	ProductName string    `json:"product_name" db:"product_name"`
	SKU         string    `json:"sku" db:"sku"`
	Quantity    int       `json:"quantity" db:"quantity"`
	UnitPrice   int64     `json:"unit_price" db:"unit_price"`
	Subtotal    int64     `json:"subtotal" db:"subtotal"`
	CreatedAt   string    `json:"created_at" db:"created_at"`
}

type OrderStatusHistory struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	OrderID   uuid.UUID  `json:"order_id" db:"order_id"`
	OldStatus *string    `json:"old_status" db:"old_status"`
	NewStatus string     `json:"new_status" db:"new_status"`
	ChangedBy *uuid.UUID `json:"changed_by" db:"changed_by"`
	Notes     *string    `json:"notes" db:"notes"`
	CreatedAt string     `json:"created_at" db:"created_at"`
}

type OrderFilters struct {
	Status        string
	PaymentStatus string
	Source        string
	OrderType     string
	DateFrom      string
	DateTo        string
	Search        string
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams, f OrderFilters) ([]Order, int64, error) {
	query := "SELECT id, order_number, customer_id, source, order_type, customer_name, customer_phone, pickup_date, subtotal, discount_amount, total_amount, order_status, payment_status, notes, created_at, updated_at FROM orders WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM orders WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if f.Status != "" {
		query += fmt.Sprintf(" AND order_status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND order_status = $%d", argIdx)
		args = append(args, f.Status)
		argIdx++
	}
	if f.PaymentStatus != "" {
		query += fmt.Sprintf(" AND payment_status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND payment_status = $%d", argIdx)
		args = append(args, f.PaymentStatus)
		argIdx++
	}
	if f.Source != "" {
		query += fmt.Sprintf(" AND source = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND source = $%d", argIdx)
		args = append(args, f.Source)
		argIdx++
	}
	if f.OrderType != "" {
		query += fmt.Sprintf(" AND order_type = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND order_type = $%d", argIdx)
		args = append(args, f.OrderType)
		argIdx++
	}
	if f.DateFrom != "" {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, f.DateFrom)
		argIdx++
	}
	if f.DateTo != "" {
		query += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", argIdx)
		countQuery += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", argIdx)
		args = append(args, f.DateTo)
		argIdx++
	}
	if f.Search != "" {
		query += fmt.Sprintf(" AND (order_number ILIKE $%d OR customer_name ILIKE $%d)", argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (order_number ILIKE $%d OR customer_name ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var orders []Order
	err := s.db.SelectContext(ctx, &orders, query, args...)
	return orders, total, err
}

func (s *Service) findOrCreateCustomer(ctx context.Context, name, phone, email string) *uuid.UUID {
	if name == "" || phone == "" {
		return nil
	}
	var id uuid.UUID
	var existingEmail *string
	err := s.db.QueryRowxContext(ctx, "SELECT id, email FROM customers WHERE phone = $1", phone).Scan(&id, &existingEmail)
	if err == nil {
		if email != "" && (existingEmail == nil || *existingEmail == "") {
			s.db.ExecContext(ctx, "UPDATE customers SET email = $1 WHERE id = $2", email, id)
		}
		return &id
	}
	err = s.db.QueryRowxContext(ctx,
		"INSERT INTO customers (name, phone, email) VALUES ($1,$2,$3) RETURNING id",
		name, phone, shared.NullStr(email)).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (s *Service) fetchPayment(ctx context.Context, orderID uuid.UUID) *OrderPayment {
	var p OrderPayment
	err := s.db.GetContext(ctx, &p,
		`SELECT p.id, p.method, p.amount, p.status, p.proof_url, p.expires_at, p.paid_at,
		        ba.bank_name, ba.account_number, ba.account_holder
		 FROM payments p
		 LEFT JOIN payment_bank_accounts ba
		   ON ba.id = COALESCE(p.bank_account_id, (SELECT id FROM payment_bank_accounts WHERE is_active = TRUE ORDER BY created_at LIMIT 1))
		 WHERE p.order_id = $1
		 ORDER BY p.created_at DESC LIMIT 1`, orderID)
	if err != nil {
		return nil
	}
	return &p
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Order, error) {
	var order Order
	err := s.db.GetContext(ctx, &order,
		"SELECT id, order_number, customer_id, source, order_type, preorder_period_id, customer_name, customer_phone, pickup_date, pickup_time, subtotal, discount_amount, total_amount, order_status, payment_status, notes, access_token, created_at, updated_at FROM orders WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	var items []OrderItem
	s.db.SelectContext(ctx, &items, "SELECT id, order_id, product_id, product_name, sku, quantity, unit_price, subtotal, created_at FROM order_items WHERE order_id = $1", id)
	order.Items = items
	order.Payment = s.fetchPayment(ctx, order.ID)

	return &order, nil
}

func (s *Service) GetByAccessToken(ctx context.Context, token string) (*Order, error) {
	var order Order
	err := s.db.GetContext(ctx, &order,
		"SELECT id, order_number, source, order_type, customer_name, customer_phone, pickup_date, pickup_time, subtotal, discount_amount, total_amount, order_status, payment_status, notes, created_at, updated_at FROM orders WHERE access_token = $1", token)
	if err != nil {
		return nil, err
	}

	var items []OrderItem
	s.db.SelectContext(ctx, &items, "SELECT id, order_id, product_id, product_name, sku, quantity, unit_price, subtotal, created_at FROM order_items WHERE order_id = $1", order.ID)
	order.Items = items
	order.Payment = s.fetchPayment(ctx, order.ID)

	return &order, nil
}

func (s *Service) GetByPhone(ctx context.Context, phone string) ([]Order, error) {
	var orders []Order
	err := s.db.SelectContext(ctx, &orders,
		"SELECT id, order_number, source, order_type, customer_name, customer_phone, pickup_date, subtotal, discount_amount, total_amount, order_status, payment_status, notes, access_token, created_at, updated_at FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC LIMIT 10", phone)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		var items []OrderItem
		s.db.SelectContext(ctx, &items, "SELECT id, order_id, product_id, product_name, sku, quantity, unit_price, subtotal, created_at FROM order_items WHERE order_id = $1", orders[i].ID)
		orders[i].Items = items
		orders[i].Payment = s.fetchPayment(ctx, orders[i].ID)
	}
	return orders, nil
}

func (s *Service) Create(ctx context.Context, req CreateOrderRequest, userID *uuid.UUID) (*Order, error) {
	if req.IdempotencyKey != "" {
		var resp []byte
		err := s.db.GetContext(ctx, &resp, "SELECT response FROM idempotency_keys WHERE key = $1", req.IdempotencyKey)
		if err == nil {
			var order Order
			err := s.db.GetContext(ctx, &order, "SELECT id, order_number, access_token, total_amount, order_status, payment_status, created_at, updated_at FROM orders WHERE order_number = (SELECT order_number FROM idempotency_keys WHERE key = $1 LIMIT 1)", req.IdempotencyKey)
			if err == nil {
				return &order, nil
			}
		}
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var subtotal int64
	type productInfo struct {
		ID            uuid.UUID `db:"id"`
		Name          string    `db:"name"`
		SKU           string    `db:"sku"`
		SellingPrice  int64     `db:"selling_price"`
		CostPrice     int64     `db:"cost_price"`
		StockTracking bool      `db:"stock_tracking"`
		StockQuantity int       `db:"stock_quantity"`
		IsActive      bool      `db:"is_active"`
	}

	type itemData struct {
		Product  productInfo
		Quantity int
	}

	var itemsData []itemData
	for _, item := range req.Items {
		var prod productInfo
		err := tx.GetContext(ctx, &prod, "SELECT id, name, sku, selling_price, cost_price, stock_tracking, stock_quantity, is_active FROM products WHERE id = $1 FOR UPDATE", item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("product %s not found", item.ProductID)
		}
		if !prod.IsActive {
			return nil, fmt.Errorf("product %s is not active", prod.Name)
		}
		if item.Quantity <= 0 {
			return nil, fmt.Errorf("quantity must be greater than 0")
		}

		if req.OrderType == "READY_STOCK" && prod.StockTracking {
			if prod.StockQuantity < item.Quantity {
				return nil, fmt.Errorf("insufficient stock for %s (available: %d, requested: %d)", prod.Name, prod.StockQuantity, item.Quantity)
			}
		}

		subtotal += prod.SellingPrice * int64(item.Quantity)
		itemsData = append(itemsData, itemData{Product: prod, Quantity: item.Quantity})
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

	totalAmount := subtotal - discountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	orderNumber := shared.GenerateOrderNumber()
	accessToken := shared.GenerateAccessToken()

	initialStatus := "PENDING_PAYMENT"
	initialPaymentStatus := "UNPAID"
	if req.PaymentMethod == "CASH" && req.Source == "POS" {
		initialStatus = "CONFIRMED"
		initialPaymentStatus = "PAID"
	}

	var pickupDate, pickupTime interface{}
	if req.PickupDate != "" {
		pickupDate = req.PickupDate
	}
	if req.PickupTime != "" {
		pickupTime = req.PickupTime
	}

	// Auto-register customer for public orders
	customerID := req.CustomerID
	if customerID == nil && req.Source != "POS" && req.CustomerPhone != "" {
		customerID = s.findOrCreateCustomer(ctx, req.CustomerName, req.CustomerPhone, req.CustomerEmail)
	}

	var orderID uuid.UUID
	err = tx.QueryRowxContext(ctx,
		`INSERT INTO orders (order_number, source, order_type, preorder_period_id, customer_id, customer_name, customer_phone, pickup_date, pickup_time, subtotal, discount_amount, total_amount, order_status, payment_status, notes, access_token)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
		orderNumber, req.Source, req.OrderType, req.PreorderPeriodID, customerID,
		nullStr(req.CustomerName), nullStr(req.CustomerPhone),
		pickupDate, pickupTime,
		subtotal, discountAmount, totalAmount,
		initialStatus, initialPaymentStatus, nullStr(req.Notes), accessToken).Scan(&orderID)
	if err != nil {
		return nil, err
	}

	for _, item := range itemsData {
		itemSubtotal := item.Product.SellingPrice * int64(item.Quantity)
		_, err := tx.ExecContext(ctx,
			"INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, cost_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
			orderID, item.Product.ID, item.Product.Name, item.Product.SKU, item.Quantity, item.Product.SellingPrice, item.Product.CostPrice, itemSubtotal)
		if err != nil {
			return nil, err
		}

		if req.OrderType == "READY_STOCK" && item.Product.StockTracking {
			movementType := "RESERVATION"
			if initialStatus == "CONFIRMED" {
				movementType = "SALE"
			}
			_, err := tx.ExecContext(ctx,
				"UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2",
				item.Quantity, item.Product.ID)
			if err != nil {
				return nil, err
			}
			_, err = tx.ExecContext(ctx,
				"INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES ($1, $2, $3, 'ORDER', $4, $5)",
				item.Product.ID, movementType, -item.Quantity, orderID, userID)
			if err != nil {
				return nil, err
			}
		}

		if req.OrderType == "PREORDER" && req.PreorderPeriodID != nil {
			result, err := tx.ExecContext(ctx,
				"UPDATE preorder_product_quotas SET reserved_quantity = reserved_quantity + $1 WHERE preorder_period_id = $2 AND product_id = $3 AND (quota - reserved_quantity) >= $1",
				item.Quantity, req.PreorderPeriodID, item.Product.ID)
			if err != nil {
				return nil, err
			}
			rows, _ := result.RowsAffected()
			if rows == 0 {
				return nil, fmt.Errorf("insufficient quota for %s", item.Product.Name)
			}
		}
	}

	tx.ExecContext(ctx,
		"INSERT INTO order_status_histories (order_id, new_status, changed_by, notes) VALUES ($1, $2, $3, 'Order created')",
		orderID, initialStatus, userID)

	if req.PaymentMethod != "" && req.PaymentMethod != "CASH" {
		paymentNumber := shared.GeneratePaymentNumber()
		paymentStatus := "PENDING"
		var expiresAt interface{}
		if req.PaymentMethod == "BANK_TRANSFER" || req.PaymentMethod == "QRIS" {
			expiry := time.Now().Add(60 * time.Minute)
			expiresAt = expiry
		}

		_, err := tx.ExecContext(ctx,
			`INSERT INTO payments (order_id, payment_number, method, amount, status, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			orderID, paymentNumber, req.PaymentMethod, totalAmount, paymentStatus, expiresAt)
		if err != nil {
			return nil, err
		}

		tx.ExecContext(ctx, "UPDATE orders SET payment_status = 'PENDING' WHERE id = $1", orderID)
	} else if req.PaymentMethod == "CASH" && req.Source == "POS" {
		paymentNumber := shared.GeneratePaymentNumber()
		_, err := tx.ExecContext(ctx,
			`INSERT INTO payments (order_id, payment_number, method, amount, status, paid_at)
			VALUES ($1, $2, 'CASH', $3, 'PAID', NOW())`,
			orderID, paymentNumber, totalAmount)
		if err != nil {
			return nil, err
		}
	}

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

	return s.GetByID(ctx, orderID)
}

var validTransitions = map[string][]string{
	"PENDING_PAYMENT": {"CONFIRMED", "CANCELLED", "EXPIRED"},
	"CONFIRMED":       {"PREPARING", "CANCELLED"},
	"PREPARING":       {"READY", "CANCELLED"},
	"READY":           {"COMPLETED"},
}

func (s *Service) UpdateStatus(ctx context.Context, id uuid.UUID, newStatus, notes string, userID *uuid.UUID) (*Order, error) {
	var currentStatus string
	err := s.db.GetContext(ctx, &currentStatus, "SELECT order_status FROM orders WHERE id = $1", id)
	if err != nil {
		return nil, errors.New("order not found")
	}

	allowed, ok := validTransitions[currentStatus]
	if !ok {
		return nil, fmt.Errorf("cannot transition from %s", currentStatus)
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("invalid transition from %s to %s", currentStatus, newStatus)
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	tx.ExecContext(ctx, "UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2", newStatus, id)
	tx.ExecContext(ctx, "INSERT INTO order_status_histories (order_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)",
		id, currentStatus, newStatus, userID, nullStr(notes))

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) Cancel(ctx context.Context, id uuid.UUID, notes string, userID *uuid.UUID) error {
	var order struct {
		OrderStatus   string `db:"order_status"`
		OrderType     string `db:"order_type"`
		PaymentStatus string `db:"payment_status"`
	}
	err := s.db.GetContext(ctx, &order, "SELECT order_status, order_type, payment_status FROM orders WHERE id = $1", id)
	if err != nil {
		return errors.New("order not found")
	}

	if order.OrderStatus == "COMPLETED" || order.OrderStatus == "CANCELLED" {
		return fmt.Errorf("cannot cancel order with status %s", order.OrderStatus)
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.ExecContext(ctx, "UPDATE orders SET order_status = 'CANCELLED', payment_status = CASE WHEN payment_status = 'PAID' THEN 'REFUNDED' ELSE 'FAILED' END, updated_at = NOW() WHERE id = $1", id)
	tx.ExecContext(ctx, "INSERT INTO order_status_histories (order_id, old_status, new_status, changed_by, notes) VALUES ($1, $2, 'CANCELLED', $3, $4)",
		id, order.OrderStatus, userID, nullStr(notes))

	if order.OrderType == "READY_STOCK" {
		var items []struct {
			ProductID uuid.UUID `db:"product_id"`
			Quantity  int       `db:"quantity"`
		}
		tx.SelectContext(ctx, &items, "SELECT product_id, quantity FROM order_items WHERE order_id = $1", id)
		for _, item := range items {
			tx.ExecContext(ctx, "UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 AND stock_tracking = TRUE", item.Quantity, item.ProductID)
			tx.ExecContext(ctx, "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES ($1, 'RELEASE', $2, 'ORDER_CANCEL', $3, $4)",
				item.ProductID, item.Quantity, id, userID)
		}
	}

	if order.OrderType == "PREORDER" {
		var items []struct {
			ProductID uuid.UUID `db:"product_id"`
			Quantity  int       `db:"quantity"`
		}
		tx.SelectContext(ctx, &items, "SELECT product_id, quantity FROM order_items WHERE order_id = $1", id)

		var periodID uuid.UUID
		tx.GetContext(ctx, &periodID, "SELECT preorder_period_id FROM orders WHERE id = $1", id)

		for _, item := range items {
			tx.ExecContext(ctx, "UPDATE preorder_product_quotas SET reserved_quantity = GREATEST(reserved_quantity - $1, 0) WHERE preorder_period_id = $2 AND product_id = $3",
				item.Quantity, periodID, item.ProductID)
		}
	}

	tx.ExecContext(ctx, "UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = $1 AND status IN ('UNPAID', 'PENDING')", id)

	return tx.Commit()
}

func (s *Service) GetHistory(ctx context.Context, orderID uuid.UUID) ([]OrderStatusHistory, error) {
	var history []OrderStatusHistory
	err := s.db.SelectContext(ctx, &history,
		"SELECT id, order_id, old_status, new_status, changed_by, notes, created_at FROM order_status_histories WHERE order_id = $1 ORDER BY created_at", orderID)
	return history, err
}

func nullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
