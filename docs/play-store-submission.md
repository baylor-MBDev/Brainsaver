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

WHAT MAKES IT REAL
DOOMTYPE isn't a simulator. Once you enable the two Android
permissions it asks for (Accessibility, to notice when a guarded app
opens, and Display over other apps, to show the gate), it actually
intercepts the apps you've chosen -- no simulate button required.

WHAT IT DOESN'T DO
DOOMTYPE never reads your screen. It only ever sees the package name
of whichever app just came to the foreground -- never content, never
what you type elsewhere. Nothing it stores ever leaves your device:
no account, no server, no analytics, no ads. Full details in the
privacy policy.

Guard Instagram, TikTok, X, YouTube, Reddit, Snapchat, Facebook -- or
all of them.
```

**Category:** Tools, or Health & Fitness

**Contact email:** baylorbower1@gmail.com

**Privacy policy URL:** https://baylor-mbdev.github.io/Brainsaver/privacy.html

## Data Safety form

Play's Data Safety questionnaire walks through each data category asking
whether the app collects or shares it. DOOMTYPE's honest answer is **no**
across the board, because everything (phrases, guarded-app list, counters,
streak, settings) lives in local on-device storage and is never transmitted
anywhere -- there's no backend to send it to.

Answers, in order the form typically asks:

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
