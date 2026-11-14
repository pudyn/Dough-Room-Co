package shared

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// jakarta is the business timezone used across the app (WIB).
var jakarta = func() *time.Location {
	if loc, err := time.LoadLocation("Asia/Jakarta"); err == nil {
		return loc
	}
	return time.FixedZone("WIB", 7*60*60)
}()

// Jakarta returns the business timezone (Asia/Jakarta, WIB).
func Jakarta() *time.Location { return jakarta }

// NowJakarta returns the current time in the business timezone.
func NowJakarta() time.Time { return time.Now().In(jakarta) }

// TodayJakarta returns today's date (YYYY-MM-DD) in the business timezone.
func TodayJakarta() string { return NowJakarta().Format("2006-01-02") }

func NullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func GenerateOrderNumber() string {
	now := NowJakarta()
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("ORD-%s-%s", now.Format("20060102"), strings.ToUpper(hex.EncodeToString(b)))
}

func GeneratePaymentNumber() string {
	now := NowJakarta()
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("PAY-%s-%s", now.Format("20060102"), strings.ToUpper(hex.EncodeToString(b)))
}

func GenerateAccessToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func GenerateBatchNumber() string {
	now := NowJakarta()
	b := make([]byte, 2)
	rand.Read(b)
	return fmt.Sprintf("BATCH-%s-%s", now.Format("20060102"), strings.ToUpper(hex.EncodeToString(b)))
}
