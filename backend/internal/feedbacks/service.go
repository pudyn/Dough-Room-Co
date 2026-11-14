package feedbacks

import (
	"context"

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

type Feedback struct {
	ID           uuid.UUID `json:"id" db:"id"`
	CustomerName string    `json:"customer_name" db:"customer_name"`
	Contact      *string   `json:"contact" db:"contact"`
	Message      string    `json:"message" db:"message"`
	ImageURL     *string   `json:"image_url" db:"image_url"`
	IsVisible    bool      `json:"is_visible" db:"is_visible"`
	CreatedAt    string    `json:"created_at" db:"created_at"`
}

func (s *Service) Create(ctx context.Context, name, contact, message, imageURL string) (*Feedback, error) {
	var f Feedback
	err := s.db.QueryRowxContext(ctx,
		`INSERT INTO feedbacks (customer_name, contact, message, image_url) VALUES ($1,$2,$3,$4)
		 RETURNING id, customer_name, contact, message, image_url, is_visible, created_at`,
		name, shared.NullStr(contact), message, shared.NullStr(imageURL)).StructScan(&f)
	return &f, err
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams) ([]Feedback, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM feedbacks")

	var items []Feedback
	err := s.db.SelectContext(ctx, &items,
		"SELECT id, customer_name, contact, message, image_url, is_visible, created_at FROM feedbacks ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		p.PerPage, p.Offset)
	if items == nil {
		items = make([]Feedback, 0)
	}
	return items, total, err
}

func (s *Service) ListPublic(ctx context.Context, limit int) ([]Feedback, error) {
	var items []Feedback
	err := s.db.SelectContext(ctx, &items,
		"SELECT id, customer_name, contact, message, image_url, is_visible, created_at FROM feedbacks WHERE is_visible = TRUE ORDER BY created_at DESC LIMIT $1", limit)
	if items == nil {
		items = make([]Feedback, 0)
	}
	return items, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Feedback, error) {
	var f Feedback
	err := s.db.GetContext(ctx, &f,
		"SELECT id, customer_name, contact, message, image_url, is_visible, created_at FROM feedbacks WHERE id = $1", id)
	return &f, err
}

func (s *Service) ToggleVisibility(ctx context.Context, id uuid.UUID) (*Feedback, error) {
	_, err := s.db.ExecContext(ctx, "UPDATE feedbacks SET is_visible = NOT is_visible WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM feedbacks WHERE id = $1", id)
	return err
}
