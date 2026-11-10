import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useWardrobe } from '../../src/context/WardrobeContext';
import { SOFT_TACTILE } from '../../src/theme/softTactile';

export default function TabsLayout() {
  const { garments } = useWardrobe();
  const dirtyCount = garments.filter(
    (g) => g.status === 'needs_wash' || g.current_wears >= g.max_wears_before_wash
  ).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor: SOFT_TACTILE.colors.terracotta,
        tabBarInactiveTintColor: SOFT_TACTILE.colors.textMuted,
        tabBarStyle: {
          backgroundColor: SOFT_TACTILE.colors.card,
          borderTopColor: SOFT_TACTILE.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 26 : 12,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Semana IA',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Armario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size + 2} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="laundry"
        options={{
          title: 'Lavandería',
          tabBarBadge: dirtyCount > 0 ? dirtyCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: SOFT_TACTILE.colors.clayRed,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="water-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
