#!/usr/bin/env node
// Publish a rendered reel to Instagram and/or TikTok through their official
// APIs. No dependencies: Node 20+ (fetch). Credentials come from video-remotion/.env
// (see .env.example). Run with --dry-run first: it prints every request
// without sending anything.
//
//   node scripts/publish.mjs --file out/reel.mp4 --caption "..." --to instagram,tiktok \
//        --video-url https://your-host/reel.mp4 [--tiktok-mode inbox|direct] [--dry-run]
//   node scripts/publish.mjs refresh-instagram
//   node scripts/publish.mjs refresh-tiktok
//
// API notes (checked 17.10.2026):
// - Instagram API with Instagram Login, graph.instagram.com v26.0. Reels are
//   created from a public video_url; local-file (resumable) upload needs
//   Facebook Login instead. Professional (Business/Creator) account required.
// - TikTok Content Posting API. "inbox" sends a draft the creator finishes in
//   the TikTok app (scope video.upload); "direct" posts straight away (scope
//   video.publish). Until the app passes TikTok's audit, direct posts must be
//   SELF_ONLY and the account private.

import { readFileSync, existsSync, statSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IG_VERSION = 'v26.0';
const IG = `https://graph.instagram.com/${IG_VERSION}`;
const TT = 'https://open.tiktokapis.com';

// --- small helpers --------------------------------------------------------

const loadEnv = () => {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
};

const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else out[key] = argv[++i];
    } else out._.push(a);
  }
  return out;
};

let DRY = false;
const need = (name) => {
  const v = process.env[name];
  if (!v && DRY) return `<${name}>`;
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const call = async (label, url, init = {}) => {
  if (DRY) {
    const body = typeof init.body === 'string' ? init.body : init.body ? `<${init.body.length ?? '?'} bytes>` : '';
    console.log(`[dry-run] ${label}: ${init.method ?? 'GET'} ${url.replace(/access_token=[^&]+/, 'access_token=***')} ${body}`);
    return { dry: true };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok && res.status !== 206) throw new Error(`${label} failed (${res.status}): ${text.slice(0, 500)}`);
  return { status: res.status, json };
};

// --- Instagram ------------------------------------------------------------

async function publishInstagram({ videoUrl, caption, shareToFeed = true }) {
  const token = need('IG_ACCESS_TOKEN');
  const user = process.env.IG_USER_ID || 'me';
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (!videoUrl) throw new Error('Instagram needs --video-url: a public https link to the MP4 (Instagram downloads it from there).');

  const limit = await call('IG publishing limit', `${IG}/${user}/content_publishing_limit?fields=quota_usage,config`, { headers: auth });
  if (!limit.dry) console.log('Instagram quota:', JSON.stringify(limit.json.data?.[0] ?? limit.json));

  const created = await call('IG create reel container', `${IG}/${user}/media`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: shareToFeed }),
  });
  if (created.dry) return;
  const containerId = created.json.id;
  console.log('Instagram container:', containerId);

  // Meta suggests checking about once a minute, for up to five minutes.
  for (let i = 0; i < 10; i++) {
    await sleep(30_000);
    const st = await call('IG container status', `${IG}/${containerId}?fields=status_code`, { headers: auth });
    const code = st.json.status_code;
    console.log('Instagram processing:', code);
    if (code === 'FINISHED') break;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Instagram could not process the video (${code}). Check the format: MP4, H.264, AAC, 9:16, 3s–15min.`);
    if (i === 9) throw new Error('Instagram is still processing after 5 minutes; run again later with the same video.');
  }

  const pub = await call('IG publish', `${IG}/${user}/media_publish`, { method: 'POST', headers: auth, body: JSON.stringify({ creation_id: containerId }) });
  console.log('Published to Instagram, media id:', pub.json.id);
}

async function refreshInstagram() {
  const token = need('IG_ACCESS_TOKEN');
  const r = await call('IG refresh token', `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  if (r.dry) return;
  saveEnv({ IG_ACCESS_TOKEN: r.json.access_token });
  console.log(`New Instagram token saved to .env (valid ~${Math.round(r.json.expires_in / 86400)} days).`);
}

// --- TikTok ---------------------------------------------------------------

const MB = 1024 * 1024;

/** TikTok chunk plan: one chunk up to 64 MB, else 10 MB chunks with the remainder folded into the last. */
export const chunkPlan = (size) => {
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.max(1, Math.floor(size / chunkSize)) };
};

async function publishTikTok({ file, caption, mode = 'inbox', privacy = 'SELF_ONLY' }) {
  const token = need('TIKTOK_ACCESS_TOKEN');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };
  const size = statSync(file).size;
  const { chunkSize, count } = chunkPlan(size);
  const source_info = { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: count };

  let init;
  if (mode === 'direct') {
    const info = await call('TikTok creator info', `${TT}/v2/post/publish/creator_info/query/`, { method: 'POST', headers });
    const options = info.json?.data?.privacy_level_options;
    if (options && !options.includes(privacy)) throw new Error(`TikTok privacy "${privacy}" is not allowed for this account; options: ${options.join(', ')}`);
    init = await call('TikTok init direct post', `${TT}/v2/post/publish/video/init/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ post_info: { title: caption, privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false, video_cover_timestamp_ms: 1000 }, source_info }),
    });
  } else {
    init = await call('TikTok init inbox draft', `${TT}/v2/post/publish/inbox/video/init/`, { method: 'POST', headers, body: JSON.stringify({ source_info }) });
  }
  if (init.dry) {
    console.log(`[dry-run] TikTok upload: ${count} chunk(s) of ${chunkSize} bytes (file ${size} bytes)`);
    return;
  }
  const { publish_id, upload_url } = init.json.data;
  console.log('TikTok publish id:', publish_id);

  const fd = openSync(file, 'r');
  try {
    for (let i = 0; i < count; i++) {
      const first = i * chunkSize;
      const last = i === count - 1 ? size - 1 : first + chunkSize - 1;
      const buf = Buffer.alloc(last - first + 1);
      readSync(fd, buf, 0, buf.length, first);
      const res = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(buf.length), 'Content-Range': `bytes ${first}-${last}/${size}` },
        body: buf,
      });
      if (res.status !== 206 && res.status !== 201) throw new Error(`TikTok chunk ${i + 1}/${count} failed (${res.status}): ${await res.text()}`);
      console.log(`TikTok upload ${i + 1}/${count}`);
    }
  } finally {
    closeSync(fd);
  }

  for (let i = 0; i < 24; i++) {
    await sleep(5_000);
    const st = await call('TikTok status', `${TT}/v2/post/publish/status/fetch/`, { method: 'POST', headers, body: JSON.stringify({ publish_id }) });
    const { status, fail_reason } = st.json.data ?? {};
    console.log('TikTok status:', status);
    if (status === 'PUBLISH_COMPLETE') return console.log('Published to TikTok.');
    if (status === 'SEND_TO_USER_INBOX') return console.log('Sent to your TikTok inbox: open TikTok to finish the post.');
    if (status === 'FAILED') throw new Error(`TikTok rejected the video: ${fail_reason}`);
  }
  console.log('TikTok is still processing; it will finish on its side.');
}

async function refreshTikTok() {
  const body = new URLSearchParams({
    client_key: need('TIKTOK_CLIENT_KEY'),
    client_secret: need('TIKTOK_CLIENT_SECRET'),
    grant_type: 'refresh_token',
    refresh_token: need('TIKTOK_REFRESH_TOKEN'),
  });
  const r = await call('TikTok refresh token', `${TT}/v2/oauth/token/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (r.dry) return;
  saveEnv({ TIKTOK_ACCESS_TOKEN: r.json.access_token, TIKTOK_REFRESH_TOKEN: r.json.refresh_token });
  console.log('New TikTok tokens saved to .env.');
}

// --- .env writer ----------------------------------------------------------

function saveEnv(values) {
  const path = join(ROOT, '.env');
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    if (!v) continue;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.replace(/\n?$/, '\n')}${k}=${v}\n`;
  }
  writeFileSync(path, text);
}

// --- main -----------------------------------------------------------------

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  DRY = Boolean(args['dry-run']);
  const cmd = args._[0];
  if (cmd === 'refresh-instagram') return refreshInstagram();
  if (cmd === 'refresh-tiktok') return refreshTikTok();

  const file = args.file;
  if (!file || !existsSync(file)) throw new Error('Pass --file with the rendered MP4.');
  const caption = typeof args.caption === 'string' ? args.caption : '';
  const targets = String(args.to ?? 'instagram,tiktok').split(',').map((s) => s.trim());

  for (const target of targets) {
    try {
      if (target === 'instagram') await publishInstagram({ videoUrl: args['video-url'], caption });
      else if (target === 'tiktok') await publishTikTok({ file, caption, mode: args['tiktok-mode'] ?? 'inbox', privacy: args['tiktok-privacy'] ?? 'SELF_ONLY' });
      else console.warn(`Unknown target: ${target}`);
    } catch (e) {
      console.error(`✗ ${target}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
