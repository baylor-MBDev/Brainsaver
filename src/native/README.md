# Enforcement layer

## Android — IMPLEMENTED

Lives in `modules/doomtype-guard` (local Expo module, autolinked during
`expo prebuild`) with the JS bridge in `src/native/guard.js`.

How it works:

1. `GuardAccessibilityService` listens for window-state changes (it never
   reads screen content — `canRetrieveWindowContent` is off)
2. A guarded package hits the foreground with no valid pass -> the service
   stores a pending challenge and relaunches DOOMTYPE over it
3. JS consumes the pending challenge (cold start via `onReady`, warm via
   `AppState`) and routes to the Challenge screen with `enforced: true`
4. Typing the phrase grants a timed pass (`intervalMinutes`) and returns to
   the guarded app via `moveTaskToBack`; the service schedules a re-gate for
   the moment the pass expires
5. Backing out sends the user to the launcher instead of back into the app

Setup on device (surfaced on the Home screen): enable the accessibility
service, and allow display-over-other-apps (exempts the service from
Android's background-activity-launch restrictions).

Play Store note: AccessibilityService use must be justified under the
digital wellbeing carve-out in the review declaration form. Direct-install
APKs (our GitHub Releases pipeline) don't need this.

Expo Go and web: the module is absent; `guard.js` no-ops and the app falls
back to the simulate button.

## iOS (Screen Time API) — ROADMAP

Package: `react-native-device-activity` (Expo config plugin, works with EAS
builds).

1. Request Family Controls authorization (requires the Family Controls
   entitlement from Apple; apply early, approval takes time)
2. Replace the mock AppPicker with `FamilyActivityPicker` (returns opaque
   tokens, not app names)
3. Apply a ManagedSettings shield to selected tokens
4. Shield button deep-links into DOOMTYPE -> Challenge screen
5. On success, lift the shield and schedule a DeviceActivity monitor for
   `intervalMinutes`
6. Monitor fires -> re-apply the shield mid-session -> user is bounced back
   to the gate

## Exercise -- IMPLEMENTED (Android)

Lives in `modules/doomtype-exercise` with the JS bridge in
`src/native/exercise.js`.

- `PoseCameraView`: CameraX preview plus MediaPipe's pose landmarker running
  on-device in live-stream mode. Emits the 33 landmarks for each processed
  frame as `onPose`; frames are never stored or sent. Rep counting happens in
  JS (`src/exercise/pushupCounter.js`, unit tested in `test/`), so tuning the
  thresholds never needs a native rebuild.
- `readStepCounter()`: one reading of the hardware step counter (cumulative
  since boot). Walks store a baseline and diff later readings against it, so
  steps keep counting with the app closed.
- The pose model (`pose_landmarker_lite.task`, 5.8 MB) isn't committed. Run
  `scripts/fetch-pose-model.sh` before a local native build; CI does this
  automatically and verifies the checksum.

Runtime permissions: `CAMERA` when a pushup session starts,
`ACTIVITY_RECOGNITION` (Android 10+) when a walk starts.
