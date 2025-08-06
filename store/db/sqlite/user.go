package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/imrany/wekalist/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	fields := []string{"`username`", "`role`", "`email`", "`nickname`", "`password_hash`, `avatar_url`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}
	args := []any{create.Username, create.Role, create.Email, create.Nickname, create.PasswordHash, create.AvatarURL}
	stmt := "INSERT INTO user (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING id, description, created_ts, updated_ts, row_status"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.Description,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	set, args := []string{}, []any{}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := update.Username; v != nil {
		set, args = append(set, "username = ?"), append(args, *v)
	}
	if v := update.Email; v != nil {
		set, args = append(set, "email = ?"), append(args, *v)
	}
	if v := update.Nickname; v != nil {
		set, args = append(set, "nickname = ?"), append(args, *v)
	}
	if v := update.AvatarURL; v != nil {
		set, args = append(set, "avatar_url = ?"), append(args, *v)
	}
	if v := update.PasswordHash; v != nil {
		set, args = append(set, "password_hash = ?"), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = ?"), append(args, *v)
	}
	if v := update.Role; v != nil {
		set, args = append(set, "role = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	query := `
		UPDATE user
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, username, role, email, nickname, password_hash, avatar_url, description, created_ts, updated_ts, row_status
	`
	user := &store.User{}
	if err := d.db.QueryRowContext(ctx, query, args...).Scan(
		&user.ID,
		&user.Username,
		&user.Role,
		&user.Email,
		&user.Nickname,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Description,
		&user.CreatedTs,
		&user.UpdatedTs,
		&user.RowStatus,
	); err != nil {
		return nil, err
	}

	return user, nil
}

func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "u.id = ?"), append(args, *v)
	}
	if v := find.Username; v != nil {
		where, args = append(where, "u.username = ?"), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "u.role = ?"), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "u.email = ?"), append(args, *v)
	}
	if v := find.Nickname; v != nil {
		where, args = append(where, "u.nickname = ?"), append(args, *v)
	}

	orderBy := []string{"u.created_ts DESC", "u.row_status DESC"}
	
	// Use LEFT JOIN to include users even if they don't have a GENERAL setting
	// Use COALESCE to handle NULL values from the LEFT JOIN
	query := `
		SELECT 
			u.id,
			u.username,
			u.role,
			u.email,
			u.nickname,
			u.password_hash,
			u.avatar_url,
			u.description,
			u.created_ts,
			u.updated_ts,
			u.row_status,
			COALESCE(us.value, '') as value
		FROM user u 
		LEFT JOIN user_setting us ON u.id = us.user_id AND us.key = ?
		WHERE ` + strings.Join(where, " AND ") + ` ORDER BY ` + strings.Join(orderBy, ", ")
	
	// Add the "GENERAL" parameter at the beginning of args for the LEFT JOIN condition
	finalArgs := append([]any{"GENERAL"}, args...)
	
	if v := find.Limit; v != nil {
		query += fmt.Sprintf(" LIMIT %d", *v)
	}

	rows, err := d.db.QueryContext(ctx, query, finalArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	list := make([]*store.User, 0)
	for rows.Next() {
		user := &store.User{}
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Role,
			&user.Email,
			&user.Nickname,
			&user.PasswordHash,
			&user.AvatarURL,
			&user.Description,
			&user.CreatedTs,
			&user.UpdatedTs,
			&user.RowStatus,
			&user.Value,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}
		list = append(list, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over rows: %w", err)
	}

	return list, nil
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	result, err := d.db.ExecContext(ctx, `
		DELETE FROM user WHERE id = ?
	`, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
