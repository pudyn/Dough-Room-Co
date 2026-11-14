package preorder

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

type Period struct {
	ID             uuid.UUID `json:"id" db:"id"`
	Name           string    `json:"name" db:"name"`
	Description    *string   `json:"description" db:"description"`
	StartAt        string    `json:"start_at" db:"start_at"`
	CloseAt        string    `json:"close_at" db:"close_at"`
	ProductionDate string    `json:"production_date" db:"production_date"`
	PickupStartAt  string    `json:"pickup_start_at" db:"pickup_start_at"`
	PickupEndAt    string    `json:"pickup_end_at" db:"pickup_end_at"`
	Status         string    `json:"status" db:"status"`
	CreatedAt      string    `json:"created_at" db:"created_at"`
	TotalOrders    int       `json:"total_orders" db:"total_orders"`
	TotalRevenue   int64     `json:"total_revenue" db:"total_revenue"`
	Quotas         []Quota   `json:"quotas,omitempty"`
}

type Quota struct {
	ID               uuid.UUID `json:"id" db:"id"`
	PreorderPeriodID uuid.UUID `json:"preorder_period_id" db:"preorder_period_id"`
	ProductID        uuid.UUID `json:"product_id" db:"product_id"`
	ProductName      *string   `json:"product_name" db:"product_name"`
	Quota            int       `json:"quota" db:"quota"`
	ReservedQuantity int       `json:"reserved_quantity" db:"reserved_quantity"`
	ConfirmedQuantity int      `json:"confirmed_quantity" db:"confirmed_quantity"`
}

type ProductionSummaryItem struct {
	ProductID   uuid.UUID `json:"product_id" db:"product_id"`
	ProductName string    `json:"product_name" db:"product_name"`
	TotalOrdered int      `json:"total_ordered" db:"total_ordered"`
	Quota       int       `json:"quota" db:"quota"`
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams) ([]Period, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM preorder_periods")

	var periods []Period
	err := s.db.SelectContext(ctx, &periods,
		`SELECT pp.id, pp.name, pp.description, pp.start_at, pp.close_at, pp.production_date,
		        pp.pickup_start_at, pp.pickup_end_at, pp.status, pp.created_at,
		        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.preorder_period_id = pp.id AND o.payment_status = 'PAID'), 0) AS total_orders,
		        COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.preorder_period_id = pp.id AND o.payment_status = 'PAID'), 0)::bigint AS total_revenue
		 FROM preorder_periods pp ORDER BY pp.created_at DESC LIMIT $1 OFFSET $2`,
		p.PerPage, p.Offset)
	return periods, total, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Period, error) {
	var period Period
	err := s.db.GetContext(ctx, &period,
		"SELECT id, name, description, start_at, close_at, production_date, pickup_start_at, pickup_end_at, status, created_at FROM preorder_periods WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	var quotas []Quota
	s.db.SelectContext(ctx, &quotas,
		"SELECT ppq.id, ppq.preorder_period_id, ppq.product_id, pr.name as product_name, ppq.quota, ppq.reserved_quantity, ppq.confirmed_quantity FROM preorder_product_quotas ppq JOIN products pr ON ppq.product_id = pr.id WHERE ppq.preorder_period_id = $1", id)
	period.Quotas = quotas
	return &period, nil
}

func (s *Service) GetOpenPeriod(ctx context.Context) (*Period, error) {
	var period Period
	err := s.db.GetContext(ctx, &period,
		"SELECT id, name, description, start_at, close_at, production_date, pickup_start_at, pickup_end_at, status, created_at FROM preorder_periods WHERE status = 'OPEN' AND close_at > NOW() ORDER BY created_at DESC LIMIT 1")
	if err != nil {
		return nil, err
	}

	var quotas []Quota
	s.db.SelectContext(ctx, &quotas,
		"SELECT ppq.id, ppq.preorder_period_id, ppq.product_id, pr.name as product_name, ppq.quota, ppq.reserved_quantity, ppq.confirmed_quantity FROM preorder_product_quotas ppq JOIN products pr ON ppq.product_id = pr.id WHERE ppq.preorder_period_id = $1 AND (ppq.quota - ppq.reserved_quantity) > 0", period.ID)
	period.Quotas = quotas
	return &period, nil
}

func (s *Service) Create(ctx context.Context, req CreatePeriodRequest) (*Period, error) {
	var period Period
	err := s.db.QueryRowxContext(ctx,
		`INSERT INTO preorder_periods (name, description, start_at, close_at, production_date, pickup_start_at, pickup_end_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, name, description, start_at, close_at, production_date, pickup_start_at, pickup_end_at, status, created_at`,
		req.Name, shared.NullStr(req.Description), req.StartAt, req.CloseAt,
		req.ProductionDate, req.PickupStartAt, req.PickupEndAt).StructScan(&period)
	return &period, err
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req CreatePeriodRequest) (*Period, error) {
	var status string
	s.db.GetContext(ctx, &status, "SELECT status FROM preorder_periods WHERE id = $1", id)
	if status == "OPEN" {
		return nil, errors.New("cannot edit an open preorder period")
	}

	var period Period
	err := s.db.QueryRowxContext(ctx,
		`UPDATE preorder_periods SET name=$1, description=$2, start_at=$3, close_at=$4, production_date=$5, pickup_start_at=$6, pickup_end_at=$7, updated_at=NOW()
		 WHERE id=$8 RETURNING id, name, description, start_at, close_at, production_date, pickup_start_at, pickup_end_at, status, created_at`,
		req.Name, shared.NullStr(req.Description), req.StartAt, req.CloseAt,
		req.ProductionDate, req.PickupStartAt, req.PickupEndAt, id).StructScan(&period)
	return &period, err
}

func (s *Service) SetStatus(ctx context.Context, id uuid.UUID, newStatus string, userID uuid.UUID) error {
	var current string
	s.db.GetContext(ctx, &current, "SELECT status FROM preorder_periods WHERE id = $1", id)

	validTransitions := map[string][]string{
		"DRAFT":     {"OPEN"},
		"OPEN":      {"CLOSED"},
		"CLOSED":    {"COMPLETED"},
	}

	ok := false
	for _, v := range validTransitions[current] {
		if v == newStatus {
			ok = true
			break
		}
	}
	if !ok {
		return fmt.Errorf("cannot transition from %s to %s", current, newStatus)
	}

	_, err := s.db.ExecContext(ctx, "UPDATE preorder_periods SET status=$1, updated_at=NOW() WHERE id=$2", newStatus, id)
	return err
}

func (s *Service) ListOrders(ctx context.Context, periodID uuid.UUID, p shared.PaginationParams) (interface{}, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM orders WHERE preorder_period_id = $1", periodID)

	rows, err := s.db.QueryxContext(ctx,
		"SELECT id, order_number, customer_name, customer_phone, total_amount, order_status, payment_status, pickup_date, created_at FROM orders WHERE preorder_period_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
		periodID, p.PerPage, p.Offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []map[string]interface{}
	for rows.Next() {
		m := make(map[string]interface{})
		rows.MapScan(m)
		orders = append(orders, m)
	}
	return orders, total, nil
}

func (s *Service) ProductionSummary(ctx context.Context, periodID uuid.UUID) ([]ProductionSummaryItem, error) {
	var items []ProductionSummaryItem
	err := s.db.SelectContext(ctx, &items,
		`SELECT oi.product_id, pr.name as product_name, SUM(oi.quantity) as total_ordered,
		 COALESCE(ppq.quota, 0) as quota
		 FROM order_items oi
		 JOIN orders o ON oi.order_id = o.id
		 JOIN products pr ON oi.product_id = pr.id
		 LEFT JOIN preorder_product_quotas ppq ON ppq.product_id = oi.product_id AND ppq.preorder_period_id = $1
		 WHERE o.preorder_period_id = $1 AND o.payment_status = 'PAID'
		 GROUP BY oi.product_id, pr.name, ppq.quota
		 ORDER BY total_ordered DESC`, periodID)
	return items, err
}

func (s *Service) UpdateQuotas(ctx context.Context, periodID uuid.UUID, quotas []ProductQuota) error {
	var status string
	s.db.GetContext(ctx, &status, "SELECT status FROM preorder_periods WHERE id = $1", periodID)
	if status == "CLOSED" || status == "COMPLETED" {
		return errors.New("cannot update quotas for a closed/completed period")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, q := range quotas {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO preorder_product_quotas (preorder_period_id, product_id, quota)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (preorder_period_id, product_id) DO UPDATE SET quota = $3`,
			periodID, q.ProductID, q.Quota)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Service) IsOpen(ctx context.Context, periodID uuid.UUID) bool {
	var period struct {
		Status  string    `db:"status"`
		CloseAt time.Time `db:"close_at"`
	}
	err := s.db.GetContext(ctx, &period, "SELECT status, close_at FROM preorder_periods WHERE id = $1", periodID)
	if err != nil {
		return false
	}
	return period.Status == "OPEN" && time.Now().Before(period.CloseAt)
}
