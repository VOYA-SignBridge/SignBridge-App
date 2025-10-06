import 'package:go_router/go_router.dart';

import '../authentication/signin.dart';
import '../authentication/signup.dart';
import '../home.dart'; 

class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/signin',
    routes: [
      GoRoute(
        path: '/signin',
        builder: (context, state) => const SignInPage(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignUpPage(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomePage(),
      ),
    ],
  );
}
