import 'package:material_ui/material_ui.dart';

import '../../core/api_client.dart';
import '../../core/secure_store.dart';

/// Text chat with JARVIS. Voice (push-to-talk + speaking) is added in step 1.4.
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
  bool _sending = false;
  String? _banner;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    final history = _turns.length > 10 ? _turns.sublist(_turns.length - 10) : List<ChatTurn>.of(_turns);
    setState(() {
      _turns.add(ChatTurn('user', text));
      _input.clear();
      _sending = true;
      _banner = null;
    });
    _scrollDown();
    try {
      final reply = await widget.api.chat(widget.session, text, history);
      setState(() => _turns.add(ChatTurn('jarvis', reply.display)));
    } on ApiException catch (e) {
      if (e.failure == ApiFailure.unauthorized) {
        widget.onUnpaired();
        return;
      }
      setState(() {
        if (e.spokenReply != null) _turns.add(ChatTurn('jarvis', e.spokenReply!.display));
        _banner = e.message;
      });
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
      appBar: AppBar(title: const Text('JARVIS')),
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
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(hintText: 'Talk to JARVIS (English / Tamil / Tanglish)'),
                    ),
                  ),
                  IconButton(onPressed: _sending ? null : _send, icon: const Icon(Icons.send)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
