package categories

import (
	"context"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

type Category struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description" db:"description"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   string    `json:"created_at" db:"created_at"`
	UpdatedAt   string    `json:"updated_at" db:"updated_at"`
}

func (s *Service) List(ctx context.Context) ([]Category, error) {
	var cats []Category
	err := s.db.SelectContext(ctx, &cats, "SELECT id, name, description, is_active, created_at, updated_at FROM categories ORDER BY name")
	return cats, err
}

func (s *Service) Create(ctx context.Context, req CategoryRequest) (*Category, error) {
	var cat Category
	err := s.db.QueryRowxContext(ctx,
		"INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, is_active, created_at, updated_at",
		req.Name, req.Description).StructScan(&cat)
	return &cat, err
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req CategoryRequest) (*Category, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var cat Category
	err := s.db.QueryRowxContext(ctx,
		"UPDATE categories SET name=$1, description=$2, is_active=$3, updated_at=NOW() WHERE id=$4 RETURNING id, name, description, is_active, created_at, updated_at",
		req.Name, req.Description, isActive, id).StructScan(&cat)
	return &cat, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Category, error) {
	var cat Category
	err := s.db.GetContext(ctx, &cat, "SELECT id, name, description, is_active, created_at, updated_at FROM categories WHERE id = $1", id)
	return &cat, err
}
