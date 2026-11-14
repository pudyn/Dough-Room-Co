package payments

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/donutshop/backend/internal/middleware"
	"github.com/donutshop/backend/internal/shared"
	"github.com/donutshop/backend/pkg"
)

type Handler struct {
	service *Service
	storage *pkg.Storage
}

func NewHandler(service *Service, storage *pkg.Storage) *Handler {
	return &Handler{service: service, storage: storage}
}

type CreatePaymentRequest struct {
	Method        string     `json:"method"`
	BankAccountID *uuid.UUID `json:"bank_account_id"`
}

type VerifyPaymentRequest struct {
	Notes string `json:"notes"`
}

func (h *Handler) CreatePayment(c *fiber.Ctx) error {
	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	var req CreatePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	payment, err := h.service.CreatePayment(c.Context(), orderID, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PAYMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Payment created", payment)
}

func (h *Handler) GetPayment(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid payment ID", nil)
	}

	payment, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Payment not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Payment retrieved", payment)
}

func (h *Handler) UploadProof(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid payment ID", nil)
	}

	file, err := c.FormFile("proof")
	if err != nil {
		return shared.ValidationError(c, "Proof file is required", nil)
	}

	if file.Size > 5*1024*1024 {
		return shared.ValidationError(c, "File size must be less than 5MB", nil)
	}

	proofURL, err := h.storage.Upload(c.Context(), file, "proofs")
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload proof", "INTERNAL_ERROR")
	}

	payment, err := h.service.UploadProof(c.Context(), id, proofURL)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PAYMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Proof uploaded", payment)
}

func (h *Handler) Verify(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid payment ID", nil)
	}

	var req VerifyPaymentRequest
	c.BodyParser(&req)

	userID := middleware.GetUserID(c)
	payment, err := h.service.Verify(c.Context(), id, req.Notes, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PAYMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Payment verified", payment)
}

func (h *Handler) Reject(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid payment ID", nil)
	}

	var req VerifyPaymentRequest
	c.BodyParser(&req)

	userID := middleware.GetUserID(c)
	payment, err := h.service.Reject(c.Context(), id, req.Notes, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PAYMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Payment rejected", payment)
}

func (h *Handler) WebhookHandler(c *fiber.Ctx) error {
	provider := c.Params("provider")
	body := c.Body()

	err := h.service.ProcessWebhook(c.Context(), provider, body)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "WEBHOOK_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Webhook processed", nil)
}

func (h *Handler) ListBankAccounts(c *fiber.Ctx) error {
	accounts, err := h.service.ListBankAccounts(c.Context())
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list bank accounts", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Bank accounts retrieved", accounts)
}

func (h *Handler) CreateBankAccount(c *fiber.Ctx) error {
	var req BankAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	account, err := h.service.CreateBankAccount(c.Context(), req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create bank account", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Bank account created", account)
}

type BankAccountRequest struct {
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountHolder string `json:"account_holder"`
	IsActive      *bool  `json:"is_active"`
}

func (h *Handler) UpdateBankAccount(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid bank account ID", nil)
	}

	var req BankAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	account, err := h.service.UpdateBankAccount(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to update bank account", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Bank account updated", account)
}

func (h *Handler) DeleteBankAccount(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid bank account ID", nil)
	}

	if err := h.service.DeleteBankAccount(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "BANK_ACCOUNT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Bank account deleted", nil)
}
