package orders

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

type CreateOrderRequest struct {
	Source           string            `json:"source"`
	OrderType        string            `json:"order_type"`
	PreorderPeriodID *uuid.UUID        `json:"preorder_period_id"`
	CustomerID       *uuid.UUID        `json:"customer_id"`
	CustomerName     string            `json:"customer_name"`
	CustomerPhone    string            `json:"customer_phone"`
	CustomerEmail    string            `json:"customer_email"`
	PickupDate      string            `json:"pickup_date"`
	PickupTime      string            `json:"pickup_time"`
	Items           []OrderItemInput  `json:"items"`
	DiscountAmount  int64             `json:"discount_amount"`
	PromoCodeID     *uuid.UUID        `json:"promo_code_id"`
	PaymentMethod   string            `json:"payment_method"`
	Notes           string            `json:"notes"`
	IdempotencyKey  string            `json:"idempotency_key"`
}

type OrderItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
	Notes  string `json:"notes"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	filters := OrderFilters{
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		Source:        c.Query("source"),
		OrderType:     c.Query("order_type"),
		DateFrom:      c.Query("date_from"),
		DateTo:        c.Query("date_to"),
		Search:        c.Query("search"),
	}

	orders, total, err := h.service.List(c.Context(), p, filters)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list orders", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Orders retrieved", orders, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	order, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Order not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order retrieved", order)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if len(req.Items) == 0 {
		return shared.ValidationError(c, "At least one item is required", nil)
	}

	userID := middleware.GetUserID(c)
	order, err := h.service.Create(c.Context(), req, &userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "ORDER_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Order created", order)
}

func (h *Handler) UpdateStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	userID := middleware.GetUserID(c)
	order, err := h.service.UpdateStatus(c.Context(), id, req.Status, req.Notes, &userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "STATUS_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order status updated", order)
}

func (h *Handler) Cancel(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	var req struct {
		Notes string `json:"notes"`
	}
	c.BodyParser(&req)

	userID := middleware.GetUserID(c)
	err = h.service.Cancel(c.Context(), id, req.Notes, &userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "CANCEL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order cancelled", nil)
}

func (h *Handler) History(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}

	history, err := h.service.GetHistory(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get order history", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order history retrieved", history)
}
