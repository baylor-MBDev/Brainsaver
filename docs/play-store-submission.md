# Play Store submission guide

Everything needed to actually publish DOOMTYPE to the Play Console, written so
you can copy-paste straight into the forms. Cross-references what's already
built in this repo vs. what only you can do in the Play Console UI.

## Status: what's done vs. what's on you

**Done (this repo):**
- Signed release build pipeline (`.github/workflows/build-android.yml`) --
  produces `doomtype.aab` once the 4 signing secrets are added (see below)
- Unused permissions stripped (`app.json` -> `blockedPermissions`)
- Privacy policy live at https://baylor-mbdev.github.io/Brainsaver/privacy.html
- Store graphics in `assets/store/`: `feature-graphic.png` (1024x500) and 5
  phone screenshots (1080x2160)

**Only doable by you, in the Play Console UI:**
- Create the Play Console developer account ($25 one-time)
- Add the 4 GitHub secrets from the keystore delivery message so CI starts
  producing the signed `.aab`
- Fill in the Data Safety form, the Accessibility declaration, the store
  listing text, and content rating questionnaire (all drafted below)
- Run the closed testing track (Google requires 14 days / 20 testers for new
  developer accounts before production access)
- Upload the `.aab`, submit for review

## GitHub secrets (unblocks the signed .aab)

At https://github.com/baylor-MBDev/Brainsaver/settings/secrets/actions, add
the 4 values from the `CREDENTIALS-KEEP-SECRET.txt` file you were sent:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. The next push to `main` (or a manual re-run) will
then attach a signed `doomtype.aab` to the release, alongside the existing
`doomtype.apk`.

## Store listing copy

**App name:** `DOOMTYPE`

**Short description** (max 80 characters):
```
Type your shame before doomscrolling. A typing gate for screen time.
```
(69 characters)

**Full description** (max 4000 characters):
```
Every time you open a doomscroll app, you type one honest sentence
first: "imdestroyingmymentalhealth." Every few minutes you stay, you
type it again. No paste, no autocorrect -- just you and the truth.

DOOMTYPE puts real friction between you and the apps that eat your
attention. Pick which apps to guard. Set how often the gate re-fires.
Add your own phrases, or add several -- the gate picks one at random
each time, so it never turns into muscle memory.

Backing out at the gate counts as a win. Days under 5 opens build
your streak. A rot meter tracks how the day is going, with a little
brain mascot that feels it right alongside you.

MOVE FIRST, SCROLL LATER
Earn your time instead of typing for it. Do 10 pushups -- counted by
your camera with on-device pose detection -- or walk 1,000 steps, and
bank 10 minutes you can spend at the gate. Short on banked time? Drop
and do the pushups right there at the gate.

NO ESCAPE MODE
Turn it on and the gate loses its exit: no never-mind button, no back
button. Type it or earn it.

WHAT MAKES IT REAL
DOOMTYPE isn't a simulator. Once you enable the two Android
permissions it asks for (Accessibility, to notice when a guarded app
opens, and Display over other apps, to show the gate), it actually
intercepts the apps you've chosen -- no simulate button required.

WHAT IT DOESN'T DO
DOOMTYPE never reads your screen. It only ever sees the package name
of whichever app just came to the foreground -- never content, never
what you type elsewhere. Camera frames are processed on your phone and
never saved or sent. No account, no server, no ads. Full details --
including the anonymous performance stats the pose-detection library
reports to Google -- in the privacy policy.

Guard Instagram, TikTok, X, YouTube, Reddit, Snapchat, Facebook -- or
all of them.
```

**Category:** Tools, or Health & Fitness

**Contact email:** baylorbower1@gmail.com

**Privacy policy URL:** https://baylor-mbdev.github.io/Brainsaver/privacy.html

## Data Safety form

Play's Data Safety questionnaire walks through each data category asking
whether the app collects or shares it. DOOMTYPE's own data (phrases,
guarded-app list, counters, streak, settings, earned time) lives in local
on-device storage and is never transmitted -- there's no backend. The one
exception comes from a library, MediaPipe's usage stats, covered at the
end of this section; it changes the first answer below to **Yes** and adds
Diagnostics.

Baseline answers, before the MediaPipe exception:

- **Does your app collect or share any of the required user data types?**
  → No
- **Is all user data encrypted in transit?** → Not applicable (no data ever
  leaves the device)
- **Do you provide a way for users to request that their data is
  deleted?** → Not applicable in the formal sense (no data is collected
  off-device), but worth noting in the free-text field: uninstalling the
  app, or clearing its storage in Android system settings, deletes
  everything immediately since it's the only copy that exists.
- **Data types collected** → none selected (Location, Personal info,
  Financial info, Health & fitness, Messages, Photos/videos, Audio,
  Files/docs, Calendar, Contacts, App activity, Web browsing, App info &
  performance, Device/other IDs -- all "not collected")

If the form asks specifically about the Accessibility Service or the
foreground-app-detection behavior, describe it exactly as the privacy
policy does: the service receives only the package name of the
foregrounded app, to decide whether to show the gate; it never reads
screen content and never transmits anything over the network.

**Camera and step counter.** Both stay "not collected." Play's definition
of collection is data sent off the device, and data processed only on the
device doesn't count. Camera frames are analyzed on-device to count
pushups and discarded; the step count is read from the phone's sensor and
stored locally. Don't tick Photos/videos or Health & fitness.

**MediaPipe's usage stats: this one does need declaring.** The pose
library (`com.google.mediapipe:tasks-core`) always sends Google a usage
report when it runs: frame counts, latencies, library version, device
model and OS version. It goes through Google's `datatransport` library,
and there's no switch to turn it off. (This was confirmed by inspecting
the 0.10.32 bytecode: `TaskRunner` always builds a `TasksStatsProtoLogger`,
which sends through `RemoteLoggingClient`.) Data that SDKs in your app
send off-device counts as collected, so with the earlier answers changed
accordingly:

- **Does your app collect or share any of the required user data types?**
  → Yes
- **App info and performance → Diagnostics** → Collected. Not shared
  (it goes to Google as the library's provider). Not processed
  ephemerally. Optional, since it only happens if the user starts a
  pushup session. Purpose: Analytics.
- **Is all user data encrypted in transit?** → Yes (`datatransport`
  sends over HTTPS)
- Everything else stays "not collected"

If you'd rather keep the original "no data collected" answer, the pose
engine has to be swapped for one without built-in reporting (e.g. LiteRT
running a MoveNet model). The rep counter in `src/exercise/` only needs
landmark positions, so that swap stays inside the native module.

## Permission justifications

The readiness report in each CI build log lists the APK's final
permissions. The ones a reviewer may ask about:

| Permission | Why |
|---|---|
| `BIND_ACCESSIBILITY_SERVICE` | Detect when a guarded app opens (see declaration below) |
| `SYSTEM_ALERT_WINDOW` | Show the gate over the guarded app |
| `CAMERA` | Count pushups with on-device pose detection, only during a pushup session |
| `ACTIVITY_RECOGNITION` | Read the step counter for earned walks |
| `VIBRATE` | Haptic feedback on the keycaps and gate |
| `INTERNET` | Included by React Native; DOOMTYPE's own code makes no network requests (MediaPipe's usage stats use it) |
| `ACCESS_NETWORK_STATE` | Added by Google's `datatransport` (via MediaPipe) to wait for a connection before sending its usage stats |

Camera and activity recognition are ordinary runtime permissions with no
separate Play declaration form. The camera is only requested when a user
starts pushups, and activity recognition only when they start a walk.

## 16 KB page size

Play rejects apps targeting Android 15+ whose native libraries aren't
16 KB page-aligned. Each CI build's "Play readiness report" step checks
every `.so` in the APK and marks any that fail with `NOT 16KB`. If one
appears, it has to be fixed (usually by updating the library that ships
it) before uploading.

## Accessibility Service declaration

Play requires a separate declaration for any app requesting
`BIND_ACCESSIBILITY_SERVICE`, under Play Console -> App content ->
Accessibility. It typically asks for a written justification, and often a
short demo video showing the permission being used for its stated purpose.

**Core functionality description** (paste into the justification field):
```
DOOMTYPE is a self-directed screen-time tool. The user selects specific
apps (e.g. Instagram, TikTok) to "guard." The Accessibility Service is
used exclusively to detect when one of those user-selected apps comes to
the foreground, so the app can display a typing challenge the user must
complete before continuing -- a friction mechanism the user opts into and
configures themselves.

The service reads only the package name of the foregrounded window
(android.view.accessibility.AccessibilityEvent.getPackageName()). It does
not request canRetrieveWindowContent, does not read on-screen text, does
not read input from any other app, and does not transmit any data over
the network -- the app has no server. This is declared and enforced at
the service's own accessibility-service-config XML, not just by policy.

This use falls under Play's permitted-use category for apps whose core
function is to help users manage their own screen time / digital
wellbeing by monitoring which app is in the foreground.
```

**Demo video script** (record your phone screen, ~60-90 seconds):

1. **(0:00-0:10)** Open DOOMTYPE fresh. Show the Home screen's "REAL
   ENFORCEMENT" section with both permission prompts visible (not yet
   granted).
2. **(0:10-0:30)** Tap "1. ENABLE APP WATCHING." Show Android's
   Accessibility settings opening, find DOOMTYPE in the list, and narrate
   (on-screen text or voiceover) that this is what lets the app notice
   when a guarded app opens -- nothing more. Toggle it on, confirm the
   dialog.
3. **(0:30-0:40)** Back in DOOMTYPE, tap "2. ALLOW OPENING OVER APPS,"
   grant it, return to the app. The section should now read "ARMED."
4. **(0:40-0:55)** Go to the home screen (launcher) and open Instagram (or
   any app you've guarded in the picker). Show the DOOMTYPE gate
   appearing automatically over it -- no simulate button, no manual
   trigger.
5. **(0:55-1:20)** Type the phrase on screen. Show the gate dismissing and
   Instagram appearing underneath, proving the permission is used for
   exactly the stated purpose and nothing else.

## Content rating questionnaire

DOOMTYPE has no violence, no user-generated content, no in-app purchases,
no ads, no chat/social features, no gambling elements. It should land in
the lowest rating tier (Everyone / PEGI 3 equivalent) across every
questionnaire branch. The one honest flag: the default and user-editable
gate phrase can contain profanity if the user chooses to type one in --
worth a footnote in the questionnaire's free-text field if it asks about
user-generated/user-editable text content.

## Target audience & Families policy

Answer "no" to the "primarily child-directed" question, and set the target
age range to 13+ (or whatever Play's minimum non-child tier is at
submission time) -- DOOMTYPE is a self-directed adult/teen productivity
tool, not designed or marketed for children, and the Families policy's
extra requirements (which are substantial) don't apply if it's correctly
scoped as general-audience.
