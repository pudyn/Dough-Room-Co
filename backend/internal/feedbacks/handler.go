package feedbacks

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

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

// Create accepts a multipart form: customer_name, contact, message, optional image file.
func (h *Handler) Create(c *fiber.Ctx) error {
	name := strings.TrimSpace(c.FormValue("customer_name"))
	if name == "" {
		name = "Pelanggan"
	}
	contact := strings.TrimSpace(c.FormValue("contact"))
	message := strings.TrimSpace(c.FormValue("message"))
	if message == "" {
		return shared.ValidationError(c, "Message is required", nil)
	}

	imageURL := ""
	if file, err := c.FormFile("image"); err == nil {
		if file.Size > 5*1024*1024 {
			return shared.ValidationError(c, "File size must be less than 5MB", nil)
		}
		url, err := h.storage.Upload(c.Context(), file, "feedbacks")
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload image", "INTERNAL_ERROR")
		}
		imageURL = url
	}

	feedback, err := h.service.Create(c.Context(), name, contact, message, imageURL)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create feedback", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Feedback created", feedback)
}

func (h *Handler) ListPublic(c *fiber.Ctx) error {
	items, err := h.service.ListPublic(c.Context(), 30)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list feedback", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Feedback retrieved", items)
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	items, total, err := h.service.List(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list feedback", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Feedback retrieved", items, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Toggle(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid feedback ID", nil)
	}
	feedback, err := h.service.ToggleVisibility(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to toggle feedback", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Feedback visibility toggled", feedback)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid feedback ID", nil)
	}
	if err := h.service.Delete(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to delete feedback", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Feedback deleted", nil)
}
