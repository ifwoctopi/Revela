import { Stack } from 'expo-router';

import { ResultsFlowProvider } from '../../src/flow/ResultsFlowContext';
import { theme } from '../../constants/theme';

// One provider for the whole flow, so intake answers, the plan, the generated
// sections and chat history are shared in memory and end with the flow.
export default function ResultsLayout() {
  return (
    <ResultsFlowProvider>
      <Stack
        screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.background } }}
      >
        {/* The highlights open like a reveal; the rest of the flow slides forward. */}
        <Stack.Screen name="summary" options={{ animation: 'fade_from_bottom' }} />
      </Stack>
    </ResultsFlowProvider>
  );
}
