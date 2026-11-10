import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WardrobeProvider } from '../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../src/theme/softTactile';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WardrobeProvider>
        <StatusBar
          style="dark"
          backgroundColor={SOFT_TACTILE.colors.canvas}
          translucent={false}
        />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </WardrobeProvider>
    </SafeAreaProvider>
  );
}
