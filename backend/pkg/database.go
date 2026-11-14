package pkg

import (
	"log"
	"time"

	"github.com/donutshop/backend/configs"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func NewDatabase(cfg configs.DatabaseConfig) *sqlx.DB {
	var db *sqlx.DB
	var err error

	for i := range 10 {
		db, err = sqlx.Connect("postgres", cfg.DSN())
		if err == nil {
			break
		}
		log.Printf("database: attempt %d/10 failed: %v — retrying in 3s", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		log.Fatalf("database: could not connect after 10 attempts: %v", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("database connected")
	return db
}
