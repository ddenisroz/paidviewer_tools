# TTS Worker Agent Manual Flow

Этот документ описывает backend-only flow для нового worker control plane.
Фронтенд и UX здесь не меняются.

## Что уже есть

- `bot_service` умеет:
  - выдавать one-time pairing codes
  - регистрировать worker-agent
  - хранить workers и jobs в PostgreSQL
  - выдавать jobs через `/api/worker-agent/poll`
  - принимать результат через `/api/worker-agent/jobs/{job_id}/complete`
- `tts_worker_agent` умеет:
  - активироваться по pairing code
  - работать с F5 и Qwen
  - long-poll'ить control plane
  - отдавать готовое аудио обратно в `bot_service`

## 1. Получить pairing code

Нужна обычная пользовательская сессия `bot_service`.

PowerShell:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/auth/status" -WebSession $session | Out-Null
$csrf = $session.Cookies.GetCookies("http://127.0.0.1:8000")["csrf_token"].Value

$pairing = Invoke-RestMethod `
  -Method POST `
  -Uri "http://127.0.0.1:8000/api/tts/workers/pairing-tokens" `
  -WebSession $session `
  -Headers @{ "X-CSRF-Token" = $csrf } `
  -ContentType "application/json" `
  -Body '{"label_hint":"Home PC","provider_hint":"both"}'

$pairing
```

Ответ:

```json
{
  "success": true,
  "pairing_code": "PV-XXXXXX-XXXXXX",
  "expires_at": "2026-03-22T12:34:56+00:00",
  "label_hint": "Home PC",
  "provider_hint": "both",
  "is_managed": false,
  "owner_user_id": 123
}
```

## 2. Подготовить агент

1. Скопируйте [config.example.json](/h:/Programming/raw_code/AI/Python/paidviewer_tools/tts_worker_agent/config.example.json)
   в `tts_worker_agent/config.json`
2. Вставьте `pairing_code`
3. Укажите `server_base_url`
4. Укажите локальные `endpoint_url` для F5 и/или Qwen

## 3. Запустить агент

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools\tts_worker_agent
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python.exe .\main.py --config .\config.json
```

После успешной активации pairing code очищается из `config.json`, а `worker_token` и `worker_key` сохраняются в конфиг.

## 4. Проверить worker list

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://127.0.0.1:8000/api/tts/workers" `
  -WebSession $session
```

## 5. Создать manual test job

```powershell
$job = Invoke-RestMethod `
  -Method POST `
  -Uri "http://127.0.0.1:8000/api/tts/workers/jobs" `
  -WebSession $session `
  -Headers @{ "X-CSRF-Token" = $csrf } `
  -ContentType "application/json" `
  -Body '{
    "provider":"f5",
    "text":"Привет, это проверка нового worker-agent пути.",
    "voice":"default_voice",
    "payload":{
      "channel_name":"manual-test",
      "author":"manual-test",
      "user_id":123,
      "tts_settings":{"advanced_provider":"f5"},
      "volume_level":50
    }
  }'

$job
```

Для Qwen меняется только `"provider":"qwen"` и, при необходимости, `payload.tts_settings.qwen_model`.

## 6. Проверить статус job

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "http://127.0.0.1:8000/api/tts/workers/jobs/<job_id>" `
  -WebSession $session
```

## Admin-only managed flow

Managed pairing token:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://127.0.0.1:8000/api/tts/admin/workers/pairing-tokens" `
  -WebSession $adminSession `
  -Headers @{ "X-CSRF-Token" = $adminCsrf } `
  -ContentType "application/json" `
  -Body '{"label_hint":"Managed Qwen VM","provider_hint":"qwen","is_managed":true}'
```

Managed job:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://127.0.0.1:8000/api/tts/admin/workers/jobs" `
  -WebSession $adminSession `
  -Headers @{ "X-CSRF-Token" = $adminCsrf } `
  -ContentType "application/json" `
  -Body '{"provider":"qwen","text":"Managed worker test"}'
```

## Important notes

- Текущий endpoint-based self-host path не удалён и не ломается.
- Новый worker-agent path пока backend/manual.
- Никаких новых кнопок и экранов для этого flow пока не добавляется.
