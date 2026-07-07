import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Challenge from './src/screens/Challenge';
import AppPicker from './src/screens/AppPicker';
import Settings from './src/screens/Settings';

const Stack = createNativeStackNavigator();

function Router() {
  const { state, ready } = useStore();
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
  if (!fontsLoaded) return null;

  return (
    <StoreProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Router />
      </NavigationContainer>
    </StoreProvider>
  );
}
