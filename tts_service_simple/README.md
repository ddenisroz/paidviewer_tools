# TTS F5 Simple

Simplified F5-TTS Microservice for local synthesis.

## Features
- **FastAPI** based high-performance API
- **Modular Architecture**
- **Docker** support
- **GPU Acceleration** monitoring
- **Voice Management** (Base & Custom voices)

## Structure
```
tts_service_simple/
├── app/
│   ├── api/          # API Routes
│   ├── core/         # Configuration
│   ├── services/     # Business logic (Engine, Audio, Voices)
│   └── main.py       # App entry point
├── models/           # TTS Models storage
├── generated_audio/  # Output directory
├── run.py            # Local runner script
└── Dockerfile        # Container definition
```

## Running Locally

### Prerequisites
- Python 3.10+
- NVIDIA GPU (Recommended)

### Setup
```bash
pip install -r requirements.txt
```

### Run
```bash
python run.py
```
Service will be available at `http://localhost:8000`

## Running with Docker

```bash
docker-compose up --build
```

## API Documentation
Open `http://localhost:8000/docs` to see Swagger UI.
