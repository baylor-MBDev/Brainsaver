import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Keycap from '../components/Keycap';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import * as screenTime from '../native/screenTime';

// Android: a curated list of the usual suspects, mapped to packages in
// src/native/guard.js. iOS: Apple's own picker, since iOS apps can only be
// guarded through the opaque tokens it hands back.

const APPS = [
  { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' },
  { id: 'twitter', name: 'X / Twitter', emoji: '🐦' },
  { id: 'youtube', name: 'YouTube', emoji: '📺' },
  { id: 'reddit', name: 'Reddit', emoji: '👽' },
  { id: 'snapchat', name: 'Snapchat', emoji: '👻' },
  { id: 'facebook', name: 'Facebook', emoji: '📘' },
];

function ScreenTimePicker() {
  const { state } = useStore();
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState(screenTime.selectionSummary());
  const [authorized, setAuthorized] = useState(screenTime.isAuthorized());

  const refresh = useCallback(() => {
    setSummary(screenTime.selectionSummary());
    setAuthorized(screenTime.isAuthorized());
  }, []);

  const pick = async () => {
    if (!authorized && !(await screenTime.requestAuthorization())) {
      refresh();
      return;
    }
    setAuthorized(true);
    setPicking(true);
  };

  const done = () => {
    setPicking(false);
    refresh();
    // New picks are shielded straight away (unless a pass is running).
    screenTime.ensureLocked();
  };

  useEffect(refresh, [refresh]);

  const Sheet = screenTime.SelectionSheet;
  const parts = summary
    ? [
        [summary.applicationCount, 'app'],
        [summary.categoryCount, 'category', 'categories'],
        [summary.webDomainCount, 'website'],
      ]
        .filter(([n]) => n > 0)
        .map(([n, one, many]) => `${n} ${n === 1 ? one : many || `${one}s`}`)
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.headline}>PICK YOUR{'\n'}POISON.</Text>
        <Text style={styles.sub}>
          Guarded apps are shielded until you get through the gate. Each pass lasts {state.intervalMinutes} min.
        </Text>
        <View style={[styles.row, parts.length > 0 && styles.rowOn]}>
          <Text style={styles.emoji}>🧠</Text>
          <Text style={[styles.name, parts.length > 0 && styles.nameOn]}>
            {parts.length > 0 ? parts.join(', ') : 'Nothing guarded yet'}
          </Text>
        </View>
        <Keycap
          label={parts.length > 0 ? 'CHANGE GUARDED APPS' : 'CHOOSE APPS'}
          color={colors.rot}
          textColor={colors.keyFace}
          onPress={pick}
          wide
        />
        {!authorized && (
          <Text style={styles.note}>
            DOOMTYPE needs Screen Time access first. If you said no before, turn it on in Settings › Screen Time.
          </Text>
        )}
        <Text style={styles.note}>
          Apple shows DOOMTYPE only a count, never which apps you picked or what you do in them.
        </Text>
      </ScrollView>
      {picking && Sheet && (
        <Sheet
          style={styles.anchor}
          familyActivitySelectionId={screenTime.SELECTION_ID}
          headerText="Pick the apps that eat your day."
          footerText="They'll stay shielded until you earn your way in."
          onDismissRequest={done}
        />
      )}
    </SafeAreaView>
  );
}

export default function AppPicker(props) {
  if (Platform.OS === 'ios' && screenTime.screenTimeAvailable()) return <ScreenTimePicker {...props} />;
  return <CuratedPicker {...props} />;
}

function CuratedPicker() {
  const { state, update } = useStore();

  const toggle = (id) => {
    Haptics.selectionAsync();
    const on = state.guardedApps.includes(id);
    update({
      guardedApps: on
        ? state.guardedApps.filter((a) => a !== id)
        : [...state.guardedApps, id],
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.headline}>PICK YOUR{'\n'}POISON.</Text>
        <Text style={styles.sub}>Guarded apps get the gate on open, then again every {state.intervalMinutes} min.</Text>

        {APPS.map((app) => {
          const on = state.guardedApps.includes(app.id);
          return (
            <Pressable key={app.id} onPress={() => toggle(app.id)} style={[styles.row, on && styles.rowOn]}>
              <Text style={styles.emoji}>{app.emoji}</Text>
              <Text style={[styles.name, on && styles.nameOn]}>{app.name}</Text>
              <View style={[styles.pill, on ? styles.pillOn : styles.pillOff]}>
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{on ? 'GUARDED' : 'FREE'}</Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.note}>
          These are the apps DOOMTYPE can guard today. Changes apply the next time you open one.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper, paddingTop: 40 },
  wrap: { padding: 24, gap: 12, paddingBottom: 48 },
  headline: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  sub: { fontFamily: fonts.mono, fontSize: 13, color: colors.faded, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    backgroundColor: colors.keyFace,
    padding: 14,
    gap: 12,
  },
  rowOn: { backgroundColor: colors.ink },
  emoji: { fontSize: 22 },
  name: { flex: 1, fontFamily: fonts.monoBold, fontSize: 15, color: colors.ink },
  nameOn: { color: colors.keyFace },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2 },
  pillOn: { backgroundColor: colors.rot, borderColor: colors.rot },
  pillOff: { borderColor: colors.faded },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.faded },
  pillTextOn: { color: colors.keyFace },
  anchor: { position: 'absolute', width: 1, height: 1 },
  note: { fontFamily: fonts.mono, fontSize: 11, color: colors.faded, marginTop: 8, lineHeight: 17 },
});
