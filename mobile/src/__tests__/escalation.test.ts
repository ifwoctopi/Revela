import { answerQuestion } from '../guardrails/pipeline';
import { checkScanForEscalation, checkTextForEscalation } from '../guardrails/escalation';
import { ESCALATION_MESSAGES } from '../guardrails/messages';
import { buildResultsPlan } from '../summary/plan';
import { SCAN, ScriptedLlm, context, repository } from './fixtures';

describe('rule-based escalation triggers', () => {
  it.each([
    ['changing mole', 'the mole on my back has been changing shape', 'changing_mole'],
    ['bleeding spot', 'a dark spot near my ear started bleeding', 'changing_mole'],
    ['new growth', 'there is a new growth on my cheek', 'changing_mole'],
    ['spreading redness', 'the redness is spreading and it feels warm to the touch', 'infection'],
    ['pus', 'there is pus coming out of it', 'infection'],
    ['fever', 'I also have a fever', 'infection'],
    ['severe pain', "I'm in severe pain", 'severe_symptoms'],
    ['blistering', 'my skin is blistering', 'severe_symptoms'],
    ['rapid spread', 'the rash is spreading quickly', 'severe_symptoms'],
    ['cancer question', 'Is this cancer?', 'serious_disease_question'],
    ['serious disease question', 'could this be a serious disease', 'serious_disease_question'],
  ])('%s → prompt healthcare escalation', (_, text, trigger) => {
    expect(checkTextForEscalation(text)).toMatchObject({ trigger, level: 'prompt' });
  });

  it.each([
    'my lips started swelling after the new serum',
    'my face is swollen after using it',
    "I'm having trouble breathing",
  ])('"%s" → emergency care', (text) => {
    expect(checkTextForEscalation(text)).toEqual({
      trigger: 'allergic_emergency', level: 'emergency', message: ESCALATION_MESSAGES.emergency,
    });
  });

  it('prioritizes the emergency when several triggers match', () => {
    expect(checkTextForEscalation('my face is swollen and blistering')?.level).toBe('emergency');
  });

  it.each(['I get new spots on my chin', 'my skin feels dry', 'what serum should I use?'])('does not escalate "%s"', (text) => {
    expect(checkTextForEscalation(text)).toBeNull();
  });

  it('escalates a low-confidence, high-severity scan result', () => {
    const uncertain = { ...SCAN, results: { acne: { present: true, confidence: 0.4, severity: 'severe' as const } } };
    expect(checkScanForEscalation(uncertain)).toMatchObject({ trigger: 'uncertain_severe_scan', message: ESCALATION_MESSAGES.uncertainScan });
    expect(checkScanForEscalation(SCAN)).toBeNull();
  });

  it('chat answers escalations with the fixed message without calling the model', async () => {
    const llm = new ScriptedLlm(['This is fine, keep using it.']);
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const reply = await answerQuestion('Is this cancer?', [], {
      llm, repository: repository(), knownBrands: [], context: context(), plan, sections: [],
    });
    expect(reply).toEqual({ text: ESCALATION_MESSAGES.seriousDiseaseQuestion, kind: 'escalation' });
    expect(llm.requests).toHaveLength(0);
  });
});
