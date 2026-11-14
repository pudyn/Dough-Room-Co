package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"

	"github.com/donutshop/backend/configs"
	"github.com/donutshop/backend/internal/middleware"
)

type Service struct {
	db  *sqlx.DB
	cfg configs.JWTConfig
}

func NewService(db *sqlx.DB, cfg configs.JWTConfig) *Service {
	return &Service{db: db, cfg: cfg}
}

type AuthResult struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int      `json:"expires_in"`
	User         UserInfo `json:"user"`
}

type UserInfo struct {
	ID    uuid.UUID `json:"id" db:"id"`
	Name  string    `json:"name" db:"name"`
	Email string    `json:"email" db:"email"`
	Roles []string  `json:"roles"`
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	var user struct {
		ID           uuid.UUID `db:"id"`
		Name         string    `db:"name"`
		Email        string    `db:"email"`
		PasswordHash string    `db:"password_hash"`
		IsActive     bool      `db:"is_active"`
	}

	err := s.db.GetContext(ctx, &user, "SELECT id, name, email, password_hash, is_active FROM users WHERE email = $1", email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if !user.IsActive {
		return nil, errors.New("account disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	roles, err := s.getUserRoles(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	accessToken, err := middleware.GenerateToken(s.cfg.Secret, user.ID, user.Email, user.Name, roles, s.cfg.Expiry)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.createRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.cfg.Expiry.Seconds()),
		User: UserInfo{
			ID:    user.ID,
			Name:  user.Name,
			Email: user.Email,
			Roles: roles,
		},
	}, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*AuthResult, error) {
	hash := hashToken(refreshToken)

	var rt struct {
		UserID    uuid.UUID `db:"user_id"`
		ExpiresAt time.Time `db:"expires_at"`
	}
	err := s.db.GetContext(ctx, &rt, "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1", hash)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	if time.Now().After(rt.ExpiresAt) {
		s.db.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", hash)
		return nil, errors.New("refresh token expired")
	}

	s.db.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", hash)

	var user struct {
		ID    uuid.UUID `db:"id"`
		Name  string    `db:"name"`
		Email string    `db:"email"`
	}
	err = s.db.GetContext(ctx, &user, "SELECT id, name, email FROM users WHERE id = $1 AND is_active = TRUE", rt.UserID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	roles, _ := s.getUserRoles(ctx, user.ID)

	accessToken, err := middleware.GenerateToken(s.cfg.Secret, user.ID, user.Email, user.Name, roles, s.cfg.Expiry)
	if err != nil {
		return nil, err
	}

	newRefresh, err := s.createRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: newRefresh,
		ExpiresIn:    int(s.cfg.Expiry.Seconds()),
		User: UserInfo{
			ID:    user.ID,
			Name:  user.Name,
			Email: user.Email,
			Roles: roles,
		},
	}, nil
}

func (s *Service) Logout(ctx context.Context, refreshToken string) {
	hash := hashToken(refreshToken)
	s.db.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE token_hash = $1", hash)
}

func (s *Service) GetUserInfo(ctx context.Context, userID uuid.UUID) (*UserInfo, error) {
	var user UserInfo
	err := s.db.GetContext(ctx, &user, "SELECT id, name, email FROM users WHERE id = $1", userID)
	if err != nil {
		return nil, err
	}

	roles, _ := s.getUserRoles(ctx, userID)
	user.Roles = roles
	return &user, nil
}

func (s *Service) getUserRoles(ctx context.Context, userID uuid.UUID) ([]string, error) {
	roles := make([]string, 0)
	err := s.db.SelectContext(ctx, &roles,
		"SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1", userID)
	return roles, err
}

func (s *Service) createRefreshToken(ctx context.Context, userID uuid.UUID) (string, error) {
	b := make([]byte, 32)
	rand.Read(b)
	token := hex.EncodeToString(b)
	hash := hashToken(token)

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, hash, time.Now().Add(s.cfg.RefreshTokenExpiry))
	if err != nil {
		return "", err
	}
	return token, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
