# Validation System Documentation

## Overview

The application implements comprehensive validation on both frontend and backend to ensure data integrity and security. This document describes the validation architecture and usage patterns.

## Architecture

### Defense in Depth

The validation system follows a **defense in depth** approach:

1. **Frontend Validation** (First Line)
   - Immediate user feedback
   - Prevents unnecessary API calls
   - Uses Zod schemas with react-hook-form

2. **Backend Validation** (Second Line)
   - Authoritative validation
   - Prevents malicious requests
   - Uses Pydantic models with custom validators

3. **Input Sanitization** (Both Layers)
   - XSS prevention
   - SQL injection prevention
   - Removes dangerous characters

## Frontend Validation

### Zod Schemas

Primary location: `frontend/src/shared/utils/validationSchemas.ts`
Legacy compatibility re-export: `frontend/src/utils/validationSchemas.ts`

#### Available Schemas

```typescript
// Stream Management
streamTitleSchema          // Stream title (1-140 chars, no < >)
streamCategorySchema       // Category selection

// TTS Settings
ttsSettingsSchema          // General TTS settings
ttsPlatformSettingsSchema  // Platform-specific settings
ttsAudioSettingsSchema     // Audio volume and speed
ttsMessageRequest          // TTS message synthesis

// Drops Configuration
dropsConfigSchema          // Drops system config with probability validation

// Commands
commandSchema              // Custom command creation

// Rewards (Channel Points)
rewardSchema               // Channel points reward creation

// Voice Management
voiceUploadSchema          // Custom voice upload

// User Management
filteredWordSchema         // Filtered word addition
blockedUserSchema          // User blocking
userSettingsSchema         // User preferences

// Support
supportTicketSchema        // Support ticket creation

// Authentication
loginSchema                // OAuth/login form validation

// YouTube
youtubeSettingsSchema      // YouTube integration settings
```

#### Usage with React Hook Form

```typescript
import { useFormValidation } from '@/hooks/useFormValidation';
import { streamTitleSchema } from '@/utils/validationSchemas';

function StreamTitleForm() {
  const form = useFormValidation({
    schema: streamTitleSchema,
    mode: 'onChange', // Real-time validation
    defaultValues: {
      title: '',
      platform: 'both'
    }
  });

  const onSubmit = async (data) => {
    // Data is already validated and typed
    await updateStreamTitle(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('title')} />
      {form.formState.errors.title && (
        <span className="error">
          {form.formState.errors.title.message}
        </span>
      )}
      <button type="submit">Update</button>
    </form>
  );
}
```

#### Manual Validation

```typescript
import { validateWithSchema, streamTitleSchema } from '@/utils/validationSchemas';

const result = validateWithSchema(streamTitleSchema, data);
if (!result.success) {
  console.error('Validation errors:', result.errors);
  // result.errors = { title: 'Error message', ... }
}
```

### Input Sanitization

Location: `frontend/src/utils/sanitization.ts`

#### Available Functions

```typescript
// General
sanitizeInput(input, maxLength)      // General purpose sanitization
sanitizeHtml(input)                  // HTML escaping for XSS prevention

// Specific Use Cases
sanitizeStreamTitle(title)           // Stream titles
sanitizeUsername(username)           // Usernames
sanitizeUrl(url)                     // URLs (protocol validation)
sanitizeCommandName(name)            // Command names
sanitizeVoiceName(name)              // Voice names
sanitizeTtsMessage(message)          // TTS messages
sanitizeJsonKey(key)                 // JSON object keys
sanitizeFileName(fileName)           // File names (path traversal prevention)
sanitizeEmail(email)                 // Email addresses
sanitizeNumber(value, min, max, def) // Numeric inputs

// Utilities
sanitizeObject(obj, sanitizer)       // Recursively sanitize object
stripHtmlTags(input)                 // Remove all HTML tags
```

#### Usage Example

```typescript
import { sanitizeStreamTitle } from '@/utils/sanitization';

const handleSubmit = async (data) => {
  // Sanitize before sending to API
  const sanitized = {
    ...data,
    title: sanitizeStreamTitle(data.title)
  };
  
  await api.updateStream(sanitized);
};
```

## Backend Validation

### Pydantic Models

Location: `bot_service/models/validation_models.py`

#### Available Models

```python
# Stream Management
StreamTitleUpdateRequest
StreamCategoryUpdateRequest

# TTS
TtsSettingsUpdateRequest
TtsPlatformSettingsRequest
TtsAudioSettingsRequest
TtsMessageRequest
VoiceUploadRequest
FilteredWordRequest
BlockUserRequest

# Drops
DropsConfigUpdateRequest
DropsRewardRequest

# Commands
CommandCreateRequest

# Rewards
RewardCreateRequest

# Support
SupportTicketRequest

# User Settings
UserSettingsUpdateRequest

# YouTube
YouTubeSettingsUpdateRequest

# Error Reporting
FrontendErrorReport
```

#### Usage in API Endpoints

```python
from fastapi import APIRouter, Depends, HTTPException
from models.validation_models import StreamTitleUpdateRequest
from auth.auth import get_current_user

router = APIRouter()

@router.post("/stream/title")
async def update_stream_title(
    request: StreamTitleUpdateRequest,  # Automatic validation
    current_user: dict = Depends(get_current_user)
):
    # request.title is already validated and sanitized
    # Pydantic ensures:
    # - Type correctness
    # - Length constraints
    # - Regex patterns
    # - Custom validators
    
    result = await stream_service.update_title(
        user_id=current_user['id'],
        title=request.title,
        platform=request.platform
    )
    
    return {"success": True, "data": result}
```

#### Custom Validators

```python
from pydantic import validator

class StreamTitleUpdateRequest(BaseValidationModel):
    title: str = Field(..., min_length=1, max_length=140)
    
    @validator('title')
    def sanitize_title(cls, v):
        """Sanitize and validate title"""
        from validators.input_validators import sanitize_stream_title
        
        sanitized = sanitize_stream_title(v)
        if not sanitized:
            raise ValueError('Title cannot be empty after sanitization')
        return sanitized
```

### Input Sanitization

Location: `bot_service/validators/input_validators.py`

#### Available Functions

```python
# General
sanitize_input(text, max_length, allow_special)  # General sanitization
sanitize_sql_string(text)                        # SQL injection prevention

# Specific Use Cases
sanitize_stream_title(title)                     # Stream titles
sanitize_tts_message(message)                    # TTS messages
sanitize_voice_name(name)                        # Voice names
sanitize_file_name(filename)                     # File names

# Validation
validate_username(username)                      # Username validation
validate_email(email)                            # Email validation
validate_url(url)                                # URL validation
validate_command_name(name)                      # Command name validation
validate_json_key(key)                           # JSON key validation
validate_pagination(page, limit)                 # Pagination parameters
validate_file_upload(file, max_size)             # File upload validation
```

#### Usage Example

```python
from validators.input_validators import sanitize_stream_title, validate_username

@router.post("/stream/title")
async def update_title(request: StreamTitleUpdateRequest):
    # Additional sanitization layer (defense in depth)
    sanitized_title = sanitize_stream_title(request.title)
    
    # Process with sanitized data
    result = await service.update(title=sanitized_title)
    return result
```

## Validation Error Handling

### Frontend Error Display

```typescript
// Inline validation errors
{form.formState.errors.title && (
  <p className="text-sm text-red-500 mt-1">
    {form.formState.errors.title.message}
  </p>
)}

// Toast notifications for API errors
import { toast } from 'sonner';

try {
  await api.updateSettings(data);
  toast.success('Settings saved');
} catch (error) {
  if (error.response?.status === 422) {
    // Validation error from backend
    const errors = error.response.data.errors;
    errors.forEach(err => {
      toast.error(`${err.field}: ${err.message}`);
    });
  } else {
    toast.error('Failed to save settings');
  }
}
```

### Backend Error Responses

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Return detailed validation errors"""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"][1:])
        message = error["msg"]
        errors.append({"field": field, "message": message})
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": errors
        }
    )
```

## Best Practices

### 1. Always Validate on Both Sides

```typescript
// ✅ GOOD: Validate on frontend AND backend
// Frontend
const form = useFormValidation({ schema: streamTitleSchema });

// Backend
@router.post("/stream/title")
async def update_title(request: StreamTitleUpdateRequest):
    ...

// ❌ BAD: Only frontend validation
// Malicious users can bypass frontend validation
```

### 2. Sanitize Before Sending

```typescript
// ✅ GOOD: Sanitize user input
import { sanitizeStreamTitle } from '@/utils/sanitization';

const data = {
  title: sanitizeStreamTitle(userInput)
};
await api.updateStream(data);

// ❌ BAD: Send raw user input
await api.updateStream({ title: userInput });
```

### 3. Use Specific Validators

```typescript
// ✅ GOOD: Use specific sanitizer
sanitizeCommandName(input)  // Only alphanumeric + underscore

// ❌ BAD: Use generic sanitizer
sanitizeInput(input)  // May allow unwanted characters
```

### 4. Provide Clear Error Messages

```typescript
// ✅ GOOD: Descriptive error
z.string()
  .min(1, 'Title is required')
  .max(140, 'Title must be 140 characters or less')

// ❌ BAD: Generic error
z.string().min(1).max(140)  // Uses default messages
```

### 5. Validate Complex Objects

```typescript
// ✅ GOOD: Validate nested structure
const dropsConfigSchema = z.object({
  probabilities: z.object({
    common: z.number().min(0).max(100),
    rare: z.number().min(0).max(100),
    // ...
  }).refine(
    (data) => {
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      return Math.abs(total - 100) < 0.01;
    },
    { message: 'Probabilities must sum to 100%' }
  )
});

// ❌ BAD: No validation of relationships
const dropsConfigSchema = z.object({
  probabilities: z.record(z.number())
});
```

## Security Considerations

### XSS Prevention

```typescript
// All user input is sanitized to prevent XSS
sanitizeHtml('<script>alert("xss")</script>')
// Returns: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
```

### SQL Injection Prevention

```python
# Use ORM (SQLAlchemy) - automatic parameterization
user = db.query(User).filter(User.username == username).first()

# If raw SQL is needed, sanitize
from validators.input_validators import sanitize_sql_string
safe_input = sanitize_sql_string(user_input)
```

### Path Traversal Prevention

```typescript
// File names are sanitized
sanitizeFileName('../../../etc/passwd')
// Returns: 'etcpasswd'
```

### Protocol Validation

```typescript
// URLs are validated for safe protocols
sanitizeUrl('javascript:alert("xss")')
// Returns: '' (empty string - invalid)

sanitizeUrl('https://example.com')
// Returns: 'https://example.com' (valid)
```

## Testing Validation

### Frontend Tests

```typescript
import { validateWithSchema, streamTitleSchema } from '@/utils/validationSchemas';

describe('Stream Title Validation', () => {
  it('should accept valid title', () => {
    const result = validateWithSchema(streamTitleSchema, {
      title: 'My Stream',
      platform: 'twitch'
    });
    expect(result.success).toBe(true);
  });
  
  it('should reject title with HTML', () => {
    const result = validateWithSchema(streamTitleSchema, {
      title: '<script>alert("xss")</script>',
      platform: 'twitch'
    });
    expect(result.success).toBe(false);
    expect(result.errors.title).toBeDefined();
  });
  
  it('should reject title over 140 chars', () => {
    const result = validateWithSchema(streamTitleSchema, {
      title: 'a'.repeat(141),
      platform: 'twitch'
    });
    expect(result.success).toBe(false);
  });
});
```

### Backend Tests

```python
import pytest
from models.validation_models import StreamTitleUpdateRequest
from pydantic import ValidationError

def test_valid_stream_title():
    request = StreamTitleUpdateRequest(
        title="My Stream",
        platform="twitch"
    )
    assert request.title == "My Stream"

def test_invalid_stream_title_too_long():
    with pytest.raises(ValidationError) as exc_info:
        StreamTitleUpdateRequest(
            title="a" * 141,
            platform="twitch"
        )
    assert "max_length" in str(exc_info.value)

def test_sanitize_stream_title():
    request = StreamTitleUpdateRequest(
        title="<script>alert('xss')</script>",
        platform="twitch"
    )
    # Title should be sanitized by validator
    assert "<script>" not in request.title
```

## Migration Guide

### Updating Existing Endpoints

1. **Import validation model**
   ```python
   from models.validation_models import StreamTitleUpdateRequest
   ```

2. **Replace dict with model**
   ```python
   # Before
   @router.post("/stream/title")
   async def update_title(data: dict):
       title = data.get('title')
       ...
   
   # After
   @router.post("/stream/title")
   async def update_title(request: StreamTitleUpdateRequest):
       title = request.title  # Already validated
       ...
   ```

3. **Update frontend to use schema**
   ```typescript
   // Before
   const form = useForm();
   
   // After
   import { streamTitleSchema } from '@/utils/validationSchemas';
   const form = useFormValidation({ schema: streamTitleSchema });
   ```

## Troubleshooting

### Common Issues

**Issue**: Validation passes on frontend but fails on backend
- **Cause**: Frontend and backend schemas are out of sync
- **Solution**: Ensure both use same constraints (length, regex, etc.)

**Issue**: Sanitization removes valid characters
- **Cause**: Using wrong sanitizer for the use case
- **Solution**: Use specific sanitizer (e.g., `sanitizeVoiceName` instead of `sanitizeInput`)

**Issue**: Error messages not displaying
- **Cause**: Not checking `formState.errors`
- **Solution**: Use `form.formState.errors.fieldName?.message`

## References

- [Zod Documentation](https://zod.dev/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
