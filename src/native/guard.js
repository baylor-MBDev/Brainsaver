import { Platform } from 'react-native';

// Bridge to the doomtype-guard native module (Android dev builds only).
// In Expo Go and on the web the module is absent and every call no-ops,
// so the rest of the app never has to check the platform.

let native = null;
if (Platform.OS === 'android') {
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

export const guardAvailable = () => !!native;

export const isServiceEnabled = () => (native ? native.isServiceEnabled() : false);

export const hasOverlayPermission = () => (native ? native.hasOverlayPermission() : false);

export const openAccessibilitySettings = () => native?.openAccessibilitySettings();

export const openOverlaySettings = () => native?.openOverlaySettings();

export const syncGuardedApps = (ids) => {
  if (!native) return;
  native.setGuardedApps(ids.flatMap((id) => APP_PACKAGES[id] || []));
};

export const grantPass = (pkg, minutes) => native?.grantPass(pkg, minutes);

export const consumePendingChallenge = () =>
  native ? native.consumePendingChallenge() : null;

export const goHome = () => native?.goHome();

export const returnToGuardedApp = () => native?.returnToGuardedApp();

export const appNameForPackage = (pkg) => PACKAGE_NAMES[pkg] || 'that app';
