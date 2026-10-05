import { Platform, PermissionsAndroid } from 'react-native';

// Bridge to the doomtype-exercise native module (Android builds only): the
// pose-detecting camera view and the hardware step counter. In Expo Go and on
// the web the module is absent, so everything here reports "unavailable" and
// the UI hides the exercise options.

let native = null;
let PoseCameraView = null;
if (Platform.OS === 'android') {
  try {
    const core = require('expo-modules-core');
    native = core.requireNativeModule('DoomtypeExercise');
    PoseCameraView = core.requireNativeViewManager('DoomtypeExercise');
  } catch (e) {
    native = null;
    PoseCameraView = null;
  }
}

export { PoseCameraView };

export const pushupsAvailable = () => !!native && !!PoseCameraView;

export const stepsAvailable = () => {
  if (!native) return false;
  try {
    return native.hasStepSensor();
  } catch (e) {
    return false;
  }
};

// System permission dialogs pause the app, which looks like leaving it. The
// gate uses this to tell "asking for the camera" apart from "walked away".
let promptOpen = false;
export const isPermissionPromptOpen = () => promptOpen;

async function request(permission) {
  if (await PermissionsAndroid.check(permission)) return true;
  promptOpen = true;
  try {
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } finally {
    promptOpen = false;
  }
}

export const ensureCameraPermission = () => request(PermissionsAndroid.PERMISSIONS.CAMERA);

// Step counting needs activity recognition from Android 10 (API 29) on.
export const ensureActivityPermission = () =>
  Platform.Version >= 29
    ? request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION)
    : Promise.resolve(true);

export const readStepCounter = () => native.readStepCounter();
