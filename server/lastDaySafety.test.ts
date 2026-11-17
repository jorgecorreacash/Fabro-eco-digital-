import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COUNSELOR_SYSTEM_SAFETY_INSTRUCTION,
  buildCrisisSupportMessage,
  detectEmotionalCrisis,
  getCrisisSupportResources,
} from '../shared/emotionalSafety.ts';

test('detectEmotionalCrisis ignores benign reflections on "si hoy fuera mi último día"', () => {
  const safeText =
    'Si hoy fuera el último día de mi vida elegiría desayunar tranquilo con mi familia, caminar por el parque y escribirle una carta de gratitud a mi hermano.';
  const res = detectEmotionalCrisis(safeText);
  assert.equal(res.isCrisis, false);
  assert.equal(res.severity, 'none');
  assert.equal(res.matchedTriggers.length, 0);
});

test('detectEmotionalCrisis flags explicit self-harm or suicidal expressions in Spanish and English', () => {
  const cases = [
    'Siento que ya no quiero seguir viviendo, estoy pensando en quitarme la vida.',
    'Tengo ganas de autolesionarme o hacerme daño hoy.',
    'I feel exhausted and I want to die.',
  ];
  for (const sample of cases) {
    const res = detectEmotionalCrisis(sample);
    assert.equal(res.isCrisis, true, `Should detect crisis in: ${sample}`);
    assert.equal(res.severity, 'high');
    assert.ok(res.matchedTriggers.length > 0);
  }
});

test('getCrisisSupportResources prioritizes user country and builds safe human-help response', () => {
  const argLines = getCrisisSupportResources('Argentina');
  assert.equal(argLines[0]?.country, 'Argentina');
  assert.ok(argLines[0]?.number.includes('135'));

  const esLines = getCrisisSupportResources('España');
  assert.equal(esLines[0]?.country, 'España');
  assert.equal(esLines[0]?.number, '024');

  const msg = buildCrisisSupportMessage('Argentina');
  assert.ok(msg.includes('135'));
  assert.ok(msg.includes('profesional'));
  assert.ok(COUNSELOR_SYSTEM_SAFETY_INSTRUCTION.includes('NO realizás diagnósticos médicos'));
});
