import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGraphic, formatCountUp, graphicDuration, graphicSize, GRAPHIC_TYPES, parseBars, parseCountUp, yearRange,
} from '../../src/shared/graphics.js';
import { captionTexts, CAPTION_LOOKS } from '../../src/shared/captions.js';

test('count-up keeps prefix, suffix, decimals and thousands separators', () => {
  const big = parseCountUp('$416B');
  assert.deepEqual(big, { prefix: '$', number: 416, decimals: 0, suffix: 'B', grouped: false });
  assert.equal(formatCountUp(big, 0), '$0B');
  assert.equal(formatCountUp(big, 0.5), '$208B');
  assert.equal(formatCountUp(big, 1), '$416B');
  assert.equal(formatCountUp(parseCountUp('×7'), 1), '×7');
  assert.equal(formatCountUp(parseCountUp('3,830 ₪'), 1), '3,830 ₪');
  assert.equal(formatCountUp(parseCountUp('7.00'), 0.5), '3.50');
  assert.equal(parseCountUp('#1').number, 1);
  assert.equal(parseCountUp('בלי מספר'), null);
});

test('bar values parse from lines or commas, Hebrew labels included', () => {
  assert.deepEqual(parseBars('2024: 4\n2025: 9.5'), [{ label: '2024', value: 4 }, { label: '2025', value: 9.5 }]);
  assert.deepEqual(parseBars('ישראל=7, סינגפור=4.57; junk'), [{ label: 'ישראל', value: 7 }, { label: 'סינגפור', value: 4.57 }]);
  assert.equal(parseBars(Array.from({ length: 12 }, (_, i) => `${i}: ${i}`).join('\n')).length, 8);
});

test('graphics have defaults, a year strip of at most 8 years, and top-half size', () => {
  for (const type of Object.keys(GRAPHIC_TYPES)) assert.equal(createGraphic(type).type, type);
  assert.throws(() => createGraphic('nope'));
  assert.deepEqual(yearRange({ from: 2021, to: 2024 }), [2021, 2022, 2023, 2024]);
  assert.equal(yearRange({ from: 2000, to: 2030 }).length, 8);
  assert.deepEqual(graphicSize('9:16'), { width: 1080, height: 960 });
  assert.deepEqual(graphicSize('16:9'), { width: 1920, height: 540 });
  assert.deepEqual(graphicSize('9:16', 'quote'), { width: 1080, height: 1920 }, 'source cards fill the frame');
});

test('captions can use the red reference look', () => {
  const [red] = captionTexts([{ start: 0, end: 1, text: 'שלום' }], { position: 'middle', look: 'red' });
  assert.equal(red.color, CAPTION_LOOKS.red.look.color);
  assert.equal(red.y, 0.5);
  const [classic] = captionTexts([{ start: 0, end: 1, text: 'שלום' }]);
  assert.equal(classic.color, '#ffffff');
});

test('graphic duration defaults to 4s and is clamped to the animation and a minute', () => {
  assert.equal(graphicDuration(createGraphic('number')), 4);
  assert.equal(graphicDuration({ duration: 6 }), 6);
  assert.equal(graphicDuration({ duration: '6.5' }), 6.5);
  assert.equal(graphicDuration({ duration: 0.5 }), 2);
  assert.equal(graphicDuration({ duration: 600 }), 60);
  assert.equal(graphicDuration({}), 4);
});

test('the wave background fills the frame and loops for its whole duration', () => {
  assert.deepEqual(graphicSize('9:16', 'waves'), { width: 1080, height: 1920 });
  assert.equal(GRAPHIC_TYPES.waves.loop > 0, true);
  assert.equal(createGraphic('waves').duration, 15);
});
