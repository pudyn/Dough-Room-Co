package production

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

type CreateBatchRequest struct {
	ProductionDate string      `json:"production_date"`
	Notes          string      `json:"notes"`
	Items          []BatchItem `json:"items"`
}

type BatchItem struct {
	ProductID       uuid.UUID `json:"product_id"`
	PlannedQuantity int       `json:"planned_quantity"`
}

func (h *Handler) ListBatches(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	batches, total, err := h.service.ListBatches(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list batches", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Batches retrieved", batches, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) GetBatch(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid batch ID", nil)
	}
	batch, err := h.service.GetBatch(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Batch not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Batch retrieved", batch)
}

func (h *Handler) CreateBatch(c *fiber.Ctx) error {
	var req CreateBatchRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	userID := middleware.GetUserID(c)
	batch, err := h.service.CreateBatch(c.Context(), req, userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "BATCH_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Batch created", batch)
}

func (h *Handler) UpdateBatch(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid batch ID", nil)
	}
	var req CreateBatchRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	batch, err := h.service.UpdateBatch(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "BATCH_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Batch updated", batch)
}

func (h *Handler) KitchenQueue(c *fiber.Ctx) error {
	dateStr := c.Query("date")
	orders, err := h.service.KitchenQueue(c.Context(), dateStr)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get kitchen queue", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Kitchen queue retrieved", orders)
}

func (h *Handler) UpdateOrderStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid order ID", nil)
	}
	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	userID := middleware.GetUserID(c)
	if err := h.service.UpdateOrderStatus(c.Context(), id, req.Status, req.Notes, userID); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "STATUS_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order status updated", nil)
}
