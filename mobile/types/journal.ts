export type JournalLevel='low'|'medium'|'high';
export interface JournalEntry { id:string; createdAt:string; sleep:'under_5'|'5_7'|'7_9'|'9_plus'; stress:JournalLevel; routineStatus:'complete'|'partial'|'missed'; newProduct:boolean; notes:string; }
