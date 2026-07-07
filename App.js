import React, { useCallback, useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { useFonts, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import { consumePendingChallenge, appNameForPackage, syncGuardedApps } from './src/native/guard';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Challenge from './src/screens/Challenge';
import AppPicker from './src/screens/AppPicker';
import Settings from './src/screens/Settings';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// The enforcement service relaunches the app with a pending challenge when a
// guarded app hits the foreground; route it straight to the gate.
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkPendingChallenge();
    });
    return () => sub.remove();
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
