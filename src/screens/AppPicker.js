import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

// Prototype picker. In production:
// iOS -> FamilyActivityPicker (you never see app names, just opaque tokens)
// Android -> installed app list via a small native module + UsageStats permission
// See src/native/README.md

const APPS = [
  { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' },
  { id: 'twitter', name: 'X / Twitter', emoji: '🐦' },
  { id: 'youtube', name: 'YouTube', emoji: '📺' },
  { id: 'reddit', name: 'Reddit', emoji: '👽' },
  { id: 'snapchat', name: 'Snapchat', emoji: '👻' },
  { id: 'facebook', name: 'Facebook', emoji: '📘' },
];

export default function AppPicker({ navigation }) {
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
          Prototype list. The production build uses Apple's FamilyActivityPicker on iOS and the installed-apps list on Android.
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
  note: { fontFamily: fonts.mono, fontSize: 11, color: colors.faded, marginTop: 8, lineHeight: 17 },
});
