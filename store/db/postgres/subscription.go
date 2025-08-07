package postgres

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/imrany/wekalist/store"
)

// JSONMap is a custom type that handles JSON marshaling/unmarshaling for map[string]string
type JSONMap map[string]string

// Scan implements the sql.Scanner interface for reading from database
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = make(map[string]string)
		return nil
	}

	var source string
	switch s := value.(type) {
	case string:
		source = s
	case []byte:
		source = string(s)
	default:
		return fmt.Errorf("cannot scan %T into JSONMap", value)
	}

	if source == "" || source == "null" {
		*j = make(map[string]string)
		return nil
	}

	var result map[string]string
	if err := json.Unmarshal([]byte(source), &result); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	*j = JSONMap(result)
	return nil
}

// Value implements the driver.Valuer interface for writing to database
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}

	result, err := json.Marshal(map[string]string(j))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return string(result), nil
}

func (d *DB) CreateSubscription(ctx context.Context, create *store.Subscription) (*store.Subscription, error) {
	// Convert Keys to JSONMap for proper handling
	jsonKeys := JSONMap(create.Keys)
	
	fields := []string{"`username`", "`email`", "`keys`", "`endpoint`"}
	
	placeholder := []string{"?", "?", "?", "?"}
	args := []any{create.Username, create.Email, jsonKeys, create.Endpoint}

	stmt := "INSERT INTO subscription (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `username`"
	var id string
	var keysJSON JSONMap

	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&id,
		&create.Username,
		&create.Endpoint,
		&create.Username,
		&create.Email,
		&keysJSON,
	); err != nil {
		return nil, err
	}

	create.ID = &id
	create.Keys = map[string]string(keysJSON)
	return create, nil
}

func (d *DB) ListSubscriptions(ctx context.Context, find *store.FindSubscription) ([]*store.Subscription, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find != nil {
        if find.ID != nil {
            where, args = append(where, "`id` = ?"), append(args, *find.ID)
        }
        if find.Endpoint != nil {
            where, args = append(where, "`endpoint` = ?"), append(args, *find.Endpoint)
        }
        if find.Username != nil {
            where, args = append(where, "`username` = ?"), append(args, *find.Username)
        }
    }

	query := "SELECT `id`, `endpoint`, `username`, `email`, `keys` FROM `subscription` WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subscriptions = []*store.Subscription{}
	for rows.Next() {
		subscription := &store.Subscription{}
		var keysJSON JSONMap
		
		if err := rows.Scan(
			&subscription.ID,
			&subscription.Endpoint,
			&subscription.Username,
			&subscription.Email,
			&keysJSON,
		); err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}
		
		// Convert JSONMap back to map[string]string
		subscription.Keys = map[string]string(keysJSON)
		subscriptions = append(subscriptions, subscription)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return subscriptions, nil
}

func (d *DB) DeleteSubscription(ctx context.Context, delete *store.DeleteSubscription) error {
	result, err := d.db.ExecContext(ctx, `
		DELETE FROM subscription WHERE username = ?
	`, delete.Username)
	if err != nil {
		return fmt.Errorf("failed to delete subscription: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no subscription found for username: %s", delete.Username)
	}

	return nil
}