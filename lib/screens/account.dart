import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/theme.dart';
import 'package:animated_custom_dropdown/custom_dropdown.dart';
import 'package:provider/provider.dart';
import 'package:sign_bridge/providers/theme_provider.dart';

const List<String> languages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
];

const List<String> signLanguages = ['ASL', 'BSL', 'CSL', 'ISL', 'JSL'];

class AccountScreen extends StatefulWidget {
  final ValueChanged<ThemeMode>? onThemeChanged;

  const AccountScreen({super.key, this.onThemeChanged});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  @override
  Widget build(BuildContext context) {
    final themProv = Provider.of<ThemeProvider>(context);
    final isDarkMode = themProv.mode == ThemeMode.dark;

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
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 20),
              // Title
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: TextStyle(
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                    fontSize: 25,
                  ),
                  children: const <TextSpan>[
                    TextSpan(
                      text: 'SignBridge',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 30,
                      ),
                    ),
                    TextSpan(
                      text: ' by CTU & CSIRO',
                      style: TextStyle(fontWeight: FontWeight.normal),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 10),
              // Subtitle
              Text(
                'An AI-based Sign language translator',
                style: TextStyle(color: const Color(0xFF547CE0), fontSize: 16),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 20),
              // Logos
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset('assets/images/CTU_logo.png', height: 70),
                  const SizedBox(width: 40),
                  Image.asset('assets/images/CSIRO_Logo.svg.png', height: 70),
                ],
              ),

              //Select language
              const SizedBox(height: 30),
              const Divider(thickness: 1),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'App languge',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: CustomDropdown(
                  hintText: 'Select Language',
                  items: languages,
                  initialItem: languages[0],
                  onChanged: (value) {
                    // Handle language change
                  },
                  decoration: CustomDropdownDecoration(
                    closedFillColor: Theme.of(context).cardColor,
                  ),
                ),
              ),

              //select sign language
              const SizedBox(height: 10),
              const Divider(thickness: 1),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Sign languge',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: CustomDropdown(
                  hintText: 'Sign Language',
                  items: signLanguages,
                  initialItem: signLanguages[0],
                  onChanged: (value) {
                    // Handle language change
                  },
                  decoration: CustomDropdownDecoration(
                    closedFillColor: Theme.of(context).cardColor,
                  ),
                ),
              ),

              //toggle dark mode
              const SizedBox(height: 10),
              const Divider(thickness: 1),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Toggle Dark Mode',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Column(
                  children: [
                    SwitchListTile(
                      title: Text(
                        isDarkMode ? 'Dark Mode' : 'Light Mode',
                        style: TextStyle(
                          color: Theme.of(context).textTheme.bodyMedium?.color,
                        ),
                      ),
                      value: isDarkMode,
                      onChanged: (_) {
                        themProv.toggleMode();
                      },
                      activeColor: const Color(0xFF547CE0),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
