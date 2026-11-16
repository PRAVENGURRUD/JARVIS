// Lists the Gemini models your API key can use:  npm run models
import { GoogleGenAI } from '@google/genai';
import { config } from '../src/config.js';

if (!config.geminiApiKey) { console.error('GEMINI_API_KEY missing in backend/.env'); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
const pager = await ai.models.list();
const names = [];
for await (const m of pager) names.push(String(m.name).replace(/^models\//, ''));
names.sort();
const group = (re) => names.filter((n) => re.test(n));
console.log('TTS (voice) models:\n  ' + (group(/tts/i).join('\n  ') || '(none)'));
console.log('\nOther Gemini models:\n  ' + names.filter((n) => /^gemini/.test(n) && !/tts/i.test(n)).join('\n  '));
console.log(`\nIn backend/.env now: SMALL=${config.models.small}  STRONG=${config.models.strong}  TTS=${config.models.tts}`);
