import 'package:baituna_mobile/router/app_router.dart';
import 'package:baituna_mobile/services/local_storage_service.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  runApp(
    Provider<LocalStorageService>(
      create: (_) => LocalStorageService(),
      child: const BaitunaApp(),
    ),
  );
}

class BaitunaApp extends StatelessWidget {
  const BaitunaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Baituna',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      routerConfig: appRouter,
    );
  }
}
