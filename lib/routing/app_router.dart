import 'package:go_router/go_router.dart';
import '../screens/signin.dart';
import '../screens/signup.dart';
import '../screens/home.dart';

class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/signin',
    routes: [
      GoRoute(
        path: '/signin',
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignUpScreen(),
      ),
      GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
    ],
  );
}
