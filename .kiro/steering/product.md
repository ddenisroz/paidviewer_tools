# Product Overview

TTS_TTV_0.02 is a production-ready text-to-speech bot for streamers on Twitch and VK Live platforms.

## Core Features

- **Multi-Platform Support**: Twitch and VK Live with unified platform abstraction layer
- **TTS Engines**: Google Cloud TTS (cloud), F5-TTS Advanced (centralized GPU), F5-TTS Simple (personal GPU)
- **YouTube Integration**: Queue management and player for song requests
- **Channel Points System**: Twitch and VK Live rewards integration
- **Drops System**: Lootbox mechanics with streak tracking and donation integration
- **DonationAlerts**: Automatic integration for donation-triggered TTS
- **Guest Mode**: View-only access without authentication
- **Custom Commands**: Global, override, and custom command support
- **Permission System**: Role-based access control (admin/user/guest)
- **Admin Panel**: User management, voice management, analytics
- **OBS Widgets**: Chat, TTS, YouTube, and Drops overlays

## Architecture

Three-service architecture:
- **bot_service**: FastAPI backend handling OAuth, chat bots, business logic, WebSocket
- **frontend**: React 19 + Vite SPA with TypeScript migration in progress
- **tts_service**: Optional F5-TTS service (Advanced or Simple variants)

## Target Users

Streamers who want professional TTS functionality with multi-platform support, customization options, and monetization features.

## Current Status

Version 0.03 - Production ready with comprehensive optimization, error handling, and performance improvements.
