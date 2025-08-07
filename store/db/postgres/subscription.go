package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/imrany/wekalist/store"
)

func (d *DB) CreateSubscription(ctx context.Context, create *store.Subscription) (*store.Subscription, error) {
	// FIX: Include endpoint field and properly handle JSON keys
    keysJSON, err := json.Marshal(create.Keys)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal keys: %w", err)
    }
	
	fields := []string{"`id`", "`username`", "`email`", "`keys`", "`endpoint`"}
	
	placeholder := []string{"?", "?", "?", "?", "?"}
	args := []any{create.ID, create.Username, create.Email, string(keysJSON), create.Endpoint}

	stmt := "INSERT INTO subscription (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `username`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.Username,
	); err != nil {
		return nil, err
	}

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

	list := []*store.Subscription{}
	for rows.Next() {
		subcription := &store.Subscription{}
		if err := rows.Scan(
			&subcription.ID,
			&subcription.Endpoint,
			&subcription.Username,
			&subcription.Email,
			&subcription.Keys,
		); err != nil {
			return nil, err
		}

		list = append(list, subcription)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteSubscription(ctx context.Context, delete *store.DeleteSubscription) error {
	result, err := d.db.ExecContext(ctx, `
		DELETE FROM subscription WHERE username = ?
	`, delete.Username)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}