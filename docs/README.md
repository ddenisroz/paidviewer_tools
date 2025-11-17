# TTS_TTV_0.02 Documentation

**Last Updated:** November 17, 2025  
**Project Version:** 0.03

Welcome to the TTS_TTV_0.02 documentation. This is a unified streaming platform for Twitch and VK Live with text-to-speech, chat interactivity, loyalty systems, and OBS widgets.

---

## Quick Navigation

### New to the Project?
1. **[Project README](../README.md)** - Start here for project overview
2. **[Quick Start Guide](guides/QUICK_START.md)** - Get up and running in 5 minutes
3. **[Developer Guide](DEVELOPER_GUIDE.md)** - Development patterns and best practices

### For Developers
1. **[Architecture Guide](architecture/ARCHITECTURE_GUIDE.md)** - System architecture overview
2. **[Developer Guide](DEVELOPER_GUIDE.md)** - Coding patterns and conventions
3. **[Current Status](CURRENT_STATUS.md)** - What's working and what's not

### For AI Assistants
1. **[LLM Development Rules](LLM_DEVELOPMENT_RULES.md)** - REQUIRED READING
2. **[Current Status](CURRENT_STATUS.md)** - Implementation status
3. **[Do Not Touch](DO_NOT_TOUCH.md)** - Protected systems and files

---

## Documentation Structure

### Guides (`guides/`)
User-focused guides for setup and usage:
- **[Quick Start](guides/QUICK_START.md)** - Fast setup guide
- **[Quick Setup](guides/QUICK_SETUP.md)** - Configuration guide
- **[Setup Guide](guides/SETUP_GUIDE.md)** - Comprehensive setup instructions

### Architecture (`architecture/`)
Technical architecture documentation:
- **[Architecture Guide](architecture/ARCHITECTURE_GUIDE.md)** - System design overview
- **[TTS Architecture](architecture/TTS_ARCHITECTURE.md)** - TTS system design
- **[Validation System](architecture/VALIDATION_SYSTEM.md)** - Input validation patterns
- **[Caching System](architecture/CACHING_SYSTEM.md)** - Caching strategies
- **[Design System](architecture/DESIGN_SYSTEM.md)** - UI design system (8px grid)
- **[Shared WebSocket](architecture/SHARED_WEBSOCKET.md)** - WebSocket with Leader Election

### API Documentation (`api/`)
API endpoint documentation:
- **[Admin Panel Endpoints](api/ADMIN_PANEL_ENDPOINTS_STATUS.md)** - Admin API status

### Feature Documentation

#### TTS (Text-to-Speech)
- **[TTS Architecture](architecture/TTS_ARCHITECTURE.md)** - TTS system design
- **[TTS Channel Points Mode](TTS_CHANNEL_POINTS_MODE.md)** - Channel points integration
- **[Local TTS Integration](LOCAL_TTS_INTEGRATION.md)** - F5-TTS setup
- **[Voice Upload System](VOICE_UPLOAD_UNIFIED.md)** - Custom voice uploads
- **[Voice Separation](VOICE_SEPARATION_GLOBAL_USER.md)** - Global vs user voices
- **[Admin Voice Management](ADMIN_VOICE_MANAGEMENT.md)** - Voice administration
- **[gTTS Voices](GTTS_VOICES.md)** - Google TTS voice options

#### Security & Moderation
- **[Security Logic](SECURITY_LOGIC.md)** - Authentication and authorization
- **[Admin Blocking & Whitelist](ADMIN_BLOCKING_AND_WHITELIST.md)** - User moderation
- **[Account Deletion System](ACCOUNT_DELETION_SYSTEM.md)** - GDPR compliance
- **[Guest Mode Support](GUEST_MODE_SUPPORT.md)** - Unauthenticated access

#### Channel Points & Rewards
- **[VK Channel Points](VK_CHANNEL_POINTS_IMPLEMENTATION.md)** - VK Live rewards
- **[Drops System](DROPS_SYSTEM.md)** - Lootbox mechanics and streaks

#### Commands & Integrations
- **[Unified Commands](UNIFIED_COMMANDS.md)** - Command system
- **[Roles Reference](ROLES_REFERENCE.md)** - Permission roles
- **[Category Mapping](CATEGORY_MAPPING_GUIDE.md)** - Twitch ↔ VK categories
- **[VK Username & Admin Users](VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md)** - VK user handling

#### Admin Panel
- **[Admin Panel Endpoints](api/ADMIN_PANEL_ENDPOINTS_STATUS.md)** - API endpoints
- **[Admin Voice Management](ADMIN_VOICE_MANAGEMENT.md)** - Voice controls
- **[Admin Blocking](ADMIN_BLOCKING_AND_WHITELIST.md)** - User management

#### System Documentation
- **[Token System](TOKEN_SYSTEM_UNIFIED.md)** - OAuth token management
- **[Validation Quick Reference](VALIDATION_QUICK_REFERENCE.md)** - Validation patterns

### Deployment & Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment
- **[Docker Deployment](DOCKER_DEPLOYMENT.md)** - Docker setup

### Project Management
- **[Current Status](CURRENT_STATUS.md)** - Implementation status
- **[Changelog](CHANGELOG.md)** - Version history
- **[Do Not Touch](DO_NOT_TOUCH.md)** - Protected systems
- **[Project Structure Audit](PROJECT_STRUCTURE_AUDIT.md)** - Codebase organization

---

## Finding Information

### By Topic

**Getting Started**
- Setup → [Quick Start](guides/QUICK_START.md)
- Development → [Developer Guide](DEVELOPER_GUIDE.md)
- Deployment → [Deployment Guide](DEPLOYMENT.md)

**Features**
- TTS System → [TTS Architecture](architecture/TTS_ARCHITECTURE.md)
- Drops/Lootboxes → [Drops System](DROPS_SYSTEM.md)
- Commands → [Unified Commands](UNIFIED_COMMANDS.md)
- Channel Points → [VK Channel Points](VK_CHANNEL_POINTS_IMPLEMENTATION.md)

**Technical**
- Architecture → [Architecture Guide](architecture/ARCHITECTURE_GUIDE.md)
- WebSocket → [Shared WebSocket](architecture/SHARED_WEBSOCKET.md)
- Security → [Security Logic](SECURITY_LOGIC.md)
- Validation → [Validation System](architecture/VALIDATION_SYSTEM.md)

**Administration**
- Admin Panel → [Admin Panel Endpoints](api/ADMIN_PANEL_ENDPOINTS_STATUS.md)
- User Management → [Admin Blocking](ADMIN_BLOCKING_AND_WHITELIST.md)
- Voice Management → [Admin Voice Management](ADMIN_VOICE_MANAGEMENT.md)

---

## Technology Stack

**Backend:** FastAPI 0.121.2, Python 3.10+, SQLAlchemy 2.0.44, Alembic 1.17.1  
**Frontend:** React 19.1.1, Vite 7.1.2, TypeScript (migration in progress), Tailwind CSS 3.4.17  
**Database:** SQLite (dev) / PostgreSQL (prod)  
**TTS:** Google Cloud TTS, F5-TTS 1.1.9  
**Infrastructure:** Docker, nginx, Cloudflare Tunnel

---

## Project Status

### Working Features
- ✅ Multi-platform support (Twitch, VK Live, DonationAlerts)
- ✅ TTS engines (Google Cloud TTS, F5-TTS Advanced, F5-TTS Simple)
- ✅ Chat overlay for OBS
- ✅ Command system (global, override, custom)
- ✅ Drops system (lootboxes, streaks, donations)
- ✅ YouTube integration
- ✅ Guest mode
- ✅ Admin panel
- ✅ Permission system (RBAC)
- ✅ WebSocket with Leader Election

### In Development
- 🚧 Enhanced admin panel features
- 🚧 Donation interactivity enhancements
- 🚧 Personality analysis system
- 🚧 Interface improvements

---

## Contributing

When updating documentation:

1. **Update relevant docs** after code changes
2. **Update CURRENT_STATUS.md** for feature status changes
3. **Add entries to CHANGELOG.md** for significant changes
4. **Follow naming conventions** (see [Developer Guide](DEVELOPER_GUIDE.md))
5. **Use relative links** for cross-references
6. **Include code examples** with language tags

---

## Support & Resources

- **Main README:** [../README.md](../README.md)
- **Documentation Index:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) (legacy)
- **VK Live API:** See `vk/` directory for VK-specific documentation

---

**Documentation Version:** 4.0.0  
**Last Updated:** November 17, 2025
