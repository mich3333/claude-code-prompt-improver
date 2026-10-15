// Properties panel for the selected clip, text or music (or the project).

import { PRESETS } from '../../shared/effects.js';
import {
  ASPECTS, clipDuration, effectiveTransition, formatTime, layoutClips, MIN_CLIP_DURATION,
  sourceTime, SPEEDS, totalDuration, TRANSITIONS,
} from '../../shared/timeline.js';
import { actions } from '../actions.js';
import { player, store, useStore } from '../state.js';
import { FONTS, TEXT_STYLES } from '../text-render.js';
import { toast } from '../toast.js';
import {
  Button, CheckField, ColorField, NumberField, RangeField, Section, Segmented, SelectField,
} from './controls.jsx';

// Live edit of the selected object (undo/redo replaces objects, so look it up).
function edit(fn) {
  store.mutate(() => {
    const t = store.selected();
    if (t) fn(t);
  });
}
const commit = () => store.commit();
const apply = (fn) => {
  edit(fn);
  commit();
};

const pct = (v) => `${v}%`;

function ClipPanel({ clip }) {
  const isImage = clip.kind === 'image';
  const clips = store.project.clips;
  const index = clips.findIndex((c) => c.id === clip.id);
  const info = isImage
    ? 'Photo'
    : `Video · ${clip.width}×${clip.height} · ${formatTime(clip.sourceDuration, true)}${clip.hasAudio ? '' : ' · no audio'}`;

  const setAtPlayhead = (which) => {
    const seg = layoutClips(store.project.clips).find((s) => s.clip.id === clip.id);
    const t = player.time;
    if (!seg || t < seg.start || t > seg.end) {
      toast('Move the playhead over this clip first.', 'warn');
      return;
    }
    const src = sourceTime(seg, t);
    apply((c) => {
      if (which === 'in') c.in = Math.min(src, c.out - MIN_CLIP_DURATION * c.speed);
      else c.out = Math.max(src, c.in + MIN_CLIP_DURATION * c.speed);
    });
  };

  const eff = effectiveTransition(clips, index);
  let transitionNote = '';
  if (clip.transition.type === 'none') transitionNote = 'Hard cut between clips.';
  else if (eff.duration < clip.transition.duration - 1e-3) {
    transitionNote = `Shortened to ${eff.duration.toFixed(2)}s to fit the neighbouring clips.`;
  }

  return (
    <div className="insp">
      <div className="insp-title">
        <strong dir="auto">{clip.name}</strong>
        <span>{info}</span>
      </div>

      <Section title={isImage ? 'Duration' : 'Trim'}>
        {isImage ? (
          <NumberField label="Show for" value={clip.out} min={MIN_CLIP_DURATION} max={600}
            onApply={(v) => apply((c) => { c.out = v; })} />
        ) : (
          <>
            <NumberField label="Start at" value={clip.in} max={clip.sourceDuration}
              onApply={(v) => apply((c) => { c.in = Math.min(v, c.out - MIN_CLIP_DURATION); })} />
            <NumberField label="End at" value={clip.out} max={clip.sourceDuration}
              onApply={(v) => apply((c) => { c.out = Math.max(v, c.in + MIN_CLIP_DURATION); })} />
            <div className="btn-row">
              <Button onClick={() => setAtPlayhead('in')}>Set start at playhead</Button>
              <Button onClick={() => setAtPlayhead('out')}>Set end at playhead</Button>
            </div>
          </>
        )}
        <div className="insp-note">On timeline: {formatTime(clipDuration(clip), true)}</div>
      </Section>

      {!isImage && (
        <Section title="Speed">
          <Segmented layout="wrap" value={clip.speed}
            options={Object.fromEntries(SPEEDS.map((s) => [s, `${s}×`]))}
            onChange={(v) => apply((c) => { c.speed = Number(v); })} />
        </Section>
      )}

      <Section title="Framing">
        <Segmented value={clip.fit} options={{ contain: 'Fit (bars)', cover: 'Fill (crop)' }}
          onChange={(v) => apply((c) => { c.fit = v; })} />
      </Section>

      <Section title="Color">
        <Segmented layout="grid" value={clip.filter}
          options={Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, p.label]))}
          onChange={(v) => apply((c) => { c.filter = v; })} />
        <RangeField label="Brightness" value={clip.brightness} min={20} max={200} format={pct}
          onChange={(v) => edit((c) => { c.brightness = v; })} onCommit={commit} />
        <RangeField label="Contrast" value={clip.contrast} min={20} max={200} format={pct}
          onChange={(v) => edit((c) => { c.contrast = v; })} onCommit={commit} />
        <RangeField label="Saturation" value={clip.saturation} min={0} max={250} format={pct}
          onChange={(v) => edit((c) => { c.saturation = v; })} onCommit={commit} />
        <div className="btn-row">
          <Button onClick={() => apply((c) => Object.assign(c, { filter: 'none', brightness: 100, contrast: 100, saturation: 100 }))}>
            Reset color
          </Button>
        </div>
      </Section>

      {!isImage && (
        <Section title="Audio">
          {clip.hasAudio ? (
            <>
              <RangeField label="Volume" value={Math.round(clip.volume * 100)} format={pct}
                onChange={(v) => edit((c) => { c.volume = v / 100; })} onCommit={commit} />
              <CheckField label="Mute this clip" checked={clip.muted} onChange={(v) => apply((c) => { c.muted = v; })} />
            </>
          ) : (
            <div className="insp-note">This clip has no audio track.</div>
          )}
        </Section>
      )}

      {index > 0 && (
        <Section title="Transition from previous clip">
          <SelectField label="Effect" options={TRANSITIONS} value={clip.transition.type}
            onChange={(v) => apply((c) => { c.transition = { ...c.transition, type: v }; })} />
          <RangeField label="Length" value={clip.transition.duration} min={0.2} max={3} step={0.1}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => edit((c) => { c.transition = { ...c.transition, duration: v }; })} onCommit={commit} />
          {transitionNote && <div className="insp-note">{transitionNote}</div>}
        </Section>
      )}

      <div className="btn-row actions">
        <Button icon="split" onClick={actions.split}>Split at playhead</Button>
        <Button icon="copy" onClick={actions.duplicate}>Duplicate</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>Delete</Button>
      </div>
    </div>
  );
}

function TextPanel({ text }) {
  const place = (y) => apply((t) => { t.x = 0.5; t.y = y; });
  return (
    <div className="insp">
      <div className="insp-title">
        <strong>Text</strong>
        <span>Drag it on the preview to move it</span>
      </div>
      <Section title="Content">
        <textarea id="text-content" rows={3} dir="auto" placeholder="Type your text…" value={text.text}
          onChange={(e) => edit((t) => { t.text = e.target.value; })} onBlur={commit} />
      </Section>
      <Section title="Timing">
        <NumberField label="Starts" value={text.start} onApply={(v) => apply((t) => { t.start = Math.min(v, t.end - 0.2); })} />
        <NumberField label="Ends" value={text.end} max={36000} onApply={(v) => apply((t) => { t.end = Math.max(v, t.start + 0.2); })} />
        <div className="btn-row">
          <Button onClick={() => {
            const now = player.time;
            apply((t) => { const len = t.end - t.start; t.start = now; t.end = now + len; });
          }}>Start at playhead</Button>
          <Button onClick={() => {
            const now = player.time;
            apply((t) => { if (now > t.start + 0.2) t.end = now; });
          }}>End at playhead</Button>
        </div>
        <Segmented value={text.animation} options={{ none: 'No animation', fade: 'Fade in/out' }}
          onChange={(v) => apply((t) => { t.animation = v; })} />
      </Section>
      <Section title="Look">
        <SelectField label="Font" value={text.font}
          options={Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.label]))}
          onChange={(v) => apply((t) => { t.font = v; })} />
        <RangeField label="Size" value={Math.round(text.size * 1000) / 10} min={2} max={25} step={0.5} format={pct}
          onChange={(v) => edit((t) => { t.size = v / 100; })} onCommit={commit} />
        <ColorField label="Color" value={text.color} onChange={(v) => edit((t) => { t.color = v; })} onCommit={commit} />
        <CheckField label="Bold" checked={text.bold} onChange={(v) => apply((t) => { t.bold = v; })} />
        <Segmented value={text.style} options={TEXT_STYLES} onChange={(v) => apply((t) => { t.style = v; })} />
        {text.style === 'box' && (
          <ColorField label="Box color" value={text.boxColor} onChange={(v) => edit((t) => { t.boxColor = v; })} onCommit={commit} />
        )}
      </Section>
      <Section title="Position">
        <div className="btn-row">
          <Button onClick={() => place(0.12)}>Top</Button>
          <Button onClick={() => place(0.5)}>Middle</Button>
          <Button onClick={() => place(0.85)}>Bottom</Button>
        </div>
        <RangeField label="Horizontal" value={Math.round(text.x * 100)} format={pct}
          onChange={(v) => edit((t) => { t.x = v / 100; })} onCommit={commit} />
        <RangeField label="Vertical" value={Math.round(text.y * 100)} format={pct}
          onChange={(v) => edit((t) => { t.y = v / 100; })} onCommit={commit} />
      </Section>
      <div className="btn-row actions">
        <Button icon="copy" onClick={actions.duplicate}>Duplicate</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>Delete</Button>
      </div>
    </div>
  );
}

function MusicPanel({ music }) {
  const sec = (v) => `${v}s`;
  return (
    <div className="insp">
      <div className="insp-title">
        <strong dir="auto">{music.name}</strong>
        <span>Music · {formatTime(music.sourceDuration)}</span>
      </div>
      <Section title="Mix">
        <RangeField label="Volume" value={Math.round(music.volume * 100)} format={pct}
          onChange={(v) => edit((m) => { m.volume = v / 100; })} onCommit={commit} />
        <CheckField label="Loop until the video ends" checked={music.loop} onChange={(v) => apply((m) => { m.loop = v; })} />
      </Section>
      <Section title="Timing">
        <NumberField label="Starts at" value={music.start} max={36000} onApply={(v) => apply((m) => { m.start = v; })} />
        <NumberField label="Skip intro" value={music.offset} max={Math.max(0, music.sourceDuration - 0.5)}
          onApply={(v) => apply((m) => { m.offset = v; })} />
        <RangeField label="Fade in" value={music.fadeIn} min={0} max={10} step={0.5} format={sec}
          onChange={(v) => edit((m) => { m.fadeIn = v; })} onCommit={commit} />
        <RangeField label="Fade out" value={music.fadeOut} min={0} max={10} step={0.5} format={sec}
          onChange={(v) => edit((m) => { m.fadeOut = v; })} onCommit={commit} />
      </Section>
      <div className="btn-row actions">
        <Button icon="music" onClick={actions.addMusic}>Replace…</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>Remove music</Button>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  ['Space', 'Play / pause'], ['S', 'Split clip at playhead'], ['T', 'Add text at playhead'],
  ['Delete', 'Remove selected'], ['← / →', 'Step one frame (Shift: 1 second)'], ['Home / End', 'Jump to start / end'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl + scroll', 'Zoom timeline'],
];

function ProjectPanel() {
  const p = store.project;
  return (
    <div className="insp">
      <div className="insp-title">
        <strong>Project</strong>
        <span>
          {p.clips.length} clip(s) · {p.texts.length} text(s) · {p.music ? 'music' : 'no music'} · {formatTime(totalDuration(p), true)}
        </span>
      </div>
      <Section title="Frame size">
        <Segmented layout="grid" value={p.aspect}
          options={Object.fromEntries(Object.entries(ASPECTS).map(([k, a]) => [k, (
            <><span className="aspect-swatch" style={{ aspectRatio: `${a.w} / ${a.h}` }} />{a.label}</>
          )]))}
          onChange={(v) => store.update((proj) => { proj.aspect = v; })} />
        <div className="insp-note">You can also change this when exporting.</div>
      </Section>
      <Section title="Keyboard shortcuts">
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="shortcut">
              <dt><kbd>{k}</kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <div className="insp-note">Select a clip, text or the music track to edit it.</div>
    </div>
  );
}

export function Inspector() {
  useStore();
  const sel = store.selection;
  const target = store.selected();
  let panel = <ProjectPanel />;
  if (sel?.type === 'clip' && target) panel = <ClipPanel clip={target} />;
  else if (sel?.type === 'text' && target) panel = <TextPanel text={target} />;
  else if (sel?.type === 'music' && target) panel = <MusicPanel music={target} />;
  // Keyed by selection: switching items swaps the panel instantly (selection
  // is a high-frequency action, so it is deliberately not animated).
  return (
    <aside id="inspector" className="inspector panel" key={sel ? `${sel.type}:${sel.id ?? ''}` : 'project'}>
      {panel}
    </aside>
  );
}
