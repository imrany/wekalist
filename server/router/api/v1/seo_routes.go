package v1

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/imrany/wekalist/store"
	"github.com/labstack/echo/v4"
)

// SEO-friendly route handlers
func (s *APIV1Service) registerSEORoutes(echoServer *echo.Echo) {
	// Add SEO routes BEFORE the gRPC gateway registration
	
	// User profile pages: /u/{id} or /u/{username}
	echoServer.GET("/share/u/:identifier", s.handleUserProfile)
	
	// Memo pages: /memos/{id} 
	echoServer.GET("/share/memos/:id", s.handleMemoPage)
}

// Handle user profile pages with server-side rendering
func (s *APIV1Service) handleUserProfile(c echo.Context) error {
	identifier := c.Param("identifier")
	
	// Try to parse as user ID first, then as username
	var userID *int32
	var username *string
	
	if id, err := strconv.ParseInt(identifier, 10, 32); err == nil {
		val := int32(id)
		userID = &val
	} else {
		username = &identifier
	}
	
	// Fetch user data via store
	ctx := c.Request().Context()
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID:       userID,
		Username: username,
	})
	if err != nil || user == nil {
		return c.HTML(http.StatusNotFound, generateNotFoundPage("User not found"))
	}
	
	// Get origin from request
	origin := getOrigin(c.Request())
	
	// Generate SEO-friendly HTML
	html := generateUserProfileHTML(user, origin)
	
	// Set SEO headers
	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	return c.HTML(http.StatusOK, html)
}

// Handle individual memo pages
func (s *APIV1Service) handleMemoPage(c echo.Context) error {
	ID := c.Param("id")
	if ID == "" {
		return c.HTML(http.StatusBadRequest, generateErrorPage("Invalid Memo Id"))
	}

	ctx := c.Request().Context()
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &ID,
	})
	if err != nil || memo == nil {
		return c.HTML(http.StatusNotFound, generateNotFoundPage(fmt.Sprintf("Memo not found: %s", err.Error())))
	}

	log.Printf("id: %v, memo: %v", ID, memo)
	
	// Check if memo is public or user has access
	if memo.Visibility != store.Public {
		return c.HTML(http.StatusForbidden, generateForbiddenPage())
	}
	
	// Get origin from request
	origin := getOrigin(c.Request())
	
	html := generateMemoHTML(memo, origin)
	
	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	return c.HTML(http.StatusOK, html)
}

// Utility function to get origin from request
func getOrigin(r *http.Request) string {
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	
	// Check for forwarded protocol
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	}
	
	host := r.Host
	if host == "" {
		host = r.Header.Get("Host")
	}
	
	return fmt.Sprintf("%s://%s", scheme, host)
}

// Utility functions for text processing
func truncateText(text string, maxLength int) string {
	if utf8.RuneCountInString(text) <= maxLength {
		return text
	}
	
	runes := []rune(text)
	if len(runes) <= maxLength {
		return text
	}
	
	return string(runes[:maxLength]) + "..."
}

func stripMarkdown(content string) string {
	// Basic markdown stripping - you might want to use a proper markdown parser
	text := content
	
	// Remove headers
	text = strings.ReplaceAll(text, "#", "")
	
	// Remove bold/italic
	text = strings.ReplaceAll(text, "**", "")
	text = strings.ReplaceAll(text, "*", "")
	text = strings.ReplaceAll(text, "__", "")
	text = strings.ReplaceAll(text, "_", "")
	
	// Remove links - keep only the text part
	// This is a simple regex replacement - you might want something more robust
	for strings.Contains(text, "[") && strings.Contains(text, "]") && strings.Contains(text, "(") && strings.Contains(text, ")") {
		start := strings.Index(text, "[")
		if start == -1 {
			break
		}
		end := strings.Index(text[start:], "]")
		if end == -1 {
			break
		}
		end += start
		
		linkStart := strings.Index(text[end:], "(")
		if linkStart == -1 || linkStart > 1 {
			break
		}
		linkStart += end
		
		linkEnd := strings.Index(text[linkStart:], ")")
		if linkEnd == -1 {
			break
		}
		linkEnd += linkStart
		
		// Replace [text](url) with just text
		linkText := text[start+1 : end]
		text = text[:start] + linkText + text[linkEnd+1:]
	}
	
	// Remove code blocks
	text = strings.ReplaceAll(text, "`", "")
	
	// Clean up extra whitespace
	text = strings.TrimSpace(text)
	lines := strings.Fields(text)
	return strings.Join(lines, " ")
}

func toJSON(v interface{}) string {
	bytes, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

// HTML generation functions
func generateUserProfileHTML(user *store.User, origin string) string {
	username := escapeHTML(user.Username)
	var favicon = "/logo.svg"
	var profileImage = "/android-chrome-192x192.png"
	
	// Use user avatar if available
	if user.AvatarURL != "" {
		favicon = user.AvatarURL
		profileImage = user.AvatarURL
	}
	
	userData := toJSON(map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		// Add other safe fields
	})
	
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="%s" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <!-- Page specific meta tags -->
    <title>%s - Wekalist</title>
    <meta name="description" content="%s's profile on Wekalist - View memos and thoughts">
    <meta name="keywords" content="Wekalist, Memos, AI-driven, %s, profile"/>
    
    <!-- wekalist.metadata.head -->
    <!-- pwa -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FAFAFA" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Wekalist" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-status-bar-style" content="#FAFAFA" />
    
    <!-- google -->
    <link rel="canonical" href="%s/u/%s" />
    <meta name="image" content="%s" />
    <meta itemProp="name" content="%s - Wekalist" />
    <meta itemProp="description" content="%s's profile on Wekalist - View memos and thoughts"/>
    <meta itemProp="image" content="%s" />
    
    <!-- twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="%s - Wekalist" />
    <meta name="twitter:description" content="View %s's memos and profile on Wekalist">
    <meta name="twitter:site" content="%s" />
    <meta name="twitter:creator" content="@matano_imran" />
    <meta name="twitter:image:src" content="%s" />
    <meta name="twitter:image" content="%s" />
    
    <!-- facebook -->
    <meta name="og:title" property="og:title" content="%s - Wekalist" />
    <meta name="og:url" property="og:url" content="%s/u/%s" />
    <meta name="og:description" property="og:description" content="View %s's memos and profile on Wekalist"/>
    <meta name="og:image" property="og:image" content="%s" />
    <meta name="og:site_name" property="og:site_name" content="Wekalist" />
    <meta name="og:type" property="og:type" content="profile" />
    <meta name="author" content="Wekalist" />
    
    <!-- SEO -->
    <meta name="msnbot" content="preview" />
</head>
<body>
    <script>
        window.__INITIAL_DATA__ = %s;
        window.__ORIGIN__ = "%s";
        
        // Redirect to origin once loaded
        window.location.replace(window.__ORIGIN__ + '/u/%s');
    </script>
</body>
</html>`, favicon, username, username, username, origin, user.Username, profileImage, username, username, profileImage, username, username, origin, profileImage, profileImage, username, origin, user.Username, username, profileImage, userData, origin, user.Username)
}

func generateMemoHTML(memo *store.Memo, origin string) string {
	// Extract first 100 chars for description
	description := truncateText(stripMarkdown(memo.Content), 100)
	if description == "" {
		description = "A memo on Wekalist"
	}
	
	description = escapeHTML(description)
	
	// Convert memo ID to string for URL
	memoIDStr := fmt.Sprintf("%d", memo.ID)
	
	memoData := toJSON(map[string]interface{}{
		"id":        memo.ID,
		"content":   memo.Content,
		"creatorId": memo.CreatorID,
		// Add other safe fields
	})
	
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <!-- Page specific meta tags -->
    <title>%s - Wekalist</title>
    <meta name="description" content="%s"/>
    <meta name="keywords" content="Wekalist, Memos, AI-driven, memo, note"/>
    
    <!-- wekalist.metadata.head -->
    <!-- pwa -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FAFAFA" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Wekalist" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-status-bar-style" content="#FAFAFA" />
    
    <!-- google -->
    <link rel="canonical" href="%s/memos/%s" />
    <meta name="image" content="/android-chrome-192x192.png" />
    <meta itemProp="name" content="Memo on Wekalist" />
    <meta itemProp="description" content="%s"/>
    <meta itemProp="image" content="/android-chrome-192x192.png" />
    
    <!-- twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Memo on Wekalist" />
    <meta name="twitter:description" content="%s">
    <meta name="twitter:site" content="%s" />
    <meta name="twitter:creator" content="@matano_imran" />
    <meta name="twitter:image:src" content="/android-chrome-192x192.png" />
    <meta name="twitter:image" content="/android-chrome-192x192.png" />
    
    <!-- facebook -->
    <meta name="og:title" property="og:title" content="Memo on Wekalist" />
    <meta name="og:url" property="og:url" content="%s/memos/%s" />
    <meta name="og:description" property="og:description" content="%s"/>
    <meta name="og:image" property="og:image" content="/android-chrome-192x192.png" />
    <meta name="og:site_name" property="og:site_name" content="Wekalist" />
    <meta name="og:type" property="og:type" content="article" />
    <meta name="author" content="Wekalist" />
    <meta property="article:author" content="User %d">
    
    <!-- SEO -->
    <meta name="msnbot" content="preview" />
</head>
<body>
    <script>
        window.__INITIAL_DATA__ = %s;
        window.__ORIGIN__ = "%s";
        
        // Redirect to origin once loaded
        window.location.replace(window.__ORIGIN__ + '/memos/%s');
    </script>
</body>
</html>`, description, description, origin, memoIDStr, description, description, origin, origin, memoIDStr, description, memo.CreatorID, memoData, origin, memoIDStr)
}

func generateNotFoundPage(message string) string {
	if message == "" {
		message = "The page you're looking for could not be found"
	}
	message = escapeHTML(message)
	
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <title>Page Not Found - Wekalist</title>
    <meta name="description" content="%s">
    <meta name="robots" content="noindex">
    
    <!-- PWA -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FAFAFA" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Wekalist" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-status-bar-style" content="#FAFAFA" />
</head>
<body>
    <script>
        window.location.replace("/");
    </script>
</body>
</html>`, message)
}

func generateErrorPage(message string) string {
	if message == "" {
		message = "An error occurred"
	}
	message = escapeHTML(message)
	
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <title>Error - Wekalist</title>
    <meta name="description" content="%s">
    <meta name="robots" content="noindex">
    
    <!-- PWA -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FAFAFA" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Wekalist" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-status-bar-style" content="#FAFAFA" />
</head>
<body>
    <script>
        window.location.replace("/");
    </script>
</body>
</html>`, message)
}

func generateForbiddenPage() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <title>Forbidden - Wekalist</title>
    <meta name="description" content="You don't have permission to access this content">
    <meta name="robots" content="noindex">
    
    <!-- PWA -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FAFAFA" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Wekalist" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-status-bar-style" content="#FAFAFA" />
</head>
<body>
    <script>
        window.location.replace("/");
    </script>
</body>
</html>`
}