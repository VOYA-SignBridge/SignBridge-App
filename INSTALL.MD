# Cài đặt và chạy SignBridge trên Android

Mở terminal tại thư mục gốc dự án (nơi có `package.json`). Tất cả lệnh bên dưới chạy từ thư mục này; đường dẫn `./` hoặc `.\` lấy thư mục gốc dự án làm mốc.

## 1. Chuẩn bị lần đầu

- Cài Node.js phù hợp với dự án, JDK và Android SDK để build Android.
- SDK cần có Platform-Tools (ADB), SDK Platform, Build-Tools, NDK và CMake mà Gradle yêu cầu. Không cần cài máy giả lập nếu dùng điện thoại thật.
- Trên điện thoại: bật **Developer options → USB debugging**.
- Dùng cáp có truyền dữ liệu. Không dùng Expo Go để kiểm tra các module camera/AI native của dự án.

### Biến môi trường Windows

Trong **Edit environment variables for your account → User variables**:

| Biến | Giá trị với SDK cài ở vị trí mặc định |
| --- | --- |
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |
| Thêm một dòng vào `Path` | `%ANDROID_HOME%\platform-tools` |

Nếu SDK ở vị trí khác, dùng đường dẫn thực tế. Không xóa hoặc thay thế các dòng `Path` đang có. Nếu `ANDROID_SDK_ROOT` đã được đặt, giữ nó trỏ cùng SDK với `ANDROID_HOME`.

Đóng toàn bộ editor rồi mở lại để nhận biến mới. Kiểm tra:

```powershell
echo $env:ANDROID_HOME
adb version
java -version
node --version
npm --version
```

Muốn dùng ngay trong một terminal mà chưa lưu biến Windows:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
```

Hai dòng trên chỉ áp dụng cho terminal hiện tại. `JAVA_HOME`, nếu cần cấu hình, phải trỏ đến thư mục JDK tương thích với Gradle của dự án.

### Dependencies và cấu hình app

```powershell
npm install
```

- `.env.example` là file mẫu, không phải chương trình để chạy. Không chép đè `.env` đang có.
- `src/config.ts` đọc `EXPO_PUBLIC_API_URL` và `EXPO_PUBLIC_WS_BASE`. Nếu không khai báo, app dùng backend đã triển khai tại `https://se.cit.ctu.edu.vn/signbridge/api/v1` và WebSocket `wss://se.cit.ctu.edu.vn/signbridge`.
- Nếu khai báo hai biến trên, phải điền địa chỉ thật; không giữ địa chỉ placeholder trong `.env.example`. Muốn dùng mặc định thì bỏ hai biến này, không đặt thành chuỗi rỗng.
- Các biến database, Redis, JWT của backend không làm backend tự khởi động khi chạy app. Không cần chạy backend local khi dùng dịch vụ đã triển khai.
- Đăng nhập hiện dùng Supabase trong `app/db/supabase.ts`; các biến Supabase trong file mẫu chưa được module này đọc.
- Model nhận diện chạy trên Android. Ghép câu hiện tắt qua `SENTENCE_BUILDING_AVAILABLE = false`, nên chưa cần khởi động Ollama.
- Biến `EXPO_PUBLIC_*` có thể được đóng gói vào app: không đặt mật khẩu database hoặc khóa bí mật backend vào các biến này.

## 2. Build và cài app lần đầu bằng cáp

1. Cắm điện thoại, mở khóa màn hình.
2. Chấp nhận **Allow USB debugging**, có thể chọn **Always allow from this computer**.
3. Kiểm tra:

```powershell
adb devices -l
```

Kết quả cần có số serial cùng trạng thái `device`. Khi chỉ có một điện thoại được kết nối và không có emulator khác, chạy:

```powershell
npm run android
```

Lệnh build, cài và mở app; có thể mở Metro ở cửa sổ riêng. Giữ cáp và Internet trong lúc build lần đầu. Gradle có thể tải JDK, SDK/NDK hoặc dependencies.

**Metro báo `Dev server ready` chỉ xác nhận Metro đã sẵn sàng.** Chờ terminal build báo `BUILD SUCCESSFUL`, cài thành công và app mở được trên điện thoại. Cho phép camera khi app hỏi.

Giữ Metro chạy. Nếu Metro chưa khởi động, mở terminal khác tại thư mục dự án và chạy `npm start`. Không mở thêm Metro khi đã có phiên dùng cổng 8081.

## 3. Chọn cách kết nối khi lập trình

Hai cách chỉ khác ở kết nối ADB và chuyển tiếp cổng Metro. Sau khi kết nối, sửa `.tsx`/`.ts`/`.js`, lưu file để Fast Refresh cập nhật.

| | Cáp USB | Wi-Fi riêng |
| --- | --- | --- |
| Cần cùng mạng | Không | Có, mạng phải cho hai thiết bị kết nối với nhau |
| Chọn thiết bị ADB | `-d` | `-s IP:5555` |
| Cáp khi làm việc | Giữ cắm | Rút sau khi thiết lập |
| Khi dùng Wi-Fi công cộng | Ưu tiên cách này | Tránh bật ADB TCP/IP trên mạng công cộng |

### A. Dùng cáp USB

Cắm cáp. Nếu trước đó dùng ADB Wi-Fi, chuyển về USB:

```powershell
adb -d usb
```

Đợi vài giây rồi chạy:

```powershell
adb disconnect
adb -d reverse tcp:8081 tcp:8081
adb devices -l
```

Nếu có bật **Wireless debugging** trong Developer options, tắt tùy chọn đó khi dùng mạng công cộng. `adb disconnect` chỉ ngắt kết nối phía máy tính, không tự tắt mọi chế độ gỡ lỗi không dây trên điện thoại.

Nếu Metro chưa chạy, tại thư mục dự án chạy:

```powershell
npm start -- --localhost
```

Tùy chọn `--localhost` giới hạn Metro ở máy tính; app truy cập qua cáp nhờ `adb reverse`. Nếu chuyển từ Metro đang nghe trên mạng LAN sang cách này, dừng Metro cũ bằng Ctrl+C trước.

Mở app đã cài. Giữ cáp và Metro trong suốt phiên làm việc. Các chức năng Supabase/backend vẫn cần Internet nhưng kết nối phát triển đi qua USB.

### B. Dùng Wi-Fi riêng sau khi thiết lập bằng cáp

Cho điện thoại và máy tính vào cùng mạng riêng. Lúc này **vẫn cắm cáp**, chạy:

```powershell
adb -d shell ip route
```

Lấy IP sau chữ `src` ở dòng của Wi-Fi (`wlan0` hoặc giao diện tương ứng). Ví dụ:

```text
192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.25
```

IP điện thoại trong ví dụ là `192.168.1.25`. Có thể xem IP trong chi tiết mạng Wi-Fi trên điện thoại.

Bật ADB TCP/IP khi cáp còn cắm:

```powershell
adb -d tcpip 5555
```

**Rút cáp**, rồi chạy các lệnh sau, thay IP ví dụ bằng IP điện thoại:

```powershell
adb connect 192.168.1.25:5555
adb -s 192.168.1.25:5555 reverse tcp:8081 tcp:8081
adb devices -l
```

Kết quả cần có `192.168.1.25:5555 device`. Giữ Metro chạy, mở app đã cài. Nếu Metro chưa chạy:

```powershell
npm start
```

Không cần bật thêm tùy chọn **Wireless debugging** để dùng cách `tcpip 5555` này.

### Buổi làm việc tiếp theo hoặc đổi mạng

- **USB:** cắm cáp và chạy lại `adb -d reverse tcp:8081 tcp:8081`; khởi động Metro nếu đã tắt.
- **Wi-Fi:** xem IP mới của điện thoại rồi chạy lại `adb connect IP:5555` và `adb -s IP:5555 reverse tcp:8081 tcp:8081`. Thay `IP` bằng địa chỉ thật.
- Không cần build/cài lại app chỉ vì đổi mạng hoặc đổi cách kết nối.
- Sau khi khởi động lại điện thoại, ADB TCP/IP có thể tắt: cắm cáp và thực hiện lại bước bật `tcpip 5555`.
- Mạng công cộng có thể chặn kết nối giữa thiết bị. Khi đó dùng cáp theo cách A.

## 4. Khi nào cần build lại?

| Thay đổi | Thao tác |
| --- | --- |
| UI, style, logic `.tsx`/`.ts`/`.js` | Lưu file; Fast Refresh cập nhật khi app kết nối Metro |
| `.env` | Dừng Metro, khởi động lại rồi reload app; nếu dùng release, build và cài lại |
| `.pte`, `.tflite`, nhãn hoặc `tflite_models.json` trong Android assets | Build và cài lại APK |
| Kotlin/Java, Gradle, manifest hoặc dependencies native | Build và cài lại APK |

Với `tflite_models.json`, tên file không giới hạn runtime chỉ ở TFLite; kiểm tra cấu hình model thực tế trước khi thay. Model mới cần đúng runtime, input/output, tiền xử lý và thứ tự nhãn. Build thành công không chứng minh nhận diện đúng.

Nếu Fast Refresh không hoạt động, mở Dev Menu bằng cách lắc điện thoại hoặc:

```powershell
# USB
adb -d shell input keyevent 82

# Hoặc Wi-Fi: thay IP ví dụ bằng IP thật
adb -s 192.168.1.25:5555 shell input keyevent 82
```

Chọn **Enable Fast Refresh** nếu đang tắt; nếu hiện **Disable Fast Refresh** thì đã bật. Có thể nhấn `r` trong cửa sổ Metro để reload.

## 5. Xuất APK và cài thủ công, không cần cắm điện thoại để build

### Debug: dùng khi lập trình, có Fast Refresh

```powershell
.\android\gradlew.bat -p .\android :app:assembleDebug
```

APK sau khi build thành công:

```text
.\android\app\build\outputs\apk\debug\app-debug.apk
```

Gửi file sang điện thoại, mở APK và chọn Cài đặt/Cập nhật. Cấp quyền cài ứng dụng từ nguồn này nếu Android hỏi. Hoặc dùng ADB:

```powershell
# USB
adb -d install -r ".\android\app\build\outputs\apk\debug\app-debug.apk"

# Hoặc Wi-Fi: thay IP ví dụ bằng IP thật
adb -s 192.168.1.25:5555 install -r ".\android\app\build\outputs\apk\debug\app-debug.apk"
```

Chỉ chọn một cách cài. Sau khi cài debug, kết nối Metro theo mục 3 để chạy và dùng Fast Refresh. Cài APK thủ công không tự thiết lập `adb reverse`.

### Release: chạy độc lập với Metro, không có Fast Refresh

```powershell
$env:NODE_ENV = 'production'
.\android\gradlew.bat -p .\android :app:assembleRelease
Remove-Item Env:NODE_ENV
```

Dòng cuối bỏ biến `NODE_ENV` vừa đặt trong terminal để không ảnh hưởng phiên dev tiếp theo.

APK sau khi build thành công:

```text
.\android\app\build\outputs\apk\release\app-release.apk
```

Release đóng gói code JavaScript vào app. Muốn cập nhật UI, logic hoặc model phải build và cài lại. Chức năng online vẫn cần mạng.

Cấu hình release hiện dùng khóa ký debug trong `android/app/build.gradle`: chỉ dùng để thử nội bộ, cần cấu hình khóa ký riêng trước khi phát hành chính thức.

## 6. Lỗi thường gặp và dung lượng ổ C

| Hiện tượng | Cách xử lý |
| --- | --- |
| `adb is not recognized` | Kiểm tra `ANDROID_HOME`, thêm `platform-tools` vào Path và mở lại editor |
| `unauthorized` | Mở khóa điện thoại, chấp nhận hộp thoại USB debugging; nếu không hiện, thu hồi quyền USB debugging rồi kết nối lại |
| Danh sách thiết bị trống | Kiểm tra cáp truyền dữ liệu, cổng USB, USB debugging và driver của hãng nếu cần |
| `more than one device/emulator` | Với ADB dùng `-d` hoặc `-s SERIAL`; trước `npm run android`, ngắt thiết bị/emulator không dùng để chỉ còn một đích |
| Không kết nối được Metro | Kiểm tra Metro ở cổng 8081, chạy lại `reverse` cho đúng thiết bị, rồi reload |
| Metro đã chạy, Gradle vẫn tải toolchain | Chờ build; trạng thái Metro không phải kết quả build Android |
| `BUILD FAILED` | Đọc phần `What went wrong` và lỗi liên quan, không kết luận từ riêng cảnh báo `deprecated` |
| Cài APK báo khác chữ ký | Không gỡ app vội vì sẽ mất dữ liệu cục bộ; dùng APK có cùng khóa ký hoặc sao lưu trước khi đổi bản |

Dù dự án ở ổ khác, các thư mục mặc định sau vẫn có thể chiếm nhiều dung lượng ổ hệ thống. Ký hiệu `%...%` bên dưới là biến môi trường Windows, có thể dán vào thanh địa chỉ File Explorer:

- Android SDK/NDK: `%LOCALAPPDATA%\Android\Sdk`.
- Cache, Gradle Wrapper và JDK tải tự động: `%USERPROFILE%\.gradle` (hoặc vị trí được đặt bằng `GRADLE_USER_HOME`).
- Dữ liệu máy giả lập mặc định: `%USERPROFILE%\.android\avd`.

Nếu chỉ dùng điện thoại thật, có thể xóa máy giả lập không dùng trong Device Manager và gỡ system images không dùng trong SDK Manager. Không xóa SDK/NDK/cache trong lúc build. Xóa cache Gradle sẽ khiến lần build sau phải tải/tạo lại; đổi `ANDROID_HOME` không tự di chuyển SDK sang ổ khác.

## Tài liệu tham khảo

- [Android Debug Bridge](https://developer.android.com/tools/adb)
- [Build Android bằng dòng lệnh](https://developer.android.com/build/building-cmdline)
- [React Native: kết nối điện thoại với Metro](https://reactnative.dev/docs/0.81/running-on-device)
- [React Native: Fast Refresh](https://reactnative.dev/docs/fast-refresh)
