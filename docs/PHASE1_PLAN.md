# Phase 1 Plan — Wake word, background service, Tanglish voice chat

**Goal of Phase 1:** you say "Hey JARVIS" with the phone locked in your pocket, it beeps, you talk in English / Tamil / Tanglish, and JARVIS answers out loud in the same style. No actions yet (no calls, alarms, posts). Those come in later phases.

---

## 1. Big picture (how a single conversation flows)

```
 Phone (Flutter + Kotlin)                          Backend (Node/Express)            Gemini (free)
 ───────────────────────                           ──────────────────────            ─────────────
 [Always-on service] mic → wake word model
        │  "Hey JARVIS" heard  → beep
        ▼
 record your sentence until you stop talking
        │  audio + device token (HTTPS)
        └────────────────────────────────────────▶ check token → model router ───▶ understand audio,
                                                    write action log              write JARVIS reply
        ┌──────────────────────────────────────── reply text + language  ◀────────┘
        ▼
 Android TTS speaks it (Tamil or English voice)
 keeps listening ~8 s for a follow-up without "Hey JARVIS"
```

The wake-word check runs **on the phone only**. Nothing leaves the phone until you say "Hey JARVIS".

---

## 2. Folder structure

```
JARVIS/
├── CLAUDE.md                 standing rules (read every session)
├── PROGRESS.md               what's done / next step
├── .gitignore                keeps secrets out of git
├── docs/
│   ├── JARVIS_Plan.pdf       master plan
│   └── PHASE1_PLAN.md        this file
│
├── backend/                  Node.js + Express
│   ├── package.json
│   ├── .env.example          names of secrets (real .env never committed)
│   └── src/
│       ├── server.js         starts Express, HTTPS headers, rate limit
│       ├── config.js         reads .env safely
│       ├── security/
│       │   ├── pairing.js    one-time QR pairing → device token
│       │   └── auth.js       rejects any request without a valid token
│       ├── brain/
│       │   ├── router.js     picks small vs strong model
│       │   ├── gemini.js     talks to Gemini free tier
│       │   └── persona.js    JARVIS personality + Tanglish rules
│       ├── routes/
│       │   ├── chat.js       POST /chat  (audio or text in, reply out)
│       │   └── health.js     GET /health
│       └── log/
│           └── actionLog.js  records everything JARVIS does
│
└── app/                      Flutter app
    ├── pubspec.yaml
    ├── assets/
    │   ├── models/           openWakeWord ONNX files (hey_jarvis etc.)
    │   └── sounds/           wake beep
    ├── lib/
    │   ├── main.dart
    │   ├── core/
    │   │   ├── api_client.dart      HTTPS calls to backend
    │   │   └── secure_store.dart    token in Android Keystore
    │   └── features/
    │       ├── pairing/             scan QR from backend once
    │       ├── chat/                chat screen + push-to-talk
    │       ├── setup_guide/         Samsung battery settings walkthrough
    │       └── action_log/          see what JARVIS did
    └── android/app/src/main/kotlin/com/praveen/jarvis/
        ├── MainActivity.kt
        ├── service/JarvisListenService.kt   always-on foreground service
        ├── wakeword/WakeWordEngine.kt       runs openWakeWord models
        ├── audio/VoiceRecorder.kt           records until you stop talking
        └── bridge/JarvisChannel.kt          Kotlin ⇄ Dart messages
```

---

## 3. Android ideas you need, in simple words

**Foreground service.** Android kills apps running in the background to save battery, like a shop owner switching off lights in empty rooms. A *foreground service* is your app saying "I'm still working, keep my lights on". The rule: it must show a permanent notification ("JARVIS is listening"). You can't hide it, and that's a good thing: you always know it's on.

**Green mic dot.** While JARVIS listens, Android shows a green dot at the top of the screen. This is a privacy feature; no app can hide it.

**Starting after a restart.** Android doesn't let an app switch on the mic by itself right after the phone boots (this stops spy apps). **So after every phone restart, you open JARVIS once (or tap its notification) to start listening again.** There's no allowed way around this.

**Samsung battery killer.** Samsung is stricter than plain Android. It puts "unused" apps to sleep even if they're working. We'll add a setup screen that walks you through: Battery → *Unrestricted*, and adding JARVIS to *Never sleeping apps*. Without this, JARVIS will randomly stop listening.

**Wake word model.** A tiny AI on the phone that does one job: hear "Hey JARVIS" or not. It's like a watchman who only knows one face. It's small, so battery use stays low, and it never sends sound anywhere. We'll use openWakeWord's ready-made "hey_jarvis" model, so you don't need to train one. (Its license allows personal, non-commercial use only. Fine for you.)

**Kotlin plugin.** Flutter can't touch deep Android features (the always-on mic service) by itself. We write those parts in Kotlin, Android's own language, and Flutter talks to them through a "channel", like a phone line between the two.

**End-of-speech detection.** After the beep, JARVIS needs to know when you've finished talking. It watches for about one second of silence, the way a person waits for you to pause before replying.

---

## 4. Steps (each step = one git commit that works)

| # | Step | What you'll be able to see/test |
|---|---|---|
| 1.0 | **Set up tools on your Windows PC:** Flutter SDK, Android Studio, Node.js LTS; turn on USB debugging on the S24+ | `flutter doctor` all green, phone shows up in `flutter devices` |
| 1.1 | **Backend skeleton:** Express, `/health`, security headers, rate limit, `.env.example`, action log | Open `/health` in a browser and get `ok` |
| 1.2 | **Pairing + auth:** backend shows a one-time QR; app scans it and stores a device token in Keystore. All other routes need that token | A request without the token gets refused |
| 1.3 | **Brain:** `POST /chat` → model router → Gemini, JARVIS persona, reply in your language | Type "machi naalaiku exam iruku, tension ah iruku" → JARVIS replies in Tanglish |
| 1.4 | **Flutter chat screen + push-to-talk:** hold a button, talk, hear the reply (Android TTS: Tamil or English voice) | Full voice loop working, *without* wake word yet |
| 1.5 | **Kotlin foreground service** with notification + Samsung setup-guide screen | Notification stays; service survives closing the app |
| 1.6 | **Wake word inside the service** (openWakeWord via ONNX Runtime), tune sensitivity, beep | Say "Hey JARVIS" with screen off → beep |
| 1.7 | **Join it all:** wake → record → backend → speak → 8-second follow-up window | The Phase 1 goal works end to end |
| 1.8 | **Security pass + tests:** token check, no secrets in APK (we scan the built APK), action-log screen, false-wake test (TV/YouTube playing for 1 hour) | Checklist all ticked, PROGRESS.md updated |

---

## 5. Honest limits for Phase 1

- **Restart = open app once.** Android rule, explained above.
- **Tanglish speech output.** Android's Tamil voice reads Tamil script well but reads Tanglish written in English letters badly ("naalaiku" sounds odd). Fix: the brain sends two versions, Tanglish text for the screen and a speech version with Tamil words in Tamil script for the voice. It'll still sound a bit robotic, not like a movie JARVIS. Better voices come in Stage 2.
- **Voice match (only *your* voice works)** isn't in Phase 1. Phase 1 JARVIS can only *talk*, not *act*, so if someone else says "Hey JARVIS" they just get a chat. Voice match + fingerprint confirmation are added before Phase 2, before JARVIS can touch calls.
- **Free Gemini tier:** has daily limits (resets about 1:30 pm IST), and Google may use free-tier data to improve its models. Don't tell Phase 1 JARVIS private things yet.
- **Battery:** the wake-word model is small, but an always-on mic will still cost some battery, roughly a few percent a day. We'll measure it in step 1.8.
- **Background noise / false wakes:** we tune the sensitivity in 1.6; a few false beeps per day is normal at first.

---

## 6. Decisions I need from you before coding

1. **Where does the backend run in Stage 1?**
   - **(A) Your PC + Tailscale (free private VPN).** The phone reaches your PC from anywhere, with no open ports. It's also the same setup as the Stage 2 home server. Downside: the PC must be on for JARVIS to answer. *(My recommendation.)*
   - **(B) Free cloud host** (e.g. Render free tier). Always reachable, but it falls asleep when idle (first reply after a break takes ~30–60 s), and your secrets sit on a third-party server.
2. **Gemini API key:** you create it yourself in Google AI Studio and paste it only into `backend/.env` on the server, never in chat or in git. OK?
3. **App ID:** `com.praveen.jarvis`. OK, or do you want another?
4. **Reply voice for Phase 1:** Android built-in TTS (fast, free, offline; my recommendation) or Gemini TTS (more natural, uses your free quota, needs internet)?
5. Is your PC **Windows** with enough space (~15 GB) for Android Studio + Flutter?
