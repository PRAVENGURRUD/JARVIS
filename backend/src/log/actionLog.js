// Action log: one JSON line per thing JARVIS does (security rule 5).
// Never put transcripts, tokens or secrets in `details` — only short, safe descriptions.
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const file = path.join(config.dataDir, 'action-log.jsonl');

export async function logAction(action, details = {}) {
  const entry = { at: new Date().toISOString(), action, details };
  await mkdir(config.dataDir, { recursive: true });
  await appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

export async function readActions(limit = 100) {
  try {
    const text = await readFile(file, 'utf8');
    return text.trim().split('\n').filter(Boolean).slice(-limit).map((l) => JSON.parse(l)).reverse();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
