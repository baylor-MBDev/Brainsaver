import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Switch, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Keycap from '../components/Keycap';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const INTERVALS = [5, 10, 15];

export default function Settings({ navigation }) {
  const { state, update } = useStore();
  const [draft, setDraft] = useState('');

  const addPhrase = () => {
    const clean = draft.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (state.phrases.includes(clean)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    update({ phrases: [...state.phrases, clean] });
    setDraft('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removePhrase = (p) => {
    if (state.phrases.length <= 1) return; // always keep at least one
    Haptics.selectionAsync();
    update({ phrases: state.phrases.filter((x) => x !== p) });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.headline}>TUNE THE{'\n'}CRUELTY.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>RE-GATE INTERVAL</Text>
          <Text style={styles.hint}>How often the gate fires again while you stay inside a guarded app.</Text>
          <View style={styles.pillRow}>
            {INTERVALS.map((m) => (
              <Pressable
                key={m}
                onPress={() => { Haptics.selectionAsync(); update({ intervalMinutes: m }); }}
                style={[styles.pill, state.intervalMinutes === m && styles.pillOn]}
              >
                <Text style={[styles.pillText, state.intervalMinutes === m && styles.pillTextOn]}>{m} MIN</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>YOUR PHRASES</Text>
          <Text style={styles.hint}>
            One is picked at random each rep, so it never turns into muscle memory. Lowercase letters only, 10+ characters, no spaces.
          </Text>

          {state.phrases.map((p) => (
            <View key={p} style={styles.phraseRow}>
              <Text style={styles.phraseText}>{p}</Text>
              {state.phrases.length > 1 && (
                <Pressable onPress={() => removePhrase(p)} hitSlop={10}>
                  <Text style={styles.phraseRemove}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}

          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="add another phrase"
            placeholderTextColor={colors.faded}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          <Keycap label="ADD PHRASE" small onPress={addPhrase} />
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ESCALATION MODE</Text>
              <Text style={styles.hint}>Every 4 opens adds a rep, up to 3x per open. For the truly cooked.</Text>
            </View>
            <Switch
              value={state.escalation}
              onValueChange={(v) => update({ escalation: v })}
              trackColor={{ true: colors.rot, false: colors.faded }}
              thumbColor={colors.keyFace}
            />
          </View>
        </View>

        <Keycap label="BACK" onPress={() => navigation.goBack()} wide />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper, paddingTop: 40 },
  wrap: { padding: 24, gap: 28, paddingBottom: 48 },
  headline: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  section: { gap: 10 },
  label: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  hint: { fontFamily: fonts.mono, fontSize: 12, color: colors.faded, lineHeight: 18 },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    borderWidth: 3, borderColor: colors.ink, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.keyFace,
  },
  pillOn: { backgroundColor: colors.ink },
  pillText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.ink },
  pillTextOn: { color: colors.zap },
  input: {
    borderWidth: 3, borderColor: colors.ink, borderRadius: 14,
    backgroundColor: colors.keyFace, fontFamily: fonts.monoBold,
    fontSize: 15, padding: 14, color: colors.ink,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  phraseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 3, borderColor: colors.ink, borderRadius: 14,
    backgroundColor: colors.keyFace, paddingVertical: 12, paddingHorizontal: 14,
  },
  phraseText: { flex: 1, fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  phraseRemove: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.rot },
});
