// Properties panel for the selected clip, overlay, text or music (or the project).

import { PRESETS } from '../../shared/effects.js';
import {
  ASPECTS, clipDuration, effectiveTransition, formatTime, layoutClips, MIN_CLIP_DURATION, OVERLAY_REGIONS,
  overlayAnimation, overlayDuration, sourceTime, SPEEDS, totalDuration, TRANSITIONS,
} from '../../shared/timeline.js';
import { useState } from 'react';
import { actions, updateGraphic } from '../actions.js';
import { GRAPHIC_TYPES } from '../../shared/graphics.js';
import { OVERLAY_ANIMATIONS } from '../../shared/overlay-motion.js';
import { player, store, ui, useAtom, useStore } from '../state.js';
import { FONTS, TEXT_STYLES } from '../text-render.js';
import { PALETTE } from '../../shared/templates.js';
import { CAPTION_LOOK } from '../../shared/captions.js';
import { toast } from '../toast.js';
import {
  Button, CheckField, ColorField, NumberField, RangeField, Row, Section, Segmented, SelectField,
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
    ? 'תמונה'
    : `וידאו · ${clip.width}×${clip.height} · ${formatTime(clip.sourceDuration, true)}${clip.hasAudio ? '' : ' · ללא סאונד'}`;

  const setAtPlayhead = (which) => {
    const seg = layoutClips(store.project.clips).find((s) => s.clip.id === clip.id);
    const t = player.time;
    if (!seg || t < seg.start || t > seg.end) {
      toast('קודם הזיזו את סמן הניגון אל הקליפ הזה.', 'warn');
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
  if (clip.transition.type === 'none') transitionNote = 'מעבר חד בין הקליפים.';
  else if (eff.duration < clip.transition.duration - 1e-3) {
    transitionNote = `קוצר ל-${eff.duration.toFixed(2)} שנ׳ כדי להתאים לקליפים השכנים.`;
  }

  return (
    <div className="insp">
      <div className="insp-title">
        <strong dir="auto">{clip.name}</strong>
        <span>{info}</span>
      </div>

      <Section title={isImage ? 'משך' : 'חיתוך'}>
        {isImage ? (
          <NumberField label="הצג למשך" value={clip.out} min={MIN_CLIP_DURATION} max={600}
            onApply={(v) => apply((c) => { c.out = v; })} />
        ) : (
          <>
            <NumberField label="התחלה" value={clip.in} max={clip.sourceDuration}
              onApply={(v) => apply((c) => { c.in = Math.min(v, c.out - MIN_CLIP_DURATION); })} />
            <NumberField label="סיום" value={clip.out} max={clip.sourceDuration}
              onApply={(v) => apply((c) => { c.out = Math.max(v, c.in + MIN_CLIP_DURATION); })} />
            <div className="btn-row">
              <Button onClick={() => setAtPlayhead('in')}>התחלה בסמן הניגון</Button>
              <Button onClick={() => setAtPlayhead('out')}>סיום בסמן הניגון</Button>
            </div>
          </>
        )}
        <div className="insp-note">על ציר הזמן: {formatTime(clipDuration(clip), true)}</div>
      </Section>

      {!isImage && (
        <Section title="מהירות">
          <Segmented layout="wrap" value={clip.speed}
            options={Object.fromEntries(SPEEDS.map((s) => [s, `${s}×`]))}
            onChange={(v) => apply((c) => { c.speed = Number(v); })} />
        </Section>
      )}

      <Section title="מסגור">
        <Segmented value={clip.fit} options={{ contain: 'התאמה (פסים)', cover: 'מילוי (חיתוך)' }}
          onChange={(v) => apply((c) => { c.fit = v; })} />
      </Section>

      <Section title="צבע">
        <Segmented layout="grid" value={clip.filter}
          options={Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, p.label]))}
          onChange={(v) => apply((c) => { c.filter = v; })} />
        <RangeField label="בהירות" value={clip.brightness} min={20} max={200} format={pct}
          onChange={(v) => edit((c) => { c.brightness = v; })} onCommit={commit} />
        <RangeField label="ניגודיות" value={clip.contrast} min={20} max={200} format={pct}
          onChange={(v) => edit((c) => { c.contrast = v; })} onCommit={commit} />
        <RangeField label="רוויה" value={clip.saturation} min={0} max={250} format={pct}
          onChange={(v) => edit((c) => { c.saturation = v; })} onCommit={commit} />
        <div className="btn-row">
          <Button onClick={() => apply((c) => Object.assign(c, { filter: 'none', brightness: 100, contrast: 100, saturation: 100 }))}>
            איפוס צבע
          </Button>
        </div>
      </Section>

      {!isImage && (
        <Section title="שמע">
          {clip.hasAudio ? (
            <>
              <RangeField label="עוצמה" value={Math.round(clip.volume * 100)} format={pct}
                onChange={(v) => edit((c) => { c.volume = v / 100; })} onCommit={commit} />
              <CheckField label="השתקת הקליפ" checked={clip.muted} onChange={(v) => apply((c) => { c.muted = v; })} />
            </>
          ) : (
            <div className="insp-note">לקליפ הזה אין פס קול.</div>
          )}
        </Section>
      )}

      {index > 0 && (
        <Section title="מעבר מהקליפ הקודם">
          <SelectField label="אפקט" options={TRANSITIONS} value={clip.transition.type}
            onChange={(v) => apply((c) => { c.transition = { ...c.transition, type: v }; })} />
          <RangeField label="אורך" value={clip.transition.duration} min={0.2} max={3} step={0.1}
            format={(v) => `${v.toFixed(1)} שנ׳`}
            onChange={(v) => edit((c) => { c.transition = { ...c.transition, duration: v }; })} onCommit={commit} />
          {transitionNote && <div className="insp-note">{transitionNote}</div>}
        </Section>
      )}

      <div className="btn-row actions">
        <Button icon="split" onClick={actions.split}>פיצול בסמן</Button>
        <Button icon="copy" onClick={actions.duplicate}>שכפול</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>מחיקה</Button>
      </div>
    </div>
  );
}

// Content of a generated black-and-gold graphic; "update" re-renders its video.
function GraphicContent({ overlay }) {
  const busy = useAtom(ui.graphicBusy);
  const [draft, setDraft] = useState(overlay.graphic);
  const g = draft;
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const field = (label, k, extra = {}) => (
    <Row label={label}>
      <input className="graphic-field" dir="auto" value={g[k] ?? ''} onChange={set(k)} {...extra} />
    </Row>
  );
  const changed = JSON.stringify(draft) !== JSON.stringify(overlay.graphic);
  return (
    <Section title={`תוכן: ${GRAPHIC_TYPES[g.type]?.name ?? 'גרפיקה'}`}>
      {field('כותרת', 'label', { id: 'graphic-label' })}
      {g.type === 'number' && field('המספר', 'value', { id: 'graphic-value', dir: 'ltr' })}
      {g.type === 'number' && field('הערה', 'note')}
      {g.type === 'bars' && (
        <>
          <textarea id="graphic-values" className="graphic-values" rows={4} value={g.values} onChange={set('values')}
            placeholder={'2024: 4\n2025: 9'} />
          <div className="insp-note">שורה לכל עמודה: תווית, נקודתיים וערך.</div>
          {field('לפני הערך', 'prefix', { dir: 'ltr' })}
          {field('אחרי הערך', 'suffix', { dir: 'ltr' })}
        </>
      )}
      {g.type !== 'year' && (
        <label className="insp-check">
          <input type="checkbox" checked={Boolean(g.years)} onChange={set('years')} />
          <span>ציר שנים למעלה</span>
        </label>
      )}
      {(g.years || g.type === 'year') && (
        <>
          {field('משנה', 'from', { type: 'number' })}
          {field('עד שנה', 'to', { type: 'number' })}
          {field('השנה המודגשת', 'active', { type: 'number', id: 'graphic-active' })}
        </>
      )}
      <div className="btn-row">
        <Button id="graphic-update" variant={changed ? 'primary' : ''} disabled={busy || !changed}
          onClick={() => updateGraphic(overlay.id, draft)}>{busy ? 'מעדכן…' : 'עדכון הגרפיקה'}</Button>
      </div>
    </Section>
  );
}

function OverlayPanel({ overlay }) {
  const isImage = overlay.kind === 'image';
  const split = overlay.region !== 'full';
  const info = isImage
    ? 'תמונה בשכבה העליונה'
    : `וידאו בשכבה העליונה · ${formatTime(overlay.sourceDuration, true)}`;
  return (
    <div className="insp">
      <div className="insp-title">
        <strong dir="auto">{overlay.name}</strong>
        <span>{info}</span>
      </div>

      {overlay.graphic && <GraphicContent key={overlay.path} overlay={overlay} />}

      <Section title="מסך מפוצל">
        <Segmented value={overlay.region} options={OVERLAY_REGIONS}
          onChange={(v) => apply((o) => { o.region = v; })} />
        {split && (
          <>
            <RangeField label="גובה" value={Math.round(overlay.split * 100)} min={30} max={70} format={pct}
              onChange={(v) => edit((o) => { o.split = v / 100; })} onCommit={commit} />
            <RangeField label="ריכוך הקצה" value={Math.round(overlay.feather * 100)} min={0} max={25} format={pct}
              onChange={(v) => edit((o) => { o.feather = v / 100; })} onCommit={commit} />
          </>
        )}
        <Segmented value={overlay.fit} options={{ cover: 'מילוי (חיתוך)', contain: 'התאמה (פסים)' }}
          onChange={(v) => apply((o) => { o.fit = v; })} />
        <div className="insp-note">
          {split
            ? 'הווידאו הראשי ממשיך מתחת. כדאי שהפנים בו יהיו בחצי השני של המסגרת.'
            : 'השכבה מכסה את כל המסגרת בזמן שהיא מוצגת.'}
        </div>
      </Section>

      <Section title="תזמון">
        <NumberField label="מתחילה ב-" value={overlay.start} max={36000}
          onApply={(v) => apply((o) => { o.start = v; })} />
        {isImage ? (
          <NumberField label="הצג למשך" value={overlay.out} min={MIN_CLIP_DURATION} max={600}
            onApply={(v) => apply((o) => { o.out = v; })} />
        ) : (
          <>
            <NumberField label="מתוך הקובץ: מ-" value={overlay.in} max={overlay.sourceDuration}
              onApply={(v) => apply((o) => { o.in = Math.min(v, o.out - MIN_CLIP_DURATION); })} />
            <NumberField label="עד" value={overlay.out} max={overlay.sourceDuration}
              onApply={(v) => apply((o) => { o.out = Math.max(v, o.in + MIN_CLIP_DURATION); })} />
          </>
        )}
        <div className="btn-row">
          <Button onClick={() => {
            const now = player.time;
            apply((o) => { o.start = now; });
          }}>התחלה בסמן</Button>
        </div>
        <SelectField label="כניסה ויציאה" options={OVERLAY_ANIMATIONS} value={overlayAnimation(overlay)}
          onChange={(v) => apply((o) => { o.animation = v; delete o.fade; })} />
        <div className="insp-note">על ציר הזמן: <span dir="ltr">{formatTime(overlay.start, true)}–{formatTime(overlay.start + overlayDuration(overlay), true)}</span></div>
      </Section>

      {overlay.hasAudio && (
        <Section title="שמע">
          <CheckField label="לכלול את הסאונד של השכבה" checked={!overlay.muted}
            onChange={(v) => apply((o) => { o.muted = !v; })} />
          {!overlay.muted && (
            <RangeField label="עוצמה" value={Math.round(overlay.volume * 100)} format={pct}
              onChange={(v) => edit((o) => { o.volume = v / 100; })} onCommit={commit} />
          )}
        </Section>
      )}

      <div className="btn-row actions">
        <Button icon="copy" onClick={actions.duplicate}>שכפול</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>מחיקה</Button>
      </div>
    </div>
  );
}

const SWATCHES = { [PALETTE.cream]: 'שמנת', [PALETTE.charcoal]: 'פחם', [PALETTE.clay]: 'טרקוטה', [PALETTE.ivory]: 'שנהב' };

function CardPanel({ card }) {
  const clips = store.project.clips;
  const index = clips.findIndex((c) => c.id === card.id);
  return (
    <div className="insp">
      <div className="insp-title">
        <strong>{card.name}</strong>
        <span>כרטיס צבע. הטקסטים עליו נערכים בנפרד, במסלול הטקסט.</span>
      </div>
      <Section title="משך">
        <NumberField label="הצג למשך" value={card.out} min={MIN_CLIP_DURATION} max={600}
          onApply={(v) => apply((c) => { c.out = v; })} />
      </Section>
      <Section title="רקע">
        <div className="swatches">
          {Object.entries(SWATCHES).map(([color, label]) => (
            <button key={color} type="button" className={`swatch${card.color.toLowerCase() === color.toLowerCase() ? ' active' : ''}`}
              style={{ background: color }} title={label} aria-label={label}
              onClick={() => apply((c) => { c.color = color; })} />
          ))}
        </div>
        <ColorField label="צבע מותאם" value={card.color} onChange={(v) => edit((c) => { c.color = v; })} onCommit={commit} />
      </Section>
      {index > 0 && (
        <Section title="מעבר מהקליפ הקודם">
          <SelectField label="אפקט" options={TRANSITIONS} value={card.transition.type}
            onChange={(v) => apply((c) => { c.transition = { ...c.transition, type: v }; })} />
        </Section>
      )}
      <div className="btn-row actions">
        <Button icon="copy" onClick={actions.duplicate}>שכפול</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>מחיקה</Button>
      </div>
    </div>
  );
}

function TextPanel({ text }) {
  const place = (y) => apply((t) => { t.x = 0.5; t.y = y; });
  return (
    <div className="insp">
      <div className="insp-title">
        <strong>{text.caption ? 'כתובית' : 'טקסט'}</strong>
        <span>גררו אותו בתצוגה המקדימה כדי להזיז</span>
      </div>
      <Section title="תוכן">
        <textarea id="text-content" rows={3} dir="auto" placeholder="הקלידו את הטקסט…" value={text.text}
          onChange={(e) => edit((t) => { t.text = e.target.value; })} onBlur={commit} />
      </Section>
      <Section title="תזמון">
        <NumberField label="מתחיל" value={text.start} onApply={(v) => apply((t) => { t.start = Math.min(v, t.end - 0.2); })} />
        <NumberField label="נגמר" value={text.end} max={36000} onApply={(v) => apply((t) => { t.end = Math.max(v, t.start + 0.2); })} />
        <div className="btn-row">
          <Button onClick={() => {
            const now = player.time;
            apply((t) => { const len = t.end - t.start; t.start = now; t.end = now + len; });
          }}>התחלה בסמן</Button>
          <Button onClick={() => {
            const now = player.time;
            apply((t) => { if (now > t.start + 0.2) t.end = now; });
          }}>סיום בסמן</Button>
        </div>
        <Segmented value={text.animation} options={{ none: 'ללא', fade: 'הופעה', rise: 'עלייה עדינה' }}
          onChange={(v) => apply((t) => { t.animation = v; })} />
      </Section>
      <Section title="מראה">
        <SelectField label="גופן" value={text.font}
          options={Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.label]))}
          onChange={(v) => apply((t) => { t.font = v; })} />
        <RangeField label="גודל" value={Math.round(text.size * 1000) / 10} min={2} max={25} step={0.5} format={pct}
          onChange={(v) => edit((t) => { t.size = v / 100; })} onCommit={commit} />
        <ColorField label="צבע" value={text.color} onChange={(v) => edit((t) => { t.color = v; })} onCommit={commit} />
        <CheckField label="מודגש" checked={text.bold} onChange={(v) => apply((t) => { t.bold = v; })} />
        <Segmented value={text.style} options={TEXT_STYLES} onChange={(v) => apply((t) => { t.style = v; })} />
        {text.style === 'box' && (
          <ColorField label="צבע רקע" value={text.boxColor} onChange={(v) => edit((t) => { t.boxColor = v; })} onCommit={commit} />
        )}
      </Section>
      <Section title="מיקום">
        <div className="btn-row">
          <Button onClick={() => place(0.12)}>למעלה</Button>
          <Button onClick={() => place(0.5)}>באמצע</Button>
          <Button onClick={() => place(0.85)}>למטה</Button>
        </div>
        <RangeField label="אופקי" value={Math.round(text.x * 100)} format={pct}
          onChange={(v) => edit((t) => { t.x = v / 100; })} onCommit={commit} />
        <RangeField label="אנכי" value={Math.round(text.y * 100)} format={pct}
          onChange={(v) => edit((t) => { t.y = v / 100; })} onCommit={commit} />
      </Section>
      {text.caption && (
        <Section title="כל הכתוביות">
          <div className="btn-row">
            <Button id="captions-apply-all" onClick={() => {
              const look = Object.fromEntries(CAPTION_LOOK.map((k) => [k, text[k]]));
              store.update((p) => p.texts.forEach((t) => t.caption && Object.assign(t, look)));
              toast('המראה הוחל על כל הכתוביות.', 'success', 2500);
            }}>החלת המראה על כולן</Button>
            <Button variant="danger" onClick={() => {
              store.update((p) => { p.texts = p.texts.filter((t) => !t.caption); });
              store.select(null);
            }}>מחיקת כל הכתוביות</Button>
          </div>
        </Section>
      )}
      <div className="btn-row actions">
        <Button icon="copy" onClick={actions.duplicate}>שכפול</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>מחיקה</Button>
      </div>
    </div>
  );
}

function MusicPanel({ music }) {
  const sec = (v) => `${v} שנ׳`;
  return (
    <div className="insp">
      <div className="insp-title">
        <strong dir="auto">{music.name}</strong>
        <span>מוזיקה · {formatTime(music.sourceDuration)}</span>
      </div>
      <Section title="מיקס">
        <RangeField label="עוצמה" value={Math.round(music.volume * 100)} format={pct}
          onChange={(v) => edit((m) => { m.volume = v / 100; })} onCommit={commit} />
        <CheckField label="חזרה עד סוף הסרטון" checked={music.loop} onChange={(v) => apply((m) => { m.loop = v; })} />
      </Section>
      <Section title="תזמון">
        <NumberField label="מתחילה ב-" value={music.start} max={36000} onApply={(v) => apply((m) => { m.start = v; })} />
        <NumberField label="דילוג על פתיח" value={music.offset} max={Math.max(0, music.sourceDuration - 0.5)}
          onApply={(v) => apply((m) => { m.offset = v; })} />
        <RangeField label="כניסה הדרגתית" value={music.fadeIn} min={0} max={10} step={0.5} format={sec}
          onChange={(v) => edit((m) => { m.fadeIn = v; })} onCommit={commit} />
        <RangeField label="יציאה הדרגתית" value={music.fadeOut} min={0} max={10} step={0.5} format={sec}
          onChange={(v) => edit((m) => { m.fadeOut = v; })} onCommit={commit} />
      </Section>
      <div className="btn-row actions">
        <Button icon="music" onClick={actions.addMusic}>החלפה…</Button>
        <Button icon="trash" variant="danger" onClick={actions.remove}>הסרת המוזיקה</Button>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  ['Space', 'ניגון / השהיה'], ['S', 'פיצול קליפ בסמן'], ['T', 'הוספת טקסט בסמן'],
  ['Delete', 'מחיקת הפריט הנבחר'], ['← / →', 'פריים אחד (עם Shift: שנייה)'], ['Home / End', 'קפיצה להתחלה / לסוף'],
  ['Ctrl+Z / Ctrl+Y', 'ביטול / שחזור'], ['Ctrl + גלגלת', 'זום בציר הזמן'],
];

function ProjectPanel() {
  const p = store.project;
  return (
    <div className="insp">
      <div className="insp-title">
        <strong>פרויקט</strong>
        <span>
          {p.clips.length} קליפים · {(p.overlays ?? []).length ? `${p.overlays.length} שכבות · ` : ''}{p.texts.length} טקסטים · {p.music ? 'עם מוזיקה' : 'בלי מוזיקה'} · {formatTime(totalDuration(p), true)}
        </span>
      </div>
      <Section title="גודל מסגרת">
        <Segmented layout="grid" value={p.aspect}
          options={Object.fromEntries(Object.entries(ASPECTS).map(([k, a]) => [k, (
            <><span className="aspect-swatch" style={{ aspectRatio: `${a.w} / ${a.h}` }} />{a.label}</>
          )]))}
          onChange={(v) => store.update((proj) => { proj.aspect = v; })} />
        <div className="insp-note">אפשר לשנות את זה גם בזמן הייצוא.</div>
      </Section>
      <Section title="קיצורי מקלדת">
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="shortcut">
              <dt><kbd dir="ltr">{k}</kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="מסך מפוצל">
        <div className="insp-note">
          כדי לשים גרפיקה למעלה ואת הפנים למטה: שימו את הסרטון שלכם במסלול הווידאו, ואת הגרפיקה הוסיפו כשכבה עליונה
          (כפתור השכבות בספריית המדיה, או גרירה למסלול ״שכבה עליונה״).
        </div>
      </Section>
      <div className="insp-note">בחרו קליפ, שכבה, טקסט או את פס המוזיקה כדי לערוך אותם.</div>
    </div>
  );
}

export function Inspector() {
  useStore();
  const sel = store.selection;
  const target = store.selected();
  let panel = <ProjectPanel />;
  if (sel?.type === 'clip' && target) panel = target.kind === 'card' ? <CardPanel card={target} /> : <ClipPanel clip={target} />;
  else if (sel?.type === 'overlay' && target) panel = <OverlayPanel overlay={target} />;
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
