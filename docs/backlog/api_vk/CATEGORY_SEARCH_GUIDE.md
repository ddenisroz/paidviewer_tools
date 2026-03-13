# VK Live API: Category Search Implementation Guide

This document outlines the correct configuration for implementing **Category Search** in VK Live applications, as the documented `/v1/category/search` endpoint is broken.

## 1. Endpoint Configuration

**⚠️ IMPORTANT:** This method is only available on the **Production** environment. It returns `404` or `Unknown Method` on the Dev environment (`apidev`).

- **Base URL**: `https://api.live.vkvideo.ru` (Production)
- **Path**: `/v1/public_video_stream/category/`
- **Method**: `GET`

## 2. Request Parameters

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `search` | `string` | **Yes** | The search query string. **Note:** Use `search`, NOT `query`. | `dota` |
| `type` | `string` | Yes | Category type filter. | `game` |
| `limit` | `integer` | No | Number of results to return. | `20` |

**Example URL:**
`https://api.live.vkvideo.ru/v1/public_video_stream/category/?search=dota&type=game&limit=20`

## 3. Response Handling

The response structure matches the internal API format and differs from the public documentation.

### JSON Structure
The response returns a JSON object where `data` is a **direct array** of category objects.

```json
{
  "data": [
    {
      "id": "aa7162db-bab7-4ed4-bc6f-bf225d668575",
      "title": "Dota 2",
      "type": "game",
      "coverUrl": "https://images.live.vkvideo.ru/...", // Note: CamelCase
      "playGameUrl": "..."
    },
    // ... more items
  ],
  "extra": {
    "isLast": false,
    "offset": 5
  }
}
```

### Key Integration Notes

1.  **Response Parsing**: Expected `data` to be an `Array`, not `{ categories: [] }`.
    *   *Check:* `Array.isArray(response.data)`
2.  **Field Naming (CamelCase)**: The API returns `coverUrl` (camelCase), whereas older/public methods often returned `cover_url` (snake_case).
    *   *Action:* Ensure your frontend maps `coverUrl` correctly if it expects snake_case.

## 4. Summary for Developer

> "Use the production endpoint **`https://api.live.vkvideo.ru/v1/public_video_stream/category/`**. Pass the search string in the **`search`** parameter (not `query`). Be aware that the response `data` is an array and image fields are **camelCase** (`coverUrl`)."
