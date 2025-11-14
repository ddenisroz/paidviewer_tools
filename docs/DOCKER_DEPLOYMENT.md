# Docker Deployment Guide

## Overview

This guide explains how to deploy the TTS Bot using Docker Compose in different configurations.

## Deployment Scenarios

### Scenario 1: All-in-One (Development)
Run everything on one machine for development.

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Scenario 2: Distributed with Advanced TTS (Production)
- **Machine 1 (GPU PC)**: TTS Service with F5-TTS + Cloudflare Tunnel
- **Machine 2 (Server)**: Bot Service + Frontend + Database

**Machine 1 (GPU PC):**
```bash
# Setup Cloudflare Tunnel first
# 1. Create tunnel: cloudflared tunnel create tts-tunnel
# 2. Copy credentials to cloudflared-credentials.json
# 3. Configure cloudflared-config.yml with your domain

# Start TTS service
docker-compose -f docker-compose.tts-advanced.yml up -d
```

**Machine 2 (Server):**
```bash
# Configure TTS_SERVICE_URL in bot_service/.env
# TTS_SERVICE_URL=https://tts.yourdomain.com

# Start bot service and frontend
docker-compose -f docker-compose.bot.yml up -d
```

### Scenario 3: Distributed with Simple TTS (Personal Use)
- **Machine 1 (GPU PC)**: TTS Service Simple + Cloudflare Tunnel
- **Machine 2 (Server)**: Bot Service + Frontend + Database

**Machine 1 (GPU PC):**
```bash
# Setup Cloudflare Tunnel (same as Scenario 2)

# Start TTS Simple
docker-compose -f docker-compose.tts-simple.yml up -d
```

**Machine 2 (Server):**
```bash
# Same as Scenario 2
docker-compose -f docker-compose.bot.yml up -d
```

## Prerequisites

### All Machines
- Docker 20.10+
- Docker Compose 2.0+

### GPU Machine (for TTS)
- NVIDIA GPU with 8GB+ VRAM
- NVIDIA Docker runtime
- CUDA 11.8+

### Server Machine
- 2GB+ RAM
- PostgreSQL (included in docker-compose.bot.yml)

## Setup Steps

### 1. Configure Environment Variables

Copy .env.example files to .env:
```bash
cp bot_service/.env.example bot_service/.env
cp tts_service/.env.example tts_service/.env
cp tts_service_simple/.env.example tts_service_simple/.env
cp frontend/.env.example frontend/.env
```

Edit each .env file with your credentials.

### 2. Generate Security Keys

```bash
# SECRET_KEY
openssl rand -hex 32

# TOKEN_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Setup Cloudflare Tunnel (for TTS)

```bash
# Install cloudflared
# Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
# Linux: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create tts-tunnel

# Copy credentials
cp ~/.cloudflared/<tunnel-id>.json cloudflared-credentials.json

# Configure
cp cloudflared-config.example.yml cloudflared-config.yml
# Edit cloudflared-config.yml with your tunnel ID and domain
```

### 4. Start Services

Choose your deployment scenario and run the appropriate docker-compose command.

## Monitoring

### Check Service Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f bot_service
docker-compose logs -f tts_service
```

### Health Checks
```bash
# Bot Service
curl http://localhost:8000/health

# TTS Service
curl http://localhost:8001/health
```

## Troubleshooting

### GPU Not Detected
```bash
# Check NVIDIA Docker runtime
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### Cloudflare Tunnel Not Working
```bash
# Check tunnel status
cloudflared tunnel info tts-tunnel

# Test connection
docker-compose logs cloudflared
```

### Database Connection Issues
```bash
# Check PostgreSQL
docker-compose exec postgres psql -U tts_user -d tts_bot -c "SELECT 1;"
```

## Updating

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose build

# Restart services
docker-compose down
docker-compose up -d
```

## Backup

### Database Backup
```bash
docker-compose exec postgres pg_dump -U tts_user tts_bot > backup.sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U tts_user tts_bot < backup.sql
```
