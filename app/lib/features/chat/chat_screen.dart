import 'dart:async';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../../core/api_client.dart';
import '../../core/secure_store.dart';
import '../voice/voice_io.dart';

/// Chat with JARVIS: type, or TAP the mic, talk, and tap again to send. Replies are spoken aloud.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.api, required this.session, required this.onUnpaired});
  final ApiClient api;
  final Session session;
  final VoidCallback onUnpaired;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<ChatTurn> _turns = [];
  final _recorder = VoiceRecorder();
  final _speaker = VoiceSpeaker();
  bool _sending = false;
  bool _recording = false;
  bool _speakReplies = true;
  String? _banner;
  Timer? _ticker;
  int _seconds = 0;
  static const _maxSeconds = 60;

  @override
  void dispose() {
    _ticker?.cancel();
    _input.dispose();
    _scroll.dispose();
    _recorder.dispose();
    _speaker.dispose();
    super.dispose();
  }

  List<ChatTurn> _history() => _turns.length > 10 ? _turns.sublist(_turns.length - 10) : List<ChatTurn>.of(_turns);

  Future<void> _sendText() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    final history = _history();
    setState(() {
      _turns.add(ChatTurn('user', text));
      _input.clear();
    });
    await _run(() => widget.api.chat(widget.session, text, history, speak: _speakReplies));
  }

  Future<void> _startRecording() async {
    if (_sending || _recording) return;
    await _speaker.stop(); // stop JARVIS talking when you start
    final bool ok;
    try {
      ok = await _recorder.start();
    } catch (e) {
      setState(() => _banner = 'Microphone error: $e');
      return;
    }
    if (!ok) {
      setState(() => _banner = 'JARVIS needs microphone permission. Allow it in Settings > Apps > jarvis > Permissions.');
      return;
    }
    setState(() {
      _recording = true;
      _seconds = 0;
      _banner = null;
    });
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _seconds++);
      if (_seconds >= _maxSeconds) _stopRecording(); // safety limit
    });
  }

  Future<void> _toggleMic() async {
    if (_recording) {
      await _stopRecording();
    } else {
      await _startRecording();
    }
  }

  Future<void> _stopRecording() async {
    if (!_recording) return;
    _ticker?.cancel();
    setState(() => _recording = false);
    Uint8List? recorded;
    try {
      recorded = await _recorder.stop();
    } catch (e) {
      setState(() => _banner = 'Microphone error: $e');
      return;
    }
    if (recorded == null) {
      setState(() => _banner = 'That was too short. Tap the mic, speak, then tap again to send.');
      return;
    }
    final Uint8List wav = recorded; // definitely has audio from here on
    final history = _history();
    final placeholder = ChatTurn('user', '🎤 …');
    setState(() => _turns.add(placeholder));
    await _run(
      () => widget.api.voiceChat(widget.session, wav, history, speak: _speakReplies),
      onHeard: (heard) {
        final i = _turns.indexOf(placeholder);
        if (i >= 0) {
          _turns[i] = ChatTurn(
            'user',
            heard == '\u0000offline'
                ? '🎤 (not sent — PC not reachable)'
                : heard.isEmpty
                    ? '🎤 (JARVIS could not hear it clearly)'
                    : '🎤 $heard',
          );
        }
      },
    );
  }

  Future<void> _run(Future<JarvisReply> Function() call, {void Function(String heard)? onHeard}) async {
    setState(() {
      _sending = true;
      _banner = null;
    });
    _scrollDown();
    try {
      final reply = await call();
      setState(() {
        if (onHeard != null) onHeard(reply.heard ?? '');
        _turns.add(ChatTurn('jarvis', reply.display));
      });
      _scrollDown();
      if (_speakReplies) {
        await _speaker.say(wavBase64: reply.audioWav, speech: reply.speech, lang: reply.lang);
      }
    } on ApiException catch (e) {
      if (e.failure == ApiFailure.unauthorized) {
        widget.onUnpaired();
        return;
      }
      setState(() {
        if (onHeard != null) onHeard(e.failure == ApiFailure.pcOffline ? '\u0000offline' : '');
        if (e.spokenReply != null) _turns.add(ChatTurn('jarvis', e.spokenReply!.display));
        _banner = e.message;
      });
      if (_speakReplies && e.spokenReply != null) {
        await _speaker.say(speech: e.spokenReply!.speech, lang: 'en');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
      _scrollDown();
    }
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('JARVIS'),
        actions: [
          IconButton(
            tooltip: _speakReplies ? 'Mute replies' : 'Speak replies',
            icon: Icon(_speakReplies ? Icons.volume_up : Icons.volume_off),
            onPressed: () async {
              if (_speakReplies) await _speaker.stop();
              setState(() => _speakReplies = !_speakReplies);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (_banner != null)
            MaterialBanner(
              content: Text(_banner!),
              actions: [TextButton(onPressed: () => setState(() => _banner = null), child: const Text('OK'))],
            ),
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(12),
              itemCount: _turns.length,
              itemBuilder: (_, i) {
                final t = _turns[i];
                final mine = t.role == 'user';
                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    constraints: const BoxConstraints(maxWidth: 320),
                    decoration: BoxDecoration(
                      color: mine ? scheme.primaryContainer : scheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(t.text),
                  ),
                );
              },
            ),
          ),
          if (_recording)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('🔴 Listening… ${_seconds}s — tap the mic again to send',
                  style: TextStyle(color: scheme.error)),
            ),
          if (_sending) const LinearProgressIndicator(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendText(),
                      decoration: const InputDecoration(hintText: 'Type, or tap 🎤 to talk'),
                    ),
                  ),
                  IconButton(onPressed: _sending ? null : _sendText, icon: const Icon(Icons.send)),
                  // Tap to start talking, tap again to send.
                  GestureDetector(
                    onTap: _sending ? null : _toggleMic,
                    child: CircleAvatar(
                      radius: 26,
                      backgroundColor: _recording ? scheme.error : scheme.primary,
                      child: Icon(_recording ? Icons.stop : Icons.mic, color: scheme.onPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
