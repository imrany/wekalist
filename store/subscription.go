package store

import (
	"context"
)

// Subscription represents a push subscription
type Subscription struct {
    ID        *string           `json:"id,omitempty"`
    Endpoint  string            `json:"endpoint"`
    Username  string            `json:"username"`
    Email     string            `json:"email,omitempty"`
    Keys      map[string]string `json:"keys"`
}

type FindSubscription struct {
	ID         *int32
	Endpoint   *string
	Username   *string
}

type DeleteSubscription struct {
	Username string
}

func (s *Store) CreateSubscription(ctx context.Context, create *Subscription) (*Subscription, error) {
	return s.driver.CreateSubscription(ctx, create)
}

func (s *Store) ListSubscriptions(ctx context.Context, find *FindSubscription) ([]*Subscription, error) {
	return s.driver.ListSubscriptions(ctx, find)
}

func (s *Store) DeleteSubscription(ctx context.Context, delete *DeleteSubscription) error {
	return s.driver.DeleteSubscription(ctx, delete)
}
