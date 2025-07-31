package v1

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

const (
	// issuer is the issuer of the jwt token.
	Issuer = "memos"
	// Signing key section. For now, this is only used for signing, not for verifying since we only
	// have 1 version. But it will be used to maintain backward compatibility if we change the signing mechanism.
	KeyID = "v1"
	// AccessTokenAudienceName is the audience name of the access token.
	AccessTokenAudienceName = "user.access-token"
	// SessionSlidingDuration is the sliding expiration duration for user sessions (2 weeks).
	// Sessions are considered valid if last_accessed_time + SessionSlidingDuration > current_time.
	SessionSlidingDuration = 14 * 24 * time.Hour

	// SessionCookieName is the cookie name of user session ID.
	SessionCookieName = "user_session"
)

type ClaimsMessage struct {
	Name string `json:"name"`
	jwt.RegisteredClaims
}

// GenerateOTP generates One Time Password
func GenerateOTP()string{
	otp, _:=util.RandomString(6)
	return otp
}


// GenerateOTPWithLength generates OTP with custom length
func GenerateOTPWithLength(length int) string {
	if length <= 0 {
		length = 6
	}
	
	otp := ""
	for i := 0; i < length; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(10))
		otp += num.String()
	}
	return otp
}

// GenerateAlphanumericOTP generates alphanumeric OTP
func GenerateAlphanumericOTP(length int) string {
	if length <= 0 {
		length = 6
	}
	
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	otp := ""
	for i := 0; i < length; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		otp += string(chars[num.Int64()])
	}
	return otp
}

// GenerateAccessToken generates an access token.
func GenerateAccessToken(username string, userID int32, expirationTime time.Time, secret []byte) (string, error) {
	return generateToken(username, userID, AccessTokenAudienceName, expirationTime, secret)
}

// generateToken generates a jwt token.
func generateToken(username string, userID int32, audience string, expirationTime time.Time, secret []byte) (string, error) {
	registeredClaims := jwt.RegisteredClaims{
		Issuer:   Issuer,
		Audience: jwt.ClaimStrings{audience},
		IssuedAt: jwt.NewNumericDate(time.Now()),
		Subject:  fmt.Sprint(userID),
	}
	if !expirationTime.IsZero() {
		registeredClaims.ExpiresAt = jwt.NewNumericDate(expirationTime)
	}

	// Declare the token with the HS256 algorithm used for signing, and the claims.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &ClaimsMessage{
		Name:             username,
		RegisteredClaims: registeredClaims,
	})
	token.Header["kid"] = KeyID

	// Create the JWT string.
	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateSessionID generates a unique session ID using UUIDv4.
func GenerateSessionID() (string, error) {
	return util.GenUUID(), nil
}

// BuildSessionCookieValue builds the session cookie value in format {userID}-{sessionID}.
func BuildSessionCookieValue(userID int32, sessionID string) string {
	return fmt.Sprintf("%d-%s", userID, sessionID)
}

// ParseSessionCookieValue parses the session cookie value to extract userID and sessionID.
func ParseSessionCookieValue(cookieValue string) (int32, string, error) {
	parts := strings.SplitN(cookieValue, "-", 2)
	if len(parts) != 2 {
		return 0, "", errors.New("invalid session cookie format")
	}

	userID, err := util.ConvertStringToInt32(parts[0])
	if err != nil {
		return 0, "", errors.Errorf("invalid user ID in session cookie: %v", err)
	}

	return userID, parts[1], nil
}
