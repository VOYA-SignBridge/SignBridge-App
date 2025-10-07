import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/theme.dart';

class TranslationScreen extends StatelessWidget {
  const TranslationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Home',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppColors.textPrimary),
            onPressed: () {
              context.go('/signin');
            },
          ),
        ],
        backgroundColor: AppColors.background,
      ),
      body: Container(
        color: AppColors.background,
        child: const Center(
          child: Text(
            'Welcome to SignBridge!',
            style: TextStyle(color: AppColors.textPrimary),
          ),
        ),
      ),
    );
  }
}
