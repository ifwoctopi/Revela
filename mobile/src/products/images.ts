// Lazy hybrid product images:
//   1. bundled thumbnail (top products, shipped with the app)
//   2. local cache (downloaded earlier)
//   3. if the caller allows it and the device is online, download and cache
//   4. otherwise null, and the UI shows a vector placeholder
//
// The results flow and chat call this with allowNetwork: false. Fetching an
// image for a recommended product would tell the image server which products
// were recommended, and those are derived from the user's skin results.

import { Directory, File, Paths } from 'expo-file-system';
import { getNetworkStateAsync } from 'expo-network';
import type { ImageSourcePropType } from 'react-native';

import { bundledThumbnails } from '../../assets/product-thumbs';

export const IMAGE_HOST = 'https://images.openbeautyfacts.org';

function cacheFile(barcode: string): File {
  return new File(Paths.cache, 'product-images', `${barcode.replace(/\D/g, '')}.jpg`);
}

export function hasOfflineImage(barcode: string): boolean {
  return barcode in bundledThumbnails || cacheFile(barcode).exists;
}

export async function resolveProductImage(
  barcode: string,
  imagePath: string | null,
  { allowNetwork }: { allowNetwork: boolean },
): Promise<ImageSourcePropType | null> {
  const bundled = bundledThumbnails[barcode];
  if (bundled) return bundled;

  const cached = cacheFile(barcode);
  if (cached.exists) return { uri: cached.uri };

  // Only relative paths from our own database are fetched, from one fixed host.
  if (!allowNetwork || !imagePath || !/^\/images\/products\/[\w/.-]+\.jpg$/.test(imagePath)) return null;
  const network = await getNetworkStateAsync().catch(() => null);
  if (!network?.isConnected || network.isInternetReachable === false) return null;

  try {
    const directory = new Directory(Paths.cache, 'product-images');
    if (!directory.exists) directory.create({ intermediates: true });
    const file = await File.downloadFileAsync(`${IMAGE_HOST}${imagePath}`, cached, { idempotent: true });
    return { uri: file.uri };
  } catch {
    return null;
  }
}
