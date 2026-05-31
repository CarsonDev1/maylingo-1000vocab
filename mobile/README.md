# Maylingo Mobile (Expo)

App học từ vựng cho điện thoại, dùng **chung tài khoản (Clerk) và dữ liệu (Supabase)** với web app `1000vocab`. Build cho mục đích **cá nhân** (không phát hành lên App Store).

## Chạy trên iPhone 13 Pro Max (Expo Go)

1. Trên iPhone, cài app **Expo Go** từ App Store.
2. iPhone và máy tính phải **chung một mạng WiFi**.
3. Trên máy tính, mở terminal tại thư mục này và chạy:
   ```bash
   cd mobile
   npx expo start
   ```
4. Một mã **QR** sẽ hiện ra trong terminal. Mở **Camera** trên iPhone (hoặc app Expo Go) và quét QR → app sẽ mở trong Expo Go.
5. Đăng nhập bằng **cùng email/mật khẩu** đã dùng trên web. (Hoặc bấm "Đăng ký" để tạo tài khoản mới — sẽ cần nhập mã xác thực gửi qua email.)

> Mỗi lần muốn học, cần chạy `npx expo start` trên máy tính (Metro server). Nếu muốn dùng độc lập không cần bật máy tính, có thể chuyển sang **standalone build** sau (cần Apple ID — xem ghi chú dưới).

## Tính năng

- **Học** — danh sách 100 bài (1000 từ), học từ mới bằng flashcard + các dạng bài tập trắc nghiệm/gõ chữ.
- **Ôn tập** — ôn các từ tới hạn theo thuật toán lặp lại ngắt quãng (SRS, giống hệt web).
- **Sổ tay** — tra cứu từ đã học, tìm kiếm + lọc theo mức ghi nhớ, phát âm.
- **Thành tích** — streak, mục tiêu ngày, phân bố mức ghi nhớ, biểu đồ hoạt động.

Toàn bộ tiến độ đồng bộ 2 chiều với web (cùng bảng Supabase, khoá theo Clerk `userId`).

## ⚠️ Bảo mật

File `.env` chứa **service-role key** của Supabase (được nhúng vào bundle JS). Key này có toàn quyền đọc/ghi database và **bỏ qua RLS**. Điều này chấp nhận được vì app chỉ chạy trên máy bạn qua Expo Go. **Tuyệt đối không** publish app này hoặc chia sẻ bản build.

## Kiến trúc

- **Expo Router** (file-based, thư mục `src/app`), **Expo SDK 54** (khớp với Expo Go trên iPhone — Expo Go chỉ chạy đúng 1 SDK).
- **Clerk** (`@clerk/clerk-expo`) — cùng instance với web → chung tài khoản.
- **Supabase** (`@supabase/supabase-js`) — nói chuyện trực tiếp với DB bằng service-role key (mirror `getSupabaseAdmin()` của web). Không cần bật server Next.js.
- Logic SRS (`src/lib/srs.ts`) và sinh bài tập (`src/lib/exercises.ts`) được **port nguyên văn** từ web — giữ đồng bộ khi web thay đổi. Reads/writes ở `src/lib/data.ts` (gộp `queries.ts` + `actions.ts` của web, nhận `userId` làm tham số).
- Âm thanh: `expo-audio`. Hiệu ứng đúng/sai/hoàn thành ở `assets/sfx/`.

## Standalone build (tuỳ chọn, dùng không cần máy tính)

Khi muốn cài app chạy độc lập trên iPhone (không cần Metro), dùng EAS:
```bash
npm i -g eas-cli
eas build -p ios --profile development   # cần đăng nhập Apple ID để ký app
```
Apple ID miễn phí: build hết hạn sau 7 ngày (build lại). Apple Developer ($99/năm): dùng 1 năm.
