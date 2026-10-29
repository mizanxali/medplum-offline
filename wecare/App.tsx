import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { start } from './src/mesh';
import { getState, loadState, useStore } from './src/state';
import { Clinic } from './src/ui/Clinic';
import { C } from './src/ui/kit';
import { Welcome } from './src/ui/Welcome';
import { Worker } from './src/ui/Worker';

export default function App() {
  const s = useStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState().then(() => {
      setLoaded(true);
      if (getState().role) start();
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {!loaded ? (
        <View style={{ flex: 1, backgroundColor: C.band }} />
      ) : s.role === 'clinic' ? (
        <Clinic />
      ) : s.role === 'chw' ? (
        <Worker />
      ) : (
        <Welcome />
      )}
    </SafeAreaProvider>
  );
}
