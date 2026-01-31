# TTS & Twitch Bot

A comprehensive solution for Twitch streamers featuring AI text-to-speech (TTS), integrations with Twitch/VK/DonationAlerts, and a web-based dashboard.

## Architecture

Refactored to follow **Clean Architecture** principles:
*   **Core**: Domain-driven design with distinct API, Service, and Repository layers.
*   **VoiceManagementService**: Centralized control for TTS providers (Google, F5-TTS).
*   **Integrations**: Modular services for Twitch, VK, and DonationAlerts.
*   **Frontend**: TypeScript/React-based UI with strict typing and feature-based structure.

## Deployment

### Quick Start

1.  Clone the repository:
    ```bash
    git clone <repo>
    cd TTS_TTV_0.02
    ```

2.  Run migration script to setup environment:
    *   Windows: `.\scripts\migrate.ps1`
    *   Linux/Mac: `./scripts/migrate.sh`

3.  Configure `.env` files in `bot_service/`, `tts_service/`, and `frontend/`.

4.  Start services:
    *   **Backend**: `cd bot_service && python main.py`
    *   **Frontend**: `cd frontend && npm run dev`
    *   **TTS Service**: `cd tts_service && python main.py`

### detailed Documentation
*   [Quick Start Guide](docs/QUICKSTART.md)
*   [Deployment Guide](docs/setup/DEPLOYMENT.md)
*   [Architecture Overview](docs/architecture/ARCHITECTURE_GUIDE.md)

## Tech Stack

*   **Backend**: Python 3.10+, FastAPI, SQLAlchemy, PostgreSQL.
*   **Frontend**: React 19, Vite, Tailwind CSS, TypeScript.
*   **TTS**: Google Cloud TTS, F5-TTS (Local/GPU).
*   **Integrations**: TwitchIO, VK Live API, DonationAlerts.
*   **Security**: OAuth2, JWT, Rate Limiting.

## License

MIT License
