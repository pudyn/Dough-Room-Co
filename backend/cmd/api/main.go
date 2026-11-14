package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/donutshop/backend/configs"
	"github.com/donutshop/backend/internal/auth"
	"github.com/donutshop/backend/migrations"
	"github.com/donutshop/backend/internal/categories"
	"github.com/donutshop/backend/internal/customers"
	"github.com/donutshop/backend/internal/dashboard"
	"github.com/donutshop/backend/internal/feedbacks"
	"github.com/donutshop/backend/internal/inventory"
	"github.com/donutshop/backend/internal/middleware"
	"github.com/donutshop/backend/internal/orders"
	"github.com/donutshop/backend/internal/payments"
	"github.com/donutshop/backend/internal/pos"
	"github.com/donutshop/backend/internal/preorder"
	"github.com/donutshop/backend/internal/production"
	"github.com/donutshop/backend/internal/products"
	"github.com/donutshop/backend/internal/promos"
	"github.com/donutshop/backend/internal/qr"
	"github.com/donutshop/backend/internal/reports"
	"github.com/donutshop/backend/internal/reviews"
	"github.com/donutshop/backend/internal/shared"
	"github.com/donutshop/backend/internal/users"
	"github.com/donutshop/backend/pkg"
)

func main() {
	cfg := configs.Load()
	db := pkg.NewDatabase(cfg.Database)
	pkg.RunMigrations(db, migrations.Files)

	// Services
	authSvc := auth.NewService(db, cfg.JWT)
	userSvc := users.NewService(db)
	categorySvc := categories.NewService(db)
	productSvc := products.NewService(db)
	customerSvc := customers.NewService(db)
	orderSvc := orders.NewService(db)
	paymentSvc := payments.NewService(db)
	inventorySvc := inventory.NewService(db)
	posSvc := pos.NewService(db)
	preorderSvc := preorder.NewService(db)
	productionSvc := production.NewService(db)
	reportSvc := reports.NewService(db)
	dashboardSvc := dashboard.NewService(db)
	storeSvc := shared.NewStoreService(db)
	storage := pkg.NewStorage()
	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	promoSvc := promos.NewService(db)
	qrSvc := qr.NewService(db, baseURL)
	reviewSvc := reviews.NewService(db)
	feedbackSvc := feedbacks.NewService(db)

	// Handlers
	authH := auth.NewHandler(authSvc)
	userH := users.NewHandler(userSvc)
	categoryH := categories.NewHandler(categorySvc)
	productH := products.NewHandler(productSvc, storage)
	customerH := customers.NewHandler(customerSvc)
	orderH := orders.NewHandler(orderSvc)
	publicOrderH := orders.NewPublicHandler(orderSvc)
	paymentH := payments.NewHandler(paymentSvc, storage)
	inventoryH := inventory.NewHandler(inventorySvc)
	posH := pos.NewHandler(posSvc)
	preorderH := preorder.NewHandler(preorderSvc)
	productionH := production.NewHandler(productionSvc)
	reportH := reports.NewHandler(reportSvc)
	dashboardH := dashboard.NewHandler(dashboardSvc)
	promoH := promos.NewHandler(promoSvc)
	qrH := qr.NewHandler(qrSvc)
	reviewH := reviews.NewHandler(reviewSvc, storage)
	feedbackH := feedbacks.NewHandler(feedbackSvc, storage)

	// Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
				"error":   fiber.Map{"code": "INTERNAL_ERROR"},
			})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, Idempotency-Key",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))

	// Payment expiry background job
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			paymentSvc.ExpirePayments(context.Background())
		}
	}()

	api := app.Group("/api/v1")

	// Auth routes
	authR := api.Group("/auth")
	authR.Post("/login", authH.Login)
	authR.Post("/refresh", authH.RefreshToken)
	authR.Post("/logout", authH.Logout)
	authR.Get("/me", middleware.AuthMiddleware(cfg.JWT.Secret), authH.Me)

	// Public endpoints (customer ordering — no auth required, rate-limited)
	pub := api.Group("/public", middleware.RateLimiter(60, time.Minute))

	pub.Get("/store", func(c *fiber.Ctx) error {
		settings, err := storeSvc.GetSettings(c.Context())
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get store info", "INTERNAL_ERROR")
		}
		bankAccounts, _ := paymentSvc.GetActiveBankAccounts(c.Context())
		return shared.SuccessResponse(c, fiber.StatusOK, "Store info retrieved", fiber.Map{
			"settings":      settings,
			"bank_accounts": bankAccounts,
		})
	})

	pub.Get("/menu", func(c *fiber.Ctx) error {
		p := shared.GetPagination(c)
		mode := c.Query("mode")
		categoryID := c.Query("category_id")
		prods, total, err := productSvc.ListPublicProducts(c.Context(), p, mode, categoryID)
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to get menu", "INTERNAL_ERROR")
		}
		return shared.SuccessWithMeta(c, "Menu retrieved", prods, shared.BuildMeta(p.Page, p.PerPage, total))
	})

	pub.Get("/menu/:id", func(c *fiber.Ctx) error {
		p, err := products.ParseUUID(c.Params("id"))
		if err != nil {
			return shared.ValidationError(c, "Invalid product ID", nil)
		}
		prod, err := productSvc.GetByID(c.Context(), p)
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusNotFound, "Product not found", "NOT_FOUND")
		}
		return shared.SuccessResponse(c, fiber.StatusOK, "Product retrieved", prod)
	})

	pub.Get("/qr/:code", func(c *fiber.Ctx) error {
		code := c.Params("code")
		qrCode, err := qrSvc.Resolve(c.Context(), code)
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusNotFound, "QR code not found", "NOT_FOUND")
		}
		return shared.SuccessResponse(c, fiber.StatusOK, "QR resolved", qrCode)
	})

	pub.Get("/preorder/active", func(c *fiber.Ctx) error {
		period, err := preorderSvc.GetOpenPeriod(c.Context())
		if err != nil {
			return shared.ErrorResponse(c, fiber.StatusNotFound, "No active preorder period", "NOT_FOUND")
		}
		return shared.SuccessResponse(c, fiber.StatusOK, "Active preorder period", period)
	})

	pub.Post("/orders", publicOrderH.CreateOrder)
	pub.Get("/orders/:token", publicOrderH.GetOrder)
	pub.Post("/orders/:token/cancel", publicOrderH.CancelOrder)

	// Public proof upload — customer uploads transfer receipt without login
	pub.Post("/payments/:id/proof", paymentH.UploadProof)
	pub.Post("/promos/validate", promoH.Validate)

	// Public reviews & feedback (kritik dan saran)
	pub.Post("/reviews", reviewH.Create)
	pub.Get("/reviews", reviewH.ListPublic)
	pub.Post("/feedbacks", feedbackH.Create)
	pub.Get("/feedbacks", feedbackH.ListPublic)

	// Payment webhook (no auth but validated by signature)
	api.Post("/webhooks/payments/:provider", paymentH.WebhookHandler)

	// Protected routes
	protected := api.Use(middleware.AuthMiddleware(cfg.JWT.Secret))

	// Dashboard
	dash := protected.Group("/dashboard")
	dash.Get("/summary", dashboardH.Summary)
	dash.Get("/sales", dashboardH.Sales)
	dash.Get("/top-products", dashboardH.TopProducts)
	dash.Get("/orders", dashboardH.Orders)

	// Store settings (admin read/write)
	api.Group("/store").Use(middleware.AuthMiddleware(cfg.JWT.Secret)).
		Get("/settings", func(c *fiber.Ctx) error {
			settings, err := storeSvc.GetSettings(c.Context())
			if err != nil {
				return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed", "INTERNAL_ERROR")
			}
			return shared.SuccessResponse(c, fiber.StatusOK, "Settings retrieved", settings)
		}).
		Post("/settings", middleware.RequireRoles("OWNER", "ADMIN"), func(c *fiber.Ctx) error {
			var body struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := c.BodyParser(&body); err != nil {
				return shared.ValidationError(c, "Invalid request", nil)
			}
			if err := storeSvc.SetSetting(c.Context(), body.Key, body.Value); err != nil {
				return shared.ErrorResponse(c, fiber.StatusInternalServerError, "Failed", "INTERNAL_ERROR")
			}
			return shared.SuccessResponse(c, fiber.StatusOK, "Setting updated", nil)
		})

	// Products
	prods := protected.Group("/products")
	prods.Get("/", productH.List)
	prods.Post("/", middleware.RequireRoles("OWNER", "ADMIN"), productH.Create)
	prods.Get("/:id", productH.Get)
	prods.Put("/:id", middleware.RequireRoles("OWNER", "ADMIN"), productH.Update)
	prods.Patch("/:id/toggle", middleware.RequireRoles("OWNER", "ADMIN"), productH.ToggleStatus)
	prods.Patch("/:id/recommended", middleware.RequireRoles("OWNER", "ADMIN"), productH.ToggleRecommended)
	prods.Delete("/:id", middleware.RequireRoles("OWNER", "ADMIN"), productH.Delete)
	prods.Post("/:id/image", middleware.RequireRoles("OWNER", "ADMIN"), productH.UploadImage)

	// Categories
	cats := protected.Group("/categories")
	cats.Get("/", categoryH.List)
	cats.Post("/", middleware.RequireRoles("OWNER", "ADMIN"), categoryH.Create)
	cats.Put("/:id", middleware.RequireRoles("OWNER", "ADMIN"), categoryH.Update)

	// Customers
	custR := protected.Group("/customers", middleware.RequireRoles("OWNER", "ADMIN", "CASHIER"))
	custR.Get("/", customerH.List)
	custR.Post("/", customerH.Create)
	custR.Get("/:id", customerH.Get)

	// Orders
	ordR := protected.Group("/orders")
	ordR.Get("/", orderH.List)
	ordR.Post("/", middleware.RequireRoles("OWNER", "ADMIN", "CASHIER"), orderH.Create)
	ordR.Get("/:id", orderH.Get)
	ordR.Patch("/:id/status", middleware.RequireRoles("OWNER", "ADMIN", "CASHIER", "KITCHEN"), orderH.UpdateStatus)
	ordR.Post("/:id/cancel", middleware.RequireRoles("OWNER", "ADMIN", "CASHIER"), orderH.Cancel)
	ordR.Get("/:id/history", orderH.History)

	// Payments
	payR := protected.Group("/payments")
	payR.Post("/orders/:id/payments", paymentH.CreatePayment)
	payR.Get("/:id", paymentH.GetPayment)
	payR.Post("/:id/proof", paymentH.UploadProof)
	payR.Post("/:id/verify", middleware.RequireRoles("OWNER", "ADMIN"), paymentH.Verify)
	payR.Post("/:id/reject", middleware.RequireRoles("OWNER", "ADMIN"), paymentH.Reject)

	// Bank accounts
	bankR := protected.Group("/bank-accounts", middleware.RequireRoles("OWNER", "ADMIN"))
	bankR.Get("/", paymentH.ListBankAccounts)
	bankR.Post("/", paymentH.CreateBankAccount)
	bankR.Put("/:id", paymentH.UpdateBankAccount)
	bankR.Delete("/:id", paymentH.DeleteBankAccount)

	// POS
	posR := protected.Group("/pos", middleware.RequireRoles("OWNER", "ADMIN", "CASHIER"))
	posR.Get("/products", posH.ListProducts)
	posR.Post("/orders", posH.CreateOrder)
	posR.Post("/orders/:id/pay", posH.Pay)
	posR.Get("/transactions", posH.ListTransactions)
	posR.Post("/registers/open", posH.OpenRegister)
	posR.Post("/registers/close", posH.CloseRegister)
	posR.Get("/registers", posH.ListRegisters)
	posR.Get("/registers/current", posH.CurrentRegister)

	// Inventory
	invR := protected.Group("/inventory")
	invR.Get("/products", inventoryH.ListProducts)
	invR.Get("/movements", inventoryH.ListMovements)
	invR.Post("/adjustments", middleware.RequireRoles("OWNER", "ADMIN"), inventoryH.Adjust)
	invR.Post("/restocks", middleware.RequireRoles("OWNER", "ADMIN"), inventoryH.Restock)
	invR.Get("/low-stock", inventoryH.LowStock)

	// Preorders
	poR := protected.Group("/preorders")
	poR.Get("/", preorderH.List)
	poR.Post("/", middleware.RequireRoles("OWNER", "ADMIN"), preorderH.Create)
	poR.Get("/:id", preorderH.Get)
	poR.Put("/:id", middleware.RequireRoles("OWNER", "ADMIN"), preorderH.Update)
	poR.Post("/:id/open", middleware.RequireRoles("OWNER", "ADMIN"), preorderH.Open)
	poR.Post("/:id/close", middleware.RequireRoles("OWNER", "ADMIN"), preorderH.Close)
	poR.Get("/:id/orders", preorderH.ListOrders)
	poR.Get("/:id/production-summary", preorderH.ProductionSummary)
	poR.Put("/:id/quotas", middleware.RequireRoles("OWNER", "ADMIN"), preorderH.UpdateQuotas)

	// Production / Kitchen
	prodR := protected.Group("/production")
	prodR.Get("/batches", middleware.RequireRoles("OWNER", "ADMIN", "KITCHEN"), productionH.ListBatches)
	prodR.Post("/batches", middleware.RequireRoles("OWNER", "ADMIN"), productionH.CreateBatch)
	prodR.Get("/batches/:id", middleware.RequireRoles("OWNER", "ADMIN", "KITCHEN"), productionH.GetBatch)
	prodR.Put("/batches/:id", middleware.RequireRoles("OWNER", "ADMIN"), productionH.UpdateBatch)
	prodR.Get("/queue", middleware.RequireRoles("OWNER", "ADMIN", "KITCHEN"), productionH.KitchenQueue)
	prodR.Patch("/orders/:id/status", middleware.RequireRoles("OWNER", "ADMIN", "KITCHEN"), productionH.UpdateOrderStatus)

	// Reports
	repR := protected.Group("/reports", middleware.RequireRoles("OWNER", "ADMIN"))
	repR.Get("/sales", reportH.Sales)
	repR.Get("/products", reportH.Products)
	repR.Get("/payments", reportH.Payments)
	repR.Get("/preorders", reportH.Preorders)
	repR.Get("/inventory", reportH.Inventory)
	repR.Get("/cashier", reportH.Cashier)

	// Users
	usrR := protected.Group("/users", middleware.RequireRoles("OWNER", "ADMIN"))
	usrR.Get("/", userH.List)
	usrR.Post("/", middleware.RequireRoles("OWNER"), userH.Create)
	usrR.Get("/:id", userH.Get)
	usrR.Put("/:id", userH.Update)
	usrR.Delete("/:id", middleware.RequireRoles("OWNER"), userH.Delete)

	// Promos
	promoR := protected.Group("/promos", middleware.RequireRoles("OWNER", "ADMIN"))
	promoR.Get("/", promoH.List)
	promoR.Post("/", promoH.Create)
	promoR.Get("/:id", promoH.Get)
	promoR.Put("/:id", promoH.Update)
	promoR.Patch("/:id/toggle", promoH.ToggleStatus)
	promoR.Delete("/:id", promoH.Delete)
	promoR.Get("/:id/usages", promoH.Usages)

	// Reviews (backoffice)
	revR := protected.Group("/reviews", middleware.RequireRoles("OWNER", "ADMIN"))
	revR.Get("/", reviewH.List)
	revR.Patch("/:id/toggle", reviewH.Toggle)
	revR.Delete("/:id", reviewH.Delete)

	// Kritik & saran (backoffice)
	fbR := protected.Group("/feedbacks", middleware.RequireRoles("OWNER", "ADMIN"))
	fbR.Get("/", feedbackH.List)
	fbR.Patch("/:id/toggle", feedbackH.Toggle)
	fbR.Delete("/:id", feedbackH.Delete)

	// QR
	qrR := protected.Group("/qr", middleware.RequireRoles("OWNER", "ADMIN"))
	qrR.Get("/", qrH.List)
	qrR.Post("/", qrH.Create)
	qrR.Delete("/:id", qrH.Delete)

	// Static file serving for uploaded images
	app.Static("/uploads", "./uploads")

	// Health
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	port := cfg.Server.Port
	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
