import 'package:material_ui/material_ui.dart';

import '../../core/secure_store.dart';
import 'voice_io.dart';

/// Pick which phone voice JARVIS speaks with. Tap a voice to hear it; it is saved straight away.
class VoiceSettingsScreen extends StatefulWidget {
  const VoiceSettingsScreen({super.key, required this.speaker, required this.store});
  final VoiceSpeaker speaker;
  final SecureStore store;

  @override
  State<VoiceSettingsScreen> createState() => _VoiceSettingsScreenState();
}

class _VoiceSettingsScreenState extends State<VoiceSettingsScreen> {
  List<PhoneVoice>? _voices;
  String? _error;

  static const _enSample = 'Good evening Praveen. All systems are online, sir.';
  static const _taSample = 'வணக்கம் Praveen, எப்படி இருக்கீங்க? நான் ரெடி sir.';

  VoiceSettings get _s => widget.speaker.settings;

  @override
  void initState() {
    super.initState();
    widget.speaker.voices().then(
          (v) => mounted ? setState(() => _voices = v) : null,
          onError: (Object e) => mounted ? setState(() => _error = '$e') : null,
        );
  }

  Future<void> _save() => _s.save(widget.store);

  Future<void> _pick(PhoneVoice v, bool tamil) async {
    setState(() => tamil ? _s.tamil = v : _s.english = v);
    await _save();
    await widget.speaker.preview(v, tamil ? _taSample : _enSample);
  }

  Widget _section(String title, String hint, bool tamil) {
    final list = (_voices ?? []).where((v) => v.locale.toLowerCase().startsWith(tamil ? 'ta' : 'en')).toList();
    final chosen = tamil ? _s.tamil : _s.english;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(hint)),
        if (list.isEmpty)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('No voices found. Install one: phone Settings > General management > Text-to-speech > ⚙ > Install voice data.'),
          ),
        for (final v in list)
          ListTile(
            dense: true,
            leading: Icon(chosen?.name == v.name ? Icons.check_circle : Icons.play_circle_outline),
            title: Text(v.name),
            subtitle: Text('${v.locale}${v.online ? ' · needs internet' : ''}'),
            onTap: () => _pick(v, tamil),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('JARVIS voice')),
      body: _error != null
          ? Center(child: Text('Could not read phone voices: $_error'))
          : _voices == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Text('Tap a voice to hear it. The one with ✓ is used. '
                          'Voice names don\'t say male/female, so listen and pick.'),
                    ),
                    ListTile(
                      title: Text('Deepness (pitch): ${_s.pitch.toStringAsFixed(2)}'),
                      subtitle: Slider(
                        min: 0.5,
                        max: 1.3,
                        divisions: 16,
                        value: _s.pitch.clamp(0.5, 1.3),
                        onChanged: (x) => setState(() => _s.pitch = x),
                        onChangeEnd: (_) => _save(),
                      ),
                    ),
                    ListTile(
                      title: Text('Speed: ${_s.rate.toStringAsFixed(2)}'),
                      subtitle: Slider(
                        min: 0.3,
                        max: 0.8,
                        divisions: 10,
                        value: _s.rate.clamp(0.3, 0.8),
                        onChanged: (x) => setState(() => _s.rate = x),
                        onChangeEnd: (_) => _save(),
                      ),
                    ),
                    _section('English voice', 'Used when JARVIS replies in English.', false),
                    _section('Tamil voice', 'Used for Tamil and Tanglish replies.', true),
                    const SizedBox(height: 24),
                  ],
                ),
    );
  }
}
