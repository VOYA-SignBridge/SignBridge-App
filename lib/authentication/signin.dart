import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});

  @override
  _SignInPageState createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  void _signIn() {
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.primary,
              theme.colorScheme.secondary,
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset(
                    'assets/images/logo.png',
                    height: 200,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'An AI-based Sign Language Translator',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 48),
                  _buildTextField(
                    controller: _emailController,
                    labelText: 'Email',
                    icon: Icons.email,
                    theme: theme,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _passwordController,
                    labelText: 'Password',
                    icon: Icons.lock,
                    obscureText: true,
                    theme: theme,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _signIn,
                    child: const Text('Sign In'),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () {
                      context.go('/signup');
                    },
                    child: const Text(
                      'Don\'t have an account? Sign Up',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String labelText,
    required IconData icon,
    required ThemeData theme,
    bool obscureText = false,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: labelText,
        labelStyle: const TextStyle(color: Colors.white70),
        prefixIcon: Icon(icon, color: Colors.white70),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white70),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: theme.colorScheme.onPrimary),
        ),
        filled: true,
        fillColor: Colors.black.withOpacity(0.1),
      ),
    );
  }
}
