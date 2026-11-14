package reports

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

type SalesDataPoint struct {
	Period  string `json:"period" db:"period"`
	Orders  int    `json:"orders" db:"total_orders"`
	Revenue int64  `json:"revenue" db:"total_amount"`
}

type SalesSummary struct {
	TotalRevenue  int64 `json:"total_revenue" db:"total_revenue"`
	TotalOrders   int   `json:"total_orders" db:"total_orders"`
	AvgOrderValue int64 `json:"avg_order_value" db:"avg_order_value"`
	TotalItems    int   `json:"total_items"`
}

type ProductPerf struct {
	ProductID   string `json:"product_id" db:"product_id"`
	ProductName string `json:"product_name" db:"product_name"`
	TotalSold   int    `json:"total_sold" db:"total_sold"`
	Revenue     int64  `json:"revenue" db:"revenue"`
}

type PaymentSummary struct {
	Method      string `json:"method" db:"method"`
	TotalCount  int    `json:"total_count" db:"total_count"`
	TotalAmount int64  `json:"total_amount" db:"total_amount"`
}

func (s *Service) SalesReport(ctx context.Context, dateFrom, dateTo, groupBy string) (interface{}, error) {
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
		       COUNT(*) as total_orders,
		       COALESCE(SUM(total_amount), 0) as total_amount
		FROM orders
		WHERE order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`, trunc)

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

	var chart []SalesDataPoint
	err := s.db.SelectContext(ctx, &chart, query, args...)
	if err != nil {
		return nil, err
	}
	if chart == nil {
		chart = make([]SalesDataPoint, 0)
	}

	summaryQuery := `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0)::bigint as total_revenue,
		(CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_amount),0)/COUNT(*) ELSE 0 END)::bigint as avg_order_value
		FROM orders WHERE order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`
	summaryArgs := []interface{}{}
	sArgIdx := 1
	if dateFrom != "" {
		summaryQuery += fmt.Sprintf(" AND created_at >= $%d", sArgIdx)
		summaryArgs = append(summaryArgs, dateFrom)
		sArgIdx++
	}
	if dateTo != "" {
		summaryQuery += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", sArgIdx)
		summaryArgs = append(summaryArgs, dateTo)
	}

	var summary SalesSummary
	s.db.GetContext(ctx, &summary, summaryQuery, summaryArgs...)

	var totalItems int
	itemsQuery := `SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON oi.order_id = o.id
		WHERE o.order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`
	itemsArgs := []interface{}{}
	iArgIdx := 1
	if dateFrom != "" {
		itemsQuery += fmt.Sprintf(" AND o.created_at >= $%d", iArgIdx)
		itemsArgs = append(itemsArgs, dateFrom)
		iArgIdx++
	}
	if dateTo != "" {
		itemsQuery += fmt.Sprintf(" AND o.created_at <= $%d::date + interval '1 day'", iArgIdx)
		itemsArgs = append(itemsArgs, dateTo)
	}
	s.db.GetContext(ctx, &totalItems, itemsQuery, itemsArgs...)
	summary.TotalItems = totalItems

	return map[string]interface{}{
		"summary": summary,
		"chart":   chart,
	}, nil
}

func (s *Service) ProductPerformance(ctx context.Context, dateFrom, dateTo string) (interface{}, error) {
	query := `
		SELECT oi.product_id::text, oi.product_name, SUM(oi.quantity) as total_sold, SUM(oi.subtotal) as revenue
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE o.order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`

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

	query += " GROUP BY oi.product_id, oi.product_name ORDER BY total_sold DESC LIMIT 50"

	var data []ProductPerf
	err := s.db.SelectContext(ctx, &data, query, args...)
	if data == nil {
		data = make([]ProductPerf, 0)
	}
	return map[string]interface{}{
		"by_quantity": data,
	}, err
}

type PaymentMethodRow struct {
	PaymentMethod string `json:"payment_method" db:"method"`
	Count         int    `json:"count" db:"total_count"`
	Amount        int64  `json:"amount" db:"total_amount"`
}

type SourceRow struct {
	Source string `json:"source" db:"source"`
	Count  int    `json:"count" db:"total_count"`
	Amount int64  `json:"amount" db:"total_amount"`
}

func (s *Service) PaymentReport(ctx context.Context, dateFrom, dateTo string) (interface{}, error) {
	methodQuery := `
		SELECT p.method, COUNT(*) as total_count, COALESCE(SUM(p.amount), 0) as total_amount
		FROM payments p JOIN orders o ON p.order_id = o.id
		WHERE o.order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`

	args := []interface{}{}
	argIdx := 1
	if dateFrom != "" {
		methodQuery += fmt.Sprintf(" AND o.created_at >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		methodQuery += fmt.Sprintf(" AND o.created_at <= $%d::date + interval '1 day'", argIdx)
		args = append(args, dateTo)
	}
	methodQuery += " GROUP BY p.method ORDER BY total_amount DESC"

	var byMethod []PaymentMethodRow
	s.db.SelectContext(ctx, &byMethod, methodQuery, args...)
	if byMethod == nil {
		byMethod = make([]PaymentMethodRow, 0)
	}

	sourceQuery := `
		SELECT source, COUNT(*) as total_count, COALESCE(SUM(total_amount), 0) as total_amount
		FROM orders WHERE order_status NOT IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`
	sArgs := []interface{}{}
	sArgIdx := 1
	if dateFrom != "" {
		sourceQuery += fmt.Sprintf(" AND created_at >= $%d", sArgIdx)
		sArgs = append(sArgs, dateFrom)
		sArgIdx++
	}
	if dateTo != "" {
		sourceQuery += fmt.Sprintf(" AND created_at <= $%d::date + interval '1 day'", sArgIdx)
		sArgs = append(sArgs, dateTo)
	}
	sourceQuery += " GROUP BY source ORDER BY total_amount DESC"

	var bySource []SourceRow
	s.db.SelectContext(ctx, &bySource, sourceQuery, sArgs...)
	if bySource == nil {
		bySource = make([]SourceRow, 0)
	}

	return map[string]interface{}{
		"by_method": byMethod,
		"by_source": bySource,
	}, nil
}

func (s *Service) PreorderReport(ctx context.Context, dateFrom, dateTo string) (interface{}, error) {
	query := `
		SELECT pp.id::text, pp.name, pp.production_date,
		       COUNT(DISTINCT o.id) as total_orders,
		       COALESCE(SUM(o.total_amount), 0) as total_amount
		FROM preorder_periods pp
		LEFT JOIN orders o ON o.preorder_period_id = pp.id AND o.payment_status = 'PAID'
		WHERE 1=1`

	args := []interface{}{}
	argIdx := 1
	if dateFrom != "" {
		query += fmt.Sprintf(" AND pp.production_date >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		query += fmt.Sprintf(" AND pp.production_date <= $%d", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	query += " GROUP BY pp.id ORDER BY pp.production_date DESC"

	rows, err := s.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []map[string]interface{}
	for rows.Next() {
		m := make(map[string]interface{})
		rows.MapScan(m)
		data = append(data, m)
	}
	return data, nil
}

func (s *Service) InventoryReport(ctx context.Context) (interface{}, error) {
	rows, err := s.db.QueryxContext(ctx, `
		SELECT p.id::text, p.sku, p.name, p.stock_quantity, p.low_stock_threshold,
		       CASE WHEN p.stock_quantity <= p.low_stock_threshold THEN true ELSE false END as is_low_stock
		FROM products p
		WHERE p.stock_tracking = TRUE AND p.is_active = TRUE
		ORDER BY p.stock_quantity ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []map[string]interface{}
	for rows.Next() {
		m := make(map[string]interface{})
		rows.MapScan(m)
		data = append(data, m)
	}
	return data, nil
}

func (s *Service) CashierReport(ctx context.Context, dateFrom, dateTo string) (interface{}, error) {
	query := `
		SELECT u.name as cashier_name,
		       COUNT(DISTINCT o.id) as total_transactions,
		       COALESCE(SUM(o.total_amount), 0) as total_amount
		FROM orders o
		JOIN order_status_histories osh ON osh.order_id = o.id AND osh.new_status = 'CONFIRMED'
		JOIN users u ON u.id = osh.changed_by
		WHERE o.source = 'POS' AND o.payment_status = 'PAID'`

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

	query += " GROUP BY u.name ORDER BY total_amount DESC"

	rows, err := s.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []map[string]interface{}
	for rows.Next() {
		m := make(map[string]interface{})
		rows.MapScan(m)
		data = append(data, m)
	}
	return data, nil
}
