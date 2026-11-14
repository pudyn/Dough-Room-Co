package preorder

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

type CreatePeriodRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	StartAt     string `json:"start_at"`
	CloseAt     string `json:"close_at"`
	ProductionDate string `json:"production_date"`
	PickupStartAt  string `json:"pickup_start_at"`
	PickupEndAt    string `json:"pickup_end_at"`
}

type UpdateQuotaRequest struct {
	Quotas []ProductQuota `json:"quotas"`
}

type ProductQuota struct {
	ProductID uuid.UUID `json:"product_id"`
	Quota     int       `json:"quota"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	periods, total, err := h.service.List(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list preorder periods", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Preorder periods retrieved", periods, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	period, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Period not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Period retrieved", period)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreatePeriodRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" {
		return shared.ValidationError(c, "Name is required", nil)
	}

	period, err := h.service.Create(c.Context(), req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PERIOD_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Preorder period created", period)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	var req CreatePeriodRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	period, err := h.service.Update(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PERIOD_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Period updated", period)
}

func (h *Handler) Open(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	userID := middleware.GetUserID(c)
	if err := h.service.SetStatus(c.Context(), id, "OPEN", userID); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "STATUS_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Preorder period opened", nil)
}

func (h *Handler) Close(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	userID := middleware.GetUserID(c)
	if err := h.service.SetStatus(c.Context(), id, "CLOSED", userID); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "STATUS_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Preorder period closed", nil)
}

func (h *Handler) ListOrders(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	p := shared.GetPagination(c)
	orders, total, err := h.service.ListOrders(c.Context(), id, p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list orders", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Orders retrieved", orders, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) ProductionSummary(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	summary, err := h.service.ProductionSummary(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get summary", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Production summary retrieved", summary)
}

func (h *Handler) UpdateQuotas(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid period ID", nil)
	}
	var req UpdateQuotaRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if err := h.service.UpdateQuotas(c.Context(), id, req.Quotas); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "QUOTA_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Quotas updated", nil)
}
