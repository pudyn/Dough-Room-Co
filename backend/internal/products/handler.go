package products

import (
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

type CreateProductRequest struct {
	CategoryID       *uuid.UUID `json:"category_id"`
	SKU              string     `json:"sku"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	ImageURL         string     `json:"image_url"`
	SellingPrice     int64      `json:"selling_price"`
	CostPrice        int64      `json:"cost_price"`
	StockTracking    bool       `json:"stock_tracking"`
	StockQuantity    int        `json:"stock_quantity"`
	LowStockThreshold int      `json:"low_stock_threshold"`
	SalesModes       []string   `json:"sales_modes"`
}

type UpdateProductRequest struct {
	CategoryID       *uuid.UUID `json:"category_id"`
	SKU              string     `json:"sku"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	ImageURL         string     `json:"image_url"`
	SellingPrice     int64      `json:"selling_price"`
	CostPrice        int64      `json:"cost_price"`
	StockTracking    bool       `json:"stock_tracking"`
	LowStockThreshold int      `json:"low_stock_threshold"`
	IsActive         *bool      `json:"is_active"`
	SalesModes       []string   `json:"sales_modes"`
	TierPrices       TierPrices `json:"tier_prices"`
}

func (h *Handler) List(c *fiber.Ctx) error {
	p := shared.GetPagination(c)
	categoryID := c.Query("category_id")
	search := c.Query("search")

	products, total, err := h.service.List(c.Context(), p, categoryID, search)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to list products", "INTERNAL_ERROR")
	}
	return shared.SuccessWithMeta(c, "Products retrieved", products, shared.BuildMeta(p.Page, p.PerPage, total))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	product, err := h.service.GetByID(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Product not found", "NOT_FOUND")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product retrieved", product)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.Name == "" {
		return shared.ValidationError(c, "Product name is required", nil)
	}
	if req.SellingPrice < 0 {
		return shared.ValidationError(c, "Selling price must not be negative", nil)
	}

	product, err := h.service.Create(c.Context(), req)
	if err != nil {
		if err.Error() == "sku already exists" {
			return shared.ErrorResponse(c, fiber.StatusConflict, "SKU already exists", "DUPLICATE_SKU")
		}
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create product", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusCreated, "Product created", product)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	var req UpdateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}

	product, err := h.service.Update(c.Context(), id, req)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to update product", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product updated", product)
}

func (h *Handler) ToggleStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	product, err := h.service.ToggleStatus(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to toggle product status", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product status toggled", product)
}

func (h *Handler) ToggleRecommended(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	product, err := h.service.ToggleRecommended(c.Context(), id)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to toggle product recommendation", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product recommendation toggled", product)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	if err := h.service.Delete(c.Context(), id); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to delete product", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Product deleted", nil)
}

func (h *Handler) UploadImage(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return shared.ValidationError(c, "Invalid product ID", nil)
	}

	file, err := c.FormFile("image")
	if err != nil {
		return shared.ValidationError(c, "Image file required", nil)
	}
	if file.Size > 2*1024*1024 {
		return shared.ValidationError(c, "Image must be under 2MB", nil)
	}

	imageURL, err := h.storage.Upload(c.Context(), file, "products")
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload image", "INTERNAL_ERROR")
	}

	if err := h.service.UpdateImageURL(c.Context(), id, imageURL); err != nil {
		return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to update product image", "INTERNAL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Image uploaded", fiber.Map{"image_url": imageURL})
}
