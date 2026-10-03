import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSI,
  parseSI,
  decodeBands,
  encodeBands,
  nearestStandard,
  ohmsLaw,
  recommendPowerRating,
} from '../js/calc.js';

// Floating point math is rarely exact, so compare to a relative tolerance.
function assertClose(actual, expected, rel = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * rel,
    `expected ${actual} to be close to ${expected}`,
  );
}

test('formatSI picks the right prefix', () => {
  assert.equal(formatSI(4700, 'Ω'), '4.7 kΩ');
  assert.equal(formatSI(1e6, 'Ω'), '1 MΩ');
  assert.equal(formatSI(0.25, 'W'), '250 mW');
  assert.equal(formatSI(0.000022, 'A'), '22 µA');
  assert.equal(formatSI(220, 'Ω'), '220 Ω');
  assert.equal(formatSI(0, 'V'), '0 V');
  assert.equal(formatSI(-5, 'V'), '-5 V');
});

test('formatSI rolls over to the next prefix after rounding', () => {
  assert.equal(formatSI(999.96, 'Ω'), '1 kΩ');
});

test('parseSI understands prefixes and schematic notation', () => {
  assert.equal(parseSI('220'), 220);
  assert.equal(parseSI('4.7k'), 4700);
  assert.equal(parseSI('1M'), 1e6);
  assert.equal(parseSI('10m'), 0.01);
  assert.equal(parseSI('4k7'), 4700);
  assert.equal(parseSI('1R5'), 1.5);
  assert.equal(parseSI('4.7kΩ'), 4700);
  assertClose(parseSI('20mA'), 0.02);
  assert.ok(Number.isNaN(parseSI('abc')));
  assert.ok(Number.isNaN(parseSI('')));
});

test('decodes common 4-band resistors', () => {
  assert.equal(decodeBands(['brown', 'black', 'red', 'gold']).ohms, 1000);
  assert.equal(decodeBands(['yellow', 'violet', 'red', 'gold']).ohms, 4700);
  assert.equal(decodeBands(['red', 'red', 'brown', 'gold']).ohms, 220);
  assert.equal(decodeBands(['brown', 'black', 'blue', 'silver']).ohms, 10e6);
});

test('decodes gold and silver multipliers', () => {
  assert.equal(decodeBands(['yellow', 'violet', 'gold', 'gold']).ohms, 4.7);
  assert.equal(decodeBands(['brown', 'black', 'silver', 'gold']).ohms, 0.1);
});

test('decodes 5-band resistors and tolerance range', () => {
  const r = decodeBands(['brown', 'black', 'black', 'red', 'brown']);
  assert.equal(r.ohms, 10000);
  assert.equal(r.tolerance, 1);
  assertClose(r.min, 9900);
  assertClose(r.max, 10100);
});

test('rejects invalid bands', () => {
  assert.throws(() => decodeBands(['brown', 'black', 'red']));
  assert.throws(() => decodeBands(['gold', 'black', 'red', 'gold']));
  assert.throws(() => decodeBands(['brown', 'black', 'red', 'orange']));
});

test('encodes values back to colors', () => {
  assert.deepEqual(encodeBands(4700).bands, ['yellow', 'violet', 'red', 'gold']);
  assert.deepEqual(encodeBands(220).bands, ['red', 'red', 'brown', 'gold']);
  assert.deepEqual(encodeBands(10).bands, ['brown', 'black', 'black', 'gold']);
  assert.deepEqual(encodeBands(4.7).bands, ['yellow', 'violet', 'gold', 'gold']);
  assert.deepEqual(encodeBands(10000, 5).bands, ['brown', 'black', 'black', 'red', 'brown']);
});

test('encoding rounds to the available digits', () => {
  assert.equal(encodeBands(4720).ohms, 4700);
  assert.equal(encodeBands(9960).ohms, 10000);
  assert.equal(encodeBands(4720, 5).ohms, 4720);
});

test('encode and decode round-trip for every E24 value', () => {
  for (const base of [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
    3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]) {
    for (const decade of [1, 10, 100, 1e3, 1e4, 1e5, 1e6]) {
      const ohms = Number((base * decade).toPrecision(3));
      const { bands } = encodeBands(ohms);
      assertClose(decodeBands(bands).ohms, ohms);
    }
  }
});

test('nearestStandard snaps to buyable values', () => {
  assert.equal(nearestStandard(4600), 4700);
  assert.equal(nearestStandard(150), 150);
  assert.equal(nearestStandard(9700), 10000);
  assert.equal(nearestStandard(5000, 'E12'), 4700);
});

test("Ohm's law solves from any two values", () => {
  const expected = { V: 12, I: 0.5, R: 24, P: 6 };
  const pairs = [['V', 'I'], ['V', 'R'], ['V', 'P'], ['I', 'R'], ['I', 'P'], ['R', 'P']];
  for (const [a, b] of pairs) {
    const r = ohmsLaw({ [a]: expected[a], [b]: expected[b] });
    for (const key of Object.keys(expected)) assertClose(r[key], expected[key]);
  }
});

test("Ohm's law needs exactly two inputs", () => {
  assert.throws(() => ohmsLaw({ V: 5 }));
  assert.throws(() => ohmsLaw({ V: 5, I: 1, R: 5 }));
  assert.throws(() => ohmsLaw({ V: 5, R: 0 }));
});

test('recommends a power rating with 2x margin', () => {
  assert.equal(recommendPowerRating(0.05), 0.125);
  assert.equal(recommendPowerRating(0.1), 0.25);
  assert.equal(recommendPowerRating(0.2), 0.5);
  assert.equal(recommendPowerRating(6), null);
});
