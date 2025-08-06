# Changelog

All notable changes to Wekalist will be documented in this file.

## [0.26.0] - 2025-08-06

### Added
- ✨ AI Assistant Integration for smart memo summarization and contextual suggestions
- 📄 Memo Summary View with collapsible sections and priority labels
- 🔐 User Sign-In with Username or Email credentials
- 📤 SMTP Email Support via configurable environment variables
- 📧 Email Verification workflow with tokenized activation links
- 📱 Push Notification System via web push API (service worker enabled)
- 🐳 Docker Image Registry published under GitHub Container Registry: `ghcr.io/imrany/wekalist`
- 🆔 Updated branding, project name, and metadata for Wekalist fork

### Improved
- ⚙️ Enhanced RESTful compatibility through grpc-gateway refinements
- 🧪 Extended test coverage for email flows and memo interactions
- 🛠 Smarter retry logic and error handling across notification channels

### Deprecated
- 🚫 Legacy auth endpoints (will be removed in v1.1.0)

