import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'secure_store.dart';

/// Why a call failed, in words the UI can show.
enum ApiFailure { pcOffline, unauthorized, quota, badRequest, server }

class ApiException implements Exception {
  ApiException(this.failure, [this.spokenReply]);
  final ApiFailure failure;
  final JarvisReply? spokenReply; // backend sends a ready-to-speak message for some errors

  String get message => switch (failure) {
        ApiFailure.pcOffline =>
          "Can't reach your PC. Is it on, with the backend and Tailscale running?",
        ApiFailure.unauthorized => 'This phone is no longer paired. Please pair again.',
        ApiFailure.quota => 'Free Gemini quota is used up for now.',
        ApiFailure.badRequest => 'That message could not be sent.',
        ApiFailure.server => 'Something went wrong on the PC.',
      };
}

class JarvisReply {
  const JarvisReply({required this.display, required this.speech, required this.lang, this.audioWav, this.heard});
  factory JarvisReply.fromJson(Map<String, dynamic> j, {Map<String, dynamic>? body}) => JarvisReply(
        display: j['display'] as String? ?? '',
        speech: j['speech'] as String? ?? '',
        lang: j['lang'] as String? ?? 'en',
        audioWav: (body?['audio'] is Map) ? (body!['audio'] as Map)['data'] as String? : null,
        heard: body?['heard'] as String?,
      );
  final String display;
  final String speech; // Tamil words in Tamil script, for speaking
  final String lang;
  final String? audioWav; // base64 WAV of Gemini's voice, if the PC made one
  final String? heard; // voice messages: what JARVIS heard you say
}

class ChatTurn {
  const ChatTurn(this.role, this.text); // role: 'user' | 'jarvis'
  final String role;
  final String text;
  Map<String, String> toJson() => {'role': role, 'text': text};
}

/// Only HTTPS addresses on your private Tailscale network are accepted, so a
/// fake QR code can't point the app at some stranger's server.
bool isAllowedBackendUrl(String url) {
  final uri = Uri.tryParse(url);
  return uri != null &&
      uri.scheme == 'https' &&
      uri.host.endsWith('.ts.net') &&
      uri.userInfo.isEmpty &&
      (uri.path.isEmpty || uri.path == '/');
}

class ApiClient {
  ApiClient({http.Client? client}) : _http = client ?? http.Client();
  final http.Client _http;
  static const _timeout = Duration(seconds: 30);

  /// Sends the one-time QR code; returns a Session with this phone's token.
  Future<Session> pair({required String baseUrl, required String code, String deviceName = 'S24 Plus'}) async {
    if (!isAllowedBackendUrl(baseUrl)) throw ApiException(ApiFailure.badRequest);
    final res = await _send(() => _http.post(
          Uri.parse('$baseUrl/pair'),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({'code': code, 'deviceName': deviceName}),
        ));
    if (res.statusCode != 201) throw ApiException(ApiFailure.unauthorized);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return Session(baseUrl, body['token'] as String);
  }

  Future<JarvisReply> chat(Session s, String text, List<ChatTurn> history, {bool speak = false}) =>
      _post(s, '/chat', {'text': text, 'history': history.map((t) => t.toJson()).toList(), 'speak': speak});

  /// Sends a WAV recording; the reply's [JarvisReply.heard] says what JARVIS understood.
  Future<JarvisReply> voiceChat(Session s, List<int> wav, List<ChatTurn> history, {bool speak = true}) => _post(
        s,
        '/chat/voice',
        {
          'audio': {'mimeType': 'audio/wav', 'data': base64Encode(wav)},
          'history': history.map((t) => t.toJson()).toList(),
          'speak': speak,
        },
        timeout: const Duration(seconds: 90),
      );

  Future<JarvisReply> _post(Session s, String path, Map<String, dynamic> payload, {Duration timeout = _timeout}) async {
    final res = await _send(
      () => _http.post(
        Uri.parse('${s.baseUrl}$path'),
        headers: {'content-type': 'application/json', 'authorization': 'Bearer ${s.token}'},
        body: jsonEncode(payload),
      ),
      timeout: timeout,
    );
    final body = _decode(res.body);
    switch (res.statusCode) {
      case 200:
        return JarvisReply.fromJson(body['reply'] as Map<String, dynamic>, body: body);
      case 401:
        throw ApiException(ApiFailure.unauthorized);
      case 429:
        throw ApiException(ApiFailure.quota, _replyOrNull(body));
      case 400:
        throw ApiException(ApiFailure.badRequest);
      default:
        throw ApiException(ApiFailure.server, _replyOrNull(body));
    }
  }

  Future<http.Response> _send(Future<http.Response> Function() call, {Duration timeout = _timeout}) async {
    try {
      return await call().timeout(timeout);
    } on SocketException {
      throw ApiException(ApiFailure.pcOffline);
    } on TimeoutException {
      throw ApiException(ApiFailure.pcOffline);
    } on http.ClientException {
      throw ApiException(ApiFailure.pcOffline);
    } on HandshakeException {
      throw ApiException(ApiFailure.pcOffline);
    }
  }

  static Map<String, dynamic> _decode(String body) {
    try {
      final d = jsonDecode(body);
      return d is Map<String, dynamic> ? d : <String, dynamic>{};
    } on FormatException {
      return <String, dynamic>{};
    }
  }

  static JarvisReply? _replyOrNull(Map<String, dynamic> body) =>
      body['reply'] is Map<String, dynamic> ? JarvisReply.fromJson(body['reply'] as Map<String, dynamic>) : null;
}
