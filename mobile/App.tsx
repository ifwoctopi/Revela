import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { CaptureSummaryScreen } from './src/screens/CaptureSummaryScreen';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <CaptureSummaryScreen />
    </>
  );
}
