# PROGRESS.md

Updated by Claude at the end of every session. Newest session at the top.

## Current status
**Phase 1 — steps 1.0–1.3 DONE and working on the real S24+** (2026-11-16): phone paired over Tailscale (`https://pravengurru.taile513f9.ts.net`), text chat with real Gemini replies in Tanglish. Step 1.4 (voice) code written 2026-11-16, waiting for first phone test. Backend has `/health`, one-time QR pairing (`npm run pair`), device-token auth on every other route, `/whoami`, `/actions`, `npm run devices` (list/revoke). `POST /chat` (text in → `{display, speech, lang}` out) with model router + quota fallback; `npm run chat` to test from the terminal. 15 tests pass (Gemini faked in tests). Brain retries a failed model once, then falls back to the other model. Flutter app in `app/` (Flutter 3.50, package `com.praveen.jarvis`): QR pairing screen (mobile_scanner), token in Keystore (flutter_secure_storage), text chat screen; only accepts `https://*.ts.net` backend URLs. 3 app tests pass.

## Phases
- [ ] **Phase 1** (1.0–1.3 done, 1.4 in test) — Wake word, background service, Tanglish voice chat ← *current*
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

## Next step
Step 1.4: push-to-talk in the app (record audio → backend → Gemini understands audio) + speak replies with Gemini TTS (`gemini-3.8-flash-lite-tts`), Android TTS fallback.

How to run (see `scripts/`): `scripts\start-jarvis.ps1` (backend + QR + `flutter run`; `-NoPair` once paired), `scripts\chat.ps1` (terminal brain test), `scripts\setup-pc.ps1` (one-time Tailscale + .env).

---

## Session log

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
