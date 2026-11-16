import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

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
    // Tamil voice for Tamil/Tanglish (the speech text has Tamil words in Tamil script), Indian English otherwise.
    await _tts.setLanguage(lang == 'en' ? 'en-IN' : 'ta-IN');
    await _tts.speak(speech);
  }

  Future<void> dispose() async {
    await _player.dispose();
    await _tts.stop();
  }
}
