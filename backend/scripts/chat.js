// Talk to JARVIS's brain from the PC terminal (no phone needed):  npm run chat
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createBrain, BrainError } from '../src/brain/gemini.js';

const brain = createBrain();
const rl = readline.createInterface({ input, output });
const history = [];

console.log('JARVIS brain test. Type in English / Tamil / Tanglish. Empty line to quit.\n');
for (;;) {
  const text = (await rl.question('You: ')).trim();
  if (!text) break;
  try {
    const r = await brain.chat({ text, history: history.slice(-10) });
    console.log(`JARVIS [${r.model}, ${r.lang}]: ${r.display}`);
    if (r.speech !== r.display) console.log(`   (voice: ${r.speech})`);
    history.push({ role: 'user', text }, { role: 'jarvis', text: r.display });
  } catch (err) {
    console.log(err instanceof BrainError ? `[${err.code}] ${err.message}` : err);
  }
}
rl.close();
