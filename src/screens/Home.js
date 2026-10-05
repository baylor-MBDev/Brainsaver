import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, AppState, Platform } from 'react-native';
import Keycap from '../components/Keycap';
import RotMeter from '../components/RotMeter';
import EarnTime from '../components/EarnTime';
import Brain, { moodForOpens } from '../components/Brain';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import {
  guardAvailable,
  isServiceEnabled,
  hasOverlayPermission,
  openAccessibilitySettings,
  openOverlaySettings,
  hasNotificationPermission,
  requestNotificationPermission,
} from '../native/guard';
import * as screenTime from '../native/screenTime';

const ios = Platform.OS === 'ios';

function Stat({ value, label, color = colors.ink }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Home({ navigation }) {
  const { state } = useStore();
  const [armed, setArmed] = useState({ service: false, overlay: false });
  // iOS: Screen Time access, picked apps, and notifications (the shield's
  // only way to reach the gate).
  const [st, setSt] = useState({ authorized: false, picked: 0, notify: false });

  const refreshArmed = useCallback(async () => {
    if (!guardAvailable()) return;
    if (!ios) {
      setArmed({ service: isServiceEnabled(), overlay: hasOverlayPermission() });
      return;
    }
    const next = {
      authorized: screenTime.isAuthorized(),
      picked: screenTime.selectionCount(),
      notify: await hasNotificationPermission(),
    };
    setSt(next);
    if (next.authorized && next.picked > 0) screenTime.lockNow();
  }, []);

  const allowScreenTime = async () => {
    await screenTime.requestAuthorization();
    refreshArmed();
  };

  const allowNotifications = async () => {
    await requestNotificationPermission();
    refreshArmed();
  };

  useEffect(() => {
    refreshArmed();
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshArmed();
    });
    const unsubFocus = navigation.addListener('focus', refreshArmed);
    return () => {
      appState.remove();
      unsubFocus();
    };
  }, [navigation, refreshArmed]);

  const fullyArmed = ios ? st.authorized && st.picked > 0 && st.notify : armed.service && armed.overlay;
  const guardedCount = ios ? st.picked : state.guardedApps.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.logo}>DOOMTYPE</Text>
          <Keycap label="⚙" small onPress={() => navigation.navigate('Settings')} />
        </View>

        <View style={styles.brainRow}>
          <Brain mood={moodForOpens(state.opensToday, state.streak)} size={84} />
          <Text style={styles.streak}>
            {state.streak > 0 ? `🔥 ${state.streak} day streak under 5 opens` : 'no streak yet. day one starts now.'}
          </Text>
        </View>

        <RotMeter opensToday={state.opensToday} />

        <View style={styles.statRow}>
          <Stat value={state.opensToday} label="opens today" color={colors.rot} />
          <Stat value={state.typedToday} label="phrases typed" />
          <Stat value={state.backoutsToday} label="backouts (wins)" color={colors.growth} />
        </View>

        <EarnTime navigation={navigation} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GUARDED APPS</Text>
          <Text style={styles.sectionNote}>
            {guardedCount} {ios ? 'apps or categories' : 'apps'} behind the gate. Tap one to feel what your future self feels.
          </Text>
          <Keycap label="VIEW GUARDED APPS" onPress={() => navigation.navigate('AppPicker')} wide />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REAL ENFORCEMENT</Text>
          {!guardAvailable() ? (
            <Text style={styles.sectionNote}>
              Real blocking runs in the installed phone app. You can still try the gate below.
            </Text>
          ) : fullyArmed && ios ? (
            <Text style={[styles.sectionNote, { color: colors.growth }]}>
              ARMED. Guarded apps are shielded. Tap OPEN THE GATE on the shield, then the notification, and earn your way in. Every pass ends after {state.intervalMinutes} minutes.
            </Text>
          ) : ios ? (
            <>
              <Text style={styles.sectionNote}>
                Three steps and Screen Time does the blocking. Apple never tells DOOMTYPE which apps you pick or what you do in them.
              </Text>
              {!st.authorized && (
                <Keycap label="1. ALLOW SCREEN TIME" onPress={allowScreenTime} wide />
              )}
              {st.picked === 0 && (
                <Keycap
                  label="2. PICK APPS TO GUARD"
                  onPress={() => navigation.navigate('AppPicker')}
                  disabled={!st.authorized}
                  wide
                />
              )}
              {!st.notify && (
                <Keycap label="3. ALLOW NOTIFICATIONS" onPress={allowNotifications} wide />
              )}
            </>
          ) : fullyArmed ? (
            <Text style={[styles.sectionNote, { color: colors.growth }]}>
              ARMED. Open a guarded app and the gate opens with it. Every {state.intervalMinutes} minutes inside, it comes back.
            </Text>
          ) : (
            <>
              <Text style={styles.sectionNote}>
                Two Android permissions and the gate stops being a suggestion. DOOMTYPE never reads what's on your screen; it only watches which app is in front.
              </Text>
              {!armed.service && (
                <Keycap label="1. ENABLE APP WATCHING" onPress={openAccessibilitySettings} wide />
              )}
              {!armed.overlay && (
                <Keycap label="2. ALLOW OPENING OVER APPS" onPress={openOverlaySettings} wide />
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRY THE GATE</Text>
          <Text style={styles.sectionNote}>
            This is what fires when a guarded app opens, and again every {state.intervalMinutes} minutes inside it. It counts like a real open.
          </Text>
          <Keycap
            label="OPEN THE GATE NOW"
            color={colors.rot}
            textColor={colors.keyFace}
            onPress={() => navigation.navigate('Challenge', { app: 'Instagram' })}
            wide
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper, paddingTop: 40 },
  wrap: { padding: 24, paddingBottom: 48, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  brainRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streak: { flex: 1, fontFamily: fonts.monoBold, fontSize: 13, color: colors.ink },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    backgroundColor: colors.keyFace,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.display, fontSize: 26 },
  statLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.faded, marginTop: 4, textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  sectionNote: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.faded },
});
