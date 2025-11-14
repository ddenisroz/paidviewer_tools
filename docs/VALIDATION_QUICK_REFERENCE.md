# Validation Quick Reference

Quick reference for using the validation system in the TTS_TTV_0.02 application.

## Frontend

### Form Validation

```typescript
import { useFormValidation } from '@/hooks/useFormValidation';
import { streamTitleSchema } from '@/utils/validationSchemas';

const form = useFormValidation({
  schema: streamTitleSchema,
  mode: 'onChange',
  defaultValues: { title: '' }
});

<form onSubmit={form.handleSubmit(onSubmit)}>
  <input {...form.register('title')} />
  {form.formState.errors.title?.message}
</form>
```

### Input Sanitization

```typescript
import { sanitizeStreamTitle } from '@/utils/sanitization';

const sanitized = sanitizeStreamTitle(userInput);
```

### Common Schemas

| Schema | Use Case |
|--------|----------|
| `streamTitleSchema` | Stream title updates |
| `ttsSettingsSchema` | TTS settings |
| `dropsConfigSchema` | Drops configuration |
| `commandSchema` | Custom commands |
| `rewardSchema` | Channel points rewards |
| `voiceUploadSchema` | Voice uploads |

### Common Sanitizers

| Function | Use Case |
|----------|----------|
| `sanitizeStreamTitle()` | Stream titles |
| `sanitizeUsername()` | Usernames |
| `sanitizeUrl()` | URLs |
| `sanitizeCommandName()` | Command names |
| `sanitizeTtsMessage()` | TTS messages |
| `sanitizeVoiceName()` | Voice names |

## Backend

### API Validation

```python
from models.validation_models import StreamTitleUpdateRequest

@router.post("/stream/title")
async def update_title(request: StreamTitleUpdateRequest):
    # request.title is validated and sanitized
    return {"success": True}
```

### Input Sanitization

```python
from validators.input_validators import sanitize_stream_title

sanitized = sanitize_stream_title(user_input)
```

### Common Models

| Model | Use Case |
|-------|----------|
| `StreamTitleUpdateRequest` | Stream title updates |
| `TtsSettingsUpdateRequest` | TTS settings |
| `DropsConfigUpdateRequest` | Drops configuration |
| `CommandCreateRequest` | Custom commands |
| `RewardCreateRequest` | Channel points rewards |
| `VoiceUploadRequest` | Voice uploads |

### Common Sanitizers

| Function | Use Case |
|----------|----------|
| `sanitize_stream_title()` | Stream titles |
| `sanitize_tts_message()` | TTS messages |
| `sanitize_voice_name()` | Voice names |
| `sanitize_file_name()` | File names |
| `validate_username()` | Username validation |

## Error Handling

### Frontend

```typescript
try {
  await api.updateSettings(data);
  toast.success('Saved');
} catch (error) {
  if (error.response?.status === 422) {
    // Validation error
    error.response.data.errors.forEach(err => {
      toast.error(`${err.field}: ${err.message}`);
    });
  }
}
```

### Backend

```python
from fastapi import HTTPException

if not valid:
    raise HTTPException(
        status_code=422,
        detail="Validation error",
        errors=[{"field": "title", "message": "Invalid"}]
    )
```

## Best Practices

1. ✅ Always validate on both frontend and backend
2. ✅ Sanitize user input before sending to API
3. ✅ Use specific sanitizers for specific use cases
4. ✅ Provide clear, user-friendly error messages
5. ✅ Test validation with edge cases

## Common Patterns

### Stream Title Update

```typescript
// Frontend
import { sanitizeStreamTitle } from '@/utils/sanitization';
const title = sanitizeStreamTitle(input);
await api.updateStreamTitle(title);

// Backend
from models.validation_models import StreamTitleUpdateRequest
@router.post("/stream/title")
async def update_title(request: StreamTitleUpdateRequest):
    ...
```

### TTS Settings Update

```typescript
// Frontend
import { ttsSettingsSchema } from '@/utils/validationSchemas';
const form = useFormValidation({ schema: ttsSettingsSchema });

// Backend
from models.validation_models import TtsSettingsUpdateRequest
@router.post("/tts/settings")
async def update_settings(request: TtsSettingsUpdateRequest):
    ...
```

### Custom Command Creation

```typescript
// Frontend
import { commandSchema } from '@/utils/validationSchemas';
const form = useFormValidation({ schema: commandSchema });

// Backend
from models.validation_models import CommandCreateRequest
@router.post("/commands")
async def create_command(request: CommandCreateRequest):
    ...
```

## Security Checklist

- [ ] User input sanitized before API call
- [ ] API endpoint uses validation model
- [ ] HTML tags removed from text fields
- [ ] URLs validated for safe protocols
- [ ] File names checked for path traversal
- [ ] Numeric inputs bounded
- [ ] String lengths limited

## Full Documentation

See `docs/VALIDATION_SYSTEM.md` for complete documentation.
