# Video chữ cái trong thư viện

Thư viện có hai mục: **Từ vựng** (QIPEDC hiện tại) và **Chữ cái** (Cloudinary).
Mục chữ cái có đúng 29 chữ cái tiếng Việt, theo thứ tự A, Ă, Â, …, X, Y.
Đây là danh sách học trong thư viện; không thay đổi nhãn của model nhận diện.

## 1. Upload video

Upload 29 file MP4 lên Media Library của Cloudinary dưới loại tài nguyên `video`.
Có thể dùng cloud hiện có `dwdsrtyim` nếu bạn có quyền quản lý, hoặc cloud riêng.
Chỉ chọn cloud bạn có quyền sử dụng; app không cần API key, API secret hay upload preset để phát video public.

Bảng tên gợi ý dưới đây giúp phân biệt các chữ có dấu. Không bắt buộc phải đổi tên
file gốc; điều app sử dụng là **public_id thực tế** sau upload.

| File gốc | Public ID gợi ý |
| --- | --- |
| A.mp4 | signbridge/alphabet/a |
| Ă.mp4 | signbridge/alphabet/a-breve |
| Â.mp4 | signbridge/alphabet/a-circumflex |
| B.mp4 | signbridge/alphabet/b |
| C.mp4 | signbridge/alphabet/c |
| D.mp4 | signbridge/alphabet/d |
| Đ.mp4 | signbridge/alphabet/d-stroke |
| E.mp4 | signbridge/alphabet/e |
| Ê.mp4 | signbridge/alphabet/e-circumflex |
| G.mp4 | signbridge/alphabet/g |
| H.mp4 | signbridge/alphabet/h |
| I.mp4 | signbridge/alphabet/i |
| K.mp4 | signbridge/alphabet/k |
| L.mp4 | signbridge/alphabet/l |
| M.mp4 | signbridge/alphabet/m |
| N.mp4 | signbridge/alphabet/n |
| O.mp4 | signbridge/alphabet/o |
| Ô.mp4 | signbridge/alphabet/o-circumflex |
| Ơ.mp4 | signbridge/alphabet/o-horn |
| P.mp4 | signbridge/alphabet/p |
| Q.mp4 | signbridge/alphabet/q |
| R.mp4 | signbridge/alphabet/r |
| S.mp4 | signbridge/alphabet/s |
| T.mp4 | signbridge/alphabet/t |
| U.mp4 | signbridge/alphabet/u |
| Ư.mp4 | signbridge/alphabet/u-horn |
| V.mp4 | signbridge/alphabet/v |
| X.mp4 | signbridge/alphabet/x |
| Y.mp4 | signbridge/alphabet/y |

Lấy `public_id` từ thông tin asset hoặc kết quả upload. Trong chế độ dynamic
folders, tên folder hiển thị không nhất thiết là đường dẫn trong `public_id`.
Video phải có thể truy cập công khai bằng HTTPS. Mở thử URL Cloudinary trước khi điền cấu hình.

## 2. Điền bảng ánh xạ

Sửa `app/data/alphabetVideoPublicIds.json`, thay `null` bằng `public_id` của chữ tương ứng:

```json
{
  "A": "signbridge/alphabet/a",
  "Ă": "signbridge/alphabet/a-breve",
  "Â": "signbridge/alphabet/a-circumflex"
}
```

Ví dụ trên chỉ minh họa ba mục; giữ đủ 29 khóa trong file thực tế.
Không điền URL đầy đủ, `/v123...`, hoặc phần mở rộng `.mp4` vào public ID.
Chữ chưa upload vẫn để `null` và hiển thị **Chưa có video**.
Các đường dẫn trong bảng là gợi ý, chưa phải video đã được upload.

Nếu dùng cloud riêng, thêm vào `.env`:

```dotenv
EXPO_PUBLIC_ALPHABET_CLOUDINARY_CLOUD_NAME=your-cloud-name
```

Nếu để trống, phần chữ cái dùng cloud hiện có. Cấu hình này không thay đổi URL
Cloudinary dùng cho video từ vựng ở màn hình phiên dịch/trò chuyện.
Sau khi thay `.env`, khởi động lại Metro (`npm start -- --clear`).
Khi phát hành bản cài đặt, build lại bundle ứng dụng để đóng gói bảng ánh xạ mới.

## 3. Phát video

App tạo URL HTTPS từ cloud name + public ID, yêu cầu MP4/H.264 và chất lượng tự động:

```text
https://res.cloudinary.com/<cloud>/video/upload/f_mp4,vc_h264/q_auto/<public_id>.mp4
```

Player phát lặp lại, có điều khiển native, trạng thái tải, lỗi và nút **Thử lại**.
Khi đổi chữ hoặc rời tab, player cũ được giải phóng. Video Cloudinary phát trực tiếp,
không qua bộ tải native QIPEDC. Chưa có chức năng tải/lưu video chữ cái để xem offline.

Nguồn: [Video delivery](https://cloudinary.com/documentation/video_manipulation_and_delivery),
[Public IDs và upload](https://cloudinary.com/documentation/upload_parameters).

## Kiểm tra sau upload

- Mở Thư viện → Chữ cái: có 29 ô, A/Ă/Â và D/Đ riêng biệt.
- Chọn từng chữ và xác nhận nội dung video khớp chữ hiển thị.
- Tìm `Ă`: chỉ ra Ă; tìm `a`: chỉ ra A. Sắp xếp đảo ngược bắt đầu bằng Y.
- Chuyển từ Từ vựng đang lọc Bắc sang Chữ cái: vẫn hiện đủ 29 chữ.
- Video chưa khai báo hiện Chưa có video, không gửi yêu cầu tải.
- URL sai hoặc mất mạng: hiển thị lỗi và thử lại được khi có mạng.
- Đổi chữ/rời tab: video cũ dừng; quay lại tab có thể phát tiếp từ đầu.
- Kiểm tra ít nhất một video chữ cái trên Android và iOS/web nếu hỗ trợ các nền tảng đó.
- Từ vựng vẫn tìm không dấu, lọc vùng và xem video QIPEDC trên Android.

Kiểm tra logic dữ liệu: `node scripts/library/test_library.cjs`.
