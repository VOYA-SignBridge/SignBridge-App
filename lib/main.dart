import 'package:flutter/material.dart';
import 'config/theme.dart';
import 'routes/router.dart';
import 'package:provider/provider.dart';
import 'package:sign_bridge/providers/theme_provider.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ThemeProvider(mode: ThemeMode.system),
      child: Consumer<ThemeProvider>(
        builder: (context, themeProv, child) {
          return MaterialApp.router(
            title: 'SignBridge',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProv.mode,
            routerConfig: AppRouter.router,
            debugShowCheckedModeBanner: false,
          );
        },
      ),
    );
  }
}
