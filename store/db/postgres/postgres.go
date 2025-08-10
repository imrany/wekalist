package postgres

import (
	"context"
	"database/sql"
	"log"
	"strings"

	// Import the PostgreSQL driver.
	_ "github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/imrany/wekalist/internal/profile"
	"github.com/imrany/wekalist/store"
)

type DB struct {
	db      *sql.DB
	profile *profile.Profile
}

func NewDB(profile *profile.Profile) (store.Driver, error) {
	if profile == nil {
		return nil, errors.New("profile is nil")
	}

	// Add sslmode=disable if not present in DSN for local development
	dsn := profile.DSN
	if !strings.Contains(dsn, "sslmode=") {
		separator := "?"
		if strings.Contains(dsn, "?") {
			separator = "&"
		}
		dsn = dsn + separator + "sslmode=disable"
	}

	// Open the PostgreSQL connection
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("Failed to open database: %s", err)
		return nil, errors.Wrapf(err, "failed to open database: %s", dsn)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, errors.Wrap(err, "failed to ping database")
	}

	var driver store.Driver = &DB{
		db:      db,
		profile: profile,
	}

	return driver, nil
}

func (d *DB) GetDB() *sql.DB {
	return d.db
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) IsInitialized(ctx context.Context) (bool, error) {
	var exists bool
	err := d.db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memo' AND table_type = 'BASE TABLE')").Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, "failed to check if database is initialized")
	}
	return exists, nil
}
