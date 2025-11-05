import { Tabs } from "@/components/bottom-tabs";
import React from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}>
      {/* Remote */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Remote",
          tabBarIcon: () => ({ sfSymbol: "wave.3.up" }),
        }}
      />
      {/* Timers */}
      <Tabs.Screen
        name="timers"
        options={{
          title: "Timers",
          tabBarIcon: () => ({ sfSymbol: "alarm" }),
        }}
      />
      {/* Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: () => ({ sfSymbol: "gear" }),
        }}
      />
      
    </Tabs>
  );
}
