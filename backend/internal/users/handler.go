package users

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

type CreateUserRequest struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password"`
	Roles    []string `json:"roles"`
}

type UpdateUserRequest struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password,omitempty"`
	IsActive *bool    `json:"is_active,omitempty"`
	Roles    []string `json:"roles"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	users, total, err := h.service.List(c.Context(), p)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list users", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Users retrieved", users, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return shared.ValidationError(c, "Name, email and password are required", nil)
	}

	user, err := h.service.Create(c.Context(), req)
	if err != nil {
		if err.Error() == "email already exists" {
			return shared.ErrorResponse(c, fiber.StatusConflict, "Email already exists", "DUPLICATE_EMAIL")
		}
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create user", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "User created", user)
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid user ID", nil)
	}

	user, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "User not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "User retrieved", user)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid user ID", nil)
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	user, err := h.service.Update(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to update user", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "User updated", user)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid user ID", nil)
	}

	if err := h.service.Deactivate(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to deactivate user", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "User deactivated", nil)
}
