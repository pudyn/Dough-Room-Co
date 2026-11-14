package pkg

import (
	"io/fs"
	"log"
	"sort"
	"strings"

	"github.com/jmoiron/sqlx"
)

func RunMigrations(db *sqlx.DB, files fs.FS) {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("migrate: failed to create schema_migrations: %v", err)
	}

	entries, err := fs.ReadDir(files, ".")
	if err != nil {
		log.Fatalf("migrate: failed to read migration dir: %v", err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var count int
		db.Get(&count, `SELECT COUNT(*) FROM schema_migrations WHERE version = $1`, name)
		if count > 0 {
			continue
		}

		content, err := fs.ReadFile(files, name)
		if err != nil {
			log.Fatalf("migrate: failed to read %s: %v", name, err)
		}

		if _, err := db.Exec(string(content)); err != nil {
			// Objects already exist = migration was applied outside tracking; record and skip.
			if isAlreadyExistsErr(err) {
				log.Printf("migrate: %s — already applied (recorded)", name)
				db.Exec(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, name)
				continue
			}
			log.Fatalf("migrate: failed to apply %s: %v", name, err)
		}

		db.Exec(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, name)
		log.Printf("migrate: applied %s", name)
	}

	log.Println("migrate: all migrations up to date")
}

func isAlreadyExistsErr(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "already exists") ||
		strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "42P07") || // duplicate_table
		strings.Contains(msg, "42710")    // duplicate_object
}
