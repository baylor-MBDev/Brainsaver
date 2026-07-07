import React, { useRef } from 'react';
import { Pressable, Text, Animated, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, keycap } from '../theme';

// The signature element. Every button in DOOMTYPE is a keyboard key.
// Rest state sits raised on a hard offset shadow; pressing it travels
// down onto the shadow like a real keycap bottoming out.

export default function Keycap({
  label,
  onPress,
  color = colors.keyFace,
  textColor = colors.ink,
  wide = false,
  small = false,
  disabled = false,
  style,
}) {
  const travel = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(travel, { toValue: 1, duration: 60, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.timing(travel, { toValue: 0, duration: 90, useNativeDriver: true }).start();
  };

  const translate = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, keycap.shadowOffset],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <View style={[styles.shadowPlate, wide && styles.wide]}>
        <Animated.View
          style={[
            styles.face,
            wide && styles.wide,
            small && styles.small,
            { backgroundColor: color, transform: [{ translateX: translate }, { translateY: translate }] },
          ]}
        >
          <Text style={[styles.label, small && styles.labelSmall, { color: textColor }]}>
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowPlate: {
    backgroundColor: colors.keyShadow,
    borderRadius: keycap.borderRadius,
    marginRight: keycap.shadowOffset,
    marginBottom: keycap.shadowOffset,
  },
  face: {
    borderWidth: keycap.borderWidth,
    borderColor: keycap.borderColor,
    borderRadius: keycap.borderRadius,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -keycap.shadowOffset,
    marginLeft: -keycap.shadowOffset,
  },
  wide: { alignSelf: 'stretch' },
  small: { paddingVertical: 10, paddingHorizontal: 16 },
  label: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelSmall: { fontSize: 12 },
});
