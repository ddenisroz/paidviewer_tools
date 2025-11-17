# Shared Module

This directory contains reusable components and utilities that are used across multiple features in the application.

## Structure

```
shared/
├── components/     # Reusable UI components
│   ├── AuthGuard.tsx
│   ├── PermissionGuard.tsx
│   ├── PageWrapper.tsx
│   ├── LoadingSpinner.tsx
│   ├── StatusBadge.tsx
│   ├── PlatformIcons.tsx
│   └── index.ts
├── utils/          # Reusable utility functions
│   ├── formatUtils.ts
│   ├── stringUtils.ts
│   ├── platformUtils.ts
│   ├── sanitization.ts
│   ├── validationUtils.ts
│   ├── errorMessages.ts
│   ├── composeProviders.tsx
│   └── index.ts
└── index.ts        # Main export file
```

## Components

### AuthGuard
Route guard component that protects routes requiring authentication.

### PermissionGuard
Component that conditionally renders children based on user permissions.

### PageWrapper
Unified wrapper for all dashboard pages providing consistent layout.

### LoadingSpinner
Reusable loading spinner component with configurable size and text.

### StatusBadge
Badge component for displaying status with icons and colors.

### PlatformIcons
SVG icons for Twitch and VK platforms.

## Utils

### formatUtils
Date, time, number, and file size formatting utilities.

### stringUtils
String manipulation utilities (truncate, capitalize, etc.).

### platformUtils
Platform-specific utilities for Twitch, VK, YouTube, and DonationAlerts.

### sanitization
Input sanitization utilities for XSS prevention.

### validationUtils
Validation utilities for email, URL, username, etc.

### errorMessages
Error message formatting and localization.

### composeProviders
Utility for composing multiple React Context providers.

## Usage

Import from the shared module using the index files:

```typescript
// Import components
import { AuthGuard, PermissionGuard, PageWrapper } from '@/shared/components';

// Import utilities
import { formatDate, truncateString, getPlatformName } from '@/shared/utils';

// Or import from the main index
import { AuthGuard, formatDate } from '@/shared';
```

## Guidelines

- Only add truly reusable components and utilities to this folder
- Feature-specific code should remain in the features/ directory
- Keep dependencies minimal and avoid circular dependencies
- Document all exports in the index files
- Update this README when adding new shared code
