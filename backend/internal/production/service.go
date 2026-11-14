package production

import (
	"context"
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

type Batch struct {
	ID             uuid.UUID `json:"id" db:"id"`
	BatchNumber    string    `json:"batch_number" db:"batch_number"`
	ProductionDate string    `json:"production_date" db:"production_date"`
	Status         string    `json:"status" db:"status"`
	Notes          *string   `json:"notes" db:"notes"`
	CreatedAt      string    `json:"created_at" db:"created_at"`
	Items          []BatchProductItem `json:"items,omitempty"`
}

type BatchProductItem struct {
	ID               uuid.UUID `json:"id" db:"id"`
	ProductID        uuid.UUID `json:"product_id" db:"product_id"`
	ProductName      *string   `json:"product_name" db:"product_name"`
	PlannedQuantity  int       `json:"planned_quantity" db:"planned_quantity"`
	ProducedQuantity int       `json:"produced_quantity" db:"produced_quantity"`
	Notes            *string   `json:"notes" db:"notes"`
}

type KitchenOrder struct {
	ID           uuid.UUID `json:"id" db:"id"`
	OrderNumber  string    `json:"order_number" db:"order_number"`
	OrderType    string    `json:"order_type" db:"order_type"`
	CustomerName *string   `json:"customer_name" db:"customer_name"`
	PickupDate   *string   `json:"pickup_date" db:"pickup_date"`
	OrderStatus  string    `json:"order_status" db:"order_status"`
	Notes        *string   `json:"notes" db:"notes"`
	CreatedAt    string    `json:"created_at" db:"created_at"`
	Items        []KitchenItem `json:"items,omitempty"`
}

type KitchenItem struct {
	ProductName string `json:"product_name" db:"product_name"`
	Quantity    int    `json:"quantity" db:"quantity"`
}

func (s *Service) ListBatches(ctx context.Context, p shared.PaginationParams) ([]Batch, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM production_batches")

	var batches []Batch
	err := s.db.SelectContext(ctx, &batches,
		"SELECT id, batch_number, production_date, status, notes, created_at FROM production_batches ORDER BY production_date DESC LIMIT $1 OFFSET $2",
		p.PerPage, p.Offset)
	return batches, total, err
}

func (s *Service) GetBatch(ctx context.Context, id uuid.UUID) (*Batch, error) {
	var batch Batch
	err := s.db.GetContext(ctx, &batch, "SELECT id, batch_number, production_date, status, notes, created_at FROM production_batches WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	var items []BatchProductItem
	s.db.SelectContext(ctx, &items,
		"SELECT pi.id, pi.product_id, pr.name as product_name, pi.planned_quantity, pi.produced_quantity, pi.notes FROM production_items pi JOIN products pr ON pi.product_id = pr.id WHERE pi.production_batch_id = $1", id)
	batch.Items = items
	return &batch, nil
}

func (s *Service) CreateBatch(ctx context.Context, req CreateBatchRequest, userID uuid.UUID) (*Batch, error) {
	batchNumber := shared.GenerateBatchNumber()
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var batchID uuid.UUID
	err = tx.QueryRowxContext(ctx,
		"INSERT INTO production_batches (batch_number, production_date, notes) VALUES ($1,$2,$3) RETURNING id",
		batchNumber, req.ProductionDate, shared.NullStr(req.Notes)).Scan(&batchID)
	if err != nil {
		return nil, err
	}

	for _, item := range req.Items {
		_, err := tx.ExecContext(ctx,
			"INSERT INTO production_items (production_batch_id, product_id, planned_quantity) VALUES ($1,$2,$3)",
			batchID, item.ProductID, item.PlannedQuantity)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetBatch(ctx, batchID)
}

func (s *Service) UpdateBatch(ctx context.Context, id uuid.UUID, req CreateBatchRequest) (*Batch, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		"UPDATE production_batches SET production_date=$1, notes=$2, updated_at=NOW() WHERE id=$3",
		req.ProductionDate, shared.NullStr(req.Notes), id)
	if err != nil {
		return nil, err
	}

	for _, item := range req.Items {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO production_items (production_batch_id, product_id, planned_quantity, produced_quantity)
			 VALUES ($1,$2,$3,0)
			 ON CONFLICT (production_batch_id, product_id) DO UPDATE SET planned_quantity=$3`,
			id, item.ProductID, item.PlannedQuantity)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetBatch(ctx, id)
}

func (s *Service) KitchenQueue(ctx context.Context, dateStr string) ([]KitchenOrder, error) {
	if dateStr == "" {
		dateStr = shared.TodayJakarta()
	}

	var orders []KitchenOrder
	err := s.db.SelectContext(ctx, &orders,
		`SELECT id, order_number, order_type, customer_name, pickup_date, order_status, notes, created_at
		 FROM orders
		 WHERE order_status IN ('CONFIRMED', 'PREPARING', 'READY')
		 AND (pickup_date = $1 OR order_type = 'READY_STOCK')
		 ORDER BY CASE order_status
		   WHEN 'CONFIRMED' THEN 1
		   WHEN 'PREPARING' THEN 2
		   WHEN 'READY' THEN 3
		 END, created_at`, dateStr)
	if err != nil {
		return nil, err
	}

	for i := range orders {
		var items []KitchenItem
		s.db.SelectContext(ctx, &items,
			"SELECT product_name, quantity FROM order_items WHERE order_id = $1", orders[i].ID)
		orders[i].Items = items
	}

	return orders, nil
}

func (s *Service) UpdateOrderStatus(ctx context.Context, id uuid.UUID, newStatus, notes string, userID uuid.UUID) error {
	validKitchenStatuses := map[string]bool{"PREPARING": true, "READY": true, "COMPLETED": true}
	if !validKitchenStatuses[newStatus] {
		return fmt.Errorf("kitchen can only set status to PREPARING, READY, or COMPLETED")
	}

	var currentStatus string
	if err := s.db.GetContext(ctx, &currentStatus, "SELECT order_status FROM orders WHERE id = $1", id); err != nil {
		return fmt.Errorf("order not found")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.ExecContext(ctx, "UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2", newStatus, id)
	tx.ExecContext(ctx, "INSERT INTO order_status_histories (order_id, old_status, new_status, changed_by, notes) VALUES ($1,$2,$3,$4,$5)",
		id, currentStatus, newStatus, userID, shared.NullStr(notes))

	return tx.Commit()
}
