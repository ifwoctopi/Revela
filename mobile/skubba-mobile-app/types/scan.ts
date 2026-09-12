export interface Scan {
  id: string;
  userId: string;
  createdAt: string;
  modelVersion: string;
  primaryCondition: string;
  confidence: number;
  aiSummary: string;
  observations: string[];
  morningRoutine: string[];
  eveningRoutine: string[];
  recommendedProductTypes: string[];
  imageExpiresAt?: string;
}
