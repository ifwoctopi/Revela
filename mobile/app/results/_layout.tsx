import { Stack } from 'expo-router';

import { ResultsFlowProvider } from '../../src/flow/ResultsFlowContext';
import { theme } from '../../skubba-mobile-app/constants/theme';

// One provider for the whole flow, so intake answers, the plan, the generated
// sections and chat history are shared in memory and end with the flow.
export default function ResultsLayout() {
  return (
    <ResultsFlowProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
    </ResultsFlowProvider>
  );
}
