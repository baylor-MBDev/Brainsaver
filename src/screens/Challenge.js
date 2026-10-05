import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, SafeAreaView, Animated, AppState, BackHandler, Keyboard,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Keycap from '../components/Keycap';
import Brain from '../components/Brain';
import PushupSession from '../components/PushupSession';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import { grantPass, goHome, returnToGuardedApp } from '../native/guard';
import { pushupsAvailable, isPermissionPromptOpen } from '../native/exercise';
import { PUSHUP_GOAL, PUSHUP_REWARD_MIN, creditBank, spendBank } from '../exercise/bank';

// The whole product is this screen. Full rot-orange takeover, the phrase
// rendered as keycaps, an input that accepts nothing but the exact truth.
// No paste. No autocorrect. Backing out is celebrated -- unless strict mode
// is on, in which case the only ways in are typing it or spending time
// earned with pushups and walks.

export default function Challenge({ navigation, route }) {
  const app = route?.params?.app ?? 'Instagram';
  const pkg = route?.params?.pkg;
  const enforced = route?.params?.enforced === true;
  const { state, update, repsRequired, randomPhrase } = useStore();
  const total = repsRequired();
  const strict = state.strictMode;

  const [mode, setMode] = useState('type'); // 'type' | 'pushups'
  const [rep, setRep] = useState(1);
  const [text, setText] = useState('');
  const [phrase, setPhrase] = useState(randomPhrase);
  const [kbVisible, setKbVisible] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  // Set once the gate is closing on purpose, so the leave-detection below
  // doesn't also fire for our own exit.
  const exiting = useRef(false);

  // With the keyboard up, vertical space halves; drop the headline block so
  // the phrase, input, and the backout button all stay on screen.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const wrong = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const onChange = (value) => {
    // hard stop anything that isn't a prefix of the phrase
    if (!phrase.startsWith(value)) {
      wrong();
      return;
    }
    setText(value);
    if (value === phrase) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      update((prev) => ({ typedToday: prev.typedToday + 1 }));
      if (rep < total) {
        setRep(rep + 1);
        setText('');
        setPhrase(randomPhrase());
      } else {
        update((prev) => ({ opensToday: prev.opensToday + 1 }));
        letIn(state.intervalMinutes);
      }
    }
  };

  // Every way through the gate ends here with a timed pass; the service
  // re-gates when it expires.
  const letIn = (minutes) => {
    exiting.current = true;
    if (enforced && pkg) grantPass(pkg, minutes);
    navigation.goBack();
    if (enforced && pkg) returnToGuardedApp();
  };

  const backOut = () => {
    if (strict) return;
    exiting.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update((prev) => ({ backoutsToday: prev.backoutsToday + 1 }));
    navigation.goBack();
    // Backing out of a real open must not drop the user back into the
    // guarded app underneath; send them to the launcher instead.
    if (enforced) goHome();
  };

  // Spend earned minutes instead of typing. One re-gate interval at a time.
  const spendable = spendBank(state.bankMinutes, state.intervalMinutes).minutes;
  const spend = () => {
    if (spendable <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update((prev) => ({
      bankMinutes: spendBank(prev.bankMinutes, spendable).bank,
      opensToday: prev.opensToday + 1,
    }));
    letIn(spendable);
  };

  // Earned on the spot: bank the reward, then spend from it straight away.
  const pushupsDone = (reps) => {
    const credited = creditBank(state.bankMinutes, PUSHUP_REWARD_MIN);
    const { minutes, bank } = spendBank(credited, state.intervalMinutes);
    update((prev) => ({
      bankMinutes: bank,
      earnedToday: prev.earnedToday + (credited - state.bankMinutes),
      pushupsToday: prev.pushupsToday + reps,
      opensToday: prev.opensToday + 1,
    }));
    letIn(minutes);
  };

  const startPushups = () => {
    Keyboard.dismiss();
    setMode('pushups');
  };

  // Hardware back: leaves the pushup camera, backs out of the gate, or --
  // in strict mode -- does nothing at all.
  const onBack = useRef(null);
  onBack.current = () => {
    if (mode === 'pushups') setMode('type');
    else backOut();
    return true;
  };
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => onBack.current());
      return () => sub.remove();
    }, [])
  );

  // Leaving DOOMTYPE (home button, recents) with the gate up isn't getting
  // in, so close the gate. Otherwise reopening DOOMTYPE itself would land on
  // a gate with no way past it in strict mode. The guarded app gets a fresh
  // gate the next time it's opened. Permission dialogs also pause the app,
  // so those don't count as leaving.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' || exiting.current || isPermissionPromptOpen()) return;
      exiting.current = true;
      navigation.goBack();
    });
    return () => sub.remove();
  }, [navigation]);

  if (mode === 'pushups') {
    return (
      <PushupSession
        onDone={pushupsDone}
        onCancel={() => setMode('type')}
        cancelLabel="BACK TO TYPING"
      />
    );
  }

  const canPushups = pushupsAvailable();

  // Render the phrase as keycaps, lit as they're typed
  const chars = phrase.split('');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={[styles.wrap, kbVisible && styles.wrapCompact]}>
        <View style={styles.top}>
          <View style={styles.topText}>
            <Text style={styles.eyebrow}>YOU ARE OPENING {app.toUpperCase()}</Text>
            {!kbVisible && <Text style={styles.headline}>SAY IT.</Text>}
            <Text style={styles.sub}>
              Open #{state.opensToday + 1} today.{total > 1 ? ` Rot level requires ${total} reps. This is rep ${rep}.` : ''}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <Brain
              mood={
                text.length === 0
                  ? 'scream'
                  : text.length < phrase.length * 0.7
                    ? 'worried'
                    : 'relieved'
              }
              size={kbVisible ? 64 : 80}
            />
          </Animated.View>
        </View>

        <View style={styles.phraseWrap}>
          {chars.map((c, i) => (
            <View key={i} style={[styles.charKey, i < text.length && styles.charKeyDone]}>
              <Text style={[styles.charText, i < text.length && styles.charTextDone]}>{c}</Text>
            </View>
          ))}
        </View>

        <Animated.View style={{ transform: [{ translateX: shake }] }}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            contextMenuHidden
            autoFocus
            keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'}
            placeholder="type it. all of it."
            placeholderTextColor="rgba(255,255,255,0.5)"
          />
        </Animated.View>

        {(spendable > 0 || canPushups) && (
          <View style={styles.altRow}>
            {spendable > 0 && (
              <Keycap
                label={`SPEND ${spendable} MIN`}
                color={colors.zap}
                onPress={spend}
                small
                wide
                style={styles.altKey}
              />
            )}
            {canPushups && (
              <Keycap
                label={`${PUSHUP_GOAL} PUSHUPS`}
                onPress={startPushups}
                small
                wide
                style={styles.altKey}
              />
            )}
          </View>
        )}

        {strict ? (
          <Text style={styles.backoutNote}>no escape mode. type it or earn it.</Text>
        ) : (
          <>
            <Keycap
              label="ACTUALLY, NEVER MIND"
              color={colors.growth}
              textColor={colors.keyFace}
              onPress={backOut}
              wide
            />
            {!kbVisible && (
              <Text style={styles.backoutNote}>backing out counts as a win. no shame in the smart move.</Text>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.rot, paddingTop: 40 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  wrapCompact: { gap: 12, paddingVertical: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: { flex: 1, gap: 8 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.keyFace, letterSpacing: 2 },
  headline: { fontFamily: fonts.display, fontSize: 52, color: colors.ink },
  sub: { fontFamily: fonts.mono, fontSize: 13, color: colors.keyFace },
  phraseWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  charKey: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 22,
    alignItems: 'center',
  },
  charKeyDone: { backgroundColor: colors.ink },
  charText: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  charTextDone: { color: colors.zap },
  input: {
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: colors.keyFace,
    fontFamily: fonts.monoBold,
    fontSize: 16,
    padding: 16,
  },
  altRow: { flexDirection: 'row', gap: 10 },
  altKey: { flex: 1 },
  backoutNote: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
});
