package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/donutshop/backend/internal/shared"
)

type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Name   string    `json:"name"`
	Roles  []string  `json:"roles"`
	jwt.RegisteredClaims
}

func AuthMiddleware(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Missing authorization header", "UNAUTHORIZED")
		}

		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Invalid authorization format", "UNAUTHORIZED")
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return shared.ErrorResponse(c, fiber.StatusUnauthorized, "Invalid or expired token", "UNAUTHORIZED")
		}

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("name", claims.Name)
		c.Locals("roles", claims.Roles)

		return c.Next()
	}
}

func RequireRoles(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userRoles, ok := c.Locals("roles").([]string)
		if !ok {
			return shared.ErrorResponse(c, fiber.StatusForbidden, "Access denied", "FORBIDDEN")
		}

		roleSet := make(map[string]bool)
		for _, r := range userRoles {
			roleSet[r] = true
		}

		for _, required := range roles {
			if roleSet[required] {
				return c.Next()
			}
		}

		return shared.ErrorResponse(c, fiber.StatusForbidden, "Insufficient permissions", "FORBIDDEN")
	}
}

func GenerateToken(secret string, userID uuid.UUID, email, name string, roles []string, expiry time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Name:   name,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func GetUserID(c *fiber.Ctx) uuid.UUID {
	id, _ := c.Locals("userID").(uuid.UUID)
	return id
}
