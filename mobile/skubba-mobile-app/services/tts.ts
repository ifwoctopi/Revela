import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';
import { createTTS, saveAudioToFile, type TtsEngine } from 'react-native-sherpa-onnx/tts';

const MODEL_ID = 'vits-piper-en_GB-cori-high';
const MODEL_DIR_NAME = `${MODEL_ID}`;
const ARCHIVE = require('../../tts/vits-piper-en_GB-cori-high.tar.bz2');

let enginePromise: Promise<TtsEngine> | null = null;
let currentPlayer: AudioPlayer | null = null;
let playbackSubscription: { remove: () => void } | null = null;
let playbackFinished: (() => void) | null = null;

function nativePath(fileUri: string): string {
  return decodeURIComponent(fileUri.replace(/^file:\/\//, ''));
}

async function ensureModel(): Promise<string> {
  const documentsUri = FileSystem.documentDirectory;
  if (!documentsUri) throw new Error('The app document directory is unavailable.');

  const modelsUri = `${documentsUri}tts-models/`;
  const modelUri = `${modelsUri}${MODEL_DIR_NAME}/`;
  const requiredFiles = [
    `${modelUri}en_GB-cori-high.onnx`,
    `${modelUri}tokens.txt`,
    `${modelUri}espeak-ng-data/phondata`,
  ];
  const files = await Promise.all(requiredFiles.map((uri) => FileSystem.getInfoAsync(uri)));
  if (files.every((file) => file.exists)) return nativePath(modelUri);

  const modelsDirectory = await FileSystem.getInfoAsync(modelsUri);
  if (!modelsDirectory.exists) {
    await FileSystem.makeDirectoryAsync(modelsUri, { intermediates: true });
  }
  const asset = Asset.fromModule(ARCHIVE);
  await asset.downloadAsync();
  const archiveUri = asset.localUri ?? asset.uri;
  if (!archiveUri.startsWith('file://')) {
    throw new Error('The bundled Piper voice archive could not be opened locally.');
  }

  await extractArchive(
    {
      modelId: MODEL_ID,
      archivePath: nativePath(archiveUri),
      format: 'tar.bz2',
    },
    nativePath(modelsUri),
    { force: true, showNotificationsEnabled: false },
  );

  const extractedFiles = await Promise.all(requiredFiles.map((uri) => FileSystem.getInfoAsync(uri)));
  if (!extractedFiles.every((file) => file.exists)) {
    throw new Error('The Piper voice model did not extract completely. Rebuild the app and try again.');
  }
  return nativePath(modelUri);
}

async function getEngine(): Promise<TtsEngine> {
  if (!enginePromise) {
    enginePromise = ensureModel().then((modelPath) =>
      createTTS({
        modelPath: { type: 'file', path: modelPath },
        modelType: 'vits',
        numThreads: 2,
      }),
    ).catch((error: unknown) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export async function stopSpeech(): Promise<void> {
  playbackSubscription?.remove();
  playbackSubscription = null;
  currentPlayer?.pause();
  currentPlayer?.remove();
  currentPlayer = null;
  playbackFinished?.();
  playbackFinished = null;
}

export async function speakText(text: string, onFinished?: () => void): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  await stopSpeech();
  const engine = await getEngine();
  const generated = await engine.generateSpeech(cleanText);
  const cacheUri = FileSystem.cacheDirectory;
  if (!cacheUri) throw new Error('The app cache directory is unavailable.');
  const wavPath = nativePath(`${cacheUri}revela-speech-${Date.now()}.wav`);

  await saveAudioToFile(generated, wavPath);
  await setAudioModeAsync({ playsInSilentMode: true });

  const player = createAudioPlayer({ uri: `file://${wavPath}` });
  currentPlayer = player;
  playbackFinished = onFinished ?? null;
  playbackSubscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      playbackSubscription?.remove();
      playbackSubscription = null;
      player.remove();
      if (currentPlayer === player) currentPlayer = null;
      playbackFinished?.();
      playbackFinished = null;
      FileSystem.deleteAsync(`file://${wavPath}`, { idempotent: true }).catch(() => undefined);
    }
  });
  player.play();
}
