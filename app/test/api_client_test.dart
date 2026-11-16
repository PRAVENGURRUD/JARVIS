import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jarvis/core/api_client.dart';
import 'package:jarvis/core/secure_store.dart';

void main() {
  test('only Tailscale HTTPS addresses are allowed', () {
    expect(isAllowedBackendUrl('https://my-pc.tail1234.ts.net'), isTrue);
    expect(isAllowedBackendUrl('http://my-pc.tail1234.ts.net'), isFalse);
    expect(isAllowedBackendUrl('https://evil.com'), isFalse);
    expect(isAllowedBackendUrl('https://evil.com/x.ts.net'), isFalse);
    expect(isAllowedBackendUrl('https://user@my-pc.tail1234.ts.net'), isFalse);
  });

  test('chat sends token and parses reply', () async {
    late http.Request seen;
    final api = ApiClient(client: MockClient((req) async {
      seen = req;
      return http.Response(
        jsonEncode({'reply': {'display': 'Seri Praveen', 'speech': 'சரி Praveen', 'lang': 'tanglish'}}),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }));
    final r = await api.chat(const Session('https://pc.tail1.ts.net', 'tok'), 'hi', const []);
    expect(seen.headers['authorization'], 'Bearer tok');
    expect(r.lang, 'tanglish');
  });

  test('401 becomes unauthorized', () async {
    final api = ApiClient(client: MockClient((_) async => http.Response('{"error":"unauthorized"}', 401)));
    expect(
      () => api.chat(const Session('https://pc.tail1.ts.net', 'tok'), 'hi', const []),
      throwsA(isA<ApiException>().having((e) => e.failure, 'failure', ApiFailure.unauthorized)),
    );
  });

  test('voiceChat sends base64 WAV and reads heard + audio', () async {
    late Map<String, dynamic> sent;
    final api = ApiClient(client: MockClient((req) async {
      sent = jsonDecode(req.body) as Map<String, dynamic>;
      expect(req.url.path, '/chat/voice');
      return http.Response(
        jsonEncode({
          'heard': 'naalaiku exam',
          'reply': {'display': 'All the best', 'speech': 'All the best', 'lang': 'en'},
          'audio': {'mimeType': 'audio/wav', 'data': 'UklGRg=='},
        }),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }));
    final r = await api.voiceChat(const Session('https://pc.tail1.ts.net', 'tok'), [1, 2, 3], const []);
    expect((sent['audio'] as Map)['data'], base64Encode([1, 2, 3]));
    expect(r.heard, 'naalaiku exam');
    expect(r.audioWav, 'UklGRg==');
  });
}
