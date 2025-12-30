# TTS_TTV_0.02 Documentation

**Version:** 0.03  
**Last Updated:** December 27, 2025  
**Status:** Production Ready

---

## 📚 Quick Links

- **[Quick Start](QUICK_START.md)** - Get started in 5 minutes
- **[Architecture Guide](ARCHITECTURE_GUIDE.md)** - System architecture overview
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Development guidelines
- **[Current Status](CURRENT_STATUS.md)** - Project status and metrics
- **[Deployment](DEPLOYMENT.md)** - Production deployment guide

---

## 📖 Documentation Structure

### 🚀 Getting Started
- [Quick Start](QUICK_START.md) - Installation and setup
- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
- [LLM Development Rules](LLM_DEVELOPMENT_RULES.md) - AI assistant guidelines

### 🏗️ Architecture
- [Architecture Guide](ARCHITECTURE_GUIDE.md) - System design
- [Current Status](CURRENT_STATUS.md) - Implementation status
- [DO NOT TOUCH](DO_NOT_TOUCH.md) - Protected systems

### ⚙️ Setup & Installation
- [setup/PYTORCH_INSTALLATION.md](setup/PYTORCH_INSTALLATION.md) - PyTorch with CUDA
- [setup/VK_LIVE_WEBSOCKET_GUIDE.md](setup/VK_LIVE_WEBSOCKET_GUIDE.md) - VK WebSocket integration

### 🎨 Features
- [features/DROPS_SYSTEM.md](features/DROPS_SYSTEM.md) - Lootbox mechanics
- [features/VALIDATION_SYSTEM.md](features/VALIDATION_SYSTEM.md) - Input validation
- [features/DESIGN_SYSTEM.md](features/DESIGN_SYSTEM.md) - UI design system
- [features/SECURITY_LOGIC.md](features/SECURITY_LOGIC.md) - Security implementation

### 📡 API Documentation
- [VK Live API](vk/) - Complete VK Live API docs (18 files)
- Twitch API - See [Twitch Dev Docs](https://dev.twitch.tv/docs/)
- YouTube API - See [YouTube Data API](https://developers.google.com/youtube/v3)

### 📝 Guides
- [guides/BOT_OAUTH_SETUP_GUIDE.md](guides/BOT_OAUTH_SETUP_GUIDE.md) - OAuth configuration
- [guides/CATEGORY_MAPPING_GUIDE.md](guides/CATEGORY_MAPPING_GUIDE.md) - Stream categories
- [guides/TTS_TROUBLESHOOTING.md](guides/TTS_TROUBLESHOOTING.md) - TTS issues
- [guides/QUICK_START_BOT_OAUTH.md](guides/QUICK_START_BOT_OAUTH.md) - Bot OAuth quick start
- [guides/QUICK_START_OAUTH.md](guides/QUICK_START_OAUTH.md) - User OAuth quick start

### 📊 Reports & Archive
- [reports/2025-12-27-vk-api-implementation.md](reports/2025-12-27-vk-api-implementation.md) - VK API upgrade
- [reports/2025-12-27-python312-migration.md](reports/2025-12-27-python312-migration.md) - Python 3.12 migration
- [reports/2025-12-27-session-summary.md](reports/2025-12-27-session-summary.md) - Latest session

---

## 🎯 By Role

### For Developers
1. [Developer Guide](DEVELOPER_GUIDE.md) - Start here
2. [Architecture Guide](ARCHITECTURE_GUIDE.md) - Understand the system
3. [LLM Development Rules](LLM_DEVELOPMENT_RULES.md) - AI guidelines
4. [DO NOT TOUCH](DO_NOT_TOUCH.md) - Protected code

### For DevOps
1. [Deployment](DEPLOYMENT.md) - Production setup
2. [Quick Start](QUICK_START.md) - Local development
3. [setup/PYTORCH_INSTALLATION.md](setup/PYTORCH_INSTALLATION.md) - GPU setup

### For Streamers
1. [Quick Start](QUICK_START.md) - Get started
2. [guides/BOT_OAUTH_SETUP_GUIDE.md](guides/BOT_OAUTH_SETUP_GUIDE.md) - Connect your channel
3. [guides/TTS_TROUBLESHOOTING.md](guides/TTS_TROUBLESHOOTING.md) - Fix issues

---

## 🔍 By Topic

### Authentication & OAuth
- [guides/BOT_OAUTH_SETUP_GUIDE.md](guides/BOT_OAUTH_SETUP_GUIDE.md)
- [guides/QUICK_START_BOT_OAUTH.md](guides/QUICK_START_BOT_OAUTH.md)
- [guides/QUICK_START_OAUTH.md](guides/QUICK_START_OAUTH.md)
- [vk/Авторизация.md](vk/Авторизация.md)

### TTS System
- [guides/TTS_TROUBLESHOOTING.md](guides/TTS_TROUBLESHOOTING.md)
- [GTTS_VOICES.md](GTTS_VOICES.md)
- [LOCAL_TTS_INTEGRATION.md](LOCAL_TTS_INTEGRATION.md)
- [TTS_CHANNEL_POINTS_MODE.md](TTS_CHANNEL_POINTS_MODE.md)

### Drops & Rewards
- [features/DROPS_SYSTEM.md](features/DROPS_SYSTEM.md)
- [VK_CHANNEL_POINTS_IMPLEMENTATION.md](VK_CHANNEL_POINTS_IMPLEMENTATION.md)

### Security & Validation
- [features/SECURITY_LOGIC.md](features/SECURITY_LOGIC.md)
- [features/VALIDATION_SYSTEM.md](features/VALIDATION_SYSTEM.md)
- [VALIDATION_QUICK_REFERENCE.md](VALIDATION_QUICK_REFERENCE.md)

### UI/UX
- [features/DESIGN_SYSTEM.md](features/DESIGN_SYSTEM.md)
- [UI_COLOR_STANDARDS.md](UI_COLOR_STANDARDS.md)

### VK Live Integration
- [vk/](vk/) - Complete API documentation (18 files)
- [setup/VK_LIVE_WEBSOCKET_GUIDE.md](setup/VK_LIVE_WEBSOCKET_GUIDE.md)
- [VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md](VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md)

---

## 📦 Project Structure

```
TTS_TTV_0.02/
├── bot_service/          # FastAPI backend
├── frontend/             # React 19 + Vite frontend
├── tts_service/          # F5-TTS Advanced (multi-user)
├── tts_service_simple/   # F5-TTS Simple (single-user)
├── docs/                 # This documentation
├── scripts/              # Utility scripts
└── docker-compose.*.yml  # Docker configurations
```

---

## 🚀 Quick Commands

```bash
# Development
npm run dev:frontend      # Start frontend (localhost:5173)
npm run dev:bot          # Start backend (localhost:8000)
npm run dev:tts          # Start TTS service (localhost:8001)

# Production (Docker)
npm start                # Start all services
npm stop                 # Stop all services
npm run logs             # View logs

# Testing
cd bot_service && pytest # Backend tests
cd frontend && npm test  # Frontend tests

# Code Quality
npm run check:design     # Design system compliance
cd bot_service && ruff check .  # Python linting
```

---

## 📞 Support

- **Issues:** Check [Current Status](CURRENT_STATUS.md) first
- **Troubleshooting:** See [guides/TTS_TROUBLESHOOTING.md](guides/TTS_TROUBLESHOOTING.md)
- **Development:** Read [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)

---

## 📝 Recent Updates

- **2025-12-27:** Python 3.12 migration, VK API improvements, project cleanup
- **2025-11-14:** Version 0.03 - Stabilization & Optimization
- **2025-11-09:** Code refactoring and quality improvements

See [CHANGELOG.md](CHANGELOG.md) for full history.

---

**Version:** 0.03  
**Status:** Production Ready  
**Last Updated:** December 27, 2025
