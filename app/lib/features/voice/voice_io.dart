import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../core/secure_store.dart';

/// A voice installed on the phone (from Samsung's or Google's speech engine).
class PhoneVoice {
  const PhoneVoice(this.name, this.locale, {this.online = false});
  final String name;
  final String locale;
  final bool online; // needs internet
  Map<String, String> toMap() => {'name': name, 'locale': locale};
}

/// Which phone voices JARVIS uses, and how it sounds.
class VoiceSettings {
  VoiceSettings({this.english, this.tamil, this.pitch = 0.85, this.rate = 0.5});
  PhoneVoice? english;
  PhoneVoice? tamil;
  double pitch; // 1.0 = normal; lower sounds deeper
  double rate; // 0.5 = normal speed

  static Future<VoiceSettings> load(SecureStore store) async {
    PhoneVoice? v(String? name, String? locale) => (name != null && locale != null) ? PhoneVoice(name, locale) : null;
    return VoiceSettings(
      english: v(await store.readSetting('en_voice'), await store.readSetting('en_locale')),
      tamil: v(await store.readSetting('ta_voice'), await store.readSetting('ta_locale')),
      pitch: double.tryParse(await store.readSetting('pitch') ?? '') ?? 0.85,
      rate: double.tryParse(await store.readSetting('rate') ?? '') ?? 0.5,
    );
  }

  Future<void> save(SecureStore store) async {
    await store.writeSetting('en_voice', english?.name);
    await store.writeSetting('en_locale', english?.locale);
    await store.writeSetting('ta_voice', tamil?.name);
    await store.writeSetting('ta_locale', tamil?.locale);
    await store.writeSetting('pitch', pitch.toStringAsFixed(2));
    await store.writeSetting('rate', rate.toStringAsFixed(2));
  }
}

/// Records your voice while you hold the mic button.
/// 16 kHz mono WAV: small enough to send quickly, clear enough for Gemini to understand Tanglish.
class VoiceRecorder {
  final AudioRecorder _rec = AudioRecorder();
  String? _path;

  /// Asks for microphone permission the first time (Android shows its own popup).
  Future<bool> start() async {
    if (!await _rec.hasPermission()) return false;
    final dir = await getTemporaryDirectory();
    _path = '${dir.path}/jarvis_in.wav';
    await _rec.start(
      const RecordConfig(encoder: AudioEncoder.wav, sampleRate: 16000, numChannels: 1),
      path: _path!,
    );
    return true;
  }

  /// Stops and returns the recording, or null if it was too short (an accidental tap).
  Future<Uint8List?> stop() async {
    final path = await _rec.stop();
    if (path == null) return null;
    final file = File(path);
    if (!await file.exists()) return null;
    final bytes = await file.readAsBytes();
    await file.delete(); // don't leave your voice lying around on the phone
    // WAV header is 44 bytes; 16 kHz * 2 bytes = 32 KB per second. Ignore < 0.4 s.
    if (bytes.length < 44 + 32000 * 0.4) return null;
    return bytes;
  }

  Future<void> cancel() async {
    await _rec.cancel();
  }

  Future<void> dispose() => _rec.dispose();
}

/// Speaks JARVIS's replies: Gemini's voice when the PC sent audio, otherwise Android's built-in voice.
class VoiceSpeaker {
  VoiceSpeaker() {
    _tts.awaitSpeakCompletion(true);
  }

  final AudioPlayer _player = AudioPlayer();
  final FlutterTts _tts = FlutterTts();
  VoiceSettings settings = VoiceSettings();

  /// All voices on the phone for English and Tamil.
  Future<List<PhoneVoice>> voices() async {
    final raw = await _tts.getVoices;
    final out = <PhoneVoice>[];
    if (raw is List) {
      for (final v in raw) {
        if (v is! Map) continue;
        final name = v['name']?.toString();
        final locale = v['locale']?.toString();
        if (name == null || locale == null) continue;
        final l = locale.toLowerCase();
        if (!l.startsWith('en') && !l.startsWith('ta')) continue;
        final online = v['network_required']?.toString() == '1' || v['network_required'] == true;
        out.add(PhoneVoice(name, locale, online: online));
      }
    }
    out.sort((a, b) => '${a.locale}${a.name}'.compareTo('${b.locale}${b.name}'));
    return out;
  }

  /// Speaks with one specific phone voice (for the "test" button).
  Future<void> preview(PhoneVoice v, String text) async {
    await stop();
    await _tts.setVoice(v.toMap());
    await _tts.setPitch(settings.pitch);
    await _tts.setSpeechRate(settings.rate);
    await _tts.speak(text);
  }

  Future<void> stop() async {
    await _player.stop();
    await _tts.stop();
  }

  /// [wavBase64] from the backend if available; otherwise speak [speech] with Android TTS.
  Future<void> say({String? wavBase64, required String speech, required String lang}) async {
    await stop();
    if (wavBase64 != null && wavBase64.isNotEmpty) {
      try {
        final dir = await getTemporaryDirectory();
        final f = File('${dir.path}/jarvis_out.wav');
        await f.writeAsBytes(base64Decode(wavBase64), flush: true);
        await _player.play(DeviceFileSource(f.path));
        return;
      } catch (_) {
        // fall through to Android voice
      }
    }
    // Tamil voice for Tamil/Tanglish (the speech text has Tamil words in Tamil script), English otherwise.
    final chosen = lang == 'en' ? settings.english : settings.tamil;
    if (chosen != null) {
      await _tts.setVoice(chosen.toMap());
    } else {
      await _tts.setLanguage(lang == 'en' ? 'en-IN' : 'ta-IN');
    }
    await _tts.setPitch(settings.pitch);
    await _tts.setSpeechRate(settings.rate);
    await _tts.speak(speech);
  }

  Future<void> dispose() async {
    await _player.dispose();
    await _tts.stop();
  }
}
