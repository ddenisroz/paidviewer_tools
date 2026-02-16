PENDING USER ISSUES (UNRESOLVED / UNVERIFIED)
=============================================

This file lists the user-reported items that are still NOT implemented
or NOT verified after recent changes. It is meant to track remaining
work before full QA sign-off.


NOT IMPLEMENTED YET
-------------------
1) VK Live bot parity with Twitch bot
   - Desired behavior: a standalone VK bot account with its own OAuth
     token, auto-refresh, and long-lived operation (like Twitch bot).
   - Current behavior: VK Live works via developer app keys / app auth.
   - Needed: a real bot account flow + token refresh + usage in VK Live.

2) VK bot OAuth flow error
   - Flow: http://localhost:8000/auth/vk/bot/login
   - Current error: http://localhost:5173/admin/settings?bot_auth_error=cancelled
   - Needed: fix the auth cancellation/error handling or incorrect redirect.

3) VK Live badges
   - Current behavior: mock/static badge data in UI.
   - Desired: real VK Live badge URLs (example from user provided).
   - Needed: badge source integration + mapping in frontend.

4) Message highlights + reply handling
   - Desired: highlight messages when streamer is tagged/mentioned.
   - Properly handle "reply" messages (threaded or quoted) in chat UI.


UNVERIFIED AFTER RECENT FIXES (NEEDS QA)
---------------------------------------
1) Chat overlay settings + layout stability
   - Font changes should always apply and must not break overlay layout.
   - Vertical mode should grow bottom-up (OBS use case, bottom-left).
   - Horizontal mode should keep stable height/overflow.

2) TTS page / route errors
   - Previous error: missing export `useSetTtsListeningMode` on `/dashboard/tts`.
   - Verify page now loads without route_error and TTS toggles work.

3) 7TV emotes in overlay
   - Example: "JustAnotherDay" should render as image.
   - Twitch/VK native emotes should render correctly.

4) Chat history loading in overlay
   - User reported history not loading. Needs re-check after changes.

5) Chat-window UI alignment
   - Badges/icons/username baseline alignment.
   - Second line indent issue in multi-line messages.

6) Chatbox settings UI controls
   - Color picker + dropdowns should be fully functional.
   - Preview should reflect all toggles (links/emotes/etc).

7) YouTube players / playback
   - Desired: seamless playback across tabs; working mini player and
     normal player in all relevant pages.
   - Recent changes: GlobalPlayer moved out of Sidebar, player container
     re-registers when video appears, ReactPlayer wrapper uses internal
     YouTube methods (no recursion).
   - Needs QA: confirm mini player, normal player, and cross-tab playback.


NOTES
-----
- If any of the "Unverified" items are confirmed working in QA,
  move them out of this list.
