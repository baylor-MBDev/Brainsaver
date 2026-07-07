import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import Keycap from '../components/Keycap';
import RotMeter from '../components/RotMeter';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.logo}>DOOMTYPE</Text>
          <Keycap label="⚙" small onPress={() => navigation.navigate('Settings')} />
        </View>

        <Text style={styles.streak}>
          {state.streak > 0 ? `🔥 ${state.streak} day streak under 5 opens` : 'no streak yet. day one starts now.'}
        </Text>

        <RotMeter opensToday={state.opensToday} />

        <View style={styles.statRow}>
          <Stat value={state.opensToday} label="opens today" color={colors.rot} />
          <Stat value={state.typedToday} label="phrases typed" />
          <Stat value={state.backoutsToday} label="backouts (wins)" color={colors.growth} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GUARDED APPS</Text>
          <Text style={styles.sectionNote}>
            {state.guardedApps.length} apps behind the gate. Tap one to feel what your future self feels.
          </Text>
          <Keycap label="VIEW GUARDED APPS" onPress={() => navigation.navigate('AppPicker')} wide />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TEST THE GATE</Text>
          <Text style={styles.sectionNote}>
            In production this fires automatically when a guarded app opens, and again every {state.intervalMinutes} minutes inside it.
          </Text>
          <Keycap
            label="SIMULATE OPENING INSTAGRAM"
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
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: 24, paddingBottom: 48, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  streak: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.ink },
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
