import { Platform, PermissionsAndroid } from 'react-native';

// Bridge to the doomtype-exercise native module: the pose-detecting camera
// view and the step counter. Android uses CameraX + MediaPipe and the
// hardware step counter; iOS uses Vision and CoreMotion. In Expo Go and on
// the web the module is absent, so everything here reports "unavailable" and
// the UI hides the exercise options.

let native = null;
let PoseCameraView = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
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

async function prompting(ask) {
  promptOpen = true;
  try {
    return await ask();
  } finally {
    promptOpen = false;
  }
}

async function requestAndroid(permission) {
  if (await PermissionsAndroid.check(permission)) return true;
  const result = await prompting(() => PermissionsAndroid.request(permission));
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export const ensureCameraPermission = () => {
  if (Platform.OS === 'ios') return prompting(() => native.requestCameraPermission());
  return requestAndroid(PermissionsAndroid.PERMISSIONS.CAMERA);
};

// Android 10+ needs activity recognition for the step counter. iOS asks for
// Motion & Fitness access itself on the first step reading.
export const ensureActivityPermission = () => {
  if (Platform.OS === 'android' && Platform.Version >= 29) {
    return requestAndroid(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
  }
  return Promise.resolve(true);
};

export const readStepCounter = () => native.readStepCounter();

// Names the permission to point people at when step reading fails.
export const activityPermissionName = Platform.OS === 'ios' ? 'Motion & Fitness' : 'Physical activity';
