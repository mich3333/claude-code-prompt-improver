import React from 'react';
import { siAnthropic, siClaude, siGooglegemini, siMeta, siMistralai } from 'simple-icons';
import type { Brand } from './scenes';

// Logos come straight from Simple Icons, drawn in each brand's own colour and
// never recoloured or distorted. OpenAI and xAI are not in Simple Icons, so they
// appear as their written name until the official files are added.
const ICONS: Partial<Record<Brand, { path: string; hex: string; title: string }>> = {
  claude: siClaude,
  anthropic: siAnthropic,
  gemini: siGooglegemini,
  meta: siMeta,
  mistral: siMistralai,
};

const NAMES: Record<Brand, string> = {
  claude: 'Claude',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  meta: 'Meta',
  mistral: 'Mistral',
  openai: 'OpenAI',
  xai: 'xAI',
};

export const brandName = (b: Brand) => NAMES[b];

export const Logo: React.FC<{ brand: Brand; size: number }> = ({ brand, size }) => {
  const icon = ICONS[brand];
  if (!icon) {
    return (
      <div
        style={{
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${size * 0.18}px`,
          borderRadius: size * 0.22,
          background: '#111',
          color: '#fff',
          fontSize: size * 0.36,
          fontWeight: 700,
          direction: 'ltr',
          whiteSpace: 'nowrap',
        }}
      >
        {NAMES[brand]}
      </div>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={icon.title}>
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
};
