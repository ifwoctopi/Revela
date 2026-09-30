import { prohibitedMedicalPhrases } from './languageRules';
export function validateInsight(text:string):string { const lower=text.toLowerCase(); if(prohibitedMedicalPhrases.some(x=>lower.includes(x))) return 'Your images show visible appearance patterns that can be compared with your personal history. Révéla does not interpret these observations as medical findings.'; return text; }
