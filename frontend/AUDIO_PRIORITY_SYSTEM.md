# Audio Priority System

## Overview

The audio priority system manages conflicts between TTS (Text-to-Speech) and YouTube audio playback. When TTS plays, the system can automatically pause, duck (reduce volume), or ignore YouTube playback based on user preference.

## Features

### 1. Audio Priority Modes

Users can choose from three modes in Settings:

- **Pause** (Default): YouTube completely stops when TTS plays, then resumes after
- **Duck**: YouTube continues playing but at 20% volume during TTS
- **None**: Both TTS and YouTube play simultaneously without interference

### 2. Automatic Audio Management

The system automatically:
- Detects when TTS starts playing
- Applies the user's preferred audio priority mode
- Restores YouTube to its original state when TTS finishes
- Handles errors gracefully (releases audio focus on TTS errors)

## Architecture

### Components

1. **AudioPriorityContext** (`frontend/src/context/AudioPriorityContext.tsx`)
   - Manages audio priority state
   - Stores user preference in localStorage
   - Provides `requestAudioFocus()` and `releaseAudioFocus()` methods
   - Dispatches custom events for YouTube player control

2. **PlayerContext** (`frontend/src/context/PlayerContext.tsx`)
   - Listens for audio priority events
   - Controls YouTube player (pause/play/volume)
   - Maintains original volume for restoration after ducking

3. **ChatContext** (`frontend/src/context/ChatContext.tsx`)
   - Requests audio focus when TTS starts
   - Releases audio focus when TTS finishes or errors

4. **SettingsPage** (`frontend/src/pages/SettingsPage.tsx`)
   - Provides UI for users to select their audio priority preference
   - Three-button selector with clear descriptions

### Event Flow

```
TTS Starts
    ↓
ChatContext.requestAudioFocus('tts')
    ↓
AudioPriorityContext checks preference
    ↓
Dispatches 'audio_priority_change' event
    ↓
PlayerContext handles event
    ↓
YouTube pauses/ducks/continues
```

```
TTS Finishes
    ↓
ChatContext.releaseAudioFocus('tts')
    ↓
AudioPriorityContext
    ↓
Dispatches 'audio_priority_change' event
    ↓
PlayerContext handles event
    ↓
YouTube resumes/restores volume
```

## Custom Events

The system uses the following custom events:

- `audio_priority_change` with actions:
  - `pause_youtube`: Pause YouTube playback
  - `resume_youtube`: Resume YouTube playback
  - `duck_youtube`: Reduce YouTube volume to 20%
  - `unduck_youtube`: Restore YouTube to original volume

## User Preference Storage

The audio priority preference is stored in localStorage:
- Key: `audio_priority_preference`
- Values: `'pause'` | `'duck'` | `'none'`
- Default: `'pause'`

## Implementation Details

### Volume Ducking

When ducking is enabled:
1. Original volume is saved in `originalVolumeRef`
2. Volume is reduced to 20% of original
3. After TTS finishes, original volume is restored

### Error Handling

If TTS playback fails:
- Audio focus is immediately released
- YouTube returns to its previous state
- No audio conflicts remain

## Usage

### For Users

1. Go to Settings page
2. Find "Audio Priority" section
3. Select preferred mode:
   - **Pause**: Best for clear TTS without background music
   - **Duck**: Good for keeping music ambiance while TTS plays
   - **None**: For users who want both audio sources at full volume

### For Developers

To request audio focus in a new component:

```typescript
import { useAudioPriority } from '../context/AudioPriorityContext';

const MyComponent = () => {
  const { requestAudioFocus, releaseAudioFocus } = useAudioPriority();
  
  const playAudio = () => {
    requestAudioFocus('tts');
    // Play audio...
    audio.onended = () => releaseAudioFocus('tts');
  };
};
```

## Testing

To test the audio priority system:

1. Enable YouTube integration and add a video to queue
2. Start playing YouTube video
3. Trigger TTS (send a chat message or test TTS)
4. Observe YouTube behavior based on selected preference:
   - **Pause**: YouTube should stop, then resume after TTS
   - **Duck**: YouTube should continue at lower volume
   - **None**: Both should play simultaneously
5. Change preference in Settings and test again

## Future Enhancements

Potential improvements:
- Configurable duck volume percentage
- Per-platform audio priority settings
- Audio crossfade transitions
- Priority levels for different audio sources
