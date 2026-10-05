import React, { useCallback, useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { useFonts, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import {
  consumePendingChallenge, appNameForPackage, syncGuardedApps, onGateRequested,
} from './src/native/guard';
import { configureShield, ensureLocked } from './src/native/screenTime';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Challenge from './src/screens/Challenge';
import AppPicker from './src/screens/AppPicker';
import Settings from './src/screens/Settings';
import Pushups from './src/screens/Pushups';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// The enforcement layer leaves a pending challenge when a guarded app is
// opened (Android: the accessibility service relaunches us; iOS: the user
// taps the Screen Time shield's notification); route it straight to the gate.
function checkPendingChallenge() {
  const pkg = consumePendingChallenge();
  if (pkg && navigationRef.isReady()) {
    navigationRef.navigate('Challenge', {
      app: appNameForPackage(pkg),
      pkg,
      enforced: true,
    });
  }
}

function Router() {
  const { state, ready } = useStore();

  useEffect(() => {
    if (ready) syncGuardedApps(state.guardedApps);
  }, [ready, state.guardedApps]);

  // iOS: the shield only offers a way out when strict mode is off.
  useEffect(() => {
    if (ready) configureShield({ strict: state.strictMode });
  }, [ready, state.strictMode]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      ensureLocked();
      checkPendingChallenge();
    });
    const gate = onGateRequested(checkPendingChallenge);
    return () => {
      sub.remove();
      gate.remove();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!state.onboarded && <Stack.Screen name="Onboarding" component={Onboarding} />}
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="AppPicker" component={AppPicker} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen
        name="Pushups"
        component={Pushups}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="Challenge"
        component={Challenge}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const onReady = useCallback(() => checkPendingChallenge(), []);

  if (!fontsLoaded) return null;

  return (
    <StoreProvider>
      <NavigationContainer ref={navigationRef} onReady={onReady}>
        <StatusBar style="dark" />
        <Router />
      </NavigationContainer>
    </StoreProvider>
  );
}
