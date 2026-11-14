package shared

import (
	"context"

	"github.com/jmoiron/sqlx"
)

type StoreService struct {
	db *sqlx.DB
}

func NewStoreService(db *sqlx.DB) *StoreService {
	return &StoreService{db: db}
}

func (s *StoreService) GetSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryxContext(ctx, "SELECT key, value FROM store_settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		rows.Scan(&key, &value)
		settings[key] = value
	}
	return settings, nil
}

func (s *StoreService) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		"INSERT INTO store_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()",
		key, value)
	return err
}
