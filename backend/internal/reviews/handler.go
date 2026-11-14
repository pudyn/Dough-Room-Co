package reviews

import (
	"strconv"
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

// Create accepts a multipart form: customer_name, rating (1-5), comment, optional image file.
func (h *Handler) Create(c *fiber.Ctx) error {
	name := strings.TrimSpace(c.FormValue("customer_name"))
	if name == "" {
		name = "Pelanggan"
	}
	comment := strings.TrimSpace(c.FormValue("comment"))
	rating, err := strconv.Atoi(c.FormValue("rating"))
	if err != nil || rating < 1 || rating > 5 {
		return shared.ValidationError(c, "Rating must be between 1 and 5", nil)
	}

	imageURL := ""
	if file, err := c.FormFile("image"); err == nil {
		if file.Size > 5*1024*1024 {
			return shared.ValidationError(c, "File size must be less than 5MB", nil)
		}
		url, err := h.storage.Upload(c.Context(), file, "reviews")
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload image", "INTERNAL_ERROR")
		}
		imageURL = url
	}

	review, err := h.service.Create(c.Context(), name, comment, imageURL, rating)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create review", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Review created", review)
}

func (h *Handler) ListPublic(c *fiber.Ctx) error {
	items, err := h.service.ListPublic(c.Context(), 30)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list reviews", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Reviews retrieved", items)
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	items, total, err := h.service.List(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list reviews", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Reviews retrieved", items, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Toggle(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid review ID", nil)
	}
	review, err := h.service.ToggleVisibility(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to toggle review", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Review visibility toggled", review)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid review ID", nil)
	}
	if err := h.service.Delete(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to delete review", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Review deleted", nil)
}
