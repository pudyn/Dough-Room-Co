package reports

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

func (h *Handler) Sales(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	groupBy := c.Query("group_by", "day")

	data, err := h.service.SalesReport(c.Context(), dateFrom, dateTo, groupBy)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate sales report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Sales report retrieved", data)
}

func (h *Handler) Products(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.ProductPerformance(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate product report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product report retrieved", data)
}

func (h *Handler) Payments(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.PaymentReport(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate payment report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Payment report retrieved", data)
}

func (h *Handler) Preorders(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.PreorderReport(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate preorder report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Preorder report retrieved", data)
}

func (h *Handler) Inventory(c *fiber.Ctx) error {
	data, err := h.service.InventoryReport(c.Context())
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate inventory report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Inventory report retrieved", data)
}

func (h *Handler) Cashier(c *fiber.Ctx) error {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	data, err := h.service.CashierReport(c.Context(), dateFrom, dateTo)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate cashier report", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Cashier report retrieved", data)
}
