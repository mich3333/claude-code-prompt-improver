#!/usr/bin/env node
// Word-timing tools (see lib/words.mjs).
//
//   node words.mjs normalize <transcript.json> <words.json>      Scribe / Whisper / whisper.cpp -> standard words
//   node words.mjs align <words.json> <script.txt> <out.json>    exact script spelling, recogniser timings
//   node words.mjs srt <words.json> <out.srt> [wordsPerCue=4]    subtitles file
//   node words.mjs find <words.json> "<phrase>" [after=0]         when is the phrase said? (seconds)
//   node words.mjs show <words.json>                             one line per word: start end text

import { readFileSync, writeFileSync } from 'node:fs';
import { alignToScript, findPhrase, normalizeWords, toSrt } from './lib/words.mjs';

const [cmd, a, b, c] = process.argv.slice(2);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const save = (p, words) => {
  writeFileSync(p, `${JSON.stringify(words, null, 1)}\n`);
  console.log(`${words.length} words -> ${p}`);
};

switch (cmd) {
  case 'normalize':
    save(b, normalizeWords(readJson(a)));
    break;
  case 'align': {
    const words = normalizeWords(readJson(a));
    const aligned = alignToScript(words, readFileSync(b, 'utf8'));
    const heard = new Set(words.map((w) => `${w.start}|${w.text}`));
    const fixed = aligned.filter((w) => !heard.has(`${w.start}|${w.text}`));
    save(c, aligned);
    console.log(`recognised ${words.length} words, script has ${aligned.length}; corrected or timed from the script: ${fixed.map((w) => w.text).join(' ') || 'none'}`);
    break;
  }
  case 'srt':
    writeFileSync(b, toSrt(normalizeWords(readJson(a)), Number(c ?? 4)));
    console.log(`-> ${b}`);
    break;
  case 'find': {
    const hit = findPhrase(normalizeWords(readJson(a)), b, Number(c ?? 0));
    console.log(hit ? `${hit.start.toFixed(2)}–${hit.end.toFixed(2)}` : 'not found');
    process.exitCode = hit ? 0 : 1;
    break;
  }
  case 'show':
    for (const w of normalizeWords(readJson(a))) console.log(`${w.start.toFixed(2)}\t${w.end.toFixed(2)}\t${w.text}`);
    break;
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exitCode = cmd ? 1 : 0;
}
