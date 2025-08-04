package v1

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Generate AI response based on user prompt
func (s *APIV1Service) GenAi(ctx context.Context, request *v1pb.GenAiRequest) (*v1pb.GenAiResponse, error) {
	// Validate input
	if request == nil {
		return nil, status.Errorf(codes.InvalidArgument, "request cannot be nil")
	}
	prompt := request.Prompt
	if prompt == "" {
		return nil, status.Errorf(codes.InvalidArgument, "prompt cannot be empty")
	}

	// Get current user
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}

	// Get the current general setting
	existingGeneralSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &currentUser.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user settings: %v", err)
	}

	// Check usage limits
	// if existingGeneralSetting != nil && existingGeneralSetting.GetGeneral() != nil {
	// 	general := existingGeneralSetting.GetGeneral()
	// 	if general.WrapperUsageCounter >= general.WrapperMaxUsage {
	// 		return nil, status.Error(codes.ResourceExhausted, "maximum usage limit reached, please renew your API key")
	// 	}
	// }

	// Establish gRPC connection with proper credentials
	serverAddr := "localhost:8080" // Consider making this configurable
	conn, err := grpc.NewClient(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to connect to AI service: %s", err.Error())
	}
	defer conn.Close()

	// Create AI service client
	client := v1pb.NewAiServiceClient(conn)

	// Call AI service
	resp, err := client.GenAi(ctx, &v1pb.GenAiRequest{
		Prompt: request.Prompt,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate AI response: %v", err)
	}

	// Update usage counter after successful AI call
	if err := s.incrementUsageCounter(ctx, currentUser.ID, existingGeneralSetting); err != nil {
		// Log the error but don't fail the request since AI response was successful
		// Consider using a proper logger here
		// s.logger.Errorf("failed to update usage counter: %v", err)
	}

	return resp, nil
}

// incrementUsageCounter handles the logic for updating the usage counter
func (s *APIV1Service) incrementUsageCounter(ctx context.Context, userID int32, existingSetting *storepb.UserSetting) error {
	// Default settings
	generalSetting := &storepb.GeneralUserSetting{
		Locale:              "en",
		Appearance:          "system",
		MemoVisibility:      "PRIVATE",
		Theme:               "",
		EnableNotifications: false,
		WrapperApiKey:       "",
		WrapperUsageCounter: 1, // Start with 1 since this is the first usage
		WrapperMaxUsage:     100, // Default max usage, consider making configurable
	}

	// If there's an existing setting, preserve existing values and increment counter
	if existingSetting != nil && existingSetting.GetGeneral() != nil {
		existing := existingSetting.GetGeneral()
		generalSetting.Locale = existing.Locale
		generalSetting.Appearance = existing.Appearance
		generalSetting.MemoVisibility = existing.MemoVisibility
		generalSetting.Theme = existing.Theme
		generalSetting.EnableNotifications = existing.EnableNotifications
		generalSetting.WrapperApiKey = existing.WrapperApiKey
		generalSetting.WrapperMaxUsage = existing.WrapperMaxUsage
		generalSetting.WrapperUsageCounter = existing.WrapperUsageCounter + 1
	}

	// Upsert the general setting
	_, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_GENERAL,
		Value: &storepb.UserSetting_General{
			General: generalSetting,
		},
	})
	
	return err
}