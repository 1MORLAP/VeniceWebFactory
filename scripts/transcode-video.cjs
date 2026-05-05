#!/usr/bin/env node
/**
 * transcode-video.cjs — ffmpeg wrapper for variant-A/B preservation
 *
 * Built 2026-05-05 alongside `scripts/inspect-splash.cjs`. After the
 * splash probe classifies a video URL as variant A (direct MP4) or B
 * (HLS), this script downloads + transcodes the source to a
 * mobile-optimized H.264 MP4 the build can self-host. Variant C
 * (third-party iframe) bypasses this — those are re-embedded directly
 * by the build, no transcode needed.
 *
 * ffmpeg is a SOFT dependency. If `ffmpeg` is not on PATH the script
 * exits 0 with a warning that records "transcode-skipped" status —
 * the pipeline continues, the build degrades gracefully (renders an
 * <a href> link to the original splash URL instead of an inline
 * <video>). The orchestrator should set `videoCta._transcoded = false`
 * when this happens.
 *
 * Default transcode profile (mobile-first, plays inline on iOS Safari):
 *   - Container: MP4
 *   - Video: H.264 (libx264), CRF 23, preset medium, max 1280×720, ≤ 30 fps
 *   - Audio: AAC 128k mono (most Hibu/Wix splash videos are talking-head)
 *   - moov atom moved to front (`-movflags faststart`) for streaming
 *
 * For HLS inputs (variant B), ffmpeg can read the .m3u8 directly via the
 * built-in HTTP demuxer. No separate hls.js fallback needed at transcode
 * time — that fallback only matters at RUNTIME for browsers that lack
 * HLS support, which we obviate by transcoding to MP4 here.
 *
 * Usage:
 *   node scripts/transcode-video.cjs <input-url-or-path> <output-path> [--max-bitrate 1500k]
 *
 * Exit codes:
 *   0 — transcode succeeded OR ffmpeg not installed (soft-fail, see stderr)
 *   1 — bad CLI args
 *   2 — ffmpeg failed (e.g., source unreadable, codec error)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
let input = null;
let output = null;
let maxBitrate = '1500k';
let maxWidth = 1280;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max-bitrate' && args[i + 1]) { maxBitrate = args[++i]; continue; }
  if (args[i] === '--max-width' && args[i + 1]) { maxWidth = Number(args[++i]); continue; }
  if (!input) { input = args[i]; continue; }
  if (!output) { output = args[i]; continue; }
}

if (!input || !output) {
  console.error('Usage: node scripts/transcode-video.cjs <input-url-or-path> <output-path> [--max-bitrate 1500k] [--max-width 1280]');
  process.exit(1);
}

// Check ffmpeg presence — soft fail if absent.
const ffmpegProbe = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe' });
if (ffmpegProbe.status !== 0) {
  console.warn('⚠ ffmpeg not installed or not on PATH — skipping transcode.');
  console.warn('  Install via `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux).');
  console.warn('  The build will degrade gracefully: rendering an <a href> link instead of an inline <video>.');
  process.exit(0);
}

// Ensure output dir exists.
const outDir = path.dirname(output);
fs.mkdirSync(outDir, { recursive: true });

// Build the ffmpeg argv. Notes:
//   • -y      overwrite if exists (we control the output path, no surprises)
//   • -i      input — works for local paths AND http(s) URLs AND .m3u8
//   • -c:v libx264 → universal H.264 codec
//   • -preset medium → balance of speed vs file size
//   • -crf 23 → constant rate factor — visually-lossless for talking heads
//   • -maxrate / -bufsize → cap peak bitrate (mobile-friendly)
//   • -vf scale=... → cap width (preserves aspect, no upscale)
//   • -r 30 → cap framerate
//   • -c:a aac -b:a 128k -ac 1 → 128k mono AAC (sufficient for the
//     "owner introduces the business" splash-video pattern)
//   • -movflags faststart → moves MOOV atom to file head; streaming starts
//     immediately instead of waiting for full download
//   • -loglevel warning → quiet stdout but report errors

const ffmpegArgs = [
  '-y',
  '-i', input,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '23',
  '-maxrate', maxBitrate,
  '-bufsize', `${parseInt(maxBitrate) * 2}k`,
  '-vf', `scale=w='min(${maxWidth},iw)':h=-2`,
  '-r', '30',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ac', '1',
  '-movflags', 'faststart',
  '-loglevel', 'warning',
  output,
];

const start = Date.now();
const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
const elapsed = Math.round((Date.now() - start) / 1000);

if (result.status !== 0) {
  console.error(`✗ ffmpeg failed (exit ${result.status}). Source may be unreachable or unreadable.`);
  process.exit(2);
}

if (!fs.existsSync(output)) {
  console.error(`✗ ffmpeg returned 0 but output file missing: ${output}`);
  process.exit(2);
}

const sizeBytes = fs.statSync(output).size;
const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);
console.log(`✓ Transcoded → ${output}  (${sizeMb} MB in ${elapsed}s)`);
process.exit(0);
