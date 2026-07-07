# DOOMTYPE

Type your shame. Reclaim your brain.

A friction-based screen time app: every time you open a doomscroll app you type `imdestroyingmymentalhealth` before it lets you in, and again every 5 to 15 minutes while you stay. Backing out at the gate counts as a win.

## Run it

```bash
npm install
npx expo start
```

Scan the QR with Expo Go (iOS or Android). Everything works in Expo Go except the actual OS-level app interception; use "Simulate opening Instagram" on the home screen to run the gate.

## What's in the box

- Onboarding (3 beats, sets the voice)
- Home: rot meter, opens / phrases typed / backouts, streak
- Challenge: the typing gate. No paste, no autocorrect, wrong characters rejected with a shake. Escalation mode adds reps as opens pile up
- App picker (prototype list; production swaps in FamilyActivityPicker / installed apps)
- Settings: re-gate interval, custom phrase, escalation toggle
- `src/native/README.md`: the exact path to real enforcement on both platforms via an Expo dev build

## Brand system

- Paper `#EFEBFF`, Ink `#221C3A`, Rot `#FF5C38`, Growth `#2FB56B`, Zap `#FFD23F`
- Archivo Black for shouting, Space Mono for anything typed or counted
- Signature element: keycap UI. Every button is a keyboard key with a hard offset shadow that physically depresses
