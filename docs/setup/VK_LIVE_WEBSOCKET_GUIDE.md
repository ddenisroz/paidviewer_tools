# VK Live WebSocket Integration Guide

## Overview

VK Live uses Centrifugo V4 for WebSocket connections to deliver real-time events with low latency.

## Connection Process

### 1. Get Connection Token

```http
GET /v1/websocket/token
Authorization: Bearer {user_access_token}
```

Response:
```json
{
  "data": {
    "token": "jwt_token_here"
  }
}
```

### 2. Connect to WebSocket

```
wss://pubsub-dev.live.vkvideo.ru/connection/websocket?format=json&cf_protocol_version=v2
```

Use Centrifugo V4 compatible client library.

### 3. Get Channel Names

Retrieve channel names from DevAPI based on your use case (chat, stream events, etc.)

### 4. Subscribe to Channels

For public channels - subscribe directly.

For limited access channels - get subscription token first:

```http
GET /v1/websocket/subscription_token?channels=channel1,channel2
Authorization: Bearer {user_access_token}
```

Response:
```json
{
  "data": {
    "channel_tokens": [
      {
        "channel": "channel_name",
        "token": "subscription_jwt"
      }
    ]
  }
}
```

### 5. Process Events

Events format:
```json
{
  "type": "event_type_constant",
  "data": {
    // Event-specific payload
  }
}
```

## Event Characteristics

- **Low latency**: Critical for real-time delivery
- **High frequency**: Many events per second
- **Non-critical loss**: Message loss is acceptable

## Implementation Notes

- Use Centrifugo V4 compatible client libraries
- Handle reconnection logic
- Implement exponential backoff for retries
- Parse event types and route to appropriate handlers
- Store subscription tokens for limited channels

## Python Client Libraries

Recommended:
- `centrifuge-python` - Official Centrifugo client
- `websockets` - Low-level WebSocket implementation

## Current Implementation

See `bot_service/bots/vk_bot.py` for VK Live bot implementation with WebSocket support.

## References

- Full API documentation: `docs/vk/Websocket.md`
- WebSocket methods: `docs/vk/Методы_Websocket.md`
- Event subscription: `docs/vk/Подписка на события.md`
- Centrifugo docs: https://centrifugal.dev/
