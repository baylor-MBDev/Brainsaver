import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single source of truth. Daily counters reset when the stored date
// no longer matches today, which is also where a native DeviceActivity /
// UsageStats layer would hook in later.

const KEY = 'doomtype-state-v1';

const DEFAULTS = {
  onboarded: false,
  phrases: ['imdestroyingmymentalhealth'], // typed at the gate; one is picked at random each rep
  intervalMinutes: 10, // re-gate cadence while inside a rotted app
  escalation: true, // repeat count grows as opens pile up
  guardedApps: ['instagram', 'tiktok'],
  opensToday: 0,
  typedToday: 0, // total phrase reps typed
  backoutsToday: 0, // times the user bailed at the gate. wins.
  lastOpenDate: null,
  streak: 0, // consecutive days under 5 opens
  strictMode: false, // no backing out of the gate: type it or spend earned time
  bankMinutes: 0, // earned by exercise, spent at the gate; expires at midnight
  earnedToday: 0, // minutes earned today
  pushupsToday: 0,
  walk: null, // { baseline, startedAt } while a step walk is in progress
};

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        // Migrate the old single-phrase field to the phrases list.
        if (saved.phrase && !saved.phrases) {
          saved.phrases = [saved.phrase];
        }
        delete saved.phrase;
        const today = new Date().toDateString();
        if (saved.lastOpenDate !== today) {
          const underLimit = saved.opensToday < 5;
          saved.streak = saved.opensToday > 0 && underLimit ? saved.streak + 1 : saved.streak;
          saved.opensToday = 0;
          saved.typedToday = 0;
          saved.backoutsToday = 0;
          saved.bankMinutes = 0;
          saved.earnedToday = 0;
          saved.pushupsToday = 0;
          saved.lastOpenDate = today;
        }
        setState({ ...DEFAULTS, ...saved });
      }
      setReady(true);
    });
  }, []);

  // Accepts a patch, or a function of the latest state returning a patch.
  // Use the function form when the new value depends on the old one, so
  // back-to-back updates (credit then spend) can't clobber each other.
  const update = (patch) => {
    setState((prev) => {
      const changes = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...changes, lastOpenDate: new Date().toDateString() };
      AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  // How many times the phrase must be typed for this open.
  // Escalates every 4 opens, capped at 3 reps. Cruelty budget: moderate.
  const repsRequired = () =>
    state.escalation ? Math.min(1 + Math.floor(state.opensToday / 4), 3) : 1;

  // Picks a phrase at random from the list, so multi-rep challenges (and
  // repeat opens) don't let muscle memory take over from actually reading it.
  const randomPhrase = () => {
    const list = state.phrases.length ? state.phrases : DEFAULTS.phrases;
    return list[Math.floor(Math.random() * list.length)];
  };

  return (
    <Ctx.Provider value={{ state, update, ready, repsRequired, randomPhrase }}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
