import { mockScans } from '../data/mockScans';
import { Scan } from '../types/scan';

// Replace these mock implementations with calls to your FastAPI/Supabase-backed service.
export async function getScans(): Promise<Scan[]> {
  return mockScans;
}

export async function getScanById(id: string): Promise<Scan | undefined> {
  return mockScans.find((scan) => scan.id === id);
}
