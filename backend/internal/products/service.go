package products

import (
	"context"
	"errors"
	"fmt"
	"strings"

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

type Product struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	CategoryID       *uuid.UUID `json:"category_id" db:"category_id"`
	CategoryName     *string    `json:"category_name,omitempty" db:"category_name"`
	SKU              string     `json:"sku" db:"sku"`
	Name             string     `json:"name" db:"name"`
	Description      *string    `json:"description" db:"description"`
	ImageURL         *string    `json:"image_url" db:"image_url"`
	SellingPrice     int64      `json:"selling_price" db:"selling_price"`
	CostPrice        int64      `json:"cost_price" db:"cost_price"`
	StockTracking    bool       `json:"stock_tracking" db:"stock_tracking"`
	StockQuantity    int        `json:"stock_quantity" db:"stock_quantity"`
	LowStockThreshold int      `json:"low_stock_threshold" db:"low_stock_threshold"`
	IsActive         bool       `json:"is_active" db:"is_active"`
	IsRecommended    bool       `json:"is_recommended" db:"is_recommended"`
	SalesModes       []string   `json:"sales_modes"`
	CreatedAt        string     `json:"created_at" db:"created_at"`
	UpdatedAt        string     `json:"updated_at" db:"updated_at"`
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams, categoryID, search string) ([]Product, int64, error) {
	query := "SELECT p.id, p.category_id, c.name as category_name, p.sku, p.name, p.description, p.image_url, p.selling_price, p.cost_price, p.stock_tracking, p.stock_quantity, p.low_stock_threshold, p.is_active, p.is_recommended, p.created_at, p.updated_at FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM products p WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if categoryID != "" {
		query += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		args = append(args, categoryID)
		argIdx++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.sku ILIKE $%d)", argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.sku ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var products []Product
	err := s.db.SelectContext(ctx, &products, query, args...)
	if err != nil {
		return nil, 0, err
	}

	for i := range products {
		modes := make([]string, 0)
		s.db.SelectContext(ctx, &modes, "SELECT mode FROM product_sales_modes WHERE product_id = $1", products[i].ID)
		products[i].SalesModes = modes
	}

	return products, total, nil
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	var product Product
	err := s.db.GetContext(ctx, &product,
		"SELECT p.id, p.category_id, c.name as category_name, p.sku, p.name, p.description, p.image_url, p.selling_price, p.cost_price, p.stock_tracking, p.stock_quantity, p.low_stock_threshold, p.is_active, p.is_recommended, p.created_at, p.updated_at FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1", id)
	if err != nil {
		return nil, err
	}

	modes := make([]string, 0)
	s.db.SelectContext(ctx, &modes, "SELECT mode FROM product_sales_modes WHERE product_id = $1", id)
	product.SalesModes = modes

	return &product, nil
}

// generateSKU builds a readable SKU from the product name, e.g.
// "Donat Banana" -> "DONAT-BANANA", adding a numeric suffix if needed.
func (s *Service) generateSKU(ctx context.Context, name string, excludeID *uuid.UUID) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToUpper(name) {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
		} else if !prevDash {
			b.WriteRune('-')
			prevDash = true
		}
	}
	base := strings.Trim(b.String(), "-")
	if base == "" {
		base = "SKU"
	}

	sku := base
	for i := 2; ; i++ {
		query := "SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1"
		args := []interface{}{sku}
		if excludeID != nil {
			query += " AND id <> $2"
			args = append(args, *excludeID)
		}
		query += ")"
		var exists bool
		s.db.GetContext(ctx, &exists, query, args...)
		if !exists {
			return sku
		}
		sku = fmt.Sprintf("%s-%d", base, i)
	}
}

func (s *Service) Create(ctx context.Context, req CreateProductRequest) (*Product, error) {
	sku := strings.TrimSpace(req.SKU)
	if sku == "" {
		sku = s.generateSKU(ctx, req.Name, nil)
	} else {
		var exists bool
		s.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1)", sku)
		if exists {
			return nil, errors.New("sku already exists")
		}
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var id uuid.UUID
	err = tx.QueryRowxContext(ctx,
		`INSERT INTO products (category_id, sku, name, description, image_url, selling_price, cost_price, stock_tracking, stock_quantity, low_stock_threshold)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
		req.CategoryID, sku, req.Name, req.Description, req.ImageURL,
		req.SellingPrice, req.CostPrice, req.StockTracking, req.StockQuantity, req.LowStockThreshold).Scan(&id)
	if err != nil {
		return nil, err
	}

	for _, mode := range req.SalesModes {
		_, err := tx.ExecContext(ctx, "INSERT INTO product_sales_modes (product_id, mode) VALUES ($1, $2)", id, mode)
		if err != nil {
			return nil, err
		}
	}

	if req.StockTracking && req.StockQuantity > 0 {
		_, err := tx.ExecContext(ctx,
			"INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, notes) VALUES ($1, 'INITIAL', $2, 'PRODUCT_CREATE', 'Initial stock')",
			id, req.StockQuantity)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	sku := strings.TrimSpace(req.SKU)
	if sku == "" {
		sku = s.generateSKU(ctx, req.Name, &id)
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE products SET category_id=$1, sku=$2, name=$3, description=$4, image_url=$5, selling_price=$6, cost_price=$7, stock_tracking=$8, low_stock_threshold=$9, is_active=$10, updated_at=NOW() WHERE id=$11`,
		req.CategoryID, sku, req.Name, req.Description, req.ImageURL,
		req.SellingPrice, req.CostPrice, req.StockTracking, req.LowStockThreshold, isActive, id)
	if err != nil {
		return nil, err
	}

	if len(req.SalesModes) > 0 {
		tx.ExecContext(ctx, "DELETE FROM product_sales_modes WHERE product_id = $1", id)
		for _, mode := range req.SalesModes {
			tx.ExecContext(ctx, "INSERT INTO product_sales_modes (product_id, mode) VALUES ($1, $2)", id, mode)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) UpdateImageURL(ctx context.Context, id uuid.UUID, imageURL string) error {
	_, err := s.db.ExecContext(ctx, "UPDATE products SET image_url=$1, updated_at=NOW() WHERE id=$2", imageURL, id)
	return err
}

func (s *Service) ToggleStatus(ctx context.Context, id uuid.UUID) (*Product, error) {
	_, err := s.db.ExecContext(ctx, "UPDATE products SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) ToggleRecommended(ctx context.Context, id uuid.UUID) (*Product, error) {
	_, err := s.db.ExecContext(ctx, "UPDATE products SET is_recommended = NOT is_recommended, updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM products WHERE id = $1", id)
	return err
}

func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1", id)
	return err
}

func (s *Service) ListPublicProducts(ctx context.Context, p shared.PaginationParams, mode, categoryID string) ([]Product, int64, error) {
	query := `SELECT p.id, p.category_id, c.name as category_name, p.sku, p.name, p.description, p.image_url, p.selling_price, p.stock_quantity, p.stock_tracking, p.is_active, p.is_recommended, p.low_stock_threshold, p.cost_price, p.created_at, p.updated_at
	          FROM products p LEFT JOIN categories c ON p.category_id = c.id
	          WHERE p.is_active = TRUE`
	countQuery := "SELECT COUNT(*) FROM products p WHERE p.is_active = TRUE"
	args := []interface{}{}
	argIdx := 1

	if mode != "" {
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM product_sales_modes WHERE product_id = p.id AND mode = $%d)", argIdx)
		countQuery += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM product_sales_modes WHERE product_id = p.id AND mode = $%d)", argIdx)
		args = append(args, mode)
		argIdx++
	}
	if categoryID != "" {
		query += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		args = append(args, categoryID)
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY c.name, p.name LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var prods []Product
	err := s.db.SelectContext(ctx, &prods, query, args...)
	if err != nil {
		return nil, 0, err
	}
	for i := range prods {
		var modes []string
		s.db.SelectContext(ctx, &modes, "SELECT mode FROM product_sales_modes WHERE product_id = $1", prods[i].ID)
		prods[i].SalesModes = modes
	}
	return prods, total, nil
}

func ParseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
