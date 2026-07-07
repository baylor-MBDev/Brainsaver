import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

// Rot rises with every gated open today. Copy escalates with it.

const STATUS = [
  { max: 0, label: 'FRESH', note: 'brain intact. suspicious.', color: colors.growth },
  { max: 3, label: 'LIGHTLY TOASTED', note: 'a normal amount of scrolling. allegedly.', color: colors.growth },
  { max: 7, label: 'FERMENTING', note: 'the algorithm knows your name now.', color: colors.zap },
  { max: 12, label: 'COMPOSTING', note: 'you have typed the phrase from memory 4 times.', color: colors.rot },
  { max: Infinity, label: 'FULL ROT', note: 'log off. touch grass. we believe in you.', color: colors.rot },
];

export default function RotMeter({ opensToday }) {
  const status = STATUS.find((s) => opensToday <= s.max);
  const pct = Math.min(opensToday / 15, 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>ROT METER</Text>
        <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(pct * 100, 4)}%`, backgroundColor: status.color }]} />
      </View>
      <Text style={styles.note}>{status.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    backgroundColor: colors.keyFace,
    padding: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  status: { fontFamily: fonts.monoBold, fontSize: 13 },
  track: {
    height: 18,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  fill: { height: '100%' },
  note: { fontFamily: fonts.mono, fontSize: 12, color: colors.faded, marginTop: 8 },
});
