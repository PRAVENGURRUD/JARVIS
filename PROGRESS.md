# PROGRESS.md

Updated by Claude at the end of every session. Newest session at the top.

## Current status
**Phase 1 — steps 1.0–1.4 working on the real S24+ (updated 2026-11-18).** Voice replies now ~6 s (small model first, 15 s timeout). Voice picker in app (⚙🎙).
- Text chat + **voice chat** (tap 🎤, speak English/Tamil/Tanglish, tap ■) through the private Tailscale tunnel (`https://pravengurru.taile513f9.ts.net`) to the backend on the PC → Gemini understands the audio and replies in Tanglish; reply spoken aloud. Voice replies take ~3–10 s.
- Spoken voice is the phone's **Android TTS** (female, robotic) because **Gemini TTS returns "model not found" for Praveen's key** (tried gemini-3.8-flash-lite-tts, gemini-3.8-flash-tts, gemini-3.1-flash-tts-preview, gemini-2.5-flash-preview-tts + models.list). Backend switches TTS off for 30 min after a full failure so replies stay fast.
- Backend: 23 tests pass. App: `flutter analyze` clean, 4 tests pass (before the last small edits — re-run).

## Phases
- [ ] **Phase 1** (1.0–1.4 done; next: voice choice, then 1.5 background service) — Wake word, background service, Tanglish voice chat ← *current*
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
- 2026-11-16: Flutter 3.47+ deprecates `package:flutter/material.dart`; import `package:material_ui/material_ui.dart` instead (already in pubspec from `flutter create`).
- 2026-11-16: Pairing = QR with `{v, url, code}` from `npm run pair`; app sends code to `POST /pair`, gets a device token once; app sends `Authorization: Bearer <token>` on every call.

## Open questions (need Praveen)
- Gemini API key: Praveen creates it in Google AI Studio and puts it only in `backend/.env`.
- Model IDs in `.env` defaults (gemini-3.5-flash-lite / gemini-3.8-flash / gemini-3.8-flash-lite-tts) come from Google's pricing page (Nov 2026); confirm on first real run.

## Known broken / to do later
- `flutter_tts` 4.2.5 still applies the Kotlin Gradle Plugin; Flutter warns future versions will refuse to build it. Before upgrading Flutter past 3.50: update flutter_tts or replace the Android-TTS fallback.
- First `flutter run` took ~25 min (Gradle downloads; PC RAM ~88% used). Later builds are fast. Close heavy apps before building.
- Windows console can't render Tamil script — `npm run chat` shows garbled (voice: ...) lines; phone shows it fine.
- Action log is plain JSON lines in `backend/data/` (gitignored). Encrypt it in step 1.8 (security rule 3).

## Next step (start here next session)
1. Choose with Praveen: A) Gemini natural voice — run `npm run models` in `backend/`, read the "TTS (voice) models" lines, set `GEMINI_MODEL_TTS` in `.env` if one exists; or B) step 1.5.
2. Step 1.5: Kotlin foreground service ("JARVIS is listening" notification) + Samsung battery setup screen. Show folder layout + steps first, wait for OK.
3. Then 1.6 wake word "Hey JARVIS" (openWakeWord via ONNX Runtime).
4. Watch: "could not hear clearly" = silent recording (peak 0) when another app (e.g. screen recorder) holds the mic.

Old next-step notes:
Step 1.4: push-to-talk in the app (record audio → backend → Gemini understands audio) + speak replies with Gemini TTS (`gemini-3.8-flash-lite-tts`), Android TTS fallback.

How to run (see `scripts/`): `scripts\start-jarvis.ps1` (backend + QR + `flutter run`; `-NoPair` once paired), `scripts\chat.ps1` (terminal brain test), `scripts\setup-pc.ps1` (one-time Tailscale + .env).

---

## Session log

### 2026-11-18 — Day 2
- Voice picker in app (⚙🎙 icon): lists phone English/Tamil voices, tap to hear, pitch + speed sliders, saved in secure storage. Phone built OK, `flutter analyze` clean.
- `npm run models`: text models incl. gemini-3.5/3.6/3.7/3.8-flash, gemini-4-*; TTS section not yet seen (scrolled off).
- Voice replies took 28–56 s (big model gemini-3.8-flash stalls on audio, then small model answered). Fix: voice → small model first, 15 s per-model timeout (20 s text), timeouts skip same-model retry, failed attempts logged to console with ms. Persona: if "heard" is filled, answer — don't ask to repeat. 400 on /chat/voice now logged. 24 backend tests pass.
- 4 voice messages showed "could not hear clearly" with nothing in the action log — cause unknown (watch `voice_chat_rejected` and backend console).

### 2026-11-16 — end of day 1
- Voice tested on phone: audio levels healthy (peak 42–95 %), Gemini transcribes Tanglish correctly ("Tamil puriyuma machi thirupi reply panra").
- Fixes today: hold-to-talk → tap-to-talk; "(not clear)" label was shown for ANY error → now "(not sent — PC not reachable)" vs "(JARVIS could not hear it clearly)"; loudness check (numbers only) + silent-recording guard; TTS model discovery + 30-min off switch; Gemini `thinkingLevel: LOW`; per-reply timing in action log; phone voice timeout 90 s; TTS capped at 20 s.
- Daily use: `scripts\start-jarvis.ps1 -NoPair -NoApp` (backend only), keep the backend window open, Tailscale connected on both devices. USB only needed to install new app versions (`flutter run`).

### 2026-11-16 — Step 1.4 first phone test
- `gemini-3.8-flash-lite-tts` returned 404 for Praveen's key → TTS now tries the configured model, then known names, then whatever `models.list()` offers (`npm run models` lists them), and remembers the working one.
- Hold-to-talk never sent audio (long-press delay) → switched to tap to start / tap to send, with a seconds counter, 60 s limit, and on-screen mic errors.

### 2026-11-16 — Step 1.4 (voice) written
- Backend: `POST /chat/voice` (base64 WAV, ≤5 MB, parsed only after token check) → Gemini understands the audio (strong model first) and returns `heard` + reply. `speak: true` on `/chat` or `/chat/voice` adds Gemini TTS audio (`gemini-3.8-flash-lite-tts`, voice `Charon`, Interactions API, `store:false`); TTS failure → no audio, phone uses Android TTS. 20 backend tests pass.
- App: hold-to-talk mic button (record: 16 kHz mono WAV, deleted after sending), speaker toggle in app bar, plays Gemini WAV (audioplayers) or falls back to flutter_tts (ta-IN / en-IN). RECORD_AUDIO + TTS_SERVICE query added to manifest. Packages added via `scripts/update-app-1.4.ps1`.

### 2026-11-16 — Session 1 (continued)
- Added `scripts/setup-pc.ps1` (winget Tailscale, sign-in, `tailscale serve --bg 3000`, writes PUBLIC_URL, hidden prompt for GEMINI_API_KEY), `scripts/start-jarvis.ps1`, `scripts/chat.ps1`.
- Tailscale: PC `pravengurru` + phone `pravens-s24` on the same tailnet; Serve + HTTPS enabled.
- First real run: pairing worked, real Gemini (`gemini-3.5-flash-lite`) replied in Tanglish on the phone. One transient `model_error` → added retry + fallback and log Google's HTTP status (no content).
- Claude can't type into terminals on the PC (safety rule) and can't push to GitHub (no GitHub App access) → Praveen runs commands/pushes.

### 2026-11-16 — Session 1
- Read the master plan (`docs/JARVIS_Plan.pdf`), added it to the repo.
- Created `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `docs/PHASE1_PLAN.md`; Praveen pushed to GitHub.
- Decisions: PC + Tailscale backend, Gemini TTS, app ID.
- Step 1.1: backend skeleton in `backend/` — `npm test` passes (3 tests).
- Flutter 3.50 + Android SDK 36 set up on Windows; `flutter doctor` clean. App created via `flutter create --org com.praveen --project-name jarvis --platforms android app`; INTERNET + CAMERA added to main manifest.
- Step 1.3: Gemini moved to a new "Interactions API" in its docs, but the official SDK (@google/genai 3.3.0) still supports `models.generateContent` — using that. Brain returns JSON {display (Tanglish), speech (Tamil words in Tamil script for TTS), lang}. Action log stores model/lang/length only, never what was said.
- Step 1.2 backend: pairing codes are single-use, 5-min, max 5 wrong tries, max 3 devices; only SHA-256 hashes of codes/tokens stored; unknown routes return 401 to hide what exists.
