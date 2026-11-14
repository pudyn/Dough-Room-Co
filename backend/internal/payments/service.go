package payments

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
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

type Payment struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	OrderID          uuid.UUID  `json:"order_id" db:"order_id"`
	PaymentNumber    string     `json:"payment_number" db:"payment_number"`
	Method           string     `json:"method" db:"method"`
	Provider         *string    `json:"provider" db:"provider"`
	ProviderReference *string   `json:"provider_reference" db:"provider_reference"`
	BankAccountID    *uuid.UUID `json:"bank_account_id" db:"bank_account_id"`
	Amount           int64      `json:"amount" db:"amount"`
	Status           string     `json:"status" db:"status"`
	ProofURL         *string    `json:"proof_url" db:"proof_url"`
	ExpiresAt        *string    `json:"expires_at" db:"expires_at"`
	PaidAt           *string    `json:"paid_at" db:"paid_at"`
	CreatedAt        string     `json:"created_at" db:"created_at"`
	UpdatedAt        string     `json:"updated_at" db:"updated_at"`
}

type BankAccount struct {
	ID            uuid.UUID `json:"id" db:"id"`
	BankName      string    `json:"bank_name" db:"bank_name"`
	AccountNumber string    `json:"account_number" db:"account_number"`
	AccountHolder string    `json:"account_holder" db:"account_holder"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	CreatedAt     string    `json:"created_at" db:"created_at"`
	UpdatedAt     string    `json:"updated_at" db:"updated_at"`
}

func (s *Service) CreatePayment(ctx context.Context, orderID uuid.UUID, req CreatePaymentRequest) (*Payment, error) {
	var totalAmount int64
	err := s.db.GetContext(ctx, &totalAmount, "SELECT total_amount FROM orders WHERE id = $1", orderID)
	if err != nil {
		return nil, errors.New("order not found")
	}

	paymentNumber := shared.GeneratePaymentNumber()
	status := "PENDING"
	var expiresAt interface{}

	if req.Method == "BANK_TRANSFER" || req.Method == "QRIS" {
		expiry := time.Now().Add(60 * time.Minute)
		expiresAt = expiry
	}

	var payment Payment
	err = s.db.QueryRowxContext(ctx,
		`INSERT INTO payments (order_id, payment_number, method, bank_account_id, amount, status, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_id, payment_number, method, bank_account_id, amount, status, expires_at, created_at, updated_at`,
		orderID, paymentNumber, req.Method, req.BankAccountID, totalAmount, status, expiresAt).StructScan(&payment)
	if err != nil {
		return nil, err
	}

	s.db.ExecContext(ctx, "UPDATE orders SET payment_status = 'PENDING', updated_at = NOW() WHERE id = $1", orderID)

	return &payment, nil
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Payment, error) {
	var payment Payment
	err := s.db.GetContext(ctx, &payment,
		"SELECT id, order_id, payment_number, method, provider, provider_reference, bank_account_id, amount, status, proof_url, expires_at, paid_at, created_at, updated_at FROM payments WHERE id = $1", id)
	return &payment, err
}

func (s *Service) GetByOrderID(ctx context.Context, orderID uuid.UUID) ([]Payment, error) {
	var payments []Payment
	err := s.db.SelectContext(ctx, &payments,
		"SELECT id, order_id, payment_number, method, provider, provider_reference, bank_account_id, amount, status, proof_url, expires_at, paid_at, created_at, updated_at FROM payments WHERE order_id = $1 ORDER BY created_at DESC", orderID)
	return payments, err
}

func (s *Service) UploadProof(ctx context.Context, id uuid.UUID, proofURL string) (*Payment, error) {
	_, err := s.db.ExecContext(ctx,
		"UPDATE payments SET proof_url = $1, status = 'PENDING', updated_at = NOW() WHERE id = $2 AND status IN ('UNPAID', 'PENDING')",
		proofURL, id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *Service) Verify(ctx context.Context, id uuid.UUID, notes string, verifiedBy uuid.UUID) (*Payment, error) {
	var payment Payment
	err := s.db.GetContext(ctx, &payment, "SELECT id, order_id, status, amount FROM payments WHERE id = $1", id)
	if err != nil {
		return nil, errors.New("payment not found")
	}

	if payment.Status == "PAID" {
		return nil, errors.New("payment already verified")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	tx.ExecContext(ctx, "UPDATE payments SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = $1", id)
	tx.ExecContext(ctx, "UPDATE orders SET payment_status = 'PAID', order_status = CASE WHEN order_status = 'PENDING_PAYMENT' THEN 'CONFIRMED' ELSE order_status END, updated_at = NOW() WHERE id = $1", payment.OrderID)

	tx.ExecContext(ctx,
		"INSERT INTO order_status_histories (order_id, old_status, new_status, changed_by, notes) SELECT $1, order_status, 'CONFIRMED', $2, $3 FROM orders WHERE id = $1 AND order_status = 'PENDING_PAYMENT'",
		payment.OrderID, verifiedBy, "Payment verified: "+notes)

	tx.ExecContext(ctx,
		"INSERT INTO payment_events (payment_id, event_type, payload) VALUES ($1, 'VERIFIED', $2)",
		id, json.RawMessage(`{"verified_by":"`+verifiedBy.String()+`","notes":"`+notes+`"}`))

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) Reject(ctx context.Context, id uuid.UUID, notes string, rejectedBy uuid.UUID) (*Payment, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	tx.ExecContext(ctx, "UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1", id)

	tx.ExecContext(ctx,
		"INSERT INTO payment_events (payment_id, event_type, payload) VALUES ($1, 'REJECTED', $2)",
		id, json.RawMessage(`{"rejected_by":"`+rejectedBy.String()+`","notes":"`+notes+`"}`))

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *Service) ProcessWebhook(ctx context.Context, provider string, body []byte) error {
	s.db.ExecContext(ctx,
		"INSERT INTO payment_events (payment_id, event_type, payload) VALUES ((SELECT id FROM payments LIMIT 1), $1, $2)",
		"WEBHOOK_"+provider, body)
	return nil
}

func (s *Service) ExpirePayments(ctx context.Context) error {
	rows, err := s.db.QueryxContext(ctx,
		"SELECT id, order_id FROM payments WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < NOW()")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var p struct {
			ID      uuid.UUID `db:"id"`
			OrderID uuid.UUID `db:"order_id"`
		}
		if err := rows.StructScan(&p); err != nil {
			continue
		}

		tx, err := s.db.BeginTxx(ctx, nil)
		if err != nil {
			continue
		}

		tx.ExecContext(ctx, "UPDATE payments SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", p.ID)
		tx.ExecContext(ctx, "UPDATE orders SET payment_status = 'EXPIRED', order_status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND order_status = 'PENDING_PAYMENT'", p.OrderID)

		var items []struct {
			ProductID uuid.UUID `db:"product_id"`
			Quantity  int       `db:"quantity"`
		}
		tx.SelectContext(ctx, &items, "SELECT product_id, quantity FROM order_items WHERE order_id = $1", p.OrderID)
		for _, item := range items {
			tx.ExecContext(ctx, "UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 AND stock_tracking = TRUE", item.Quantity, item.ProductID)
			tx.ExecContext(ctx, "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id) VALUES ($1, 'RELEASE', $2, 'PAYMENT_EXPIRED', $3)",
				item.ProductID, item.Quantity, p.OrderID)
		}

		tx.ExecContext(ctx, "INSERT INTO order_status_histories (order_id, old_status, new_status, notes) VALUES ($1, 'PENDING_PAYMENT', 'EXPIRED', 'Payment expired')", p.OrderID)

		tx.Commit()
	}

	return nil
}

func (s *Service) ListBankAccounts(ctx context.Context) ([]BankAccount, error) {
	var accounts []BankAccount
	err := s.db.SelectContext(ctx, &accounts,
		"SELECT id, bank_name, account_number, account_holder, is_active, created_at, updated_at FROM payment_bank_accounts ORDER BY created_at")
	return accounts, err
}

func (s *Service) GetActiveBankAccounts(ctx context.Context) ([]BankAccount, error) {
	var accounts []BankAccount
	err := s.db.SelectContext(ctx, &accounts,
		"SELECT id, bank_name, account_number, account_holder, is_active, created_at, updated_at FROM payment_bank_accounts WHERE is_active = TRUE")
	return accounts, err
}

func (s *Service) CreateBankAccount(ctx context.Context, req BankAccountRequest) (*BankAccount, error) {
	var account BankAccount
	err := s.db.QueryRowxContext(ctx,
		"INSERT INTO payment_bank_accounts (bank_name, account_number, account_holder) VALUES ($1, $2, $3) RETURNING id, bank_name, account_number, account_holder, is_active, created_at, updated_at",
		req.BankName, req.AccountNumber, req.AccountHolder).StructScan(&account)
	return &account, err
}

func (s *Service) UpdateBankAccount(ctx context.Context, id uuid.UUID, req BankAccountRequest) (*BankAccount, error) {
	// Partial update: empty strings / nil keep the existing values, so
	// toggling is_active alone never wipes the account details.
	var account BankAccount
	err := s.db.QueryRowxContext(ctx,
		`UPDATE payment_bank_accounts SET
		   bank_name = COALESCE(NULLIF($1, ''), bank_name),
		   account_number = COALESCE(NULLIF($2, ''), account_number),
		   account_holder = COALESCE(NULLIF($3, ''), account_holder),
		   is_active = COALESCE($4, is_active),
		   updated_at = NOW()
		 WHERE id = $5
		 RETURNING id, bank_name, account_number, account_holder, is_active, created_at, updated_at`,
		req.BankName, req.AccountNumber, req.AccountHolder, req.IsActive, id).StructScan(&account)
	return &account, err
}

func (s *Service) DeleteBankAccount(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM payment_bank_accounts WHERE id = $1", id)
	if err != nil {
		if strings.Contains(err.Error(), "foreign key") {
			return errors.New("rekening sudah pernah dipakai pembayaran, nonaktifkan saja")
		}
		return err
	}
	return nil
}
