package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/imrany/wekalist/store"
	"github.com/labstack/echo/v4"
)

// Constants for configuration
const (
	DefaultLogo       = "/logo.svg"
	TwitterHandle     = "@matano_imran"
	MaxDescLength    = 100
	MaxLinkRetries   = 10 // Prevent infinite loops in markdown parsing
	
	// Default values - these should never be modified
	BaseSiteName    = "Wekalist"
	BaseFaviconURL  = "/android-chrome-192x192.png"
)

// Template data structures
type UserProfileData struct {
	User        *store.User
	Origin      string
	UserData    string
	Description string
}

type MemoPageData struct {
	Memo            *store.Memo
	Origin          string
	AttachmentImage string
	Description     string
	MemoData        string
	MemoIDStr       string
}

type ErrorPageData struct {
	Title       string
	Message     string
	Description string
}

// SiteConfig holds the site configuration that can be customized
type SiteConfig struct {
	SiteName   string
	FaviconURL string
	LogoURL    string
}

// getSiteConfig retrieves the site configuration from workspace settings
func (s *APIV1Service) getSiteConfig(ctx context.Context) SiteConfig {
	config := SiteConfig{
		SiteName:   BaseSiteName,
		FaviconURL: BaseFaviconURL,
		LogoURL:    DefaultLogo,
	}
	
	if generalSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx); err == nil && generalSetting != nil {
		if generalSetting.CustomProfile.Title != "" {
			config.SiteName = generalSetting.CustomProfile.Title
		}
		if generalSetting.CustomProfile.LogoUrl != "" {
			config.FaviconURL = generalSetting.CustomProfile.LogoUrl
		}
	}
	
	return config
}

// HTML templates - could be moved to separate files
var (
	userProfileTemplate = template.Must(template.New("userProfile").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="{{.LogoURL}}" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <!-- Page specific meta tags -->
    <title>{{.User.Username}} - {{.SiteName}}</title>
    <meta name="description" content="{{.Description}}">
    <meta name="keywords" content="{{.SiteName}}, Memos, AI-driven, {{.User.Username}}, profile"/>
    
    <!-- Canonical and structured data -->
    <link rel="canonical" href="{{.Origin}}/u/{{.User.Username}}" />
    <meta name="image" content="{{.ProfileImage}}" />
    <meta itemProp="name" content="{{.User.Username}} - {{.SiteName}}" />
    <meta itemProp="description" content="{{.Description}}"/>
    <meta itemProp="image" content="{{.ProfileImage}}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="{{.User.Username}} - {{.SiteName}}" />
    <meta name="twitter:description" content="{{.Description}}">
    <meta name="twitter:site" content="{{.Origin}}" />
    <meta name="twitter:creator" content="{{.TwitterHandle}}" />
    <meta name="twitter:image" content="{{.ProfileImage}}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="{{.User.Username}} - {{.SiteName}}" />
    <meta property="og:url" content="{{.Origin}}/u/{{.User.Username}}" />
    <meta property="og:description" content="{{.Description}}"/>
    <meta property="og:image" content="{{.ProfileImage}}" />
    <meta property="og:site_name" content="{{.SiteName}}" />
    <meta property="og:type" content="profile" />
    <meta name="author" content="{{.SiteName}}" />
</head>
<body>
    <script>
        window.__INITIAL_DATA__ = {{.UserData}};
        window.__ORIGIN__ = "{{.Origin}}";
        window.location.replace(window.__ORIGIN__ + '/u/{{.User.Username}}');
    </script>
</body>
</html>`))

	memoTemplate = template.Must(template.New("memo").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="{{.LogoURL}}" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <title>{{.Description}} - {{.SiteName}}</title>
    <meta name="description" content="{{.Description}}"/>
    <meta name="keywords" content="{{.SiteName}}, Memos, AI-driven, memo, note"/>
    
    <!-- Canonical and structured data -->
    <link rel="canonical" href="{{.Origin}}/memos/{{.MemoIDStr}}" />
    <meta name="image" content="{{.AttachmentImage}}" />
    <meta itemProp="name" content="Memo on {{.SiteName}}" />
    <meta itemProp="description" content="{{.Description}}"/>
    <meta itemProp="image" content="{{.AttachmentImage}}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Memo on {{.SiteName}}" />
    <meta name="twitter:description" content="{{.Description}}">
    <meta name="twitter:site" content="{{.Origin}}" />
    <meta name="twitter:creator" content="{{.TwitterHandle}}" />
    <meta name="twitter:image" content="{{.AttachmentImage}}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="Memo on {{.SiteName}}" />
    <meta property="og:url" content="{{.Origin}}/memos/{{.MemoIDStr}}" />
    <meta property="og:description" content="{{.Description}}"/>
    <meta property="og:image" content="{{.AttachmentImage}}" />
    <meta property="og:site_name" content="{{.SiteName}}" />
    <meta property="og:type" content="article" />
    <meta name="author" content="{{.SiteName}}" />
    <meta property="article:author" content="User {{.Memo.CreatorID}}">
</head>
<body>
    <script>
        window.__INITIAL_DATA__ = {{.MemoData}};
        window.__ORIGIN__ = "{{.Origin}}";
        window.location.replace(window.__ORIGIN__ + '/memos/{{.MemoIDStr}}');
    </script>
</body>
</html>`))
)

// SEO-friendly route handlers
func (s *APIV1Service) registerSEORoutes(echoServer *echo.Echo) {
	echoServer.GET("/share/u/:identifier", s.handleUserProfile)
	echoServer.GET("/share/memos/:id", s.handleMemoPage)
}

// Handle user profile pages with server-side rendering
func (s *APIV1Service) handleUserProfile(c echo.Context) error {
	identifier := c.Param("identifier")
	ctx := c.Request().Context()
	
	// Get site configuration
	siteConfig := s.getSiteConfig(ctx)
	
	var userID *int32
	var username *string
	
	if id, err := strconv.ParseInt(identifier, 10, 32); err == nil {
		val := int32(id)
		userID = &val
	} else {
		username = &identifier
	}
	
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID:       userID,
		Username: username,
	})
	if err != nil || user == nil {
		return s.renderErrorPage(c, http.StatusNotFound, "User Not Found", "The user you're looking for could not be found", siteConfig)
	}
	
	origin := getOrigin(c.Request())
	
	// Handle profile image - use the avatar endpoint for data URIs
	profileImage := user.AvatarURL
	if profileImage == "" {
		if strings.HasPrefix(siteConfig.FaviconURL, "http") {
			// Use absolute URL for favicon
			profileImage = siteConfig.FaviconURL
		} else if strings.HasPrefix(siteConfig.FaviconURL, "/") {
			// Use relative URL with origin
			profileImage = origin + siteConfig.FaviconURL
		}
	} else if strings.HasPrefix(profileImage, "data:") {
		// Use the GetUserAvatar endpoint for social media compatibility
		profileImage = fmt.Sprintf("%s/api/v1/users/%d/avatar", origin, user.ID)
	}
	
	description := user.Description
	if description == "" {
		description = fmt.Sprintf("%s's profile on %s - View memos and thoughts", user.Username, siteConfig.SiteName)
	}
	
	userData, err := json.Marshal(map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
	})
	if err != nil {
		return s.renderErrorPage(c, http.StatusInternalServerError, "Error", "Failed to process user data", siteConfig)
	}
	
	data := struct {
		User          *store.User
		Origin        string
		ProfileImage  string
		Description   string
		UserData      template.JS
		SiteName      string
		TwitterHandle string
		LogoURL       string
	}{
		User:          user,
		Origin:        origin,
		ProfileImage:  profileImage,
		Description:   template.HTMLEscapeString(description),
		UserData:      template.JS(userData),
		SiteName:      siteConfig.SiteName,
		TwitterHandle: TwitterHandle,
		LogoURL:       siteConfig.LogoURL,
	}
	
	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	return userProfileTemplate.Execute(c.Response().Writer, data)
}

// Handle individual memo pages
func (s *APIV1Service) handleMemoPage(c echo.Context) error {
	ID := c.Param("id")
	if ID == "" {
		ctx := c.Request().Context()
		siteConfig := s.getSiteConfig(ctx)
		return s.renderErrorPage(c, http.StatusBadRequest, "Invalid Request", "Invalid Memo ID", siteConfig)
	}

	ctx := c.Request().Context()
	siteConfig := s.getSiteConfig(ctx)
	
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &ID,
	})
	if err != nil || memo == nil {
		log.Printf("Memo not found - ID: %v, error: %v", ID, err)
		return s.renderErrorPage(c, http.StatusNotFound, "Memo Not Found", "The memo you're looking for could not be found", siteConfig)
	}
	
	if memo.Visibility != store.Public {
		return s.renderErrorPage(c, http.StatusForbidden, "Access Denied", "You don't have permission to access this content", siteConfig)
	}
	
	origin := getOrigin(c.Request())
	attachmentImage := s.getMemoThumbnail(ctx, memo, origin, siteConfig.FaviconURL)
	description := s.generateMemoDescription(memo, siteConfig.SiteName)
	
	memoData, err := json.Marshal(map[string]interface{}{
		"id":        memo.ID,
		"content":   memo.Content,
		"creatorId": memo.CreatorID,
	})
	if err != nil {
		return s.renderErrorPage(c, http.StatusInternalServerError, "Error", "Failed to process memo data", siteConfig)
	}
	
	data := struct {
		Memo            *store.Memo
		Origin          string
		AttachmentImage string
		Description     string
		MemoData        template.JS
		MemoIDStr       string
		SiteName        string
		TwitterHandle   string
		LogoURL         string
	}{
		Memo:            memo,
		Origin:          origin,
		AttachmentImage: attachmentImage,
		Description:     description,
		MemoData:        template.JS(memoData),
		MemoIDStr:       fmt.Sprintf("%d", memo.ID),
		SiteName:        siteConfig.SiteName,
		TwitterHandle:   TwitterHandle,
		LogoURL:         siteConfig.LogoURL,
	}
	
	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	return memoTemplate.Execute(c.Response().Writer, data)
}

// Helper methods
func (s *APIV1Service) getMemoThumbnail(ctx context.Context, memo *store.Memo, origin, defaultFavicon string) string {
	var attachmentImage string
	if strings.HasPrefix(defaultFavicon, "http") {
		// Use absolute URL for favicon
		attachmentImage = defaultFavicon
	} else if strings.HasPrefix(defaultFavicon, "/") {
		// Use relative URL with origin
		attachmentImage = origin + defaultFavicon
	}
	
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil || len(attachments) == 0 {
		return attachmentImage
	}
	
	// Find the most recent attachment
	chosen := attachments[0]
	for _, a := range attachments[1:] {
		if a.UpdatedTs > chosen.UpdatedTs {
			chosen = a
		}
	}
	
	if chosen.UID != "" {
		name := fmt.Sprintf("%s%s", AttachmentNamePrefix, chosen.UID)
		attachmentImage = fmt.Sprintf("%s/file/%s/%s?thumbnail=true", origin, name, chosen.Filename)
	}
	
	return attachmentImage
}

func (s *APIV1Service) generateMemoDescription(memo *store.Memo, siteName string) string {
	description := truncateText(stripMarkdownImproved(memo.Content), MaxDescLength)
	if description == "" {
		description = fmt.Sprintf("A memo on %s", siteName)
	}
	return template.HTMLEscapeString(description)
}

func (s *APIV1Service) renderErrorPage(c echo.Context, status int, title, message string, siteConfig SiteConfig) error {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="%s" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>%s - %s</title>
    <meta name="description" content="%s">
    <meta name="robots" content="noindex">
</head>
<body>
    <script>
        window.location.replace("/");
    </script>
</body>
</html>`, siteConfig.LogoURL, template.HTMLEscapeString(title), siteConfig.SiteName, template.HTMLEscapeString(message))

	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	return c.HTML(status, html)
}

// Improved utility functions
func truncateText(text string, maxLength int) string {
	if utf8.RuneCountInString(text) <= maxLength {
		return text
	}
	
	runes := []rune(text)
	if len(runes) <= maxLength {
		return text
	}
	
	// Try to break at a word boundary
	truncated := runes[:maxLength]
	for i := len(truncated) - 1; i >= maxLength-20 && i > 0; i-- {
		if truncated[i] == ' ' {
			return string(truncated[:i]) + "..."
		}
	}
	
	return string(truncated) + "..."
}

func stripMarkdownImproved(content string) string {
	text := content
	
	// Remove headers
	text = strings.ReplaceAll(text, "#", "")
	
	// Remove bold/italic
	text = strings.ReplaceAll(text, "**", "")
	text = strings.ReplaceAll(text, "*", "")
	text = strings.ReplaceAll(text, "__", "")
	text = strings.ReplaceAll(text, "_", "")
	
	// Remove code blocks and inline code
	text = strings.ReplaceAll(text, "`", "")
	
	// Improved link removal with retry limit
	retries := 0
	for retries < MaxLinkRetries && strings.Contains(text, "[") && strings.Contains(text, "]") {
		start := strings.Index(text, "[")
		if start == -1 {
			break
		}
		
		end := strings.Index(text[start:], "]")
		if end == -1 {
			break
		}
		end += start
		
		// Check if this looks like a markdown link
		if end+1 < len(text) && text[end+1] == '(' {
			linkEnd := strings.Index(text[end+1:], ")")
			if linkEnd != -1 {
				linkEnd += end + 1
				// Replace [text](url) with just text
				linkText := text[start+1 : end]
				text = text[:start] + linkText + text[linkEnd+1:]
				retries++
				continue
			}
		}
		
		// If not a proper link, just remove the brackets
		text = text[:start] + text[start+1:]
		retries++
	}
	
	// Clean up extra whitespace
	text = strings.TrimSpace(text)
	fields := strings.Fields(text)
	return strings.Join(fields, " ")
}

// Utility function to get origin from request (unchanged)
func getOrigin(r *http.Request) string {
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	}
	
	host := r.Host
	if host == "" {
		host = r.Header.Get("Host")
	}
	
	return fmt.Sprintf("%s://%s", scheme, host)
}