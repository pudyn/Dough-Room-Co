package customers

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
	customers, total, err := h.service.List(c.Context(), p, search)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list customers", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Customers retrieved", customers, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid customer ID", nil)
	}
	customer, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Customer not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Customer retrieved", customer)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" {
		return shared.ValidationError(c, "Name is required", nil)
	}
	if req.Phone == "" {
		return shared.ValidationError(c, "Phone is required", nil)
	}
	customer, err := h.service.FindOrCreate(c.Context(), req.Name, req.Phone, req.Email)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create customer", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Customer created", customer)
}
