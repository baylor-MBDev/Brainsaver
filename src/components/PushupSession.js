import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import Keycap from './Keycap';
import Brain from './Brain';
import { colors, fonts } from '../theme';
import { createPushupCounter } from '../exercise/pushupCounter';
import { PUSHUP_GOAL, PUSHUP_REWARD_MIN } from '../exercise/bank';
import { PoseCameraView, ensureCameraPermission } from '../native/exercise';

// Full-screen pushup counter: live camera with on-device pose detection, a
// big rep count, and a hint that coaches the setup. Used from Home (bank the
// minutes) and from the gate (earn your way in).

const HINTS = {
  searching: 'Prop your phone on the floor, side-on, about 2 m away. Whole body in frame.',
  position: 'Get into a plank, side-on to the camera.',
  ready: 'Arms straight to start.',
  lower: 'Down.',
  push: 'Up!',
};

function moodFor(reps, goal, status) {
  if (reps >= goal) return 'proud';
  if (status === 'searching' || status === 'position') return 'worried';
  return reps >= goal * 0.7 ? 'relieved' : 'worried';
}

export default function PushupSession({ onDone, onCancel, cancelLabel = 'GIVE UP' }) {
  const goal = PUSHUP_GOAL;
  const [permission, setPermission] = useState('checking');
  const [facing, setFacing] = useState('front');
  const [reading, setReading] = useState({ reps: 0, status: 'searching' });
  const [cameraError, setCameraError] = useState(null);
  const counter = useRef(createPushupCounter());
  const last = useRef({ reps: 0, status: 'searching' });
  const finished = useRef(false);

  useEffect(() => {
    let alive = true;
    ensureCameraPermission().then((ok) => {
      if (alive) setPermission(ok ? 'granted' : 'denied');
    });
    return () => {
      alive = false;
    };
  }, []);

  const onPose = useCallback(
    (e) => {
      if (finished.current) return;
      const { reps, status } = counter.current.update(e.nativeEvent);
      if (reps === last.current.reps && status === last.current.status) return;
      if (reps > last.current.reps) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      last.current = { reps, status };
      setReading({ reps, status });
      if (reps >= goal) {
        finished.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => onDone(reps), 900);
      }
    },
    [goal, onDone]
  );

  const done = reading.reps >= goal;
  const hint = done ? `Done. +${PUSHUP_REWARD_MIN} min.` : HINTS[reading.status];

  let body;
  if (permission === 'denied') {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>Counting pushups needs the camera. Frames stay on your phone and are never saved.</Text>
        <Keycap label="OPEN SETTINGS" onPress={() => Linking.openSettings()} wide />
      </View>
    );
  } else if (cameraError) {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>The camera didn't start: {cameraError}</Text>
      </View>
    );
  } else if (permission === 'granted' && PoseCameraView) {
    body = (
      <PoseCameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        onPose={onPose}
        onCameraError={(e) => setCameraError(e.nativeEvent.message)}
      />
    );
  } else {
    body = <View style={styles.center} />;
  }

  return (
    <View style={styles.wrap}>
      {body}

      <View style={styles.top} pointerEvents="none">
        <Text style={styles.eyebrow}>EARN IT</Text>
        <Text style={styles.title}>
          {goal} PUSHUPS = +{PUSHUP_REWARD_MIN} MIN
        </Text>
      </View>

      {permission === 'granted' && !cameraError && (
        <View style={styles.counterCard} pointerEvents="none">
          <Text style={[styles.count, done && { color: colors.growth }]}>{reading.reps}</Text>
          <Text style={styles.goal}>/ {goal}</Text>
        </View>
      )}

      <View style={styles.bottom}>
        {permission === 'granted' && !cameraError && (
          <View style={styles.hintRow}>
            <Brain mood={moodFor(reading.reps, goal, reading.status)} size={64} />
            <Text style={styles.hint}>{hint}</Text>
          </View>
        )}
        <View style={styles.buttons}>
          {permission === 'granted' && !cameraError && (
            <Keycap
              label="FLIP"
              small
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            />
          )}
          <Keycap label={cancelLabel} small wide onPress={onCancel} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  message: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 21, color: colors.keyFace },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: 24, gap: 6 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.zap, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.keyFace },
  counterCard: {
    position: 'absolute',
    top: 150,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  count: { fontFamily: fonts.display, fontSize: 72, color: colors.ink },
  goal: { fontFamily: fonts.monoBold, fontSize: 20, color: colors.faded },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 36, gap: 14 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    padding: 12,
  },
  hint: { flex: 1, fontFamily: fonts.monoBold, fontSize: 14, lineHeight: 20, color: colors.ink },
  buttons: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
