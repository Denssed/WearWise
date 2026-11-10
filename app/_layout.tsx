import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { WardrobeProvider } from '../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../src/theme/softTactile';

function RootNavigator() {
  const { session, loading, recovering, user, suggestedDisplayName } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: SOFT_TACTILE.colors.canvas,
        }}
      >
        <ActivityIndicator color={SOFT_TACTILE.colors.terracotta} />
      </View>
    );
  }

  const signedIn = Boolean(session);

  return (
    <WardrobeProvider userId={user?.id ?? null} suggestedDisplayName={suggestedDisplayName}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn && !recovering}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="garment/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && recovering}>
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
      </Stack>
    </WardrobeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
