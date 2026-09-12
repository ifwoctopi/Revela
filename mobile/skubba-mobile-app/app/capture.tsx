import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

type Angle = 'front' | 'left_3q' | 'right_3q';

const angles: Array<{ name: Angle; title: string; instruction: string }> = [
  { name: 'front', title: 'Front view', instruction: 'Look straight at the camera.' },
  { name: 'left_3q', title: 'Left three-quarter view', instruction: 'Turn your head slightly to the left.' },
  { name: 'right_3q', title: 'Right three-quarter view', instruction: 'Turn your head slightly to the right.' },
];

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [angleIndex, setAngleIndex] = useState(0);
  const [capturedUris, setCapturedUris] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [prompt, setPrompt] = useState('Center your face in the frame to begin.');
  const cameraRef = useRef<CameraView>(null);
  const angle = angles[angleIndex];

  async function captureAngle() {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });
    setIsCapturing(false);
    if (!photo?.uri) return;

    const nextUris = [...capturedUris, photo.uri];
    setCapturedUris(nextUris);
    if (angleIndex === angles.length - 1) {
      router.replace({
        pathname: '/summary',
        params: { frames: JSON.stringify(nextUris) },
      });
      return;
    }
    setPrompt(`Great. Now ${angles[angleIndex + 1].instruction.toLowerCase()}`);
    setAngleIndex((current) => current + 1);
  }

  if (!permission) return <SafeAreaView style={styles.safeArea} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionView}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.body}>Révéla uses the camera to capture three local face views.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasStarted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.startView}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>NEW SKIN CHECK</Text>
            <Text style={styles.title}>Ready to scan?</Text>
            <Text style={styles.body}>
              Révéla will guide you through three face views. Keep your face centered and follow the movement prompts.
            </Text>
            <View style={styles.steps}>
              {angles.map((scanAngle, index) => (
                <View style={styles.step} key={scanAngle.name}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{scanAngle.title}</Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setHasStarted(true)}>
            <Text style={styles.primaryButtonText}>Start scan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.progress}>{angleIndex + 1} of {angles.length}</Text>
        </View>
        <Text style={styles.title}>{angle.title}</Text>
        <Text style={styles.body}>{angle.instruction}</Text>

        <View style={styles.cameraFrame}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          <View style={styles.promptPill}>
            <Text style={styles.promptText}>{prompt}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.caption}>Keep your face centered, well lit, and still.</Text>
          <TouchableOpacity style={styles.captureButton} onPress={captureAngle} disabled={isCapturing}>
            <Text style={styles.captureButtonText}>{isCapturing ? 'Capturing...' : 'Capture view'}</Text>
          </TouchableOpacity>
          <Text style={styles.caption}>{capturedUris.length} view{capturedUris.length === 1 ? '' : 's'} captured locally</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: 20 },
  permissionView: { flex: 1, justifyContent: 'center', padding: 24 },
  startView: { flex: 1, justifyContent: 'space-between', padding: 24, paddingTop: 20, paddingBottom: 30 },
  eyebrow: { color: theme.colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progress: { color: theme.colors.mutedText, fontWeight: '700' },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', marginTop: 18 },
  body: { color: theme.colors.mutedText, fontSize: 16, lineHeight: 23, marginTop: 8 },
  cameraFrame: { flex: 1, minHeight: 320, marginTop: 20, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  promptPill: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: 'rgba(29, 38, 34, 0.82)', borderRadius: 12, padding: 12 },
  promptText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700' },
  footer: { alignItems: 'center', paddingVertical: 18 },
  caption: { color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  captureButton: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 28, marginVertical: 12 },
  captureButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  steps: { marginTop: 28, gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { color: theme.colors.primary, backgroundColor: theme.colors.primarySoft, borderRadius: 16, width: 32, height: 32, textAlign: 'center', paddingTop: 7, fontWeight: '800' },
  stepText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
});
