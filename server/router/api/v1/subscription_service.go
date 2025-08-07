package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/SherClockHolmes/webpush-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/imrany/wekalist/proto/gen/api/v1"
	"github.com/imrany/wekalist/store"
)

func (s *APIV1Service) AddSubscription(ctx context.Context, request *v1pb.SubscriptionRequest) (*v1pb.SubscriptionResponse, error) {
    if request.Endpoint == "" || request.Username == "" {
        return wrapSubscriptionError("Endpoint and username are required", codes.InvalidArgument)
    }

    if len(request.Keys) == 0 {
        return wrapSubscriptionError("Subscription keys are required", codes.InvalidArgument)
    }

    subscription := &store.Subscription{
        Endpoint: request.Endpoint,
        Username: request.Username,
        Email:    request.Email,
        Keys:     request.Keys,
    }

    _, err := s.Store.CreateSubscription(ctx, subscription)
    if err != nil {
        log.Printf("[AddSubscription] Failed for user %s: %v", request.Username, err)
        return wrapSubscriptionError("Failed to create subscription", codes.Internal)
    }

    log.Printf("[AddSubscription] Success for user %s: %s", request.Username, request.Endpoint)
    return &v1pb.SubscriptionResponse{
        Success: true,
        Message: "Subscription added successfully",
    }, nil
}

func (s *APIV1Service) RemoveSubscription(ctx context.Context, request *v1pb.RemoveSubscriptionRequest) (*v1pb.SubscriptionResponse, error) {
    if request.Endpoint == "" || request.Username == "" {
        return wrapSubscriptionError("Endpoint and username are required", codes.InvalidArgument)
    }

    err := s.Store.DeleteSubscription(ctx, &store.DeleteSubscription{
        Username: request.Username,
        // Endpoint: request.Endpoint,
    })

    if err != nil {
        log.Printf("[RemoveSubscription] Failed for user %s: %v", request.Username, err)
        return wrapSubscriptionError("Failed to remove subscription", codes.Internal)
    }

    log.Printf("[RemoveSubscription] Success for user %s: %s", request.Username, request.Endpoint)
    return &v1pb.SubscriptionResponse{
        Success: true,
        Message: "Subscription removed successfully",
    }, nil
}

func (s *APIV1Service) SendNotification(ctx context.Context, request *v1pb.SendNotificationRequest) (*v1pb.SendNotificationResponse, error) {
    if request.Payload == nil {
        return &v1pb.SendNotificationResponse{
            Success: false,
            Message: "Notification payload is required",
        }, status.Error(codes.InvalidArgument, "missing payload")
    }

    var subscriptions []*store.Subscription
    var err error

    if request.SendToAll {
        subscriptions, err = s.Store.ListSubscriptions(ctx, nil)
    } else if request.Username != "" {
        subscriptions, err = s.Store.ListSubscriptions(ctx, &store.FindSubscription{
            Username: &request.Username,
        })
    } else if request.SendToAllExcept != "" {
        allSubscriptions, err := s.Store.ListSubscriptions(ctx, nil)
        if err != nil {
            return &v1pb.SendNotificationResponse{
                Success: false,
                Message: "Failed to retrieve subscriptions",
            }, status.Error(codes.Internal, fmt.Sprintf("database error, %s", err.Error()))
        }

        // Filter out the excluded user
        for _, sub := range allSubscriptions {
            if sub.Username != request.SendToAllExcept {
                subscriptions = append(subscriptions, sub)
            }
        }
    } else {
        return &v1pb.SendNotificationResponse{
            Success: false,
            Message: "Either username or send_to_all must be specified",
        }, status.Error(codes.InvalidArgument, "invalid request")
    }

    if err != nil {
        return &v1pb.SendNotificationResponse{
            Success: false,
            Message: "Failed to retrieve subscriptions",
        }, status.Error(codes.Internal, fmt.Sprintf("database error, %s", err.Error()))
    }

    if len(subscriptions) == 0 {
        return &v1pb.SendNotificationResponse{
            Success: false,
            Message: "No subscriptions found",
        }, nil
    }

    notificationData := map[string]interface{}{
        "title": request.Payload.Title,
        "body":  request.Payload.Body,
    }

    if request.Payload.Icon != "" {
        notificationData["icon"] = request.Payload.Icon
    }
    if request.Payload.Badge != "" {
        notificationData["badge"] = request.Payload.Badge
    }
    if request.Payload.Url != "" {
        notificationData["url"] = request.Payload.Url
    }
    if len(request.Payload.Data) > 0 {
        notificationData["data"] = request.Payload.Data
    }

    payloadJSON, err := json.Marshal(notificationData)
    if err != nil {
        return &v1pb.SendNotificationResponse{
            Success: false,
            Message: "Failed to marshal notification payload",
        }, status.Error(codes.Internal, "payload marshaling error")
    }

    var successCount int
    for _, subscription := range subscriptions {
        if err := s.sendPushNotification(subscription, payloadJSON); err != nil {
            log.Printf("[SendNotification] Failed for %s: %v", subscription.Username, err)
        } else {
            log.Printf("[SendNotification] Sent to %s (%s)", subscription.Username, subscription.Endpoint)
            successCount++
        }
    }

    return &v1pb.SendNotificationResponse{
        Success:         successCount > 0,
        Message:         fmt.Sprintf("Sent %d/%d notifications successfully", successCount, len(subscriptions)),
        RecipientsCount: int32(successCount),
    }, nil
}

func (s *APIV1Service) sendPushNotification(subscription *store.Subscription, payload []byte) error {
    sub := &webpush.Subscription{
        Endpoint: subscription.Endpoint,
        Keys: webpush.Keys{
            P256dh: subscription.Keys["p256dh"],
            Auth:   subscription.Keys["auth"],
        },
    }

    resp, err := webpush.SendNotification(payload, sub, &webpush.Options{
        TTL:             60,
        VAPIDPublicKey:  s.Profile.WebPushConfig.VAPIDPublicKey,
        VAPIDPrivateKey: s.Profile.WebPushConfig.VAPIDPrivateKey,
    })
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    return nil
}

func wrapSubscriptionError(msg string, code codes.Code) (*v1pb.SubscriptionResponse, error) {
    return &v1pb.SubscriptionResponse{
        Success: false,
        Message: msg,
    }, status.Error(code, msg)
}
