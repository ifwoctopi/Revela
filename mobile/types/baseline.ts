import { ObservationType } from './observation';
export interface BaselineMetric { characteristic: ObservationType; averageConfidence:number; samples:number; }
export interface PersonalBaseline { createdAt:string; scanCount:number; metrics:BaselineMetric[]; }
