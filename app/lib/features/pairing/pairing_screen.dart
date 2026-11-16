import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api_client.dart';
import '../../core/secure_store.dart';

/// Scan the QR shown by `npm run pair` on your PC.
class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, required this.api, required this.store, required this.onPaired});
  final ApiClient api;
  final SecureStore store;
  final void Function(Session) onPaired;

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy || capture.barcodes.isEmpty) return;
    final raw = capture.barcodes.first.rawValue;
    if (raw == null) return;

    String? url;
    String? code;
    try {
      final data = jsonDecode(raw);
      if (data is Map && data['v'] == 1) {
        url = data['url'] as String?;
        code = data['code'] as String?;
      }
    } on FormatException {
      // not our QR
    }
    if (url == null || code == null || !isAllowedBackendUrl(url)) {
      setState(() => _error = 'This is not a JARVIS pairing QR.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await widget.api.pair(baseUrl: url, code: code);
      await widget.store.save(session);
      widget.onPaired(session);
    } on ApiException catch (e) {
      setState(() {
        _busy = false;
        _error = e.failure == ApiFailure.unauthorized
            ? 'Pairing code expired or already used. Run "npm run pair" again.'
            : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair with your PC')),
      body: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('On your PC, run "npm run pair" in the backend folder, then point the camera at the QR.'),
          ),
          Expanded(
            child: _busy
                ? const Center(child: CircularProgressIndicator())
                : MobileScanner(onDetect: _onDetect),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
        ],
      ),
    );
  }
}
