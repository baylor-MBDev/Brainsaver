import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import Keycap from '../components/Keycap';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const BEATS = [
  {
    big: 'YOUR BRAIN\nIS ROTTING.',
    small: 'Average person checks social apps 96 times a day. You are probably not below average. No offense.',
    cta: 'RUDE. CONTINUE',
  },
  {
    big: 'SO WE MADE\nYOU A TOLL.',
    small: 'Every time you open a rotted app, you type one honest sentence first:\n\nimdestroyingmymentalhealth\n\nEvery 10 minutes inside, you type it again. No paste. No autocorrect. Just you and the truth.',
    cta: 'THAT IS EVIL. GO ON',
  },
  {
    big: 'SHAME,\nBUT MAKE IT\nSELF CARE.',
    small: 'Backing out at the gate counts as a win. Days under 5 opens build your streak. Full rot is reversible. Probably.',
    cta: 'START TYPING',
  },
];

export default function Onboarding({ navigation }) {
  const [beat, setBeat] = useState(0);
  const { update } = useStore();
  const b = BEATS[beat];

  const next = () => {
    if (beat < BEATS.length - 1) setBeat(beat + 1);
    else {
      update({ onboarded: true });
      navigation.replace('Home');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.logo}>DOOMTYPE</Text>
        <View style={styles.body}>
          <Text style={styles.big}>{b.big}</Text>
          <Text style={styles.small}>{b.small}</Text>
        </View>
        <View style={styles.dots}>
          {BEATS.map((_, i) => (
            <View key={i} style={[styles.dot, i === beat && styles.dotOn]} />
          ))}
        </View>
        <Keycap label={b.cta} onPress={next} color={beat === 2 ? colors.growth : colors.keyFace} wide />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  logo: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.rot, letterSpacing: 4 },
  body: { flex: 1, justifyContent: 'center' },
  big: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, color: colors.ink, marginBottom: 20 },
  small: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, color: colors.ink },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.ink },
  dotOn: { backgroundColor: colors.rot },
});
