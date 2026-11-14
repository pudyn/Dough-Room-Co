package pos

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/donutshop/backend/internal/middleware"
	"github.com/donutshop/backend/internal/shared"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type POSOrderRequest struct {
	Items          []POSItemInput `json:"items"`
	DiscountAmount int64          `json:"discount_amount"`
	PromoCodeID    *uuid.UUID     `json:"promo_code_id"`
	PaymentMethod  string         `json:"payment_method"`
	CustomerName   string         `json:"customer_name"`
	Notes          string         `json:"notes"`
}

type POSItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

type OpenRegisterRequest struct {
	Name           string `json:"name"`
	OpeningBalance int64  `json:"opening_balance"`
}

type CloseRegisterRequest struct {
	ClosingBalance int64  `json:"closing_balance"`
	Notes          string `json:"notes"`
}

func (h *Handler) ListProducts(c *fiber.Ctx) error {
	search := c.Query("search")
	categoryID := c.Query("category_id")
	products, err := h.service.ListPOSProducts(c.Context(), search, categoryID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list products", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Products retrieved", products)
}

func (h *Handler) CreateOrder(c *fiber.Ctx) error {
	var req POSOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if len(req.Items) == 0 {
		return shared.ValidationError(c, "At least one item is required", nil)
	}

	userID := middleware.GetUserID(c)
	order, err := h.service.CreatePOSOrder(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "ORDER_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "POS order created", order)
}

func (h *Handler) Pay(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	var req struct {
		Method string `json:"method"`
		Amount int64  `json:"amount"`
	}
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	userID := middleware.GetUserID(c)
	order, err := h.service.ProcessPayment(c.Context(), id, req.Method, req.Amount, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PAYMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Payment processed", order)
}

func (h *Handler) ListTransactions(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	transactions, total, err := h.service.ListTransactions(c.Context(), p, dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list transactions", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Transactions retrieved", transactions, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) OpenRegister(c *fiber.Ctx) error {
	var req OpenRegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" {
		req.Name = "Kasir Utama"
	}

	userID := middleware.GetUserID(c)
	register, err := h.service.OpenRegister(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "REGISTER_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Register opened", register)
}

func (h *Handler) CloseRegister(c *fiber.Ctx) error {
	var req CloseRegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	userID := middleware.GetUserID(c)
	register, err := h.service.CloseRegister(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "REGISTER_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Register closed", register)
}

func (h *Handler) ListRegisters(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	registers, total, err := h.service.ListRegisters(c.Context(), p, dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list registers", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Registers retrieved", registers, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) CurrentRegister(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	register, err := h.service.GetCurrentRegister(c.Context(), userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "No open register found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Current register retrieved", register)
}
