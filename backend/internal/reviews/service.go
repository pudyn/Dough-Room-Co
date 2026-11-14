package reviews

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

type Review struct {
	ID           uuid.UUID `json:"id" db:"id"`
	CustomerName string    `json:"customer_name" db:"customer_name"`
	Rating       int       `json:"rating" db:"rating"`
	Comment      *string   `json:"comment" db:"comment"`
	ImageURL     *string   `json:"image_url" db:"image_url"`
	IsVisible    bool      `json:"is_visible" db:"is_visible"`
	CreatedAt    string    `json:"created_at" db:"created_at"`
}

func (s *Service) Create(ctx context.Context, name, comment, imageURL string, rating int) (*Review, error) {
	var r Review
	err := s.db.QueryRowxContext(ctx,
		`INSERT INTO reviews (customer_name, rating, comment, image_url) VALUES ($1,$2,$3,$4)
		 RETURNING id, customer_name, rating, comment, image_url, is_visible, created_at`,
		name, rating, shared.NullStr(comment), shared.NullStr(imageURL)).StructScan(&r)
	return &r, err
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams) ([]Review, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM reviews")

	var items []Review
	err := s.db.SelectContext(ctx, &items,
		"SELECT id, customer_name, rating, comment, image_url, is_visible, created_at FROM reviews ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		p.PerPage, p.Offset)
	if items == nil {
		items = make([]Review, 0)
	}
	return items, total, err
}

func (s *Service) ListPublic(ctx context.Context, limit int) ([]Review, error) {
	var items []Review
	err := s.db.SelectContext(ctx, &items,
		"SELECT id, customer_name, rating, comment, image_url, is_visible, created_at FROM reviews WHERE is_visible = TRUE ORDER BY created_at DESC LIMIT $1", limit)
	if items == nil {
		items = make([]Review, 0)
	}
	return items, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Review, error) {
	var r Review
	err := s.db.GetContext(ctx, &r,
		"SELECT id, customer_name, rating, comment, image_url, is_visible, created_at FROM reviews WHERE id = $1", id)
	return &r, err
}

func (s *Service) ToggleVisibility(ctx context.Context, id uuid.UUID) (*Review, error) {
	_, err := s.db.ExecContext(ctx, "UPDATE reviews SET is_visible = NOT is_visible WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM reviews WHERE id = $1", id)
	return err
}
