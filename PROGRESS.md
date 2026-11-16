# PROGRESS.md

Updated by Claude at the end of every session. Newest session at the top.

## Current status
**Phase 1 — planning.** No app or backend code yet. Waiting for Praveen's go-ahead on `docs/PHASE1_PLAN.md` and answers to its open decisions.

## Phases
- [ ] **Phase 1** — Wake word, background service, Tanglish voice chat ← *current*
- [ ] Phase 2 — Calls: answer, speaker, hang-up fallback, busy mode, transcripts
- [ ] Phase 3 — Alarms, calendar, messages, LinkedIn, phone control
- [ ] Phase 4 — Browser booking, smart home, briefings, extras
- [ ] Phase 5 — Move the brain to the home server

## Decisions made
- 2026-11-16: Stack fixed as Flutter + Kotlin plugins (app), Node/Express (backend), Stage 1 free tools only (see `CLAUDE.md`).
- 2026-11-16: Wake word = openWakeWord's pretrained "hey_jarvis" model, run on the phone with ONNX Runtime (no Picovoice key needed).

## Open questions (need Praveen)
See "Decisions I need from you" in `docs/PHASE1_PLAN.md`.

## Known broken
Nothing yet.

## Next step
Praveen answers the open decisions → set up dev tools on Windows (Flutter SDK, Android Studio, Node LTS) → step 1.1 of the Phase 1 plan.

---

## Session log

### 2026-11-16 — Session 1
- Read the master plan (`docs/JARVIS_Plan.pdf`), added it to the repo.
- Created `CLAUDE.md`, `PROGRESS.md`, `.gitignore`, `docs/PHASE1_PLAN.md`.
