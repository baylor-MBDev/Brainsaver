import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Circle, Ellipse, Line } from 'react-native-svg';
import { colors } from '../theme';

// The mascot. A pink brain drawn in the keycap style: ink outline, flat
// fill, big feelings. Moods map to the product's emotional states:
//   happy    - default, things are fine
//   proud    - streak energy, backout wins
//   worried  - rot is rising / mid-phrase panic
//   rot      - fermenting, half-lidded
//   dead     - full rot, X eyes, stink lines
//   scream   - the gate just slammed shut in front of you
//   relieved - phrase nearly done, almost free

const PINK = '#F7A8C4';

const BODY =
  'M 24 80 C 11 76, 8 60, 17 52 C 8 46, 11 31, 24 28 ' +
  'C 24 15, 39 8, 49 15 C 56 4, 73 4, 79 13 ' +
  'C 91 8, 103 17, 101 29 C 112 33, 114 48, 105 54 ' +
  'C 113 62, 109 76, 97 80 C 93 92, 77 97, 68 90 ' +
  'C 59 99, 42 99, 36 90 C 29 95, 24 88, 24 80 Z';

function Folds() {
  return (
    <>
      <Path
        d="M60 10 C 55 20, 66 27, 58 36"
        stroke={colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
      <Path
        d="M32 36 C 40 33, 43 41, 36 45"
        stroke={colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
      <Path
        d="M88 32 C 81 36, 85 43, 92 42"
        stroke={colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
    </>
  );
}

function Sweat() {
  return (
    <Path
      d="M103 40 C 109 49, 109 56, 103 56 C 97 56, 97 49, 103 40 Z"
      fill={colors.keyFace}
      stroke={colors.ink}
      strokeWidth={2.5}
    />
  );
}

function Sparkle({ x, y }) {
  return (
    <Path
      d={`M${x} ${y - 8} L${x + 2.6} ${y - 2.6} L${x + 8} ${y} L${x + 2.6} ${y + 2.6} L${x} ${y + 8} L${x - 2.6} ${y + 2.6} L${x - 8} ${y} L${x - 2.6} ${y - 2.6} Z`}
      fill={colors.zap}
      stroke={colors.ink}
      strokeWidth={2}
    />
  );
}

function Stink({ x }) {
  return (
    <Path
      d={`M${x} 24 q 5 -7 0 -14 q -5 -7 0 -14`}
      stroke={colors.growth}
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
      opacity={0.9}
    />
  );
}

function Face({ mood }) {
  switch (mood) {
    case 'proud':
      return (
        <>
          <Path d="M38 60 Q44 53 50 60" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M70 60 Q76 53 82 60" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M47 71 Q60 84 73 71" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Circle cx={36} cy={69} r={5} fill={colors.rot} opacity={0.4} />
          <Circle cx={84} cy={69} r={5} fill={colors.rot} opacity={0.4} />
          <Sparkle x={108} y={16} />
        </>
      );
    case 'worried':
      return (
        <>
          <Line x1={38} y1={49} x2={48} y2={53} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={82} y1={49} x2={72} y2={53} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Circle cx={44} cy={61} r={4.5} fill={colors.ink} />
          <Circle cx={76} cy={61} r={4.5} fill={colors.ink} />
          <Path d="M49 76 Q54.5 71 60 76 Q65.5 81 71 76" stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Sweat />
        </>
      );
    case 'rot':
      return (
        <>
          <Path d="M38 59 Q44 64 50 59" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M70 59 Q76 64 82 59" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M49 77 Q60 72 71 77" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Stink x={16} />
        </>
      );
    case 'dead':
      return (
        <>
          <Line x1={39} y1={55} x2={49} y2={65} stroke={colors.ink} strokeWidth={4} strokeLinecap="round" />
          <Line x1={49} y1={55} x2={39} y2={65} stroke={colors.ink} strokeWidth={4} strokeLinecap="round" />
          <Line x1={71} y1={55} x2={81} y2={65} stroke={colors.ink} strokeWidth={4} strokeLinecap="round" />
          <Line x1={81} y1={55} x2={71} y2={65} stroke={colors.ink} strokeWidth={4} strokeLinecap="round" />
          <Ellipse cx={60} cy={78} rx={9} ry={6.5} fill={colors.ink} />
          <Circle cx={60} cy={81} r={3.5} fill={colors.rot} />
          <Stink x={16} />
          <Stink x={104} />
        </>
      );
    case 'scream':
      return (
        <>
          <Line x1={37} y1={48} x2={49} y2={51} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={83} y1={48} x2={71} y2={51} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Circle cx={44} cy={60} r={7} fill={colors.keyFace} stroke={colors.ink} strokeWidth={3.5} />
          <Circle cx={44} cy={60} r={2.4} fill={colors.ink} />
          <Circle cx={76} cy={60} r={7} fill={colors.keyFace} stroke={colors.ink} strokeWidth={3.5} />
          <Circle cx={76} cy={60} r={2.4} fill={colors.ink} />
          <Ellipse cx={60} cy={80} rx={10.5} ry={8.5} fill={colors.ink} />
          <Ellipse cx={60} cy={84} rx={5} ry={3.2} fill={colors.rot} />
          <Sweat />
        </>
      );
    case 'relieved':
      return (
        <>
          <Path d="M38 57 Q44 63 50 57" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M70 57 Q76 63 82 57" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M50 73 Q60 80 70 73" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Sweat />
        </>
      );
    case 'happy':
    default:
      return (
        <>
          <Circle cx={44} cy={59} r={4.5} fill={colors.ink} />
          <Circle cx={76} cy={59} r={4.5} fill={colors.ink} />
          <Path d="M48 72 Q60 82 72 72" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Circle cx={35} cy={68} r={5} fill={colors.rot} opacity={0.35} />
          <Circle cx={85} cy={68} r={5} fill={colors.rot} opacity={0.35} />
        </>
      );
  }
}

export default function Brain({ mood = 'happy', size = 80, bob = true, style }) {
  const bobAnim = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bob) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, bobAnim]);

  useEffect(() => {
    if (mood !== 'scream') {
      wobble.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mood, wobble]);

  const translateY = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <Animated.View style={[{ transform: [{ translateY }, { rotate }] }, style]}>
      <Svg width={size} height={size * (112 / 120)} viewBox="0 0 120 112">
        <Path d={BODY} fill={PINK} stroke={colors.ink} strokeWidth={4.5} strokeLinejoin="round" />
        <Folds />
        <Face mood={mood} />
      </Svg>
    </Animated.View>
  );
}

// Rot level -> mood, shared by Home so the mascot and the meter agree.
export function moodForOpens(opensToday, streak) {
  if (opensToday === 0) return streak > 0 ? 'proud' : 'happy';
  if (opensToday <= 3) return 'happy';
  if (opensToday <= 7) return 'worried';
  if (opensToday <= 12) return 'rot';
  return 'dead';
}
