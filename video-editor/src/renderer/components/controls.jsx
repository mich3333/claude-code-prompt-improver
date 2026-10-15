import { useId, useState } from 'react';
import { motion } from 'motion/react';
import { snappy } from '../motion.js';
import { Icon } from './Icon.jsx';

export function Button({ icon, children, variant = '', className = '', ...rest }) {
  return (
    <button type="button" className={`btn ${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = '', size = 18, ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} title={label} aria-label={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Section({ title, children }) {
  return (
    <section className="insp-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Row({ label, children, extra }) {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      {children}
      {extra}
    </label>
  );
}

// Segmented control; the active pill slides between options.
export function Segmented({ options, value, onChange, layout = '' }) {
  const id = useId();
  return (
    <div className={`segmented ${layout}`} role="radiogroup">
      {Object.entries(options).map(([v, label]) => {
        const active = String(value) === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            data-value={v}
            className={active ? 'active' : ''}
            onClick={() => onChange(v)}
          >
            {active && <motion.span layoutId={`pill-${id}`} className="seg-pill" transition={snappy} />}
            <span className="seg-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Number input that keeps a draft while typing and applies on Enter/blur.
export function NumberField({ label, value, onApply, min = 0, max = Infinity, step = 0.1, suffix = 's' }) {
  const [draft, setDraft] = useState(null);
  const apply = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(v)) onApply(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  return (
    <Row label={label} extra={<span className="insp-suffix">{suffix}</span>}>
      <input
        type="number"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        value={draft ?? String(Number(Number(value).toFixed(2)))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </Row>
  );
}

// Slider: changes apply live; one undo step is recorded when released.
export function RangeField({ label, value, onChange, onCommit, min = 0, max = 100, step = 1, format = String }) {
  return (
    <Row label={label} extra={<span className="insp-value">{format(value)}</span>}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </Row>
  );
}

export function SelectField({ label, options, value, onChange }) {
  return (
    <Row label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </Row>
  );
}

export function CheckField({ label, checked, onChange }) {
  return (
    <label className="insp-check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function ColorField({ label, value, onChange, onCommit }) {
  return (
    <Row label={label}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} />
    </Row>
  );
}
