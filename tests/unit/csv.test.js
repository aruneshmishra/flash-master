import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, toCSV } from '../../js/lib/csv.js';

test('parses simple rows', () => {
  assert.deepEqual(parseCSV('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
});
test('handles quotes, escaped quotes, commas and newlines in cells', () => {
  const csv = 'Term,Definition\r\n"Hello, world","He said ""hi""\nthen left"\r\nx,y\r\n';
  assert.deepEqual(parseCSV(csv), [['Term', 'Definition'], ['Hello, world', 'He said "hi"\nthen left'], ['x', 'y']]);
});
test('drops blank rows and BOM, keeps empty cells', () => {
  assert.deepEqual(parseCSV('﻿a,b\n,\n\nc,'), [['a', 'b'], ['c', '']]);
});
test('round trips through toCSV', () => {
  const rows = [['a,b', 'say "x"'], ['line\nbreak', 'plain']];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
});
test('non-string input', () => { assert.deepEqual(parseCSV(null), []); });
