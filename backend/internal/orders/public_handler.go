package orders

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/donutshop/backend/internal/shared"
)

// PublicHandler handles unauthenticated customer ordering endpoints.
type PublicHandler struct {
	orderService    *Service
	productService  publicProductService
	qrService       publicQRService
	paymentService  publicPaymentService
	storeService    publicStoreService
	preorderService publicPreorderService
}

type publicProductService interface {
	ListPublicProducts(ctx interface{}, mode string) (interface{}, error)
	GetPublicProduct(ctx interface{}, id uuid.UUID) (interface{}, error)
}

type publicQRService interface {
	Resolve(ctx interface{}, code string) (interface{}, error)
}

type publicPaymentService interface {
	GetActiveBankAccounts(ctx interface{}) (interface{}, error)
}

type publicStoreService interface {
	GetSettings(ctx interface{}) (interface{}, error)
}

type publicPreorderService interface {
	GetOpenPeriod(ctx interface{}) (interface{}, error)
}

func NewPublicHandler(
	orderService *Service,
) *PublicHandler {
	return &PublicHandler{orderService: orderService}
}

type PublicCreateOrderRequest struct {
	OrderType        string            `json:"order_type"`
	PreorderPeriodID *uuid.UUID        `json:"preorder_period_id"`
	CustomerName     string            `json:"customer_name"`
	CustomerPhone    string            `json:"customer_phone"`
	CustomerEmail    string            `json:"customer_email"`
	PickupDate       string            `json:"pickup_date"`
	PickupTime       string            `json:"pickup_time"`
	Items            []OrderItemInput  `json:"items"`
	PromoCodeID      *uuid.UUID        `json:"promo_code_id"`
	PaymentMethod    string            `json:"payment_method"`
	Notes            string            `json:"notes"`
	IdempotencyKey   string            `json:"idempotency_key"`
}

func (h *PublicHandler) CreateOrder(c *fiber.Ctx) error {
	var req PublicCreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return shared.ValidationError(c, "Invalid request body", nil)
	}
	if req.CustomerName == "" {
		return shared.ValidationError(c, "Customer name is required", nil)
	}
	if req.CustomerPhone == "" {
		return shared.ValidationError(c, "Customer phone is required", nil)
	}
	if len(req.Items) == 0 {
		return shared.ValidationError(c, "At least one item is required", nil)
	}

	source := "QR_STORE"
	if c.Query("source") == "catalog" {
		source = "QR_CATALOG"
	}

	orderType := req.OrderType
	if orderType == "" {
		orderType = "READY_STOCK"
	}

	createReq := CreateOrderRequest{
		Source:           source,
		OrderType:        orderType,
		PreorderPeriodID: req.PreorderPeriodID,
		CustomerName:     req.CustomerName,
		CustomerPhone:    req.CustomerPhone,
		CustomerEmail:    req.CustomerEmail,
		PickupDate:       req.PickupDate,
		PickupTime:       req.PickupTime,
		Items:            req.Items,
		PromoCodeID:      req.PromoCodeID,
		PaymentMethod:    req.PaymentMethod,
		Notes:            req.Notes,
		IdempotencyKey:   req.IdempotencyKey,
	}

	order, err := h.orderService.Create(c.Context(), createReq, nil)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "ORDER_ERROR")
	}

	// Return limited info for public — include access token for tracking
	return shared.SuccessResponse(c, fiber.StatusCreated, "Order placed", fiber.Map{
		"order_number":   order.OrderNumber,
		"access_token":   order.AccessToken,
		"total_amount":   order.TotalAmount,
		"order_status":   order.OrderStatus,
		"payment_status": order.PaymentStatus,
	})
}

func (h *PublicHandler) GetOrder(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return shared.ValidationError(c, "Order token is required", nil)
	}

	order, err := h.orderService.GetByAccessToken(c.Context(), token)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Order not found", "NOT_FOUND")
	}

	// Don't expose internal fields like access_token in list responses
	order.AccessToken = ""
	return shared.SuccessResponse(c, fiber.StatusOK, "Order retrieved", order)
}

func (h *PublicHandler) LookupByPhone(c *fiber.Ctx) error {
	phone := c.Query("phone")
	if phone == "" {
		return shared.ValidationError(c, "Phone number is required", nil)
	}

	orders, err := h.orderService.GetByPhone(c.Context(), phone)
	if err != nil || len(orders) == 0 {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "No orders found for this phone number", "NOT_FOUND")
	}

	result := make([]fiber.Map, len(orders))
	for i, o := range orders {
		result[i] = fiber.Map{
			"order_number":   o.OrderNumber,
			"access_token":   o.AccessToken,
			"customer_name":  o.CustomerName,
			"total_amount":   o.TotalAmount,
			"order_status":   o.OrderStatus,
			"payment_status": o.PaymentStatus,
			"created_at":     o.CreatedAt,
		}
	}

	return shared.SuccessResponse(c, fiber.StatusOK, "Orders found", result)
}

func (h *PublicHandler) CancelOrder(c *fiber.Ctx) error {
	token := c.Params("token")
	var req struct {
		Notes string `json:"notes"`
	}
	c.BodyParser(&req)

	order, err := h.orderService.GetByAccessToken(c.Context(), token)
	if err != nil {
		return shared.ErrorResponse(c, fiber.StatusNotFound, "Order not found", "NOT_FOUND")
	}

	if err := h.orderService.Cancel(c.Context(), order.ID, req.Notes, nil); err != nil {
		return shared.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), "CANCEL_ERROR")
	}
	return shared.SuccessResponse(c, fiber.StatusOK, "Order cancellation requested", nil)
}
