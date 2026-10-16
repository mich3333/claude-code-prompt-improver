// ElevenLabs Scribe speech-to-text client (main process only, so the API key
// never reaches the UI). Returns word timings in seconds.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
// Newest model first; fall back if the account or API rejects it.
const MODELS = ['scribe_v2', 'scribe_v1'];

function errorDetail(body) {
  try {
    const json = JSON.parse(body);
    const d = json.detail ?? json.error ?? json;
    const msg = typeof d === 'string' ? d : d.message ?? JSON.stringify(d);
    return String(msg).slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}

const cancelled = () => Object.assign(new Error('התמלול בוטל'), { cancelled: true });

export async function transcribe(file, {
  apiKey, language, signal, url = process.env.CLIPCRAFT_SCRIBE_URL || DEFAULT_URL, fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error('חסר מפתח API של ElevenLabs.');
  const audio = await readFile(file);
  for (const model of MODELS) {
    const form = new FormData();
    form.append('model_id', model);
    form.append('file', new Blob([audio], { type: 'audio/mpeg' }), path.basename(file));
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');
    if (language && language !== 'auto') form.append('language_code', language);
    let res;
    try {
      res = await fetchImpl(url, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form, signal });
    } catch (e) {
      if (signal?.aborted) throw cancelled();
      throw new Error(`אין חיבור ל-ElevenLabs. בדקו את החיבור לאינטרנט. (${e.message})`);
    }
    if (res.ok) {
      const json = await res.json();
      return { words: Array.isArray(json.words) ? json.words : [], language: json.language_code ?? null };
    }
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('מפתח ה-API של ElevenLabs לא תקין. בדקו אותו ונסו שוב.');
    const modelRejected = (res.status === 400 || res.status === 422) && /model/i.test(body);
    if (modelRejected && model !== MODELS.at(-1)) continue;
    if (res.status === 402 || res.status === 429) {
      throw new Error(`ElevenLabs: נגמרה המכסה או שיש יותר מדי בקשות. (${errorDetail(body)})`);
    }
    throw new Error(`ElevenLabs החזיר שגיאה ${res.status}: ${errorDetail(body)}`);
  }
  throw new Error('ElevenLabs דחה את כל מודלי התמלול.');
}
