package dashboard

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/donutshop/backend/internal/shared"
)

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

type DashboardSummary struct {
	TodaySales         int64  `json:"today_sales" db:"today_sales"`
	TodayTransactions  int    `json:"today_transactions" db:"today_transactions"`
	TodayRevenue       int64  `json:"today_revenue" db:"today_revenue"`
	TodayCost          int64  `json:"today_cost" db:"today_cost"`
	TodayProfit        int64  `json:"today_profit"`
	PendingPayment     int    `json:"pending_payment" db:"pending_payment"`
	Processing         int    `json:"processing" db:"processing"`
	ReadyForPickup     int    `json:"ready_for_pickup" db:"ready_for_pickup"`
	ActivePOPeriods    int    `json:"active_po_periods" db:"active_po_periods"`
	LowStockCount      int    `json:"low_stock_count" db:"low_stock_count"`
}

type SalesPoint struct {
	Period  string `json:"period" db:"period"`
	Revenue int64  `json:"revenue" db:"revenue"`
	Orders  int    `json:"orders" db:"orders"`
}

type TopProduct struct {
	ProductName string `json:"product_name" db:"product_name"`
	TotalSold   int    `json:"total_sold" db:"total_sold"`
	Revenue     int64  `json:"revenue" db:"revenue"`
}

type OrderSummaryItem struct {
	Status string `json:"status" db:"status"`
	Count  int    `json:"count" db:"count"`
}

func (s *Service) Summary(ctx context.Context, dateFrom, dateTo string) (*DashboardSummary, error) {
	today := shared.TodayJakarta()
	filterStart := today
	filterEnd := today
	if dateFrom != "" {
		filterStart = dateFrom
	}
	if dateTo != "" {
		filterEnd = dateTo
	}

	summary := &DashboardSummary{}

	// Revenue: only PAID orders
	s.db.GetContext(ctx, &summary.TodaySales,
		"SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE payment_status='PAID' AND created_at::date >= $1 AND created_at::date <= $2",
		filterStart, filterEnd)

	// Transactions: all orders that were confirmed (not pending/cancelled/expired)
	s.db.GetContext(ctx, &summary.TodayTransactions,
		"SELECT COUNT(*) FROM orders WHERE order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED') AND created_at::date >= $1 AND created_at::date <= $2",
		filterStart, filterEnd)

	summary.TodayRevenue = summary.TodaySales

	s.db.GetContext(ctx, &summary.TodayCost,
		`SELECT COALESCE(SUM(oi.cost_price * oi.quantity), 0)
		 FROM order_items oi
		 JOIN orders o ON oi.order_id = o.id
		 WHERE o.payment_status='PAID' AND o.created_at::date >= $1 AND o.created_at::date <= $2`,
		filterStart, filterEnd)

	summary.TodayProfit = summary.TodayRevenue - summary.TodayCost

	s.db.GetContext(ctx, &summary.PendingPayment,
		"SELECT COUNT(*) FROM orders WHERE order_status='PENDING_PAYMENT'")

	s.db.GetContext(ctx, &summary.Processing,
		"SELECT COUNT(*) FROM orders WHERE order_status IN ('CONFIRMED','PREPARING')")

	s.db.GetContext(ctx, &summary.ReadyForPickup,
		"SELECT COUNT(*) FROM orders WHERE order_status='READY'")

	s.db.GetContext(ctx, &summary.ActivePOPeriods,
		"SELECT COUNT(*) FROM preorder_periods WHERE status='OPEN' AND close_at > NOW()")

	s.db.GetContext(ctx, &summary.LowStockCount,
		"SELECT COUNT(*) FROM products WHERE stock_tracking=TRUE AND is_active=TRUE AND stock_quantity <= low_stock_threshold")

	return summary, nil
}

func (s *Service) SalesChart(ctx context.Context, dateFrom, dateTo, groupBy string) ([]SalesPoint, error) {
	var trunc string
	switch groupBy {
	case "week":
		trunc = "week"
	case "month":
		trunc = "month"
	default:
		trunc = "day"
	}

	query := fmt.Sprintf(`
		SELECT DATE_TRUNC('%s', created_at AT TIME ZONE 'Asia/Jakarta')::date::text as period,
		       COALESCE(SUM(total_amount), 0) as revenue,
		       COUNT(*) as orders
		FROM orders
		WHERE payment_status = 'PAID'`, trunc)

	args := []interface{}{}
	argIdx := 1
	if dateFrom != "" {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		query += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	query += " GROUP BY 1 ORDER BY 1"

	var points []SalesPoint
	err := s.db.SelectContext(ctx, &points, query, args...)
	return points, err
}

func (s *Service) TopProducts(ctx context.Context, dateFrom, dateTo string) ([]TopProduct, error) {
	query := `
		SELECT oi.product_name, SUM(oi.quantity) as total_sold, SUM(oi.subtotal) as revenue
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE o.payment_status = 'PAID'`

	args := []interface{}{}
	argIdx := 1
	if dateFrom != "" {
		query += fmt.Sprintf(" AND o.created_at >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		query += fmt.Sprintf(" AND o.created_at <= $%d::date + interval '1 day'", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	query += " GROUP BY oi.product_name ORDER BY total_sold DESC LIMIT 10"

	var products []TopProduct
	err := s.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (s *Service) OrderSummary(ctx context.Context) ([]OrderSummaryItem, error) {
	var items []OrderSummaryItem
	err := s.db.SelectContext(ctx, &items,
		"SELECT order_status as status, COUNT(*) as count FROM orders WHERE order_status NOT IN ('COMPLETED','CANCELLED','EXPIRED') GROUP BY order_status")
	return items, err
}
