import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Keycap from './Keycap';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import {
  BANK_CAP_MIN, PUSHUP_GOAL, PUSHUP_REWARD_MIN, STEP_GOAL, STEP_REWARD_MIN, creditBank, walkSteps,
} from '../exercise/bank';
import {
  pushupsAvailable, stepsAvailable, ensureActivityPermission, readStepCounter,
} from '../native/exercise';

// Home's "earn time" block: the bank balance, pushups, and step walks.
// Earned minutes can be spent at the gate instead of typing.

export default function EarnTime({ navigation }) {
  const { state, update } = useStore();
  const pushups = pushupsAvailable();
  const steps = stepsAvailable();
  const [walked, setWalked] = useState(0);
  const [walkError, setWalkError] = useState(null);
  const bankFull = state.bankMinutes >= BANK_CAP_MIN;

  // While a walk is running and Home is on screen, poll the step counter.
  // The hardware keeps counting with the app closed, so a walk taken with
  // the phone in a pocket shows up the next time Home opens.
  useFocusEffect(
    useCallback(() => {
      if (!state.walk || !steps) return undefined;
      let alive = true;
      const tick = () =>
        readStepCounter()
          .then((now) => {
            if (alive) setWalked(walkSteps(state.walk.baseline, now));
          })
          .catch(() => {});
      tick();
      const timer = setInterval(tick, 3000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [state.walk, steps])
  );

  const startWalk = async () => {
    setWalkError(null);
    if (!(await ensureActivityPermission())) {
      setWalkError('Walks need the "Physical activity" permission to read your step counter.');
      return;
    }
    try {
      const baseline = await readStepCounter();
      setWalked(0);
      update({ walk: { baseline, startedAt: Date.now() } });
    } catch (e) {
      setWalkError("Couldn't read your step counter. Try again in a moment.");
    }
  };

  const claimWalk = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update((prev) => {
      const bank = creditBank(prev.bankMinutes, STEP_REWARD_MIN);
      return { bankMinutes: bank, earnedToday: prev.earnedToday + (bank - prev.bankMinutes), walk: null };
    });
    setWalked(0);
  };

  const cancelWalk = () => {
    update({ walk: null });
    setWalked(0);
  };

  const walkDone = walked >= STEP_GOAL;

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <Text style={styles.title}>EARN TIME</Text>
        <View style={[styles.bankPill, state.bankMinutes > 0 && styles.bankPillOn]}>
          <Text style={[styles.bankText, state.bankMinutes > 0 && styles.bankTextOn]}>
            {state.bankMinutes} MIN BANKED
          </Text>
        </View>
      </View>
      <Text style={styles.note}>
        Move first, scroll later. {PUSHUP_GOAL} pushups or {STEP_GOAL.toLocaleString()} steps banks {PUSHUP_REWARD_MIN} minutes you can spend at the gate instead of typing. The bank holds up to {BANK_CAP_MIN} minutes and empties at midnight.
      </Text>

      {!pushups && !steps && (
        <Text style={styles.note}>Pushups and walks run in the installed Android app.</Text>
      )}

      {pushups && (
        <Keycap
          label={bankFull ? 'BANK FULL' : `DO ${PUSHUP_GOAL} PUSHUPS  +${PUSHUP_REWARD_MIN} MIN`}
          onPress={() => navigation.navigate('Pushups')}
          disabled={bankFull}
          wide
        />
      )}

      {steps && !state.walk && (
        <Keycap
          label={`START A ${STEP_GOAL.toLocaleString()}-STEP WALK`}
          onPress={startWalk}
          disabled={bankFull}
          wide
        />
      )}

      {steps && state.walk && (
        <View style={styles.walkCard}>
          <View style={styles.walkRow}>
            <Text style={styles.walkCount}>
              {Math.min(walked, STEP_GOAL).toLocaleString()} / {STEP_GOAL.toLocaleString()}
            </Text>
            <Text style={styles.walkLabel}>STEPS</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(Math.min(walked / STEP_GOAL, 1) * 100, 3)}%` },
                walkDone && { backgroundColor: colors.growth },
              ]}
            />
          </View>
          {walkDone ? (
            <Keycap
              label={bankFull ? 'BANK FULL' : `CLAIM +${STEP_REWARD_MIN} MIN`}
              color={colors.growth}
              textColor={colors.keyFace}
              onPress={claimWalk}
              disabled={bankFull}
              wide
            />
          ) : (
            <View style={styles.walkFoot}>
              <Text style={styles.walkHint}>Keeps counting with the app closed. Phone in pocket, go.</Text>
              <Pressable onPress={cancelWalk} hitSlop={10}>
                <Text style={styles.cancel}>CANCEL</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {walkError && <Text style={[styles.note, { color: colors.rot }]}>{walkError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  bankPill: {
    borderWidth: 2, borderColor: colors.faded, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  bankPillOn: { backgroundColor: colors.zap, borderColor: colors.ink },
  bankText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.faded },
  bankTextOn: { color: colors.ink },
  note: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.faded },
  walkCard: {
    borderWidth: 3, borderColor: colors.ink, borderRadius: 14, backgroundColor: colors.keyFace,
    padding: 14, gap: 10,
  },
  walkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  walkCount: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  walkLabel: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.faded },
  track: {
    height: 16, borderWidth: 3, borderColor: colors.ink, borderRadius: 8, overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  fill: { height: '100%', backgroundColor: colors.zap },
  walkFoot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walkHint: { flex: 1, fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.faded },
  cancel: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.rot },
});
