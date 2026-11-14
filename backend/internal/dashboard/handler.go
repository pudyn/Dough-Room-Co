package dashboard

import (
	"github.com/gofiber/fiber/v2"

	"github.com/donutshop/backend/internal/shared"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Summary(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.Summary(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get dashboard summary", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Dashboard summary retrieved", data)
}

func (h *Handler) Sales(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	groupBy := c.Query("group_by", "day")

	data, err := h.service.SalesChart(c.Context(), dateFrom, dateTo, groupBy)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get sales chart", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Sales chart retrieved", data)
}

func (h *Handler) TopProducts(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.TopProducts(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get top products", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Top products retrieved", data)
}

func (h *Handler) Orders(c *fiber.Ctx) error {
	data, err := h.service.OrderSummary(c.Context())
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get order summary", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order summary retrieved", data)
}
