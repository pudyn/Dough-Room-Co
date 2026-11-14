package promos

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/donutshop/backend/internal/shared"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	search := c.Query("search")
	promos, total, err := h.service.List(c.Context(), p, search)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list promo codes", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Promo codes retrieved", promos, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid promo ID", nil)
	}
	promo, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Promo not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Promo retrieved", promo)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreatePromoRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Code == "" || req.Name == "" {
		return shared.ValidationError(c, "Code and name are required", nil)
	}
	if req.DiscountType != "PERCENTAGE" && req.DiscountType != "FIXED" {
		return shared.ValidationError(c, "Discount type must be PERCENTAGE or FIXED", nil)
	}
	if req.DiscountValue <= 0 {
		return shared.ValidationError(c, "Discount value must be greater than 0", nil)
	}

	promo, err := h.service.Create(c.Context(), req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "CREATE_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Promo created", promo)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid promo ID", nil)
	}

	var req CreatePromoRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	promo, err := h.service.Update(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to update promo", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Promo updated", promo)
}

func (h *Handler) ToggleStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid promo ID", nil)
	}

	promo, err := h.service.ToggleStatus(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to toggle promo", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Promo status toggled", promo)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid promo ID", nil)
	}
	if err := h.service.Delete(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to delete promo", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Promo deleted", nil)
}

func (h *Handler) Validate(c *fiber.Ctx) error {
	var req struct {
		Code        string `json:"code"`
		OrderAmount int64  `json:"order_amount"`
	}
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Code == "" {
		return shared.ValidationError(c, "Promo code is required", nil)
	}

	promo, discount, err := h.service.Validate(c.Context(), req.Code, req.OrderAmount)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "PROMO_INVALID")
	}

	return shared.SuccessResponse(c, fiber.StatusOK, "Promo valid", fiber.Map{
		"promo_id":      promo.ID,
		"code":          promo.Code,
		"name":          promo.Name,
		"discount_type": promo.DiscountType,
		"discount":      discount,
	})
}

func (h *Handler) Usages(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid promo ID", nil)
	}
	p := shared.GetPagination(c)
	usages, total, summary, err := h.service.GetUsages(c.Context(), id, p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list usages", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Usages retrieved", fiber.Map{
		"usages":  usages,
		"summary": summary,
	}, shared.BuildMeta(p.Page, p.PerPage, total))
}
