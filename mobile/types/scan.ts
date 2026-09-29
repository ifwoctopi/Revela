import { SkinObservation } from './observation';
import { ScanQuality } from './scanQuality';
export interface Scan { id:string; userId:string; createdAt:string; modelVersion:string; observations:SkinObservation[]; appearanceSummary:string; morningRoutine:string[]; eveningRoutine:string[]; recommendedProductTypes:string[]; quality:ScanQuality; analysisPurpose:'cosmetic_tracking'; disclaimerVersion:string; imageExpiresAt?:string; imageUri?:string; }
