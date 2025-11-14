# Permission and Role System Implementation

## Overview

This document describes the implementation of the role-based access control (RBAC) system for the bot service. The system provides strict separation between admin and user functions, with support for both application-level roles and platform-specific roles.

## Implementation Date

November 14, 2025

## Components Implemented

### 1. Core Permission System (`bot_service/core/permissions.py`)

**Features:**
- Application-level roles: `admin`, `user`, `guest`
- Platform-specific roles: `broadcaster`, `moderator`, `vip`, `subscriber`, `viewer` (Twitch/VK)
- Granular permissions for different operations
- Role hierarchy with permission inheritance
- Decorators for endpoint protection:
  - `@require_permission(Permission.MANAGE_USERS)`
  - `@require_role(AppRole.ADMIN)`
  - `@require_platform_role(PlatformRole.MODERATOR)`
  - `@require_ownership_or_admin()`

**Role Hierarchy:**
```
Admin (Level 5) - Full system access
├── User (Level 4) - Manage own resources
└── Guest (Level 1) - Read-only access

Platform Roles:
Broadcaster/Owner (Level 5) > Moderator (Level 4) > VIP (Level 3) > Subscriber (Level 2) > Viewer (Level 1)
```

**Permissions:**
- Admin: `MANAGE_USERS`, `MANAGE_GLOBAL_VOICES`, `VIEW_ALL_SETTINGS`, `MANAGE_SYSTEM`, `BLOCK_USERS`
- User: `MANAGE_OWN_SETTINGS`, `MANAGE_OWN_VOICES`, `MANAGE_STREAM`, `MANAGE_BOTS`, `MANAGE_COMMANDS`, `MANAGE_REWARDS`, `MANAGE_DROPS`
- Guest: `VIEW_CHAT`, `VIEW_PUBLIC_DATA`

### 2. Database Schema Updates (`bot_service/core/database.py`)

**New Fields Added to User Model:**
```python
# Application role
role = Column(String, default='user', nullable=False, index=True)

# Twitch platform roles
twitch_is_broadcaster = Column(Boolean, default=False)
twitch_is_moderator = Column(Boolean, default=False)
twitch_is_vip = Column(Boolean, default=False)
twitch_is_subscriber = Column(Boolean, default=False)

# VK platform roles
vk_is_owner = Column(Boolean, default=False)
vk_is_moderator = Column(Boolean, default=False)
```

**Migration File:**
- `bot_service/alembic/versions/20251114_add_role_fields_to_users.py`
- Automatically migrates existing `is_admin=true` users to `role='admin'`

### 3. API Endpoint Separation

**Admin Endpoints (`bot_service/api/admin/`):**
- `users_management.py` - User management (CRUD operations)
  - `GET /api/admin/users/list` - List all users with pagination and search
  - `GET /api/admin/users/{user_id}` - Get user details
  - `POST /api/admin/users/{user_id}/block` - Block a user
  - `POST /api/admin/users/{user_id}/unblock` - Unblock a user
  - `PUT /api/admin/users/{user_id}` - Update user properties
  - `DELETE /api/admin/users/{user_id}` - Delete a user
  - `GET /api/admin/users/stats/overview` - System statistics

All admin endpoints are protected with `@require_permission()` or `@require_role()` decorators.

**User Endpoints (`bot_service/api/user/`):**
- `settings.py` - Personal settings management
  - `GET /api/user/settings/me` - Get current user's settings
  - `PUT /api/user/settings/me` - Update current user's settings
  - `PUT /api/user/settings/me/tts` - Update TTS settings
  - `PUT /api/user/settings/me/audio` - Update audio settings
  - `GET /api/user/settings/{user_id}` - Get settings (with ownership check)

All user endpoints are protected with `@require_permission(Permission.MANAGE_OWN_SETTINGS)`.

### 4. Platform Role Synchronization (`bot_service/services/platform_sync_service.py`)

**Features:**
- Automatic role synchronization from platform APIs (Twitch, VK)
- Channel points/rewards synchronization
- Sync on login
- Bulk sync for all users (admin operation)

**Methods:**
- `sync_user_roles(user, platform, db)` - Sync roles from platform API
- `sync_channel_points(user, platform, db)` - Sync channel rewards
- `sync_on_login(user, platform, db)` - Full sync on user login
- `sync_all_users(platform, db)` - Bulk sync (admin only)

**Usage:**
```python
from services.platform_sync_service import platform_sync_service

# Sync on login
result = await platform_sync_service.sync_on_login(user, 'twitch', db)

# Manual sync
success = await platform_sync_service.sync_user_roles(user, 'twitch', db)
```

### 5. Command Permission Checks (`bot_service/core/command_permission_checker.py`)

**Features:**
- Role hierarchy checks for bot commands
- Cooldown management
- Permission summary for users

**Functions:**
- `can_use_command(command, user, platform, user_roles)` - Check if user can use command
- `get_user_command_permissions(user, platform)` - Get permission summary
- `check_command_cooldown(command, user_id, cooldowns)` - Check cooldown status
- `update_command_cooldown(command, user_id, cooldowns)` - Update cooldown

**Updated Command Executor:**
- `bot_service/core/command_executor.py` - Updated `check_user_role()` to use new permission system with proper role hierarchy

## Usage Examples

### Protecting Admin Endpoints

```python
from fastapi import APIRouter, Depends
from core.permissions import require_permission, Permission
from auth.auth import get_current_user

router = APIRouter()

@router.get("/admin/users")
@require_permission(Permission.MANAGE_USERS)
async def get_all_users(current_user = Depends(get_current_user)):
    # Only admins with MANAGE_USERS permission can access
    ...
```

### Protecting User Endpoints

```python
from core.permissions import require_permission, Permission, require_ownership_or_admin

@router.get("/user/settings/me")
@require_permission(Permission.MANAGE_OWN_SETTINGS)
async def get_my_settings(current_user = Depends(get_current_user)):
    # Any authenticated user can access their own settings
    ...

@router.get("/user/settings/{user_id}")
@require_ownership_or_admin(resource_user_id_param="user_id")
async def get_user_settings(user_id: int, current_user = Depends(get_current_user)):
    # User can only access their own settings, admins can access any
    ...
```

### Checking Platform Roles

```python
from core.permissions import has_platform_role, PlatformRole

# Check if user is a moderator
if has_platform_role(user, PlatformRole.MODERATOR, platform='twitch'):
    # User is a moderator or higher
    ...
```

### Checking Command Permissions

```python
from core.command_permission_checker import can_use_command

if can_use_command(command, user, 'twitch'):
    # User can execute this command
    await execute_command(command, user)
else:
    # Permission denied
    await send_error_message("You don't have permission to use this command")
```

## Migration Instructions

### 1. Run Database Migration

```bash
cd bot_service
alembic upgrade head
```

This will:
- Add `role` field to users table
- Add platform role fields (twitch_is_broadcaster, etc.)
- Migrate existing `is_admin=true` users to `role='admin'`

### 2. Update Existing Code

**Before:**
```python
if user.is_admin:
    # Admin-only code
    ...
```

**After:**
```python
from core.permissions import AppRole

user_role = AppRole(user.role)
if user_role == AppRole.ADMIN:
    # Admin-only code
    ...
```

### 3. Update API Endpoints

Move admin-only endpoints to `bot_service/api/admin/` and add permission decorators.
Move user endpoints to `bot_service/api/user/` and add permission decorators.

### 4. Register New Routers

In `bot_service/main.py`:
```python
from api.admin import users_management
from api.user import settings

app.include_router(users_management.router)
app.include_router(settings.router)
```

## Testing

### Test Permission System

```python
from core.permissions import has_permission, Permission, AppRole

# Test admin permissions
assert has_permission(AppRole.ADMIN, Permission.MANAGE_USERS) == True
assert has_permission(AppRole.USER, Permission.MANAGE_USERS) == False

# Test user permissions
assert has_permission(AppRole.USER, Permission.MANAGE_OWN_SETTINGS) == True
assert has_permission(AppRole.GUEST, Permission.MANAGE_OWN_SETTINGS) == False
```

### Test Platform Roles

```python
from core.permissions import get_platform_roles, PlatformRole

# Set up test user
user.twitch_is_broadcaster = True
user.twitch_is_moderator = True

roles = get_platform_roles(user, 'twitch')
assert PlatformRole.BROADCASTER in roles
assert PlatformRole.MODERATOR in roles
```

### Test Command Permissions

```python
from core.command_permission_checker import can_use_command

# Test broadcaster command
command.allowed_roles = 'broadcaster'
user.twitch_is_broadcaster = True
assert can_use_command(command, user, 'twitch') == True

# Test moderator command
command.allowed_roles = 'moderator'
user.twitch_is_moderator = True
assert can_use_command(command, user, 'twitch') == True
```

## Security Considerations

1. **Role Hierarchy**: Higher roles automatically inherit permissions from lower roles
2. **Ownership Checks**: Users can only access their own resources unless they're admins
3. **Platform Isolation**: Platform roles are separate for Twitch and VK
4. **Admin Protection**: Cannot block, delete, or modify admin users
5. **Self-Protection**: Users cannot delete themselves

## Future Enhancements

1. **Custom Permissions**: Allow creating custom permission sets
2. **Role Templates**: Pre-defined role templates for common use cases
3. **Audit Logging**: Track all permission changes and access attempts
4. **Time-based Roles**: Temporary role assignments with expiration
5. **Role Groups**: Group multiple roles for easier management

## Requirements Satisfied

- ✅ 3.1: Create permission system with AppRole, Permission enums, and decorators
- ✅ 3.2: Add role fields to User model with database migration
- ✅ 3.3: Separate admin and user API endpoints with permission decorators
- ✅ 3.4: Implement platform role synchronization service
- ✅ 3.5: Update command permission checks with role hierarchy

## Files Created/Modified

**Created:**
- `bot_service/core/permissions.py`
- `bot_service/services/platform_sync_service.py`
- `bot_service/api/admin/__init__.py`
- `bot_service/api/admin/users_management.py`
- `bot_service/api/user/__init__.py`
- `bot_service/api/user/settings.py`
- `bot_service/core/command_permission_checker.py`
- `bot_service/alembic/versions/20251114_add_role_fields_to_users.py`

**Modified:**
- `bot_service/core/database.py` - Added role fields to User model
- `bot_service/core/command_executor.py` - Updated check_user_role() method

## Conclusion

The permission and role system has been successfully implemented with:
- Strict separation between admin and user functions
- Platform-specific role support (Twitch, VK)
- Automatic role synchronization from platform APIs
- Comprehensive permission checking with decorators
- Role hierarchy with proper inheritance
- Database migration for existing users

All code passes diagnostics with no errors.
