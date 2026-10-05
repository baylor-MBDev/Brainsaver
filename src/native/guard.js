import { Platform } from 'react-native';
import * as screenTime from './screenTime';

// Bridge to the doomtype-guard native module. On Android it is the whole
// enforcement layer (an accessibility service). On iOS, Screen Time does the
// blocking (./screenTime.js) and the module only hands taps on the shield's
// notification back to the gate. In Expo Go and on the web the module is
// absent and every call no-ops, so screens rarely check the platform.

const ios = Platform.OS === 'ios';

let native = null;
if (Platform.OS === 'android' || ios) {
  try {
    const { requireNativeModule } = require('expo-modules-core');
    native = requireNativeModule('DoomtypeGuard');
  } catch (e) {
    native = null;
  }
}

// Picker ids -> real Android packages. TikTok ships under two ids by region.
export const APP_PACKAGES = {
  instagram: ['com.instagram.android'],
  tiktok: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
  twitter: ['com.twitter.android'],
  youtube: ['com.google.android.youtube'],
  reddit: ['com.reddit.frontpage'],
  snapchat: ['com.snapchat.android'],
  facebook: ['com.facebook.katana'],
};

const PACKAGE_NAMES = {
  'com.instagram.android': 'Instagram',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok',
  'com.twitter.android': 'X / Twitter',
  'com.google.android.youtube': 'YouTube',
  'com.reddit.frontpage': 'Reddit',
  'com.snapchat.android': 'Snapchat',
  'com.facebook.katana': 'Facebook',
};

export const guardAvailable = () => !!native && (!ios || screenTime.screenTimeAvailable());

export const isServiceEnabled = () => (native && !ios ? native.isServiceEnabled() : false);

export const hasOverlayPermission = () => (native && !ios ? native.hasOverlayPermission() : false);

export const openAccessibilitySettings = () => (ios ? undefined : native?.openAccessibilitySettings());

export const openOverlaySettings = () => (ios ? undefined : native?.openOverlaySettings());

// iOS picks apps in Apple's sheet instead (screens/AppPicker.js).
export const syncGuardedApps = (ids) => {
  if (!native || ios) return;
  native.setGuardedApps(ids.flatMap((id) => APP_PACKAGES[id] || []));
};

export const grantPass = (pkg, minutes) => {
  if (ios) return screenTime.grantPass(minutes);
  return native?.grantPass(pkg, minutes);
};

// Android reports the package that triggered the gate. iOS reports the app
// name from the shield notification, tagged so appNameForPackage can tell.
export const consumePendingChallenge = () => {
  if (!native) return null;
  const pending = native.consumePendingChallenge();
  if (!ios || pending == null) return pending;
  return `ios:${pending}`;
};

// Fires when the shield notification is tapped while DOOMTYPE is running.
export const onGateRequested = (listener) => {
  if (!native || !ios) return { remove() {} };
  return native.addListener('onGateRequested', listener);
};

export const requestNotificationPermission = () =>
  native && ios ? native.requestNotificationPermission() : Promise.resolve(false);

export const hasNotificationPermission = () =>
  native && ios ? native.hasNotificationPermission() : Promise.resolve(false);

// iOS can't send the user home or into another app; leaving that to them.
export const goHome = () => (ios ? undefined : native?.goHome());

export const returnToGuardedApp = () => (ios ? undefined : native?.returnToGuardedApp());

export const appNameForPackage = (pkg) => {
  if (pkg?.startsWith('ios:')) return pkg.slice(4) || 'that app';
  return PACKAGE_NAMES[pkg] || 'that app';
};
