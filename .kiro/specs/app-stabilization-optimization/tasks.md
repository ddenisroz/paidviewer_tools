# Implementation Plan: Application Stabilization and Optimization

## Overview

This implementation plan breaks down the stabilization and optimization work into discrete, manageable coding tasks. Each task builds incrementally on previous tasks and references specific requirements from the requirements document.

## Task List

- [ ] 1. Configuration and Environment Setup
  - Create environment-based configuration system with no hardcoded values
  - _Requirements: 1.1, 1.2, 10.1, 10.2_

- [ ] 1.1 Create .env.example templates
  - Create `.env.example` for bot_service with all required variables
  - Create `.env.example` for tts_service with all required variables
  - Create `.env.example` for tts_service_simple with all required variables
  - Create `.env.example` for frontend with all required variables
  - Document each variable with comments
  - _Requirements: 1.1, 10.1_

- [ ] 1.2 Implement pydantic-settings configuration loader
  - Create `bot_service/core/config.py` with Settings class
  - Add validation for required settings on startup
  - Replace all hardcoded values with `settings.variable_name`
  - _Requirements: 1.1, 6.1, 6.2_

- [ ] 1.3 Create migration and setup scripts
  - Create `migrate.sh` script for easy project setup
  - Add secret generation (openssl, Fernet key)
  - Add directory creation (data, logs, models, voices)
  - Add dependency installation steps
  - _Requirements: 1.1, 1.2_

- [ ] 1.4 Create Docker Compose configurations
  - Create `docker-compose.bot.yml` for bot service deployment
  - Create `docker-compose.tts-advanced.yml` for TTS Service (F5-TTS)
  - Create `docker-compose.tts-simple.yml` for TTS Service Simple
  - Add Cloudflare Tunnel configuration
  - _Requirements: 1.1, 1.2_

- [ ] 2. Platform Abstraction Layer
  - Implement extensible platform architecture for easy addition of new platforms (Kick, YouTube Live)
  - _Requirements: 1.3, 1.4, 6.1_

- [ ] 2.1 Create platform base interface
  - Create `bot_service/platforms/base.py` with StreamingPlatform abstract class
  - Define PlatformConfig dataclass
  - Define all required abstract methods (authenticate, update_stream_title, etc.)
  - _Requirements: 1.3, 6.1_

- [ ] 2.2 Implement platform registry
  - Create `bot_service/platforms/registry.py` with PlatformRegistry class
  - Add platform registration and retrieval methods
  - Add endpoint to expose platform configs to frontend
  - _Requirements: 1.3, 1.4_

- [ ] 2.3 Refactor Twitch platform to use abstraction
  - Create `bot_service/platforms/twitch.py` implementing StreamingPlatform
  - Move existing Twitch logic to new structure
  - Ensure backward compatibility
  - _Requirements: 1.3, 6.1_

- [ ] 2.4 Refactor VK platform to use abstraction
  - Create `bot_service/platforms/vk.py` implementing StreamingPlatform
  - Move existing VK logic to new structure
  - Ensure backward compatibility
  - _Requirements: 1.3, 6.1_

- [ ] 2.5 Update API endpoints to use platform registry
  - Refactor stream_info_api.py to use platform_registry.get()
  - Update all platform-specific endpoints
  - Add validation for unknown platforms
  - _Requirements: 1.3, 6.1, 6.2_

- [ ] 3. Permission and Role System
  - Implement role-based access control with strict separation between admin and user functions
  - _Requirements: 3.1, 3.2, 6.1, 6.2, 9.1_

- [ ] 3.1 Create permission system
  - Create `bot_service/core/permissions.py` with AppRole and Permission enums
  - Implement has_permission() function
  - Create @require_permission and @require_role decorators
  - Add get_platform_roles() function for platform-specific roles
  - _Requirements: 3.1, 3.2, 6.1_

- [ ] 3.2 Add role fields to User model
  - Add `role` field (admin, user, guest) to User model
  - Add platform role fields (twitch_is_broadcaster, etc.)
  - Create database migration
  - _Requirements: 3.1, 9.1_

- [ ] 3.3 Separate admin and user API endpoints
  - Create `bot_service/api/admin/` directory
  - Create `bot_service/api/user/` directory
  - Move admin-only endpoints to admin/ (voices, users management)
  - Move user endpoints to user/ (personal voices, settings)
  - Apply @require_permission decorators
  - _Requirements: 3.1, 3.2, 6.1_

- [ ] 3.4 Implement platform role synchronization
  - Create `bot_service/services/platform_sync_service.py`
  - Implement sync_user_roles() to fetch roles from platform APIs
  - Implement sync_channel_points() to sync rewards
  - Add automatic sync on login
  - _Requirements: 3.1, 3.2, 9.1_

- [ ] 3.5 Update command permission checks
  - Refactor `bot_service/bots/command_handler.py`
  - Implement can_use_command() using platform roles
  - Add role hierarchy checks (broadcaster > moderator > vip > subscriber > viewer)
  - _Requirements: 3.1, 3.2, 6.1_

- [ ] 4. Drops System Separation
  - Separate business logic (probability calculation) from UI (animation widget)
  - _Requirements: 1.3, 6.1, 6.2_

- [ ] 4.1 Create drops calculation service
  - Create `bot_service/services/drops_service.py` with DropsCalculationService
  - Implement calculate_drop() with probability-based logic
  - Implement get_probabilities() and validate_probabilities()
  - Add comprehensive logging
  - _Requirements: 6.1, 6.2, 8.1_

- [ ] 4.2 Update drops API to use calculation service
  - Refactor `/api/drops/spin` endpoint
  - Calculate result on backend before returning to frontend
  - Save result to database
  - Broadcast result via WebSocket
  - _Requirements: 5.1, 5.2, 6.1_

- [ ] 4.3 Refactor drops animation widget
  - Update `frontend/src/widgets/LootboxWidget/LootboxAnimation.tsx`
  - Remove probability calculation from frontend
  - Animate towards predetermined result from backend
  - Ensure animation cannot be manipulated
  - _Requirements: 1.3, 5.1_

- [ ] 5. TTS Service Architecture
  - Implement unified TTS API supporting both TTS Service and TTS Service Simple
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 5.1 Create TTS Service unified API
  - Implement `/synthesize` endpoint with F5-TTS
  - Implement `/voices` endpoint
  - Implement `/voices/upload` endpoint for custom voices
  - Implement `/health` endpoint
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 5.2 Create TTS Service Simple
  - Create `tts_service_simple/` directory structure
  - Implement same API as TTS Service
  - Add user-specific voice storage (`voices/user_{user_id}/`)
  - Implement `/voices/global` endpoint for global voice packs
  - Implement `/voices/download/{voice_id}` for downloading global voices
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 5.3 Update Bot Service TTS client
  - Refactor `bot_service/services/tts_service/tts_client.py`
  - Use `settings.tts_service_url` from environment
  - Add health check before synthesis
  - Add retry logic with exponential backoff
  - _Requirements: 1.1, 1.2, 3.1, 3.2_

- [ ] 5.4 Add TTS generation control based on connections
  - Update `bot_service/services/tts_service/queue_manager.py`
  - Check connection_manager.is_user_connected() before generating
  - Disable TTS when user disconnects
  - Re-enable when user reconnects
  - _Requirements: 1.4, 3.1, 7.1_

- [ ] 6. WebSocket Optimization
  - Implement single WebSocket connection per browser with proper leader election
  - _Requirements: 1.4, 3.1, 3.2, 3.3, 5.1_

- [ ] 6.1 Implement BroadcastChannel leader election
  - Update `frontend/src/utils/sharedWebSocket.ts`
  - Add BroadcastChannel for cross-tab communication
  - Implement leader election algorithm
  - Ensure only leader tab maintains WebSocket connection
  - Broadcast messages to all tabs via BroadcastChannel
  - _Requirements: 1.4, 3.1, 3.2_

- [ ] 6.2 Add heartbeat mechanism
  - Implement ping/pong heartbeat every 30 seconds
  - Detect connection drops quickly
  - Trigger reconnection on heartbeat failure
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6.3 Enhance reconnection logic
  - Implement exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
  - Limit reconnection attempts to 5
  - Show user-friendly error after max attempts
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6.4 Implement backend connection tracking
  - Update `bot_service/core/websocket_manager.py`
  - Track active connections per user
  - Implement is_user_connected() method
  - Trigger cleanup when user fully disconnects
  - _Requirements: 1.4, 3.1, 8.1_

- [ ] 6.5 Add state reconciliation on reconnect
  - Fetch fresh state from backend on reconnection
  - Update all React Query caches
  - Show sync status to user
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 7. Performance Optimization
  - Improve application load times and runtime performance
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2_

- [ ] 7.1 Implement code splitting
  - Add lazy loading for non-critical routes (Admin, Drops, Analytics)
  - Add Suspense boundaries with skeleton loaders
  - Preload on hover for navigation links
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 7.2 Add React performance optimizations
  - Wrap Context providers with React.memo
  - Add useMemo for expensive computations (filtered messages, search results)
  - Add useCallback for stable function references
  - _Requirements: 1.3, 7.1, 7.2_

- [ ] 7.3 Optimize ChatCard with virtualization
  - Implement @tanstack/react-virtual for message list
  - Render only visible messages
  - Maintain scroll position on new messages
  - _Requirements: 1.3, 7.1_

- [ ] 7.4 Optimize database queries
  - Add indexes to User model (twitch_username, vk_user_id)
  - Implement connection pooling (pool_size=10, max_overflow=20)
  - Add eager loading for relationships (joinedload)
  - _Requirements: 1.5, 7.3_

- [ ] 7.5 Implement async operations in backend
  - Use asyncio.gather() for parallel API calls
  - Avoid blocking operations in request handlers
  - Add timeout configurations (30s total, 10s connect)
  - _Requirements: 1.2, 1.5, 7.4_

- [ ] 8. Error Handling
  - Implement comprehensive error handling to prevent application crashes
  - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2_

- [ ] 8.1 Implement global error boundaries
  - Add ErrorBoundary at app level
  - Add ErrorBoundary at route level
  - Add ErrorBoundary for critical components (TTS, Drops)
  - Create fallback UI components
  - _Requirements: 3.1, 3.3_

- [ ] 8.2 Create centralized API error handler
  - Implement handleApiError() function
  - Handle different status codes (401, 403, 500)
  - Show user-friendly error messages
  - Implement retry logic with exponential backoff
  - _Requirements: 3.1, 3.2, 8.1_

- [ ] 8.3 Implement backend exception handlers
  - Add global exception handler for unhandled errors
  - Add HTTPException handler
  - Add RequestValidationError handler with field-level errors
  - Log all errors with context (user_id, endpoint, timestamp)
  - _Requirements: 3.1, 3.2, 8.1, 8.2_

- [ ] 8.4 Add error logging
  - Implement structured logging with levels (DEBUG, INFO, WARNING, ERROR)
  - Log errors to file with rotation
  - Redact sensitive information (tokens, passwords)
  - Add error tracking endpoint for frontend errors
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 9. Code Cleanup
  - Remove dead code, unused dependencies, and improve code quality
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.2, 10.3, 10.4_

- [ ] 9.1 Run dependency audit
  - Run `npx depcheck` on frontend
  - Run `pip-audit` on backend
  - Remove unused dependencies
  - Update dependencies to latest stable versions
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9.2 Remove dead code
  - Run `npx ts-prune` to find unused exports
  - Run `vulture` to find unused Python code
  - Remove unused imports (ESLint, Pylint)
  - Remove commented code blocks > 5 lines
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9.3 Consolidate duplicate code
  - Identify duplicate utility functions
  - Create shared implementations
  - Update all references
  - _Requirements: 2.3, 2.4_

- [ ] 9.4 Clean up obsolete files
  - Remove unused component files
  - Remove old backup files
  - Remove empty directories
  - Update documentation index
  - _Requirements: 2.2, 2.5_

- [ ] 10. UI/UX Enhancement
  - Improve user interface consistency and user experience
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10.1 Apply consistent spacing system
  - Create CSS variables for 8px grid spacing
  - Update all components to use spacing variables
  - Ensure consistent padding and margins
  - _Requirements: 4.1_

- [ ] 10.2 Add loading states
  - Create skeleton loader components
  - Add loading spinners to buttons
  - Show loading state during data fetching
  - _Requirements: 4.2_

- [ ] 10.3 Implement visual feedback
  - Add hover states to all interactive elements
  - Add focus indicators for keyboard navigation
  - Add success animations (checkmarks, toasts)
  - Ensure feedback within 200ms of user action
  - _Requirements: 4.2, 4.3_

- [ ] 10.4 Improve form validation display
  - Show inline validation errors
  - Add real-time validation (onChange mode)
  - Use zod for schema validation
  - Display field-level error messages
  - _Requirements: 4.5, 6.3, 6.4_

- [ ] 10.5 Enhance accessibility
  - Ensure WCAG AA contrast ratios
  - Add aria-labels to interactive elements
  - Support keyboard navigation
  - Test with screen readers
  - _Requirements: 4.4_

- [ ] 11. State Synchronization
  - Implement optimistic updates and proper state sync between frontend and backend
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11.1 Implement optimistic updates
  - Add optimistic updates to React Query mutations
  - Implement rollback on error
  - Show sync status indicators
  - _Requirements: 5.1, 5.4_

- [ ] 11.2 Add WebSocket state sync
  - Broadcast setting changes via WebSocket
  - Update frontend state on WebSocket messages
  - Handle concurrent updates
  - _Requirements: 5.2, 5.3_

- [ ] 11.3 Implement state reconciliation
  - Fetch fresh state on reconnection
  - Invalidate stale queries
  - Show sync progress to user
  - _Requirements: 5.3, 5.5_

- [ ] 12. Validation Enhancement
  - Add comprehensive validation on frontend and backend
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 12.1 Create zod validation schemas
  - Create schemas for all forms (stream title, TTS settings, drops config)
  - Add min/max length validation
  - Add regex validation for special characters
  - _Requirements: 6.1, 6.3, 6.4_

- [ ] 12.2 Implement input sanitization
  - Create sanitizeInput() function for XSS prevention
  - Apply to all user inputs before API calls
  - Sanitize on backend as well (defense in depth)
  - _Requirements: 6.5_

- [ ] 12.3 Enhance Pydantic models
  - Add validators to all Pydantic models
  - Add custom validation logic (@validator)
  - Return detailed validation errors
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 13. Testing and Validation
  - Test all changes and ensure no regressions
  - _Requirements: All_

- [ ] 13.1 Test configuration system
  - Verify all environment variables load correctly
  - Test with missing required variables
  - Test migration script on fresh install
  - _Requirements: 1.1, 1.2_

- [ ] 13.2 Test platform abstraction
  - Verify Twitch platform works after refactoring
  - Verify VK platform works after refactoring
  - Test platform registry endpoints
  - _Requirements: 1.3, 1.4_

- [ ] 13.3 Test permission system
  - Verify admin can access admin endpoints
  - Verify users cannot access admin endpoints
  - Test platform role synchronization
  - Test command permission checks
  - _Requirements: 3.1, 3.2_

- [ ] 13.4 Test drops system
  - Verify probability calculation is server-side
  - Test animation with predetermined results
  - Verify results cannot be manipulated from client
  - _Requirements: 1.3, 6.1_

- [ ] 13.5 Test TTS services
  - Test TTS Service with F5-TTS
  - Test TTS Service Simple with local voices
  - Test voice upload and download
  - Test Bot Service connection to both services
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 13.6 Test WebSocket optimization
  - Verify single connection per browser
  - Test leader election with multiple tabs
  - Test reconnection logic
  - Test state sync after reconnection
  - _Requirements: 1.4, 3.1, 5.1_

- [ ] 13.7 Test performance improvements
  - Measure initial load time (target < 3s)
  - Verify code splitting works
  - Test virtualized chat performance
  - Measure API response times (target < 100ms)
  - _Requirements: 1.1, 1.2, 1.3, 7.1_

- [ ] 13.8 Test error handling
  - Trigger various errors and verify graceful handling
  - Verify error boundaries catch component errors
  - Test API error retry logic
  - Verify error logging works
  - _Requirements: 3.1, 3.2, 3.3, 8.1_

- [ ] 14. Documentation
  - Update documentation to reflect all changes
  - _Requirements: All_

- [ ] 14.1 Update README
  - Document new environment variables
  - Update setup instructions
  - Add TTS Service Simple setup guide
  - Document platform abstraction
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 14.2 Update CURRENT_STATUS.md
  - Document all completed optimizations
  - Update metrics (load time, performance)
  - Add new features (platform abstraction, permission system)
  - _Requirements: All_

- [ ] 14.3 Create deployment guide
  - Document distributed deployment scenarios
  - Add Cloudflare Tunnel setup instructions
  - Document TTS Service vs TTS Service Simple choice
  - Add troubleshooting section
  - _Requirements: 1.1, 1.2_

## Notes

- Tasks marked with "*" are optional and can be skipped for MVP
- Always read requirements.md and design.md before starting a task
- Test each task thoroughly before moving to the next
- Do not modify files listed in docs/DO_NOT_TOUCH.md
- Focus on one task at a time
- Stop after completing each task for user review

## Protected Systems

**DO NOT MODIFY:**
- TTS system files (8 files) - See docs/DO_NOT_TOUCH.md
- Category system files (6 files) - See docs/DO_NOT_TOUCH.md
- Authentication flow
- WebSocket system (except for optimization tasks)

## Success Criteria

- All environment variables configurable via .env
- No hardcoded values in code
- Platform abstraction allows easy addition of Kick
- Admin and user functions strictly separated
- Drops calculation on backend, animation on frontend
- TTS Service and TTS Service Simple both functional
- Single WebSocket connection per browser
- Initial load time < 3 seconds
- No application crashes from errors
- All tests passing
