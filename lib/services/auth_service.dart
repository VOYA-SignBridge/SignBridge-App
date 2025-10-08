class AuthService {
  Future<bool> signIn(String email, String password) async {
    // Sau này thay bằng gọi API hoặc Firebase
    await Future.delayed(const Duration(seconds: 1));
    return email.isNotEmpty && password.isNotEmpty;
  }

  Future<bool> signUp(
    String email,
    String password,
    String confirmPassword,
  ) async {
    await Future.delayed(const Duration(seconds: 1));
    return password == confirmPassword && email.isNotEmpty;
  }
}
