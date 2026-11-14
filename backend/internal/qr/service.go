package qr

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service struct {
	db      *sqlx.DB
	baseURL string
}

func NewService(db *sqlx.DB, baseURL string) *Service {
	return &Service{db: db, baseURL: baseURL}
}

type QRCode struct {
	ID         uuid.UUID `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Code       string    `json:"code" db:"code"`
	TargetType string    `json:"target_type" db:"target_type"`
	IsActive   bool      `json:"is_active" db:"is_active"`
	URL        string    `json:"url"`
	CreatedAt  string    `json:"created_at" db:"created_at"`
}

func (s *Service) List(ctx context.Context) ([]QRCode, error) {
	var codes []QRCode
	err := s.db.SelectContext(ctx, &codes,
		"SELECT id, name, code, target_type, is_active, created_at FROM qr_codes WHERE is_active = TRUE ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	for i := range codes {
		codes[i].URL = s.baseURL + "/menu?qr=" + codes[i].Code
	}
	return codes, nil
}

func (s *Service) Create(ctx context.Context, req CreateQRRequest) (*QRCode, error) {
	b := make([]byte, 8)
	rand.Read(b)
	code := hex.EncodeToString(b)

	var qrCode QRCode
	err := s.db.QueryRowxContext(ctx,
		"INSERT INTO qr_codes (name, code, target_type) VALUES ($1,$2,$3) RETURNING id, name, code, target_type, is_active, created_at",
		req.Name, code, req.TargetType).StructScan(&qrCode)
	if err != nil {
		return nil, err
	}
	qrCode.URL = s.baseURL + "/menu?qr=" + qrCode.Code
	return &qrCode, nil
}

func (s *Service) Resolve(ctx context.Context, code string) (*QRCode, error) {
	var qrCode QRCode
	err := s.db.GetContext(ctx, &qrCode,
		"SELECT id, name, code, target_type, is_active, created_at FROM qr_codes WHERE code = $1 AND is_active = TRUE", code)
	if err != nil {
		return nil, err
	}
	qrCode.URL = s.baseURL + "/menu?qr=" + qrCode.Code
	return &qrCode, nil
}

func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "UPDATE qr_codes SET is_active = FALSE WHERE id = $1", id)
	return err
}
