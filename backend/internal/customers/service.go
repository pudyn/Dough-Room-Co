package customers

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

type Customer struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Phone       *string   `json:"phone" db:"phone"`
	Email       *string   `json:"email" db:"email"`
	CreatedAt   string    `json:"created_at" db:"created_at"`
	TotalOrders int       `json:"total_orders" db:"total_orders"`
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams, search string) ([]Customer, int64, error) {
	query := `SELECT c.id, c.name, c.phone, c.email, c.created_at,
		COALESCE((SELECT COUNT(*) FROM orders o
		          WHERE (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone <> '' AND o.customer_phone = c.phone))
		            AND o.order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')), 0) AS total_orders
		FROM customers c WHERE 1=1`
	countQuery := "SELECT COUNT(*) FROM customers WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (c.name ILIKE $%d OR c.phone ILIKE $%d)", argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (name ILIKE $%d OR phone ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY c.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var customers []Customer
	err := s.db.SelectContext(ctx, &customers, query, args...)
	return customers, total, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Customer, error) {
	var c Customer
	err := s.db.GetContext(ctx, &c, "SELECT id, name, phone, email, created_at FROM customers WHERE id = $1", id)
	return &c, err
}

func (s *Service) FindOrCreate(ctx context.Context, name, phone, email string) (*Customer, error) {
	var c Customer
	err := s.db.GetContext(ctx, &c, "SELECT id, name, phone, email, created_at FROM customers WHERE phone = $1", phone)
	if err == nil {
		if email != "" && (c.Email == nil || *c.Email == "") {
			s.db.ExecContext(ctx, "UPDATE customers SET email = $1 WHERE id = $2", email, c.ID)
			c.Email = &email
		}
		return &c, nil
	}

	err = s.db.QueryRowxContext(ctx,
		"INSERT INTO customers (name, phone, email) VALUES ($1,$2,$3) RETURNING id, name, phone, email, created_at",
		name, shared.NullStr(phone), shared.NullStr(email)).StructScan(&c)
	return &c, err
}
