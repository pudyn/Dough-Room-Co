package inventory

import (
	"context"
	"errors"
	"fmt"

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

type InventoryProduct struct {
	ID                uuid.UUID `json:"id" db:"id"`
	SKU               string    `json:"sku" db:"sku"`
	Name              string    `json:"name" db:"name"`
	StockTracking     bool      `json:"stock_tracking" db:"stock_tracking"`
	StockQuantity     int       `json:"stock_quantity" db:"stock_quantity"`
	LowStockThreshold int       `json:"low_stock_threshold" db:"low_stock_threshold"`
	IsActive          bool      `json:"is_active" db:"is_active"`
}

type StockMovement struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	ProductID     uuid.UUID  `json:"product_id" db:"product_id"`
	ProductName   *string    `json:"product_name" db:"product_name"`
	MovementType  string     `json:"movement_type" db:"movement_type"`
	Quantity      int        `json:"quantity" db:"quantity"`
	ReferenceType *string    `json:"reference_type" db:"reference_type"`
	ReferenceID   *uuid.UUID `json:"reference_id" db:"reference_id"`
	Notes         *string    `json:"notes" db:"notes"`
	CreatedBy     *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt     string     `json:"created_at" db:"created_at"`
}

func (s *Service) ListProducts(ctx context.Context, p shared.PaginationParams) ([]InventoryProduct, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM products WHERE stock_tracking = TRUE")

	var products []InventoryProduct
	err := s.db.SelectContext(ctx, &products,
		"SELECT id, sku, name, stock_tracking, stock_quantity, low_stock_threshold, is_active FROM products WHERE stock_tracking = TRUE ORDER BY name LIMIT $1 OFFSET $2",
		p.PerPage, p.Offset)
	return products, total, err
}

func (s *Service) ListMovements(ctx context.Context, p shared.PaginationParams, productID string) ([]StockMovement, int64, error) {
	query := "SELECT sm.id, sm.product_id, pr.name as product_name, sm.movement_type, sm.quantity, sm.reference_type, sm.reference_id, sm.notes, sm.created_by, sm.created_at FROM stock_movements sm JOIN products pr ON sm.product_id = pr.id WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM stock_movements WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if productID != "" {
		query += fmt.Sprintf(" AND sm.product_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND product_id = $%d", argIdx)
		args = append(args, productID)
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY sm.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var movements []StockMovement
	err := s.db.SelectContext(ctx, &movements, query, args...)
	return movements, total, err
}

func (s *Service) Adjust(ctx context.Context, req AdjustmentRequest, userID uuid.UUID) error {
	movementType := req.Type
	if movementType == "" {
		movementType = "ADJUSTMENT"
	}
	if movementType != "ADJUSTMENT" && movementType != "WASTE" && movementType != "RETURN" {
		return errors.New("invalid adjustment type")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx,
		"UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 AND stock_tracking = TRUE AND stock_quantity + $1 >= 0",
		req.Quantity, req.ProductID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("adjustment would result in negative stock or product not found")
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, notes, created_by) VALUES ($1, $2, $3, 'MANUAL', $4, $5)",
		req.ProductID, movementType, req.Quantity, req.Notes, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Service) Restock(ctx context.Context, req RestockRequest, userID uuid.UUID) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx,
		"UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 AND stock_tracking = TRUE",
		req.Quantity, req.ProductID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("product not found or stock tracking disabled")
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, notes, created_by) VALUES ($1, 'PURCHASE', $2, 'RESTOCK', $3, $4)",
		req.ProductID, req.Quantity, req.Notes, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Service) LowStock(ctx context.Context) ([]InventoryProduct, error) {
	var products []InventoryProduct
	err := s.db.SelectContext(ctx, &products,
		"SELECT id, sku, name, stock_tracking, stock_quantity, low_stock_threshold, is_active FROM products WHERE stock_tracking = TRUE AND is_active = TRUE AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity")
	return products, err
}
