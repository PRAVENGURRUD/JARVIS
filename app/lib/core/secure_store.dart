import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keeps the backend address and device token in Android's Keystore-backed
/// secure storage — like a locker inside the phone that only JARVIS has a key to.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _kUrl = 'backend_url';
  static const _kToken = 'device_token';

  Future<Session?> load() async {
    final url = await _storage.read(key: _kUrl);
    final token = await _storage.read(key: _kToken);
    if (url == null || token == null) return null;
    return Session(url, token);
  }

  Future<void> save(Session s) async {
    await _storage.write(key: _kUrl, value: s.baseUrl);
    await _storage.write(key: _kToken, value: s.token);
  }

  /// Small app settings (e.g. chosen voice). Not secret, but kept in the same locked store.
  Future<String?> readSetting(String key) => _storage.read(key: 'setting_$key');
  Future<void> writeSetting(String key, String? value) =>
      value == null ? _storage.delete(key: 'setting_$key') : _storage.write(key: 'setting_$key', value: value);

  Future<void> clear() async {
    await _storage.delete(key: _kUrl);
    await _storage.delete(key: _kToken);
  }
}

class Session {
  const Session(this.baseUrl, this.token);
  final String baseUrl;
  final String token;
}
