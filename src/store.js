import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single source of truth. Daily counters reset when the stored date
// no longer matches today, which is also where a native DeviceActivity /
// UsageStats layer would hook in later.

const KEY = 'doomtype-state-v1';

const DEFAULTS = {
  onboarded: false,
  phrase: 'imdestroyingmymentalhealth',
  intervalMinutes: 10, // re-gate cadence while inside a rotted app
  escalation: true, // repeat count grows as opens pile up
  guardedApps: ['instagram', 'tiktok'],
  opensToday: 0,
  typedToday: 0, // total phrase reps typed
  backoutsToday: 0, // times the user bailed at the gate. wins.
  lastOpenDate: null,
  streak: 0, // consecutive days under 5 opens
};

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        const today = new Date().toDateString();
        if (saved.lastOpenDate !== today) {
          const underLimit = saved.opensToday < 5;
          saved.streak = saved.opensToday > 0 && underLimit ? saved.streak + 1 : saved.streak;
          saved.opensToday = 0;
          saved.typedToday = 0;
          saved.backoutsToday = 0;
          saved.lastOpenDate = today;
        }
        setState({ ...DEFAULTS, ...saved });
      }
      setReady(true);
    });
  }, []);

  const update = (patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch, lastOpenDate: new Date().toDateString() };
      AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  // How many times the phrase must be typed for this open.
  // Escalates every 4 opens, capped at 3 reps. Cruelty budget: moderate.
  const repsRequired = () =>
    state.escalation ? Math.min(1 + Math.floor(state.opensToday / 4), 3) : 1;

  return (
    <Ctx.Provider value={{ state, update, ready, repsRequired }}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
