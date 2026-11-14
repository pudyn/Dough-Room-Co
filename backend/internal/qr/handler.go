package qr

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

type CreateQRRequest struct {
	Name       string `json:"name"`
	TargetType string `json:"target_type"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	codes, err := h.service.List(c.Context())
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list QR codes", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "QR codes retrieved", codes)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateQRRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" {
		return shared.ValidationError(c, "Name is required", nil)
	}
	if req.TargetType != "STORE" && req.TargetType != "CATALOG" {
		return shared.ValidationError(c, "TargetType must be STORE or CATALOG", nil)
	}

	qrCode, err := h.service.Create(c.Context(), req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create QR code", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "QR code created", qrCode)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid QR code ID", nil)
	}
	if err := h.service.Deactivate(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to deactivate QR code", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "QR code deactivated", nil)
}
