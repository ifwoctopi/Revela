import {ScanQuality} from '../types/scanQuality';
export function captureGuidanceQuality():ScanQuality{return {mode:'capture_guidance',lighting:'guided',blur:'guided',facePosition:'guided',acceptable:true,note:'This build provides capture guidance only. Automated blur, lighting, and pose validation is the next computer-vision milestone.'}}
