// Opt-in setting: when on and the device is online, product photos that aren't
// bundled or cached are downloaded from Open Beauty Facts. Off by default
// because the download tells that server which products were recommended,
// and those come from the user's skin results (see products/images.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

const KEY = '@revela/fetch_product_images';
const listeners = new Set<(enabled: boolean) => void>();
let current = false;
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY).then(
    (raw) => {
      current = raw === 'true';
    },
    () => undefined,
  );
  return loaded;
}

export async function setFetchProductImages(enabled: boolean): Promise<void> {
  await load();
  current = enabled;
  listeners.forEach((l) => l(enabled));
  await AsyncStorage.setItem(KEY, String(enabled)).catch(() => undefined);
}

/** The current setting, plus a setter that persists it. False until loaded. */
export function useFetchProductImages(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = React.useState(current);
  React.useEffect(() => {
    let active = true;
    listeners.add(setEnabled);
    load().then(() => active && setEnabled(current));
    return () => {
      active = false;
      listeners.delete(setEnabled);
    };
  }, []);
  return [enabled, React.useCallback((value: boolean) => void setFetchProductImages(value), [])];
}
