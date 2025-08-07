package v1

var authenticationAllowlistMethods = map[string]bool{
	"/wekalist.api.v1.WorkspaceService/GetWorkspaceProfile":          true,
	"/wekalist.api.v1.WorkspaceService/GetWorkspaceSetting":          true,
	"/wekalist.api.v1.IdentityProviderService/ListIdentityProviders": true,
	"/wekalist.api.v1.AuthService/CreateSession":                     true,
	"/wekalist.api.v1.AuthService/GetCurrentSession":                 true,
	"/wekalist.api.v1.UserService/VerifyUser":                        true,
	"/wekalist.api.v1.UserService/CreateUser":                        true,
	"/wekalist.api.v1.UserService/GetUser":                           true,
	"/wekalist.api.v1.UserService/GetUserAvatar":                     true,
	"/wekalist.api.v1.UserService/GetUsererviceStats":                true,
	"/wekalist.api.v1.AiService/GenAi":                      		  true,
	"/wekalist.api.v1.UserService/ListAllUserStats":                  true,
	"/wekalist.api.v1.UserService/SearchUsers":                       true,
	"/wekalist.api.v1.MemoService/GetMemo":                           true,
	"/wekalist.api.v1.MemoService/ListMemos":                         true,
	"/wekalist.api.v1.MarkdownService/GetLinkMetadata":               true,
	"/wekalist.api.v1.SubscriptionService/AddSubscription":           true,
	"/wekalist.api.v1.SubscriptionService/RemoveSubscription":        true,
	"/wekalist.api.v1.SubscriptionService/SendNotification":          true,
	"/wekalist.api.v1.AttachmentService/GetAttachmentBinary":         true,
}

// isUnauthorizeAllowedMethod returns whether the method is exempted from authentication.
func isUnauthorizeAllowedMethod(fullMethodName string) bool {
	return authenticationAllowlistMethods[fullMethodName]
}

var allowedMethodsOnlyForAdmin = map[string]bool{
	"/wekalist.api.v1.UserService/CreateUser":                  true,
	"/wekalist.api.v1.WorkspaceService/UpdateWorkspaceSetting": true,
}

// isOnlyForAdminAllowedMethod returns true if the method is allowed to be called only by admin.
func isOnlyForAdminAllowedMethod(methodName string) bool {
	return allowedMethodsOnlyForAdmin[methodName]
}
