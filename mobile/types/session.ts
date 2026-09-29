export type ConditionName='acne'|'dryness'|'oily_skin'|'dark_circles'|'hyperpigmentation';
export interface SessionSummary { session_id:string; timestamp:string; angles_captured:string[]; results:Partial<Record<ConditionName,{present:boolean;confidence:number}>>; }
