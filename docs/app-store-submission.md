# Getting DOOMTYPE into the App Store

The iOS app is built and compiles in CI (`.github/workflows/build-ios.yml`),
but running it on a real iPhone needs things only you can set up: an Apple
Developer account, Apple's approval for Screen Time, and signing.

## How the iOS version works

| | Android | iPhone |
|---|---|---|
| Blocking | Accessibility service watches which app is in front and opens the gate over it | Apple's Screen Time **shield** covers picked apps |
| Getting to the gate | Automatic | Shield button → notification → tap opens DOOMTYPE at the gate |
| Picking apps | DOOMTYPE's list of 7 apps | Apple's picker (any app, category, or website) |
| Pass expiry | Service re-gates after the interval | A DeviceActivity schedule re-shields when the pass ends (works even if DOOMTYPE is closed) |
| Pushups | CameraX + MediaPipe | Apple Vision (on-device, sends nothing) |
| Steps | Hardware step counter | CoreMotion (Motion & Fitness) |

iOS doesn't let one app open another, so after earning a pass the user
switches back themselves. DOOMTYPE says so in an alert.

## 1. Apple Developer Program ($99/year)

1. Go to <https://developer.apple.com/programs/enroll/> and sign in with your Apple ID (2-factor auth required).
2. Enroll as an **Individual** (fastest) or an **Organization** (needs a D-U-N-S number, and shows the company name on the store).
3. Pay. Approval usually takes 1–2 days.
4. Note your **Team ID**: Membership details → Team ID (10 characters).

## 2. Register the identifiers

In **Certificates, Identifiers & Profiles**:

1. **App Group** → `group.dev.mockingbird.doomtype`
2. **App IDs**: create all four with the **Family Controls** and **App Groups** capabilities (App Groups set to the group above):
   - `dev.mockingbird.doomtype`
   - `dev.mockingbird.doomtype.ActivityMonitorExtension`
   - `dev.mockingbird.doomtype.ShieldAction`
   - `dev.mockingbird.doomtype.ShieldConfiguration`
3. Turn on **Push Notifications** for the main app ID only. The gate uses local notifications, which don't strictly need this, but it avoids a provisioning warning.

## 3. Request the Family Controls entitlement (the long pole)

Development builds work with the development entitlement right away. **App
Store and TestFlight builds need Apple's approval** for the distribution
entitlement, **for each of the four bundle IDs above**.

1. Open <https://developer.apple.com/contact/request/family-controls-distribution>.
2. Submit once per bundle ID. Suggested description:

   > DOOMTYPE is a self-control app for adults. Users choose apps that eat
   > their time; DOOMTYPE shields them with Screen Time. To get in, the user
   > types a phrase admitting what they're about to do, or earns time with
   > pushups or a walk. Passes expire automatically. Uses
   > FamilyControls (individual authorization), ManagedSettings shields, and
   > DeviceActivity schedules. No data leaves the device.

3. Approval has taken anywhere from days to several weeks. Start it as soon as the account is active. Everything else can happen in parallel.

## 4. Build and sign with EAS

EAS (Expo's build service) handles certificates and profiles, including for the three extensions.

```bash
npm i -g eas-cli
eas login                 # your Expo account
eas build:configure       # creates eas.json
```

Add your Team ID to the device-activity plugin in `app.json` (this removes the warning):

```json
["react-native-device-activity", {
  "appGroup": "group.dev.mockingbird.doomtype",
  "appleTeamId": "YOURTEAMID"
}]
```

Then:

- **On your own iPhone now** (development entitlement):
  `eas device:create`, then `eas build -p ios --profile development`.
- **TestFlight / App Store** (after the step 3 approval):
  `eas build -p ios --profile production`, then `eas submit -p ios`.

Screen Time doesn't work in the Simulator. Test blocking on a real device.

## 5. App Store Connect listing

1. **My Apps → +** → New App. Bundle ID `dev.mockingbird.doomtype`, SKU `doomtype`.
2. **Privacy policy URL**: `https://baylor-mbdev.github.io/Brainsaver/privacy.html`
3. **App Privacy**: "Data Not Collected". iOS uses Apple Vision and CoreMotion on-device, and nothing leaves the phone.
4. **Age rating**: 4+. No objectionable content.
5. **Category**: Productivity (secondary: Health & Fitness).
6. **Screenshots**: 6.9" (1320×2868) and 6.5" (1284×2778) are required. Take them on a device or simulator after the first build.
7. **Review notes** (important; Screen Time apps get extra scrutiny):

   > To test: open DOOMTYPE → Allow Screen Time → Pick apps (choose e.g.
   > Safari) → Allow notifications. Open Safari: the shield appears. Tap
   > OPEN THE GATE, then tap the notification. Type the phrase shown to
   > unlock Safari for the set interval. Pushups (camera) and walks (Motion)
   > are optional ways to earn time. All processing is on-device.

## What's already done in the repo

- iOS native code: Vision pushup camera and CoreMotion steps (`modules/doomtype-exercise/ios`), plus the gate notification handoff (`modules/doomtype-guard/ios`).
- Screen Time logic in `src/native/screenTime.js` (shield, timed pass, scheduled re-lock).
- `app.json`: bundle ID, app group, camera and motion usage strings, and the export-compliance flag (no non-exempt encryption).
- CI compiles the app and all three extensions for the Simulator on every push.
- Privacy policy covers iOS.
