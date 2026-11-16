# PROGRESS.md

Updated by Claude at the end of every session. Newest session at the top.

## Current status
**Phase 1 — steps 1.1, 1.2 (backend half) and 1.3 (brain, untested against real Gemini) done.** Backend has `/health`, one-time QR pairing (`npm run pair`), device-token auth on every other route, `/whoami`, `/actions`, `npm run devices` (list/revoke). `POST /chat` (text in → `{display, speech, lang}` out) with model router + quota fallback; `npm run chat` to test from the terminal. 13 tests pass (Gemini faked in tests). Step 1.0 (Flutter SDK on Windows, Tailscale) in progress on Praveen's side. App half of 1.2 (scan QR, store token in Keystore) waits for Flutter.

## Phases
- [ ] **Phase 1** — Wake word, background service, Tanglish voice chat ← *current*
- [ ] Phase 2 — Calls: answer, speaker, hang-up fallback, busy mode, transcripts
- [ ] Phase 3 — Alarms, calendar, messages, LinkedIn, phone control
- [ ] Phase 4 — Browser booking, smart home, briefings, extras
- [ ] Phase 5 — Move the brain to the home server

## Decisions made
- 2026-11-16: Stack fixed as Flutter + Kotlin plugins (app), Node/Express (backend), Stage 1 free tools only (see `CLAUDE.md`).
- 2026-11-16: Wake word = openWakeWord's pretrained "hey_jarvis" model, run on the phone with ONNX Runtime (no Picovoice key needed).
- 2026-11-16: Backend runs on Praveen's Windows PC, bound to 127.0.0.1, exposed only to his devices via **Tailscale Serve** (HTTPS, no open ports). App must say clearly when the PC is off.
- 2026-11-16: Reply voice = **Gemini TTS**, automatic fallback to Android built-in TTS when offline or quota is used up.
- 2026-11-16: App ID = `com.praveen.jarvis`.
- 2026-11-16: PC already has Node.js and Android Studio; Flutter SDK still to install.
- 2026-11-16: Brain = Gemini via @google/genai `generateContent`, JSON reply schema; small model for short chat, strong model for explain/compare/code/Tanglish "eppadi/yen" questions; on quota error try the other model, then answer with a spoken fallback.
- 2026-11-16: Pairing = QR with `{v, url, code}` from `npm run pair`; app sends code to `POST /pair`, gets a device token once; app sends `Authorization: Bearer <token>` on every call.

## Open questions (need Praveen)
- Gemini API key: Praveen creates it in Google AI Studio and puts it only in `backend/.env`.
- Model IDs in `.env` defaults (gemini-3.5-flash-lite / gemini-3.8-flash / gemini-3.8-flash-lite-tts) come from Google's pricing page (Nov 2026); confirm on first real run.

## Known broken / to do later
- Action log is plain JSON lines in `backend/data/` (gitignored). Encrypt it in step 1.8 (security rule 3).

## Next step
Finish step 1.0 (Flutter SDK, `flutter doctor`, USB debugging, Tailscale on PC + phone, set `PUBLIC_URL` in `backend/.env`) → Praveen adds `GEMINI_API_KEY` to `backend/.env` and tries `npm run chat` (first real Gemini test) → Flutter app skeleton + pairing screen (app half of 1.2) → 1.4 push-to-talk + TTS.

---

## Session log

### 2026-11-16 — Session 1
- Read the master plan (`docs/JARVIS_Plan.pdf`), added it to the repo.
- Created `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `docs/PHASE1_PLAN.md`; Praveen pushed to GitHub.
- Decisions: PC + Tailscale backend, Gemini TTS, app ID.
- Step 1.1: backend skeleton in `backend/` — `npm test` passes (3 tests).
- Step 1.3: Gemini moved to a new "Interactions API" in its docs, but the official SDK (@google/genai 3.3.0) still supports `models.generateContent` — using that. Brain returns JSON {display (Tanglish), speech (Tamil words in Tamil script for TTS), lang}. Action log stores model/lang/length only, never what was said.
- Step 1.2 backend: pairing codes are single-use, 5-min, max 5 wrong tries, max 3 devices; only SHA-256 hashes of codes/tokens stored; unknown routes return 401 to hide what exists.
