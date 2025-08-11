package v1

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/imrany/wekalist/internal/base"
	v1pb "github.com/imrany/wekalist/proto/gen/api/v1"
	storepb "github.com/imrany/wekalist/proto/gen/store"
	"github.com/imrany/wekalist/store"
)

func (s *APIV1Service) VerifyUser(ctx context.Context, request *v1pb.VerifyRequest) (*v1pb.VerifyResponse, error){
	if !base.EMAILMatcher.MatchString(strings.ToLower(request.Email)) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid email: %s", request.Email)
	}
	email, err := s.Store.ListUsers(ctx, &store.FindUser{
		Email: &request.Email,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to send OTP: %v", err.Error())
	}
	
	if len(email) != 0 {
		return nil, status.Errorf(codes.AlreadyExists, "failed, account already exist")
	}

	generalSettings, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get smtp configurations %v", err.Error())
	}
	smtpConfig:=SMTPConfig{
		Host: generalSettings.SmtpHost,
		Port: int(generalSettings.SmtpPort),
		Username: generalSettings.SmtpAccountUsername,
		Email: generalSettings.SmtpAccountEmail,
		Password: generalSettings.SmtpAccountPassword,
	}

	otp := GenerateOTP()
	_, err =SendOTP(request.Email, OtpPurposeVerification ,otp, smtpConfig)
	if err !=nil{
		return nil, status.Errorf(codes.Internal, "%v", err.Error())
	}

	verificationRespond := &v1pb.VerifyResponse{
		Email: request.Email,
		Otp: otp,
	}
	return verificationRespond, nil
}

func (s *APIV1Service) ListUsers(ctx context.Context, _ *v1pb.ListUsersRequest) (*v1pb.ListUsersResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}
	// TODO: Implement proper filtering, ordering, and pagination
	// For now, return all users with basic structure
	response := &v1pb.ListUsersResponse{
		Users:     []*v1pb.User{},
		TotalSize: int32(len(users)),
	}
	for _, user := range users {
		// Only include users with role user and admin
		if user.Role == store.RoleUser || user.Role == store.RoleAdmin {
			response.Users = append(response.Users, convertUserFromStore(user))
		}
	}
	return response, nil
}

func (s *APIV1Service) GetUser(ctx context.Context, request *v1pb.GetUserRequest) (*v1pb.User, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userPb := convertUserFromStore(user)

	// TODO: Implement read_mask field filtering
	// For now, return all fields

	return userPb, nil
}

func (s *APIV1Service) SearchUsers(ctx context.Context, request *v1pb.SearchUsersRequest) (*v1pb.SearchUsersResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser != nil {
		if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	// Search users by username, email, or display name
	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	var filteredUsers []*store.User
	query := strings.ToLower(request.Query)
	for _, user := range users {
		if strings.Contains(strings.ToLower(user.Username), query) ||
			strings.Contains(strings.ToLower(user.Email), query) ||
			strings.Contains(strings.ToLower(user.Nickname), query) {
			filteredUsers = append(filteredUsers, user)
		}
	}

	response := &v1pb.SearchUsersResponse{
		Users:     []*v1pb.User{},
		TotalSize: int32(len(filteredUsers)),
	}
	for _, user := range filteredUsers {
		response.Users = append(response.Users, convertUserFromStore(user))
	}
	return response, nil
}

func (s *APIV1Service) GetUserAvatar(ctx context.Context, request *v1pb.GetUserAvatarRequest) (*httpbody.HttpBody, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if user.AvatarURL == "" {
		return nil, status.Errorf(codes.NotFound, "avatar not found")
	}

	imageType, base64Data, err := extractImageInfo(user.AvatarURL)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to extract image info: %v", err)
	}
	imageData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to decode string: %v", err)
	}
	httpBody := &httpbody.HttpBody{
		ContentType: imageType,
		Data:        imageData,
	}
	return httpBody, nil
}

func (s *APIV1Service) CreateUser(ctx context.Context, request *v1pb.CreateUserRequest) (*v1pb.User, error) {
	// Check if there are any existing host users (for first-time setup detection)
	hostUserType := store.RoleHost
	existedHostUsers, err := s.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list host users: %v", err.Error())
	}

	// Determine the role to assign and check permissions
	var roleToAssign store.Role
	if len(existedHostUsers) == 0 {
		// First-time setup: create the first user as HOST (no authentication required)
		roleToAssign = store.RoleHost
	} else {
		// Regular user creation: allow unauthenticated creation of normal users
		// But if authenticated, check if user has HOST permission for any role
		currentUser, err := s.GetCurrentUser(ctx)
		if err == nil && currentUser != nil && currentUser.Role == store.RoleHost {
			// Authenticated HOST user can create users with any role specified in request
			if request.User.Role != v1pb.User_ROLE_UNSPECIFIED {
				roleToAssign = convertUserRoleToStore(request.User.Role)
			} else {
				roleToAssign = store.RoleUser
			}
		} else {
			// Unauthenticated or non-HOST users can only create normal users
			roleToAssign = store.RoleUser
		}
	}

	if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
	}

	// If validate_only is true, just validate without creating
	if request.ValidateOnly {
		// Perform validation checks without actually creating the user
		return &v1pb.User{
			Username:    request.User.Username,
			Email:       request.User.Email,
			DisplayName: request.User.DisplayName,
			Role:        convertUserRoleFromStore(roleToAssign),
		}, nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
	}

	user, err := s.Store.CreateUser(ctx, &store.User{
		Username:     request.User.Username,
		Role:         roleToAssign,
		Email:        request.User.Email,
		Nickname:     request.User.DisplayName,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user: %v", err)
	}

	return convertUserFromStore(user), nil
}

func (s *APIV1Service) UpdateUser(ctx context.Context, request *v1pb.UpdateUserRequest) (*v1pb.User, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}
	userID, err := ExtractUserIDFromName(request.User.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	// Check permission.
	// Only allow admin or self to update user.
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		// Handle allow_missing field
		if request.AllowMissing {
			// Could create user if missing, but for now return not found
			return nil, status.Errorf(codes.NotFound, "user not found")
		}
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        user.ID,
		UpdatedTs: &currentTs,
	}
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting: %v", err)
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "username":
			if workspaceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		case "display_name":
			if workspaceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.DisplayName
		case "email":
			update.Email = &request.User.Email
		case "avatar_url":
			update.AvatarURL = &request.User.AvatarUrl
		case "description":
			update.Description = &request.User.Description
		case "role":
			// Only allow admin to update role.
			if currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		case "password":
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		case "state":
			rowStatus := convertStateToStore(request.User.State)
			update.RowStatus = &rowStatus
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	updatedUser, err := s.Store.UpdateUser(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update user: %v", err)
	}

	return convertUserFromStore(updatedUser), nil
}

func (s *APIV1Service) DeleteUser(ctx context.Context, request *v1pb.DeleteUserRequest) (*emptypb.Empty, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	if err := s.Store.DeleteUser(ctx, &store.DeleteUser{
		ID: user.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete user: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func getDefaultUserSetting() *v1pb.UserSetting {
	return &v1pb.UserSetting{
		Name:           "", // Will be set by caller
		Locale:         "en",
		Appearance:     "system",
		MemoVisibility: "PRIVATE",
		Theme:          "",
		EnableNotifications: false,
		WrapperApiKey: "",
		WrapperUsageCounter: 0,
		WrapperMaxUsage: 0,
	}
}

func (s *APIV1Service) GetUserSetting(ctx context.Context, request *v1pb.GetUserSettingRequest) (*v1pb.UserSetting, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	// Only allow user to get their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user settings: %v", err)
	}

	userSettingMessage := getDefaultUserSetting()
	userSettingMessage.Name = fmt.Sprintf("users/%d", userID)

	for _, setting := range userSettings {
		if setting.Key == storepb.UserSetting_GENERAL {
			general := setting.GetGeneral()
			if general != nil {
				userSettingMessage.Locale = general.Locale
				userSettingMessage.Appearance = general.Appearance
				userSettingMessage.MemoVisibility = general.MemoVisibility
				userSettingMessage.Theme = general.Theme
				userSettingMessage.EnableNotifications = general.EnableNotifications
				userSettingMessage.WrapperApiKey = general.WrapperApiKey
				userSettingMessage.WrapperMaxUsage = general.WrapperMaxUsage
				userSettingMessage.WrapperUsageCounter = general.WrapperUsageCounter
			}
		}
	}

	// Backfill theme if empty: use workspace theme or default to "default"
	if userSettingMessage.Theme == "" {
		workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get workspace general setting: %v", err)
		}
		workspaceTheme := workspaceGeneralSetting.Theme
		if workspaceTheme == "" {
			workspaceTheme = "default"
		}
		userSettingMessage.Theme = workspaceTheme
	}

	return userSettingMessage, nil
}

func (s *APIV1Service) UpdateUserSetting(ctx context.Context, request *v1pb.UpdateUserSettingRequest) (*v1pb.UserSetting, error) {
	// Extract user ID from the setting resource name
	userID, err := ExtractUserIDFromName(request.Setting.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	// Only allow user to update their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	// Get the current general setting
	existingGeneralSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_GENERAL,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get existing general setting: %v", err)
	}

	// Create or update the general setting
	generalSetting := &storepb.GeneralUserSetting{
		Locale:         "en",
		Appearance:     "system",
		MemoVisibility: "PRIVATE",
		Theme:          "",
		EnableNotifications: false,
		WrapperApiKey: "",
		WrapperUsageCounter: 0,
		WrapperMaxUsage: 0,
	}

	// If there's an existing setting, use its values as defaults
	if existingGeneralSetting != nil && existingGeneralSetting.GetGeneral() != nil {
		existing := existingGeneralSetting.GetGeneral()
		generalSetting.Locale = existing.Locale
		generalSetting.Appearance = existing.Appearance
		generalSetting.MemoVisibility = existing.MemoVisibility
		generalSetting.Theme = existing.Theme
		generalSetting.EnableNotifications = existing.EnableNotifications
		generalSetting.WrapperApiKey = existing.WrapperApiKey
		generalSetting.WrapperMaxUsage = existing.WrapperMaxUsage
		generalSetting.WrapperUsageCounter = existing.WrapperUsageCounter
	}

	// Apply updates based on the update mask
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "locale":
			generalSetting.Locale = request.Setting.Locale
		case "appearance":
			generalSetting.Appearance = request.Setting.Appearance
		case "memo_visibility":
			generalSetting.MemoVisibility = request.Setting.MemoVisibility
		case "theme":
			generalSetting.Theme = request.Setting.Theme
		case "enable_notifications":
			generalSetting.EnableNotifications = request.Setting.EnableNotifications
		case "wrapper_api_key":
			generalSetting.WrapperApiKey = request.Setting.WrapperApiKey
		case "wrapper_max_usage":
			generalSetting.WrapperMaxUsage = request.Setting.WrapperMaxUsage
		case "wrapper_usage_counter":
			generalSetting.WrapperUsageCounter = request.Setting.WrapperUsageCounter
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	// Upsert the general setting
	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_GENERAL,
		Value: &storepb.UserSetting_General{
			General: generalSetting,
		},
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
	}

	return s.GetUserSetting(ctx, &v1pb.GetUserSettingRequest{Name: request.Setting.Name})
}

func (s *APIV1Service) ListUserAccessTokens(ctx context.Context, request *v1pb.ListUserAccessTokensRequest) (*v1pb.ListUserAccessTokensResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}

	accessTokens := []*v1pb.UserAccessToken{}
	for _, userAccessToken := range userAccessTokens {
		claims := &ClaimsMessage{}
		_, err := jwt.ParseWithClaims(userAccessToken.AccessToken, claims, func(t *jwt.Token) (any, error) {
			if t.Method.Alg() != jwt.SigningMethodHS256.Name {
				return nil, errors.Errorf("unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
			}
			if kid, ok := t.Header["kid"].(string); ok {
				if kid == "v1" {
					return []byte(s.Secret), nil
				}
			}
			return nil, errors.Errorf("unexpected access token kid=%v", t.Header["kid"])
		})
		if err != nil {
			// If the access token is invalid or expired, just ignore it.
			continue
		}

		accessTokenResponse := &v1pb.UserAccessToken{
			Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, userAccessToken.AccessToken),
			AccessToken: userAccessToken.AccessToken,
			Description: userAccessToken.Description,
			IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
		}
		if claims.ExpiresAt != nil {
			accessTokenResponse.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
		}
		accessTokens = append(accessTokens, accessTokenResponse)
	}

	// Sort by issued time in descending order.
	slices.SortFunc(accessTokens, func(i, j *v1pb.UserAccessToken) int {
		return int(i.IssuedAt.Seconds - j.IssuedAt.Seconds)
	})
	response := &v1pb.ListUserAccessTokensResponse{
		AccessTokens: accessTokens,
	}
	return response, nil
}

func (s *APIV1Service) CreateUserAccessToken(ctx context.Context, request *v1pb.CreateUserAccessTokenRequest) (*v1pb.UserAccessToken, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	expiresAt := time.Time{}
	if request.AccessToken.ExpiresAt != nil {
		expiresAt = request.AccessToken.ExpiresAt.AsTime()
	}

	accessToken, err := GenerateAccessToken(currentUser.Username, currentUser.ID, expiresAt, []byte(s.Secret))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
	}

	claims := &ClaimsMessage{}
	_, err = jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, errors.Errorf("unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
		}
		if kid, ok := t.Header["kid"].(string); ok {
			if kid == "v1" {
				return []byte(s.Secret), nil
			}
		}
		return nil, errors.Errorf("unexpected access token kid=%v", t.Header["kid"])
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to parse access token: %v", err)
	}

	// Upsert the access token to user setting store.
	if err := s.UpsertAccessTokenToStore(ctx, currentUser, accessToken, request.AccessToken.Description); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert access token to store: %v", err)
	}

	userAccessToken := &v1pb.UserAccessToken{
		Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, accessToken),
		AccessToken: accessToken,
		Description: request.AccessToken.Description,
		IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
	}
	if claims.ExpiresAt != nil {
		userAccessToken.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
	}
	return userAccessToken, nil
}

func (s *APIV1Service) DeleteUserAccessToken(ctx context.Context, request *v1pb.DeleteUserAccessTokenRequest) (*emptypb.Empty, error) {
	// Extract user ID from the access token resource name
	// Format: users/{user}/accessTokens/{access_token}
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "accessTokens" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid access token name format: %s", request.Name)
	}

	userID, err := ExtractUserIDFromName(fmt.Sprintf("users/%s", parts[1]))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	accessTokenToDelete := parts[3]

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}
	updatedUserAccessTokens := []*storepb.AccessTokensUserSetting_AccessToken{}
	for _, userAccessToken := range userAccessTokens {
		if userAccessToken.AccessToken == accessTokenToDelete {
			continue
		}
		updatedUserAccessTokens = append(updatedUserAccessTokens, userAccessToken)
	}
	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: currentUser.ID,
		Key:    storepb.UserSetting_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: updatedUserAccessTokens,
			},
		},
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListUserSessions(ctx context.Context, request *v1pb.ListUserSessionsRequest) (*v1pb.ListUserSessionsResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSessions, err := s.Store.GetUserSessions(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list sessions: %v", err)
	}

	sessions := []*v1pb.UserSession{}
	for _, userSession := range userSessions {
		sessionResponse := &v1pb.UserSession{
			Name:             fmt.Sprintf("users/%d/sessions/%s", userID, userSession.SessionId),
			SessionId:        userSession.SessionId,
			CreateTime:       userSession.CreateTime,
			LastAccessedTime: userSession.LastAccessedTime,
		}

		if userSession.ClientInfo != nil {
			sessionResponse.ClientInfo = &v1pb.UserSession_ClientInfo{
				UserAgent:  userSession.ClientInfo.UserAgent,
				IpAddress:  userSession.ClientInfo.IpAddress,
				DeviceType: userSession.ClientInfo.DeviceType,
				Os:         userSession.ClientInfo.Os,
				Browser:    userSession.ClientInfo.Browser,
			}
		}

		sessions = append(sessions, sessionResponse)
	}

	// Sort by last accessed time in descending order.
	slices.SortFunc(sessions, func(i, j *v1pb.UserSession) int {
		return int(j.LastAccessedTime.Seconds - i.LastAccessedTime.Seconds)
	})

	response := &v1pb.ListUserSessionsResponse{
		Sessions: sessions,
	}
	return response, nil
}

func (s *APIV1Service) RevokeUserSession(ctx context.Context, request *v1pb.RevokeUserSessionRequest) (*emptypb.Empty, error) {
	// Extract user ID and session ID from the session resource name
	// Format: users/{user}/sessions/{session}
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "sessions" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid session name format: %s", request.Name)
	}

	userID, err := ExtractUserIDFromName(fmt.Sprintf("users/%s", parts[1]))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	sessionIDToRevoke := parts[3]

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.RemoveUserSession(ctx, userID, sessionIDToRevoke); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to revoke session: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// UpsertUserSession adds or updates a user session.
func (s *APIV1Service) UpsertUserSession(ctx context.Context, userID int32, sessionID string, clientInfo *storepb.SessionsUserSetting_ClientInfo) error {
	session := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID,
		CreateTime:       timestamppb.Now(),
		LastAccessedTime: timestamppb.Now(),
		ClientInfo:       clientInfo,
	}

	return s.Store.AddUserSession(ctx, userID, session)
}

func (s *APIV1Service) UpsertAccessTokenToStore(ctx context.Context, user *store.User, accessToken, description string) error {
	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return errors.Wrap(err, "failed to get user access tokens")
	}
	userAccessToken := storepb.AccessTokensUserSetting_AccessToken{
		AccessToken: accessToken,
		Description: description,
	}
	userAccessTokens = append(userAccessTokens, &userAccessToken)

	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: userAccessTokens,
			},
		},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert user setting")
	}
	return nil
}

func convertUserFromStore(user *store.User) *v1pb.User {
	userpb := &v1pb.User{
		Name:        fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
		State:       convertStateFromStore(user.RowStatus),
		CreateTime:  timestamppb.New(time.Unix(user.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(user.UpdatedTs, 0)),
		Role:        convertUserRoleFromStore(user.Role),
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.Nickname,
		AvatarUrl:   user.AvatarURL,
		MemoVisibility: user.Value,
		Description: user.Description,
	}
	// Use the avatar URL instead of raw base64 image data to reduce the response size.
	if user.AvatarURL != "" {
		// Check if avatar url is base64 format.
		_, _, err := extractImageInfo(user.AvatarURL)
		if err == nil {
			userpb.AvatarUrl = fmt.Sprintf("/api/v1/%s/avatar", userpb.Name)
		} else {
			userpb.AvatarUrl = user.AvatarURL
		}
	}
	return userpb
}

func convertUserRoleFromStore(role store.Role) v1pb.User_Role {
	switch role {
	case store.RoleHost:
		return v1pb.User_HOST
	case store.RoleAdmin:
		return v1pb.User_ADMIN
	case store.RoleUser:
		return v1pb.User_USER
	default:
		return v1pb.User_ROLE_UNSPECIFIED
	}
}

func convertUserRoleToStore(role v1pb.User_Role) store.Role {
	switch role {
	case v1pb.User_HOST:
		return store.RoleHost
	case v1pb.User_ADMIN:
		return store.RoleAdmin
	case v1pb.User_USER:
		return store.RoleUser
	default:
		return store.RoleUser
	}
}

func extractImageInfo(dataURI string) (string, string, error) {
	dataURIRegex := regexp.MustCompile(`^data:(?P<type>.+);base64,(?P<base64>.+)`)
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", "", errors.New("Invalid data URI format")
	}
	imageType := matches[1]
	base64Data := matches[2]
	return imageType, base64Data, nil
}

// Helper functions for user settings

// ExtractUserIDAndSettingKeyFromName extracts user ID and setting key from resource name.
// e.g., "users/123/settings/general" -> 123, "general".
func ExtractUserIDAndSettingKeyFromName(name string) (int32, string, error) {
	// Expected format: users/{user}/settings/{setting}
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "settings" {
		return 0, "", errors.Errorf("invalid resource name format: %s", name)
	}

	userID, err := util.ConvertStringToInt32(parts[1])
	if err != nil {
		return 0, "", errors.Errorf("invalid user ID: %s", parts[1])
	}

	settingKey := parts[3]
	return userID, settingKey, nil
}

// convertSettingKeyToStore converts API setting key to store enum.
func convertSettingKeyToStore(key string) (storepb.UserSetting_Key, error) {
	switch key {
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_GENERAL)]:
		return storepb.UserSetting_GENERAL, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_SESSIONS)]:
		return storepb.UserSetting_SESSIONS, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_ACCESS_TOKENS)]:
		return storepb.UserSetting_ACCESS_TOKENS, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_WEBHOOKS)]:
		return storepb.UserSetting_WEBHOOKS, nil
	default:
		return storepb.UserSetting_KEY_UNSPECIFIED, errors.Errorf("unknown setting key: %s", key)
	}
}

// convertSettingKeyFromStore converts store enum to API setting key.
func convertSettingKeyFromStore(key storepb.UserSetting_Key) string {
	switch key {
	case storepb.UserSetting_GENERAL:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_GENERAL)]
	case storepb.UserSetting_SESSIONS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_SESSIONS)]
	case storepb.UserSetting_ACCESS_TOKENS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_ACCESS_TOKENS)]
	case storepb.UserSetting_SHORTCUTS:
		return "SHORTCUTS" // Not defined in API proto
	case storepb.UserSetting_WEBHOOKS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_WEBHOOKS)]
	default:
		return "unknown"
	}
}

// convertUserSettingFromStore converts store UserSetting to API UserSetting.
func convertUserSettingFromStore(storeSetting *storepb.UserSetting, userID int32, key storepb.UserSetting_Key) *v1pb.UserSetting {
	if storeSetting == nil {
		// Return default setting if none exists
		settingKey := convertSettingKeyFromStore(key)
		setting := &v1pb.UserSetting{
			Name: fmt.Sprintf("users/%d/settings/%s", userID, settingKey),
		}

		switch key {
		case storepb.UserSetting_GENERAL:
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		case storepb.UserSetting_SESSIONS:
			setting.Value = &v1pb.UserSetting_SessionsSetting_{
				SessionsSetting: &v1pb.UserSetting_SessionsSetting{
					Sessions: []*v1pb.UserSession{},
				},
			}
		case storepb.UserSetting_ACCESS_TOKENS:
			setting.Value = &v1pb.UserSetting_AccessTokensSetting_{
				AccessTokensSetting: &v1pb.UserSetting_AccessTokensSetting{
					AccessTokens: []*v1pb.UserAccessToken{},
				},
			}
		case storepb.UserSetting_WEBHOOKS:
			setting.Value = &v1pb.UserSetting_WebhooksSetting_{
				WebhooksSetting: &v1pb.UserSetting_WebhooksSetting{
					Webhooks: []*v1pb.UserWebhook{},
				},
			}
		}
		return setting
	}

	settingKey := convertSettingKeyFromStore(storeSetting.Key)
	setting := &v1pb.UserSetting{
		Name: fmt.Sprintf("users/%d/settings/%s", userID, settingKey),
	}

	switch storeSetting.Key {
	case storepb.UserSetting_GENERAL:
		if general := storeSetting.GetGeneral(); general != nil {
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: &v1pb.UserSetting_GeneralSetting{
					Locale:         general.Locale,
					Appearance:     general.Appearance,
					MemoVisibility: general.MemoVisibility,
					Theme:          general.Theme,
				},
			}
		} else {
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		}
	case storepb.UserSetting_SESSIONS:
		sessions := storeSetting.GetSessions()
		apiSessions := make([]*v1pb.UserSession, 0, len(sessions.Sessions))
		for _, session := range sessions.Sessions {
			apiSession := &v1pb.UserSession{
				Name:             fmt.Sprintf("users/%d/sessions/%s", userID, session.SessionId),
				SessionId:        session.SessionId,
				CreateTime:       session.CreateTime,
				LastAccessedTime: session.LastAccessedTime,
				ClientInfo: &v1pb.UserSession_ClientInfo{
					UserAgent:  session.ClientInfo.UserAgent,
					IpAddress:  session.ClientInfo.IpAddress,
					DeviceType: session.ClientInfo.DeviceType,
					Os:         session.ClientInfo.Os,
					Browser:    session.ClientInfo.Browser,
				},
			}
			apiSessions = append(apiSessions, apiSession)
		}
		setting.Value = &v1pb.UserSetting_SessionsSetting_{
			SessionsSetting: &v1pb.UserSetting_SessionsSetting{
				Sessions: apiSessions,
			},
		}
	case storepb.UserSetting_ACCESS_TOKENS:
		accessTokens := storeSetting.GetAccessTokens()
		apiTokens := make([]*v1pb.UserAccessToken, 0, len(accessTokens.AccessTokens))
		for _, token := range accessTokens.AccessTokens {
			apiToken := &v1pb.UserAccessToken{
				Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, token.AccessToken),
				AccessToken: token.AccessToken,
				Description: token.Description,
			}
			apiTokens = append(apiTokens, apiToken)
		}
		setting.Value = &v1pb.UserSetting_AccessTokensSetting_{
			AccessTokensSetting: &v1pb.UserSetting_AccessTokensSetting{
				AccessTokens: apiTokens,
			},
		}
	case storepb.UserSetting_WEBHOOKS:
		webhooks := storeSetting.GetWebhooks()
		apiWebhooks := make([]*v1pb.UserWebhook, 0, len(webhooks.Webhooks))
		for _, webhook := range webhooks.Webhooks {
			apiWebhook := &v1pb.UserWebhook{
				Name:        fmt.Sprintf("users/%d/webhooks/%s", userID, webhook.Id),
				Url:         webhook.Url,
				DisplayName: webhook.Title,
			}
			apiWebhooks = append(apiWebhooks, apiWebhook)
		}
		setting.Value = &v1pb.UserSetting_WebhooksSetting_{
			WebhooksSetting: &v1pb.UserSetting_WebhooksSetting{
				Webhooks: apiWebhooks,
			},
		}
	}

	return setting
}

// convertUserSettingToStore converts API UserSetting to store UserSetting.
func convertUserSettingToStore(apiSetting *v1pb.UserSetting, userID int32, key storepb.UserSetting_Key) (*storepb.UserSetting, error) {
	storeSetting := &storepb.UserSetting{
		UserId: userID,
		Key:    key,
	}

	switch key {
	case storepb.UserSetting_GENERAL:
		if general := apiSetting.GetGeneralSetting(); general != nil {
			storeSetting.Value = &storepb.UserSetting_General{
				General: &storepb.GeneralUserSetting{
					Locale:         general.Locale,
					Appearance:     general.Appearance,
					MemoVisibility: general.MemoVisibility,
					Theme:          general.Theme,
				},
			}
		} else {
			return nil, errors.Errorf("general setting is required")
		}
	case storepb.UserSetting_SESSIONS:
		if sessions := apiSetting.GetSessionsSetting(); sessions != nil {
			storeSessions := make([]*storepb.SessionsUserSetting_Session, 0, len(sessions.Sessions))
			for _, session := range sessions.Sessions {
				storeSession := &storepb.SessionsUserSetting_Session{
					SessionId:        session.SessionId,
					CreateTime:       session.CreateTime,
					LastAccessedTime: session.LastAccessedTime,
					ClientInfo: &storepb.SessionsUserSetting_ClientInfo{
						UserAgent:  session.ClientInfo.UserAgent,
						IpAddress:  session.ClientInfo.IpAddress,
						DeviceType: session.ClientInfo.DeviceType,
						Os:         session.ClientInfo.Os,
						Browser:    session.ClientInfo.Browser,
					},
				}
				storeSessions = append(storeSessions, storeSession)
			}
			storeSetting.Value = &storepb.UserSetting_Sessions{
				Sessions: &storepb.SessionsUserSetting{
					Sessions: storeSessions,
				},
			}
		} else {
			return nil, errors.Errorf("sessions setting is required")
		}
	case storepb.UserSetting_ACCESS_TOKENS:
		if accessTokens := apiSetting.GetAccessTokensSetting(); accessTokens != nil {
			storeTokens := make([]*storepb.AccessTokensUserSetting_AccessToken, 0, len(accessTokens.AccessTokens))
			for _, token := range accessTokens.AccessTokens {
				storeToken := &storepb.AccessTokensUserSetting_AccessToken{
					AccessToken: token.AccessToken,
					Description: token.Description,
				}
				storeTokens = append(storeTokens, storeToken)
			}
			storeSetting.Value = &storepb.UserSetting_AccessTokens{
				AccessTokens: &storepb.AccessTokensUserSetting{
					AccessTokens: storeTokens,
				},
			}
		} else {
			return nil, errors.Errorf("access tokens setting is required")
		}
	case storepb.UserSetting_WEBHOOKS:
		if webhooks := apiSetting.GetWebhooksSetting(); webhooks != nil {
			storeWebhooks := make([]*storepb.WebhooksUserSetting_Webhook, 0, len(webhooks.Webhooks))
			for _, webhook := range webhooks.Webhooks {
				storeWebhook := &storepb.WebhooksUserSetting_Webhook{
					Id:    extractWebhookIDFromName(webhook.Name),
					Title: webhook.DisplayName,
					Url:   webhook.Url,
				}
				storeWebhooks = append(storeWebhooks, storeWebhook)
			}
			storeSetting.Value = &storepb.UserSetting_Webhooks{
				Webhooks: &storepb.WebhooksUserSetting{
					Webhooks: storeWebhooks,
				},
			}
		} else {
			return nil, errors.Errorf("webhooks setting is required")
		}
	default:
		return nil, errors.Errorf("unsupported setting key: %v", key)
	}

	return storeSetting, nil
}

// extractWebhookIDFromName extracts webhook ID from resource name.
// e.g., "users/123/webhooks/webhook-id" -> "webhook-id".
func extractWebhookIDFromName(name string) string {
	parts := strings.Split(name, "/")
	if len(parts) >= 4 && parts[0] == "users" && parts[2] == "webhooks" {
		return parts[3]
	}
	return ""
}

// validateUserFilter validates the user filter string.
func (s *APIV1Service) validateUserFilter(_ context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}
	// Validate the filter.
	parsedExpr, err := filter.Parse(filterStr, filter.UserFilterCELAttributes...)
	if err != nil {
		return errors.Wrap(err, "failed to parse filter")
	}
	convertCtx := filter.NewConvertContext()

	// Determine the dialect based on the actual database driver
	var dialect filter.SQLDialect
	switch s.Profile.Driver {
	case "sqlite":
		dialect = &filter.SQLiteDialect{}
	case "mysql":
		dialect = &filter.MySQLDialect{}
	case "postgres":
		dialect = &filter.PostgreSQLDialect{}
	default:
		// Default to SQLite for unknown drivers
		dialect = &filter.SQLiteDialect{}
	}

	converter := filter.NewCommonSQLConverter(dialect)
	err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
	if err != nil {
		return errors.Wrap(err, "failed to convert filter to SQL")
	}
	return nil
}
