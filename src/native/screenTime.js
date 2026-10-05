import { Platform } from 'react-native';

// iOS enforcement, built on Apple's Screen Time APIs through
// react-native-device-activity. The flow:
//
//   1. The user picks apps in Apple's own picker (apps are opaque tokens; we
//      never learn which ones), persisted under SELECTION_ID.
//   2. Those apps are shielded. The shield's button posts a notification;
//      tapping it opens DOOMTYPE at the gate (modules/doomtype-guard/ios).
//   3. Getting through the gate lifts the shield and schedules a
//      DeviceActivity interval whose start re-shields everything, so the pass
//      ends on time even if DOOMTYPE is never opened again. Apple won't run
//      an interval shorter than 15 minutes, so the interval is padded past
//      the pass; only its start matters.
//
// Everywhere except an iOS dev build the library is absent and every call
// here is a no-op.

export const SELECTION_ID = 'doomtype-guarded';
const RELOCK_ACTIVITY = 'doomtype-relock';
const MIN_INTERVAL_MIN = 16;
// When the current pass ends (ms), kept in the library's shared defaults so
// it survives DOOMTYPE being killed mid-pass.
const PASS_KEY = 'doomtype.passUntil';

let lib = null;
if (Platform.OS === 'ios') {
  try {
    lib = require('react-native-device-activity');
    if (!lib.isAvailable()) lib = null;
  } catch (e) {
    lib = null;
  }
}

export const screenTimeAvailable = () => !!lib;

export const SelectionSheet = lib ? lib.DeviceActivitySelectionSheetViewPersisted : null;

// 0 = not asked yet, 1 = denied, 2 = approved.
export const authorizationStatus = () => (lib ? lib.getAuthorizationStatus() : 0);

export const isAuthorized = () => authorizationStatus() === 2;

export const requestAuthorization = async () => {
  if (!lib) return false;
  try {
    await lib.requestAuthorization('individual');
  } catch (e) {
    // Declining throws; the status below says what happened.
  }
  return isAuthorized();
};

const selection = { activitySelectionId: SELECTION_ID };

// How many apps/categories/sites are picked, or null before anything is.
export const selectionSummary = () => {
  if (!lib || !lib.getFamilyActivitySelectionId(SELECTION_ID)) return null;
  try {
    return lib.activitySelectionMetadata(selection) ?? null;
  } catch (e) {
    return null;
  }
};

export const selectionCount = () => {
  const s = selectionSummary();
  return s ? s.applicationCount + s.categoryCount + s.webDomainCount : 0;
};

// The shield every guarded app shows. Strict mode drops the way out.
export const configureShield = ({ strict }) => {
  if (!lib) return;
  const ink = { red: 17, green: 17, blue: 17 };
  const rot = { red: 255, green: 77, blue: 0 };
  const paper = { red: 244, green: 240, blue: 230 };
  lib.updateShield(
    {
      backgroundColor: rot,
      title: 'HOLD ON.',
      titleColor: ink,
      subtitle: strict
        ? '{applicationOrDomainDisplayName} is behind the gate. Type your shame or do your pushups.'
        : 'Want {applicationOrDomainDisplayName}? Type your shame first.',
      subtitleColor: ink,
      iconSystemName: 'brain.head.profile',
      iconTint: ink,
      primaryButtonLabel: 'OPEN THE GATE',
      primaryButtonLabelColor: paper,
      primaryButtonBackgroundColor: ink,
      ...(strict ? {} : { secondaryButtonLabel: 'Never mind', secondaryButtonLabelColor: ink }),
    },
    {
      primary: {
        behavior: 'close',
        actions: [
          {
            type: 'sendNotification',
            payload: {
              title: 'DOOMTYPE',
              // GateNotifications.swift reads the app name back from here.
              subtitle: '{applicationName}',
              body: 'Tap to open the gate.',
              sound: 'default',
              threadIdentifier: 'doomtype-gate',
              userInfo: { doomtype: 'gate' },
              interruptionLevel: 'active',
            },
          },
        ],
      },
      secondary: { behavior: 'close' },
    },
  );
};

const passUntil = () => {
  try {
    return Number(lib.userDefaultsGet(PASS_KEY)) || 0;
  } catch (e) {
    return 0;
  }
};

export const passActive = () => !!lib && Date.now() < passUntil();

// Shield the picked apps now, and cancel any pending pass.
export const lockNow = () => {
  if (!lib || !lib.getFamilyActivitySelectionId(SELECTION_ID)) return;
  lib.stopMonitoring([RELOCK_ACTIVITY]);
  lib.blockSelection(selection, 'doomtype-lock');
  lib.userDefaultsRemove(PASS_KEY);
};

// Shield the picked apps unless a pass is running. Safe to call any time
// DOOMTYPE comes to the front; it also backs up the scheduled re-lock.
export const ensureLocked = () => {
  if (!lib || passActive()) return;
  lockNow();
};

const components = (d) => ({
  year: d.getFullYear(),
  month: d.getMonth() + 1,
  day: d.getDate(),
  hour: d.getHours(),
  minute: d.getMinutes(),
  second: d.getSeconds(),
});

// Lift the shield for `minutes`, then let the system put it back.
export const grantPass = async (minutes) => {
  if (!lib || !lib.getFamilyActivitySelectionId(SELECTION_ID)) return;
  const until = new Date(Date.now() + minutes * 60 * 1000);
  lib.configureActions({
    activityName: RELOCK_ACTIVITY,
    callbackName: 'intervalDidStart',
    actions: [{ type: 'blockSelection', familyActivitySelectionId: SELECTION_ID }],
  });
  lib.stopMonitoring([RELOCK_ACTIVITY]);
  try {
    await lib.startMonitoring(
      RELOCK_ACTIVITY,
      {
        intervalStart: components(until),
        intervalEnd: components(new Date(until.getTime() + MIN_INTERVAL_MIN * 60 * 1000)),
        repeats: false,
      },
      [],
    );
  } catch (e) {
    // Couldn't schedule the re-lock: don't hand out an open-ended pass.
    return;
  }
  lib.userDefaultsSet(PASS_KEY, until.getTime());
  lib.unblockSelection(selection, 'doomtype-pass');
};
