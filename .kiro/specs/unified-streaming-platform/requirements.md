# Requirements Document

## Introduction

This document defines the requirements for a unified streaming platform that consolidates stream management, text-to-speech (TTS), chat interactivity, loyalty systems, YouTube integration, and OBS widgets into a single application. The platform aims to replace multiple fragmented tools with one comprehensive solution, simplifying stream management and increasing viewer engagement across Twitch and VK Live platforms.

## Glossary

- **Platform**: The unified streaming platform application (TTS_TTV_0.02)
- **Streamer**: A content creator who broadcasts live video content on Twitch or VK Live
- **Viewer**: An audience member watching a stream
- **TTS Engine**: Text-to-speech synthesis system (Google Cloud TTS, F5-TTS Advanced, or F5-TTS Simple)
- **Chat Interactive**: A feature that responds to chat commands or events
- **Channel Points**: Platform-specific reward currency (Twitch Channel Points or VK Live Points)
- **Loyalty System**: A mechanism that tracks and rewards viewer engagement over time
- **Streak**: Consecutive days or streams a viewer has participated in
- **OBS Widget**: An overlay component displayed in streaming software (Open Broadcaster Software)
- **Admin Panel**: A management interface for configuring platform features and permissions
- **Custom Voice**: A user-uploaded audio sample used for personalized TTS output
- **YouTube Queue**: An ordered list of video requests from chat
- **DonationAlerts**: A third-party service for processing monetary donations
- **Guest Mode**: A view-only access level without authentication requirements
- **Bot Service**: The backend FastAPI service handling OAuth, chat bots, and business logic
- **Frontend**: The React-based single-page application user interface
- **Multi-Platform**: Support for both Twitch and VK Live streaming platforms

## Requirements

### Requirement 1: Multi-Platform Stream Management

**User Story:** As a streamer, I want to manage my streams on Twitch and VK Live from a single interface, so that I can control both platforms without switching between multiple tools.

#### Acceptance Criteria

1. WHEN the Streamer authenticates with Twitch OAuth, THE Platform SHALL establish a connection to the Twitch API
2. WHEN the Streamer authenticates with VK Live OAuth, THE Platform SHALL establish a connection to the VK Live API
3. THE Platform SHALL display stream status for all connected platforms in a unified dashboard
4. WHEN the Streamer modifies stream settings, THE Platform SHALL apply changes to the selected platform through its respective API
5. THE Platform SHALL synchronize stream metadata including title, category, and tags across platforms when requested by the Streamer

### Requirement 2: Text-to-Speech System

**User Story:** As a streamer, I want multiple TTS engine options with custom voice support, so that I can provide personalized audio experiences for my viewers.

#### Acceptance Criteria

1. THE Platform SHALL support Google Cloud TTS, F5-TTS Advanced, and F5-TTS Simple as TTS Engine options
2. WHEN a Viewer sends a chat message eligible for TTS, THE Platform SHALL synthesize speech using the configured TTS Engine
3. WHERE Custom Voice is enabled, THE Platform SHALL allow Viewers to upload audio samples for voice cloning
4. THE Platform SHALL validate uploaded Custom Voice files for format, duration, and quality requirements
5. WHEN processing TTS requests, THE Platform SHALL queue messages and process them in order of receipt

### Requirement 3: Chat Command System

**User Story:** As a streamer, I want to create and manage custom chat commands, so that I can automate responses and provide interactive features for my viewers.

#### Acceptance Criteria

1. THE Platform SHALL support global commands, override commands, and custom commands
2. WHEN a Viewer sends a message matching a command pattern, THE Platform SHALL execute the associated command action
3. THE Platform SHALL allow the Streamer to define command triggers, responses, and permission levels through the Admin Panel
4. THE Platform SHALL support command variables including username, platform, and timestamp
5. WHEN a command is disabled by the Streamer, THE Platform SHALL not execute that command until re-enabled

### Requirement 4: Channel Points Integration

**User Story:** As a viewer, I want to use channel points to trigger rewards and TTS messages, so that I can interact with the stream using platform-native currency.

#### Acceptance Criteria

1. WHEN the Streamer enables Channel Points integration, THE Platform SHALL register custom rewards with the platform API
2. WHEN a Viewer redeems a Channel Points reward, THE Platform SHALL receive the redemption event through the platform webhook
3. THE Platform SHALL execute the configured action for each reward redemption including TTS synthesis, command execution, or custom response
4. THE Platform SHALL synchronize reward availability and cost with the platform API
5. WHEN a reward redemption fails, THE Platform SHALL refund Channel Points to the Viewer through the platform API

### Requirement 5: Loyalty and Streak System

**User Story:** As a viewer, I want to earn rewards for consistent participation, so that I feel recognized for my loyalty to the streamer.

#### Acceptance Criteria

1. THE Platform SHALL track Viewer participation across consecutive streams or days
2. WHEN a Viewer participates in a stream, THE Platform SHALL increment their Streak counter
3. WHEN a Viewer misses a participation window, THE Platform SHALL reset their Streak counter to zero
4. THE Platform SHALL award loyalty points or rewards when a Viewer reaches Streak milestones
5. THE Platform SHALL display Streak progress through an OBS Widget visible during the stream

### Requirement 6: DonationAlerts Integration

**User Story:** As a streamer, I want donations to automatically trigger TTS messages, so that I can acknowledge supporter contributions without manual intervention.

#### Acceptance Criteria

1. WHEN the Streamer configures DonationAlerts credentials, THE Platform SHALL establish a connection to the DonationAlerts API
2. WHEN a donation is received, THE Platform SHALL receive the donation event through the DonationAlerts webhook
3. THE Platform SHALL synthesize the donation message using the configured TTS Engine
4. THE Platform SHALL include donor name and amount in the TTS output
5. WHERE the donation includes a custom message, THE Platform SHALL synthesize the message content after donor information

### Requirement 7: YouTube Integration

**User Story:** As a viewer, I want to request YouTube videos through chat commands, so that I can share music or content with the stream.

#### Acceptance Criteria

1. WHEN a Viewer sends a chat message with a YouTube URL, THE Platform SHALL validate the video availability
2. THE Platform SHALL add valid YouTube videos to the YouTube Queue in order of request
3. THE Platform SHALL display the YouTube Queue through an embedded player interface
4. WHEN a video completes playback, THE Platform SHALL automatically advance to the next video in the YouTube Queue
5. THE Platform SHALL allow the Streamer to skip, remove, or reorder videos in the YouTube Queue

### Requirement 8: OBS Widget System

**User Story:** As a streamer, I want customizable OBS widgets for chat, TTS, YouTube, and rewards, so that I can display interactive elements on my stream overlay.

#### Acceptance Criteria

1. THE Platform SHALL provide browser-source URLs for chat, TTS, YouTube, and rewards OBS Widgets
2. WHEN a TTS message is synthesized, THE Platform SHALL display the message text and speaker in the TTS OBS Widget
3. WHEN a reward is redeemed, THE Platform SHALL display the redemption in the rewards OBS Widget with animation
4. THE Platform SHALL update the YouTube OBS Widget with current playback status and queue information
5. THE Platform SHALL allow the Streamer to customize widget appearance including colors, fonts, and animations through the Admin Panel

### Requirement 9: Admin Panel

**User Story:** As a streamer, I want a comprehensive admin panel, so that I can configure all platform features and manage user permissions from one location.

#### Acceptance Criteria

1. THE Platform SHALL provide an Admin Panel accessible only to users with admin role
2. THE Platform SHALL allow the Streamer to configure TTS Engine settings, voice options, and message filters through the Admin Panel
3. THE Platform SHALL allow the Streamer to create, modify, and delete custom commands through the Admin Panel
4. THE Platform SHALL allow the Streamer to configure Channel Points rewards and loyalty system parameters through the Admin Panel
5. THE Platform SHALL allow the Streamer to manage user roles and permissions through the Admin Panel
6. THE Platform SHALL display analytics including TTS usage, command frequency, and viewer engagement metrics in the Admin Panel

### Requirement 10: Guest Mode Access

**User Story:** As a visitor, I want to view stream information without authentication, so that I can explore the platform before creating an account.

#### Acceptance Criteria

1. THE Platform SHALL allow unauthenticated users to access Guest Mode
2. WHEN a user accesses the Platform without authentication, THE Platform SHALL display public stream information in read-only mode
3. THE Platform SHALL prevent Guest Mode users from executing commands, redeeming rewards, or modifying settings
4. THE Platform SHALL display a prompt encouraging Guest Mode users to authenticate for full feature access
5. WHEN a Guest Mode user attempts a restricted action, THE Platform SHALL display an authentication requirement message

### Requirement 11: Permission System

**User Story:** As a streamer, I want role-based access control, so that I can grant appropriate permissions to moderators and viewers.

#### Acceptance Criteria

1. THE Platform SHALL support admin, moderator, user, and guest permission roles
2. THE Platform SHALL enforce permission checks before executing commands or allowing access to features
3. THE Platform SHALL allow the Streamer to assign roles to users through the Admin Panel
4. WHEN a user attempts an action without sufficient permissions, THE Platform SHALL deny the action and log the attempt
5. THE Platform SHALL allow the Streamer to define custom permission levels for specific commands or features

### Requirement 12: Cross-Platform Synchronization

**User Story:** As a streamer, I want settings and configurations to work consistently across Twitch and VK Live, so that I maintain a unified experience regardless of platform.

#### Acceptance Criteria

1. THE Platform SHALL maintain a unified configuration for TTS settings applicable to both Twitch and VK Live
2. THE Platform SHALL translate platform-specific features to equivalent functionality on the alternate platform where possible
3. THE Platform SHALL synchronize custom commands across both platforms unless explicitly configured as platform-specific
4. THE Platform SHALL map Twitch categories to VK Live categories using the category mapping system
5. WHEN a feature is unavailable on one platform, THE Platform SHALL disable that feature only for the unsupported platform

