import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

class LocalStorageService {
  static const _secureStorage = FlutterSecureStorage();

  Future<Box<dynamic>> openSearchCache() => Hive.openBox<dynamic>('search_cache');

  Future<void> saveAccessToken(String token) =>
      _secureStorage.write(key: 'access_token', value: token);
}
