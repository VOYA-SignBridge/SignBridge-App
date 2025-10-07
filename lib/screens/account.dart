import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/theme.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

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
              context.pushReplacementNamed('/signin');
            },
          ),
        ],
        backgroundColor: AppColors.background,
      ),
      body: Center(
        child: Text(
          "Account Screen",
          style: TextStyle(color: AppColors.textPrimary),
        ),
      ),
    );
  }
}
