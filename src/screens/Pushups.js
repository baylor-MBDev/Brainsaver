import React from 'react';
import PushupSession from '../components/PushupSession';
import { useStore } from '../store';
import { PUSHUP_REWARD_MIN, creditBank } from '../exercise/bank';

// Pushups started from Home bank their minutes for later.
export default function Pushups({ navigation }) {
  const { update } = useStore();

  const done = (reps) => {
    update((prev) => {
      const bank = creditBank(prev.bankMinutes, PUSHUP_REWARD_MIN);
      return {
        bankMinutes: bank,
        earnedToday: prev.earnedToday + (bank - prev.bankMinutes),
        pushupsToday: prev.pushupsToday + reps,
      };
    });
    navigation.goBack();
  };

  return <PushupSession onDone={done} onCancel={() => navigation.goBack()} />;
}
