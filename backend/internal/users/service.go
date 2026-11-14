package users

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"

	"github.com/donutshop/backend/internal/shared"
)

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

type User struct {
	ID       uuid.UUID `json:"id" db:"id"`
	Name     string    `json:"name" db:"name"`
	Email    string    `json:"email" db:"email"`
	IsActive bool      `json:"is_active" db:"is_active"`
	Roles    []string  `json:"roles"`
	CreatedAt string   `json:"created_at" db:"created_at"`
	UpdatedAt string   `json:"updated_at" db:"updated_at"`
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams) ([]User, int64, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM users")

	var users []User
	err := s.db.SelectContext(ctx, &users,
		"SELECT id, name, email, is_active, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		p.PerPage, p.Offset)
	if err != nil {
		return nil, 0, err
	}

	for i := range users {
		roles := make([]string, 0)
		s.db.SelectContext(ctx, &roles,
			"SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1", users[i].ID)
		users[i].Roles = roles
	}

	return users, total, nil
}

func (s *Service) Create(ctx context.Context, req CreateUserRequest) (*User, error) {
	var exists bool
	s.db.GetContext(ctx, &exists, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email)
	if exists {
		return nil, errors.New("email already exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var user User
	err = tx.QueryRowxContext(ctx,
		"INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, is_active, created_at, updated_at",
		req.Name, req.Email, string(hash)).StructScan(&user)
	if err != nil {
		return nil, err
	}

	for _, roleName := range req.Roles {
		var roleID uuid.UUID
		err := tx.GetContext(ctx, &roleID, "SELECT id FROM roles WHERE name = $1", roleName)
		if err != nil {
			continue
		}
		tx.ExecContext(ctx, "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)", user.ID, roleID)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	user.Roles = req.Roles
	return &user, nil
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var user User
	err := s.db.GetContext(ctx, &user,
		"SELECT id, name, email, is_active, created_at, updated_at FROM users WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	roles := make([]string, 0)
	s.db.SelectContext(ctx, &roles,
		"SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1", id)
	user.Roles = roles

	return &user, nil
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateUserRequest) (*User, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		tx.ExecContext(ctx, "UPDATE users SET name=$1, email=$2, password_hash=$3, updated_at=NOW() WHERE id=$4",
			req.Name, req.Email, string(hash), id)
	} else {
		tx.ExecContext(ctx, "UPDATE users SET name=$1, email=$2, updated_at=NOW() WHERE id=$3",
			req.Name, req.Email, id)
	}

	if req.IsActive != nil {
		tx.ExecContext(ctx, "UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2", *req.IsActive, id)
	}

	if len(req.Roles) > 0 {
		tx.ExecContext(ctx, "DELETE FROM user_roles WHERE user_id = $1", id)
		for _, roleName := range req.Roles {
			var roleID uuid.UUID
			err := tx.GetContext(ctx, &roleID, "SELECT id FROM roles WHERE name = $1", roleName)
			if err != nil {
				continue
			}
			tx.ExecContext(ctx, "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)", id, roleID)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1", id)
	return err
}
