# Docker Deployment Guide

Last updated: 2026-03-11

## Current Status

Use this section as the current source of truth. Some legacy notes remain below for historical Cloudflare examples.

Read first:

1. `docs/STATUS_TRACKER.md`
2. `docs/setup/LOCAL_TTS_INTEGRATION.md`
3. `docs/setup/REPO_SPLIT_GUIDE.md`

Current container topology:

- frontend talks only to `bot_service`
- advanced synthesis for `f5` and `qwen` goes through `tts-gateway`
- provider-owned voice/admin APIs stay behind `bot_service`
- qwen voice CRUD is intentionally disabled until `QWEN_VOICE_SERVICE_URL` is configured

Current compose entrypoints:

- `deploy/docker/docker-compose.dev.yml`: full local stack in this repo
- `deploy/docker/docker-compose.prod.yml`: production-like single-host stack in this repo
- `deploy/docker/docker-compose.bot.yml`: bot/frontend host with remote upstream TTS services
- `deploy/docker/docker-compose.tts-advanced.yml`: compatibility overlay for a dedicated remote `f5-tts-service` host with Cloudflare Tunnel
- `deploy/docker/docker-compose.tts-simple.yml`: compatibility overlay for a local single-node `f5-tts-service` host

Important constraints:

- `tts-gateway` and `nano-qwen3tts-vllm` are separate upstream repositories
- `tts-gateway` requires Redis
- `f5-tts-service` requires its own PostgreSQL state plus model/vendor assets
- do not restore direct frontend runtime dependency on `VITE_TTS_SERVICE_URL`

## Overview

This guide explains how to deploy the TTS Bot using Docker Compose in different configurations.

## Deployment Scenarios

### Scenario 1: All-in-One (Development)
Run everything on one machine for development.

```bash
docker compose -f deploy/docker/docker-compose.dev.yml up -d
```

### Scenario 2: Bot/Frontend Host With External TTS Stack
- **Machine 1+ (External upstreams)**: `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`
- **Machine 2 (Server)**: `bot_service` + frontend + database

**Machine 1 (GPU PC):**
```bash
# Setup Cloudflare Tunnel first
# 1. Create tunnel: cloudflared tunnel create tts-tunnel
# 2. Copy credentials to cloudflared-credentials.json
# 3. Configure cloudflared-config.yml with your domain

# Start TTS service
docker compose -f deploy/docker/docker-compose.tts-advanced.yml up -d
```

**Machine 2 (Server):**
```bash
# Configure remote upstream URLs in bot_service/.env
# TTS_GATEWAY_URL=https://tts-gateway.yourdomain.com
# F5_TTS_SERVICE_URL=https://f5-tts.yourdomain.com

# Start bot service and frontend
docker compose -f deploy/docker/docker-compose.bot.yml up -d
```

### Scenario 3: Compatibility F5-Only Host
- **Machine 1 (GPU PC)**: standalone `f5-tts-service` compatibility host
- **Machine 2 (Server)**: optional `bot_service` + frontend + database

**Machine 1 (GPU PC):**
```bash
# Start single-node F5 profile
docker compose -f deploy/docker/docker-compose.tts-simple.yml up -d
```

**Machine 2 (Server):**
```bash
# Same as Scenario 2
docker compose -f deploy/docker/docker-compose.bot.yml up -d
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
- PostgreSQL (included in `deploy/docker/docker-compose.bot.yml`)

## Setup Steps

### 1. Configure Environment Variables

Copy .env.example files to .env:
```bash
cp bot_service/.env.example bot_service/.env
cp frontend/.env.example frontend/.env
```

Edit each `.env` file with your credentials.
If upstream TTS runs on separate hosts, configure `TTS_GATEWAY_URL`, `F5_TTS_SERVICE_URL`, and `QWEN_TTS_SERVICE_URL` accordingly.

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

# F5 compatibility host
curl http://localhost:8011/health/ready
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

