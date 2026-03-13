# Voice Separation: Global vs User Voices

Status: Implemented and active.

This document describes the behavior of voice management where global voices and user voices are separated by ownership and permissions.

## Purpose

- keep shared voices available to all users
- keep personal voices isolated per owner
- enforce safe edit/delete boundaries

## Voice Types

## `voice_type='global'`

Characteristics:

- visible to all users
- managed by admin flows
- users can tune playback settings for their own profile
- users cannot rename/delete/retranscribe the global voice asset itself

Storage model:

- shared global voice files in global voice storage
- per-user tuning values stored in user settings

## `voice_type='user'`

Characteristics:

- visible only to owner
- full owner controls: rename, delete, retranscribe
- owner-specific synthesis settings

Storage model:

- user voice files scoped by owner id
- settings owned by the same user

## UI Behavior Contract

Voice management UI must show two clear groups:

1. Global voices (shared)
2. My voices (owned)

Expected control differences:

- Global voice card: no destructive actions
- User voice card: full action set

## API Contract (Conceptual)

- listing should return both groups with explicit `voice_type`
- mutation endpoints must enforce ownership/role rules server-side
- client-side role checks are UX-only and not trusted for authorization

## Security Rules

1. Never trust client-provided ownership fields.
2. Validate owner/admin rights on every mutation endpoint.
3. Return clear 403 responses for unauthorized actions.
4. Avoid exposing absolute filesystem paths in responses.

## Regression Checklist

1. Non-admin cannot modify global voice assets.
2. User can modify only own voices.
3. Global voices remain selectable by regular users.
4. Per-user settings for global voices do not affect other users.
5. Delete/rename/retranscribe on foreign voice returns 403.

