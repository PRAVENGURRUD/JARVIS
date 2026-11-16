import 'package:material_ui/material_ui.dart';

import 'core/api_client.dart';
import 'core/secure_store.dart';
import 'features/chat/chat_screen.dart';
import 'features/pairing/pairing_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const JarvisApp());
}

class JarvisApp extends StatefulWidget {
  const JarvisApp({super.key});

  @override
  State<JarvisApp> createState() => _JarvisAppState();
}

class _JarvisAppState extends State<JarvisApp> {
  final _store = SecureStore();
  final _api = ApiClient();
  Session? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _store.load().then((s) => setState(() {
          _session = s;
          _loading = false;
        }));
  }

  Future<void> _unpair() async {
    await _store.clear();
    setState(() => _session = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JARVIS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00B4D8), brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _session == null
              ? PairingScreen(api: _api, store: _store, onPaired: (s) => setState(() => _session = s))
              : ChatScreen(api: _api, session: _session!, onUnpaired: _unpair),
    );
  }
}
