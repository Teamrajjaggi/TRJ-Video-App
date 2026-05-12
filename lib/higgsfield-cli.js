const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Wraps the official `@higgsfield/cli` so the server can shell out to it.
// The CLI is expected to already be logged in (`higgsfield auth login`) on
// whichever machine runs this app.
//
// Configurable via env (so you can tune without code changes):
//   HIGGSFIELD_BIN          path to the cli (default: "higgsfield")
//   HIGGSFIELD_MODEL        model id (default: "kling3_0")
//   HIGGSFIELD_DURATION     seconds (default: 5)
//   HIGGSFIELD_ASPECT       "9:16" (default)
//   HIGGSFIELD_EXTRA_ARGS   space-separated extra flags
//   HIGGSFIELD_TIMEOUT_MS   ms (default: 5 min)
//   HIGGSFIELD_DISABLED     "1" to skip the CLI entirely (falls back to stub)

const DEFAULTS = {
  bin: process.env.HIGGSFIELD_BIN || 'higgsfield',
  model: process.env.HIGGSFIELD_MODEL || 'kling3_0',
  duration: parseInt(process.env.HIGGSFIELD_DURATION || '5', 10),
  aspect: process.env.HIGGSFIELD_ASPECT || '9:16',
  extra: (process.env.HIGGSFIELD_EXTRA_ARGS || '').split(/\s+/).filter(Boolean),
  timeoutMs: parseInt(process.env.HIGGSFIELD_TIMEOUT_MS || String(5 * 60 * 1000), 10),
};

function isDisabled() {
  return process.env.HIGGSFIELD_DISABLED === '1';
}

function writePromptToTempFile(prompt) {
  const file = path.join(
    os.tmpdir(),
    `vr-prompt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.txt`,
  );
  fs.writeFileSync(file, prompt, 'utf8');
  return file;
}

// Best-effort extraction: try JSON first, then a URL match on stdout/stderr.
function parseOutput(stdout, stderr) {
  const blob = `${stdout}\n${stderr}`;
  // JSON line first
  for (const line of stdout.split('\n').reverse()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const src =
        obj?.video_url || obj?.url || obj?.src || obj?.output || obj?.result?.video_url;
      if (src) return { src, raw: obj };
    } catch {
      /* fall through */
    }
  }
  // Then plain URL
  const urlMatch = blob.match(/https?:\/\/[^\s)\]"'>]+\.(?:mp4|mov|webm)/i);
  if (urlMatch) return { src: urlMatch[0], raw: blob };
  // Then a local file path
  const fileMatch = blob.match(/(?:saved|wrote|output)\s*(?:to|:)?\s*([^\s]+\.(?:mp4|mov|webm))/i);
  if (fileMatch) return { src: fileMatch[1], raw: blob };
  throw new Error(
    `could not parse video URL from higgsfield output. stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 200)}`,
  );
}

async function runCli({ prompt, model, duration, aspect, extra, timeoutMs, bin }) {
  return new Promise((resolve, reject) => {
    const promptFile = writePromptToTempFile(prompt);
    const args = [
      'generate',
      'create',
      model,
      '--prompt-file',
      promptFile,
      '--duration',
      String(duration),
      '--aspect-ratio',
      aspect,
      '--json',
      ...extra,
    ];

    const child = spawn(bin, args, {
      shell: process.platform === 'win32',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`higgsfield CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      try {
        fs.unlinkSync(promptFile);
      } catch {
        /* ignore */
      }
      if (code !== 0) {
        return reject(
          new Error(
            `higgsfield exited ${code}. stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`,
          ),
        );
      }
      try {
        resolve(parseOutput(stdout, stderr));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function generateVideo({ prompt }) {
  if (isDisabled()) {
    const err = new Error('HIGGSFIELD_DISABLED=1');
    err.code = 'HIGGSFIELD_DISABLED';
    throw err;
  }
  return runCli({ prompt, ...DEFAULTS });
}

module.exports = { generateVideo, DEFAULTS, isDisabled };
