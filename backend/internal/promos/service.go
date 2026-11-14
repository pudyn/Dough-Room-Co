package promos

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

type PromoCode struct {
	ID            uuid.UUID `json:"id" db:"id"`
	Code          string    `json:"code" db:"code"`
	Name          string    `json:"name" db:"name"`
	Description   *string   `json:"description" db:"description"`
	DiscountType  string    `json:"discount_type" db:"discount_type"`
	DiscountValue int64     `json:"discount_value" db:"discount_value"`
	MinOrder      int64     `json:"min_order" db:"min_order"`
	MaxDiscount   *int64    `json:"max_discount" db:"max_discount"`
	UsageLimit    *int      `json:"usage_limit" db:"usage_limit"`
	UsageCount    int       `json:"usage_count" db:"usage_count"`
	TotalNormalAmount int64 `json:"total_normal_amount" db:"total_normal_amount"`
	TotalDiscount     int64 `json:"total_discount" db:"total_discount"`
	ValidFrom     *time.Time `json:"valid_from" db:"valid_from"`
	ValidUntil    *time.Time `json:"valid_until" db:"valid_until"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	CreatedAt     string    `json:"created_at" db:"created_at"`
	UpdatedAt     string    `json:"updated_at" db:"updated_at"`
}

type PromoUsage struct {
	ID             uuid.UUID `json:"id" db:"id"`
	PromoCodeID    uuid.UUID `json:"promo_code_id" db:"promo_code_id"`
	OrderID        uuid.UUID `json:"order_id" db:"order_id"`
	DiscountAmount int64     `json:"discount_amount" db:"discount_amount"`
	UsedAt         string    `json:"used_at" db:"used_at"`
	OrderNumber    *string   `json:"order_number,omitempty" db:"order_number"`
	CustomerName   *string   `json:"customer_name,omitempty" db:"customer_name"`
	OrderSubtotal  int64     `json:"order_subtotal" db:"order_subtotal"`
	OrderTotal     int64     `json:"order_total" db:"order_total"`
}

type PromoUsageSummary struct {
	TotalUsages       int   `json:"total_usages" db:"total_usages"`
	TotalNormalAmount int64 `json:"total_normal_amount" db:"total_normal_amount"`
	TotalDiscount     int64 `json:"total_discount" db:"total_discount"`
	TotalPaid         int64 `json:"total_paid" db:"total_paid"`
}

type CreatePromoRequest struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	DiscountType  string `json:"discount_type"`
	DiscountValue int64  `json:"discount_value"`
	MinOrder      int64  `json:"min_order"`
	MaxDiscount   *int64 `json:"max_discount"`
	UsageLimit    *int   `json:"usage_limit"`
	ValidFrom     string `json:"valid_from"`
	ValidUntil    string `json:"valid_until"`
}

func (s *Service) List(ctx context.Context, p shared.PaginationParams, search string) ([]PromoCode, int64, error) {
	query := `SELECT id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, usage_count, valid_from, valid_until, is_active, created_at, updated_at,
		COALESCE((SELECT SUM(o.subtotal) FROM promo_usages pu JOIN orders o ON o.id = pu.order_id WHERE pu.promo_code_id = promo_codes.id), 0)::bigint AS total_normal_amount,
		COALESCE((SELECT SUM(pu.discount_amount) FROM promo_usages pu WHERE pu.promo_code_id = promo_codes.id), 0)::bigint AS total_discount
		FROM promo_codes WHERE 1=1`
	countQuery := "SELECT COUNT(*) FROM promo_codes WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (code ILIKE $%d OR name ILIKE $%d)", argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (code ILIKE $%d OR name ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	var total int64
	s.db.GetContext(ctx, &total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, p.PerPage, p.Offset)

	var promos []PromoCode
	err := s.db.SelectContext(ctx, &promos, query, args...)
	if promos == nil {
		promos = make([]PromoCode, 0)
	}
	return promos, total, err
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*PromoCode, error) {
	var p PromoCode
	err := s.db.GetContext(ctx, &p, "SELECT id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, usage_count, valid_from, valid_until, is_active, created_at, updated_at FROM promo_codes WHERE id = $1", id)
	return &p, err
}

func (s *Service) Create(ctx context.Context, req CreatePromoRequest) (*PromoCode, error) {
	var validFrom, validUntil interface{}
	if req.ValidFrom != "" {
		validFrom = req.ValidFrom
	}
	if req.ValidUntil != "" {
		validUntil = req.ValidUntil
	}

	var id uuid.UUID
	err := s.db.QueryRowxContext(ctx,
		`INSERT INTO promo_codes (code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, valid_from, valid_until)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		req.Code, req.Name, shared.NullStr(req.Description), req.DiscountType, req.DiscountValue,
		req.MinOrder, req.MaxDiscount, req.UsageLimit, validFrom, validUntil).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req CreatePromoRequest) (*PromoCode, error) {
	var validFrom, validUntil interface{}
	if req.ValidFrom != "" {
		validFrom = req.ValidFrom
	}
	if req.ValidUntil != "" {
		validUntil = req.ValidUntil
	}

	_, err := s.db.ExecContext(ctx,
		`UPDATE promo_codes SET code=$1, name=$2, description=$3, discount_type=$4, discount_value=$5, min_order=$6, max_discount=$7, usage_limit=$8, valid_from=$9, valid_until=$10, updated_at=NOW() WHERE id=$11`,
		req.Code, req.Name, shared.NullStr(req.Description), req.DiscountType, req.DiscountValue,
		req.MinOrder, req.MaxDiscount, req.UsageLimit, validFrom, validUntil, id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) ToggleStatus(ctx context.Context, id uuid.UUID) (*PromoCode, error) {
	_, err := s.db.ExecContext(ctx, "UPDATE promo_codes SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM promo_codes WHERE id = $1", id)
	return err
}

func (s *Service) Validate(ctx context.Context, code string, orderAmount int64) (*PromoCode, int64, error) {
	var promo PromoCode
	err := s.db.GetContext(ctx, &promo,
		"SELECT id, code, name, description, discount_type, discount_value, min_order, max_discount, usage_limit, usage_count, valid_from, valid_until, is_active, created_at, updated_at FROM promo_codes WHERE code = $1", code)
	if err != nil {
		return nil, 0, errors.New("kode promo tidak ditemukan")
	}
	if !promo.IsActive {
		return nil, 0, errors.New("kode promo tidak aktif")
	}
	now := time.Now()
	if promo.ValidFrom != nil && now.Before(*promo.ValidFrom) {
		return nil, 0, errors.New("kode promo belum berlaku")
	}
	if promo.ValidUntil != nil && now.After(*promo.ValidUntil) {
		return nil, 0, errors.New("kode promo sudah kedaluwarsa")
	}
	if promo.UsageLimit != nil && promo.UsageCount >= *promo.UsageLimit {
		return nil, 0, errors.New("kode promo sudah mencapai batas penggunaan")
	}
	if orderAmount < promo.MinOrder {
		return nil, 0, fmt.Errorf("minimum order Rp %d", promo.MinOrder)
	}

	var discount int64
	if promo.DiscountType == "PERCENTAGE" {
		discount = orderAmount * promo.DiscountValue / 100
		if promo.MaxDiscount != nil && discount > *promo.MaxDiscount {
			discount = *promo.MaxDiscount
		}
	} else {
		discount = promo.DiscountValue
	}
	if discount > orderAmount {
		discount = orderAmount
	}

	return &promo, discount, nil
}

func (s *Service) RecordUsage(ctx context.Context, promoCodeID, orderID uuid.UUID, discountAmount int64) error {
	_, err := s.db.ExecContext(ctx,
		"INSERT INTO promo_usages (promo_code_id, order_id, discount_amount) VALUES ($1,$2,$3)",
		promoCodeID, orderID, discountAmount)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, "UPDATE promo_codes SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1", promoCodeID)
	return err
}

func (s *Service) GetUsages(ctx context.Context, promoCodeID uuid.UUID, p shared.PaginationParams) ([]PromoUsage, int64, *PromoUsageSummary, error) {
	var total int64
	s.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM promo_usages WHERE promo_code_id = $1", promoCodeID)

	var usages []PromoUsage
	err := s.db.SelectContext(ctx, &usages,
		`SELECT pu.id, pu.promo_code_id, pu.order_id, pu.discount_amount, pu.used_at,
		        o.order_number, o.customer_name, o.subtotal AS order_subtotal, o.total_amount AS order_total
		 FROM promo_usages pu
		 JOIN orders o ON pu.order_id = o.id
		 WHERE pu.promo_code_id = $1
		 ORDER BY pu.used_at DESC
		 LIMIT $2 OFFSET $3`, promoCodeID, p.PerPage, p.Offset)
	if usages == nil {
		usages = make([]PromoUsage, 0)
	}

	summary := &PromoUsageSummary{}
	s.db.GetContext(ctx, summary,
		`SELECT COUNT(*) AS total_usages,
		        COALESCE(SUM(o.subtotal), 0)::bigint AS total_normal_amount,
		        COALESCE(SUM(pu.discount_amount), 0)::bigint AS total_discount,
		        COALESCE(SUM(o.total_amount), 0)::bigint AS total_paid
		 FROM promo_usages pu
		 JOIN orders o ON pu.order_id = o.id
		 WHERE pu.promo_code_id = $1`, promoCodeID)

	return usages, total, summary, err
}
