# Enforcement layer roadmap

Expo Go runs the full product experience, but the actual interception of other apps requires native capabilities via an Expo dev build (`npx expo prebuild` + EAS). Nothing in the UI layer changes; the gate screen just gets triggered by the OS instead of the simulate button.

## iOS (Screen Time API)

Package: `react-native-device-activity` (Expo config plugin, works with EAS builds).

Flow:
1. Request Family Controls authorization (requires the Family Controls entitlement from Apple; apply early, approval takes time)
2. Replace the mock AppPicker with `FamilyActivityPicker` (returns opaque tokens, not app names)
3. Apply a ManagedSettings shield to selected tokens
4. Shield button deep-links into DOOMTYPE -> Challenge screen
5. On success, lift the shield and schedule a DeviceActivity monitor for `intervalMinutes`
6. Monitor fires -> re-apply the shield mid-session -> user is bounced back to the gate

## Android

Custom native module (Kotlin), roughly 300 lines:
1. AccessibilityService detects foreground app changes (or UsageStatsManager polling as the Play-Store-safer fallback)
2. Guarded app in foreground + no active pass -> launch Challenge activity over it (full-screen intent)
3. On success, grant a pass for `intervalMinutes`, tracked by a foreground service
4. Pass expires while app still foregrounded -> relaunch Challenge

Play Store note: AccessibilityService use must be justified under the digital wellbeing carve-out in the review declaration form.

## Shared

- The store's daily reset logic already lives in `src/store.js`; the native layer only needs to call `update()` through a bridge event
- Keep phrase validation in JS so the challenge logic stays identical across platforms
