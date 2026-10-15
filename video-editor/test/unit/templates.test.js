import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplate, PALETTE, TEMPLATES } from '../../src/shared/templates.js';
import { buildExport, textRiseOffset, RISE_DISTANCE } from '../../src/shared/ffmpeg.js';
import { createCard, createClip, createProject, createText, insertClip, layoutClips, totalDuration } from '../../src/shared/timeline.js';

const video = (duration) => createClip({ kind: 'video', path: '/v.mp4', url: 'media://file/v', name: 'v', duration, hasAudio: true });

function projectWith(...durations) {
  const p = createProject();
  p.clips = durations.map(video);
  return p;
}

test('insertClip moves later texts and music with the clips', () => {
  const p = projectWith(5, 5);
  const t1 = { ...createText(1, 2) }; // on the first clip
  const t2 = { ...createText(6, 7) }; // on the second clip
  p.texts = [t1, t2];
  p.music = { start: 6, offset: 0 };
  const res = insertClip(p, 1, createCard('#000000', 3));
  assert.equal(res.start, 5);
  assert.equal(res.texts[0].start, 1, 'text before the insertion stays');
  assert.equal(res.texts[1].start, 9, 'text after the insertion moves by 3s');
  assert.equal(res.music.start, 9);
  assert.equal(p.texts[1].start, 6, 'input project is not mutated');
});

test('insertClip accounts for transitions added by prepare()', () => {
  const p = projectWith(5);
  p.texts = [createText(1, 2)];
  const res = insertClip(p, 0, createCard('#000000', 4), (clips) => {
    clips[1].transition = { type: 'fade', duration: 0.6 };
  });
  // The video now starts 4 - 0.6 = 3.4s in, and its text moves the same amount.
  assert.equal(layoutClips(res.clips)[1].start, 3.4);
  assert.equal(res.texts[0].start, 4.4);
});

test('intro template adds a card at the start, a dissolve and two staggered texts', () => {
  const p = projectWith(6);
  p.texts = [createText(2, 3)];
  const { project, select } = applyTemplate(p, 'intro');
  assert.equal(project.clips.length, 2);
  assert.equal(project.clips[0].kind, 'card');
  assert.equal(project.clips[0].color, PALETTE.cream);
  assert.equal(project.clips[1].transition.type, 'fade');
  const added = project.texts.filter((t) => t.font === 'serifHe' || t.font === 'rubik');
  assert.equal(added.length, 2);
  assert.ok(added[1].start > added[0].start, 'subtitle arrives after the title');
  assert.equal(select.id, added[0].id);
  const original = project.texts.find((t) => t.font === 'sans');
  assert.equal(original.start, 2 + (4 - 0.6), 'existing text stays with its clip');
});

test('quote goes after the clip under the playhead; outro goes last', () => {
  const p = projectWith(4, 4);
  const quoted = applyTemplate(p, 'quote', 1).project;
  assert.equal(quoted.clips[1].kind, 'card');
  const out = applyTemplate(p, 'outro').project;
  assert.equal(out.clips.at(-1).kind, 'card');
  assert.ok(totalDuration(out) > totalDuration(p));
});

test('lower third adds a boxed text at the playhead without changing clips', () => {
  const p = projectWith(8);
  const { project } = applyTemplate(p, 'lower-third', 2.5);
  assert.equal(project.clips.length, 1);
  const t = project.texts.at(-1);
  assert.equal(t.start, 2.5);
  assert.equal(t.style, 'box');
  assert.equal(t.animation, 'rise');
});

test('warm grade applies the Claude preset to media clips only', () => {
  const p = applyTemplate(projectWith(3), 'intro').project;
  const graded = applyTemplate(p, 'warm-grade').project;
  assert.equal(graded.clips[0].filter, 'none'); // card
  assert.equal(graded.clips[1].filter, 'claude');
});

test('every template applies to an empty project without throwing', () => {
  for (const t of TEMPLATES) assert.ok(applyTemplate(createProject(), t.id).project);
});

test('cards export as a colour source and rise text as an animated overlay', () => {
  const p = createProject();
  p.clips = [createCard('#D97757', 3)];
  const { inputs, filter } = buildExport(p, {
    output: '/o.mp4', width: 1920, height: 1080, fps: 30,
    textInputs: [{ path: '/t.png', start: 0.5, end: 2.5, fade: 0.4, rise: true }],
  });
  assert.deepEqual(inputs.slice(0, 6), ['-f', 'lavfi', '-t', '3.5', '-i', 'color=c=0xD97757:s=1920x1080:r=30']);
  assert.match(filter, /anullsrc/);
  assert.match(filter, /overlay=x=0:y='37\.8\*pow\(1-min\(max\(\(t-0\.5\)\/0\.6,0\),1\),3\)':eval=frame/);
});

test('rise offset eases out to zero', () => {
  const t = { animation: 'rise', start: 1 };
  assert.equal(textRiseOffset(t, 1), RISE_DISTANCE);
  assert.ok(textRiseOffset(t, 1.3) < RISE_DISTANCE / 2, 'most of the distance is covered early (ease-out)');
  assert.equal(textRiseOffset(t, 2), 0);
  assert.equal(textRiseOffset({ animation: 'fade', start: 0 }, 0), 0);
});
