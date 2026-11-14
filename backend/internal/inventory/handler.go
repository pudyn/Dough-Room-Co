package inventory

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

type AdjustmentRequest struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Type      string    `json:"type"`
	Notes     string    `json:"notes"`
}

type RestockRequest struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Notes     string    `json:"notes"`
}

func (h *Handler) ListProducts(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	products, total, err := h.service.ListProducts(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list inventory", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Inventory retrieved", products, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) ListMovements(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	productID := c.Query("product_id")
	movements, total, err := h.service.ListMovements(c.Context(), p, productID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list movements", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Stock movements retrieved", movements, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Adjust(c *fiber.Ctx) error {
	var req AdjustmentRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	userID := middleware.GetUserID(c)
	err := h.service.Adjust(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "ADJUSTMENT_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Stock adjusted", nil)
}

func (h *Handler) Restock(c *fiber.Ctx) error {
	var req RestockRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Quantity <= 0 {
		return shared.ValidationError(c, "Quantity must be greater than 0", nil)
	}

	userID := middleware.GetUserID(c)
	err := h.service.Restock(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "RESTOCK_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Stock restocked", nil)
}

func (h *Handler) LowStock(c *fiber.Ctx) error {
	products, err := h.service.LowStock(c.Context())
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get low stock", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Low stock products", products)
}
