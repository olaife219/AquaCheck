import assert from 'node:assert/strict';
import { classifyColour, samplePatch, waterType } from './dist/modules/colour.js';
import { stripProfile } from './dist/modules/profile.js';

const image = (red, green, blue) => ({
  width: 20,
  height: 20,
  data: new Uint8ClampedArray(Array.from({ length: 400 }, () => [red, green, blue, 255]).flat())
});

assert.equal(stripProfile.colors.length, 14);
assert.deepEqual(waterType(6.4).title, 'High acidity');
assert.deepEqual(waterType(7).title, 'Neutral');
assert.deepEqual(waterType(8.6).title, 'High alkalinity');

const patch = samplePatch(image(149, 143, 65), { x: 0.5, y: 0.5 });
assert.deepEqual(patch.rgb, [149, 143, 65]);
assert.equal(classifyColour(patch.rgb, stripProfile).ph, 7);
assert.match(samplePatch(image(0, 0, 0), { x: 0.5, y: 0.5 }).error, /too dark/);
assert.match(classifyColour([240, 20, 240], stripProfile).error, /does not match/);

console.log('Passed: strip profile, water-type labels, colour sampling and invalid-colour rejection.');
