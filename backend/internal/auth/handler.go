package auth

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

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Email == "" || req.Password == "" {
		return shared.ValidationError(c, "Email and password are required", nil)
	}

	result, err := h.service.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Invalid credentials", "INVALID_CREDENTIALS")
	}

	return shared.SuccessResponse(c, fiber.StatusOK, "Login successful", result)
}

func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	result, err := h.service.RefreshToken(c.Context(), req.RefreshToken)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Invalid refresh token", "INVALID_TOKEN")
	}

	return shared.SuccessResponse(c, fiber.StatusOK, "Token refreshed", result)
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	h.service.Logout(c.Context(), req.RefreshToken)
	return shared.SuccessResponse(c, fiber.StatusOK, "Logged out successfully", nil)
}

func (h *Handler) Me(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == uuid.Nil {
		return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Unauthorized", "UNAUTHORIZED")
	}

	user, err := h.service.GetUserInfo(c.Context(), userID)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get user info", "INTERNAL_ERROR")
	}

	return shared.SuccessResponse(c, fiber.StatusOK, "User info retrieved", user)
}
