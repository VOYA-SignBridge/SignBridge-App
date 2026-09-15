# Sửa lỗi `.map` trên `undefined`

Stack trace chỉ ra `AlphabetHandTracker.encode` nhận `event.detections === undefined`. JavaScript trước chỉ khai báo type TypeScript rồi gọi `detections.map`, không xác minh payload native. Một APK cũ vẫn gửi `onAlphabetFrame126` với `frame`, `timestampMs`, `handCount` nhưng chưa có `detections`. Metro/Fast Refresh cập nhật JavaScript mà không build/cài lại Kotlin có thể tạo đúng tổ hợp này. Chưa truy cập thiết bị người dùng để xác nhận APK đang cài.

Đã thêm `readAlphabetFrame` kiểm tra dữ liệu tại biên native→JS: danh sách detection, đủ 21 landmark hữu hạn, raw frame 126 số hữu hạn, số tay, timestamp và kích thước ảnh. `encode` cũng từ chối `undefined/null` hoặc payload sai và trả `null`, không biến lỗi thành frame không có tay. Khi nhận payload không tương thích, AlphabetMode hủy prediction đang chờ, xóa buffer/trạng thái và dừng capture; hiện thông báo cài APK mới/build lại Android thay vì crash hoặc log lặp lại. Frame rỗng thật (`detections: []`) vẫn hợp lệ.

14 Node tests đạt; gồm tái hiện payload APK cũ, payload hỏng, payload mới, empty detection, identity và các regression sampling/word. TypeScript và ESLint phần sửa đạt. Model, labels, native Kotlin và word không thay đổi trong bản vá này.

Release ARM64/ARM32 build thành công (1m08s); artifact mới `alphabet-camera-v2.1-arm.apk`. `apk-event-guard.json` ghi SHA và kết quả kiểm tra model/labels trong APK. Source map xác nhận JavaScript chứa đúng hai file đã vá. Bản camera v2 trước đó được giữ nguyên.

Nếu dùng môi trường phát triển, chạy `npm run android` từ gốc workspace để build và cài native mới. Chỉ Reload, Fast Refresh hoặc reset Metro cache không nâng cấp phần Kotlin trong APK.
