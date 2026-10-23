import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeWritten, normalize, levenshtein } from '../../js/lib/grade.js';

test('normalize ignores case, accents, punctuation', () => {
  assert.equal(normalize('  Café, NOIR! '), 'cafe noir');
});
test('levenshtein', () => { assert.equal(levenshtein('kitten', 'sitting'), 3); });
test('exact and forgiving matches', () => {
  assert.equal(gradeWritten('PHOTOSYNTHESIS', 'Photosynthesis').correct, true);
  assert.equal(gradeWritten('el gato', 'gato').correct, true);
  assert.equal(gradeWritten('gato', 'el gato').correct, true);
  assert.equal(gradeWritten('mitochondria', 'Mitochondria (powerhouse)').correct, true);
  assert.equal(gradeWritten('color', 'colour / color').correct, true);
});
test('small typo is close-but-correct', () => {
  const g = gradeWritten('photosynthsis', 'photosynthesis');
  assert.deepEqual([g.correct, g.close], [true, true]);
});
test('short answers must be exact, wrong answers fail', () => {
  assert.equal(gradeWritten('cat', 'car').correct, false);
  assert.equal(gradeWritten('banana', 'photosynthesis').correct, false);
  assert.equal(gradeWritten('', 'x').empty, true);
});
