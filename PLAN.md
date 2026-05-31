# Plan — App học từ vựng cá nhân (MochiDemy clone)

> Xây lại **chức năng** học/ôn từ vựng của MochiDemy thành app cá nhân của bạn — code gốc của riêng mình (không sao chép source/logo/thương hiệu của họ), bỏ **MochiHub**. Dùng đúng dữ liệu (1001 từ) + mp3 + ảnh đã trích xuất.

## 1. Phạm vi

**Core (làm trước):**
- Dashboard: tiến độ khóa, streak, số từ cần ôn hôm nay, nút **Học từ mới** / **Ôn tập**.
- Danh sách 100 bài học theo chủ đề (en + vi), tiến độ từng bài.
- **Học từ mới**: giới thiệu từ theo lô (flashcard) → luyện qua các dạng bài tập.
- **Ôn tập (SRS)**: gom từ tới hạn → luyện → cập nhật độ thành thạo.
- 10 dạng bài tập (xem mục 6).
- **Sổ tay**: danh sách từ đã học theo 5 mức nhớ, tìm kiếm/lọc, phát âm.
- **Thành tích**: biểu đồ độ thành thạo, lịch streak, tổng từ đã học/ôn.
- Streak hằng ngày + mục tiêu.
- Đăng nhập (Clerk), hồ sơ/cài đặt.

**Tùy chọn (phase 2):** Leaderboard/Rank, Garden/Plant (mang tính xã hội/đa người dùng — ít ý nghĩa cho 1 người; sẽ làm bản đơn giản hóa nếu bạn muốn).

**Bỏ:** MochiHub.

## 2. Tech stack (ghim phiên bản)

- **Next.js 14** (App Router, TypeScript, thư mục `src/`)
- **React 18**
- **TailwindCSS** + **shadcn/ui**
- **Clerk** — xác thực
- **Supabase** — Postgres (data) + Storage (mp3 + ảnh)
- Phụ trợ: `@supabase/supabase-js`, `lucide-react`, `recharts` (biểu đồ thống kê), `zod`.

## 3. Kiến trúc

- **App Router** với 2 nhóm route: `(auth)` cho đăng nhập, `(app)` cho phần đã đăng nhập (bảo vệ bằng Clerk middleware).
- **Truy cập dữ liệu**: Server Actions / Route Handlers gọi Supabase bằng **service-role key (chỉ chạy ở server)**, mọi truy vấn được giới hạn theo `userId` của Clerk trong code. (Đơn giản & an toàn hơn cấu hình RLS-qua-JWT cho app cá nhân; vẫn kèm sẵn policy RLS tùy chọn.)
- **Nội dung từ vựng** (lessons/words) seed sẵn vào Supabase; **tiến độ học** lưu theo từng user.
- **Phiên học** là client component giữ state, gọi server action `submitAnswer` sau mỗi câu.

## 4. Cấu trúc thư mục (dự kiến)

```
src/
  app/
    (auth)/sign-in, sign-up
    (app)/
      layout.tsx           # sidebar + topbar (streak, avatar)
      page.tsx             # dashboard
      lessons/page.tsx
      learn/[lessonId]/page.tsx   # phiên học từ mới
      review/page.tsx             # phiên ôn tập SRS
      notebook/page.tsx           # sổ tay
      stats/page.tsx              # thành tích
      settings/page.tsx
    api/...               # route handlers nếu cần
  components/
    ui/                   # shadcn
    exercises/            # 10 dạng bài tập
    session/              # khung phiên học/ôn
    layout/, charts/, word/
  lib/
    supabase/server.ts    # client service-role (server-only)
    srs.ts                # thuật toán SRS
    actions/              # server actions
    audio.ts, utils.ts
  types/
data/                     # JSON/CSV gốc (đã có)
media/                    # ảnh + mp3 tải về (bước pipeline)
scripts/                  # download media, upload storage, seed
supabase/                 # schema.sql, policies.sql
```

## 5. Mô hình dữ liệu (Supabase Postgres)

- `courses(id, title_vi, title_en, ...)`
- `lessons(id, course_id, sort, title_en, title_vi, code)`
- `words(id, lesson_id, term, pos, phonetic_uk, phonetic_us, meaning_vi, meaning_en/ja/ko/th/zh, example_en, example_vi, audio_url, audio_sentence_url, image_url)`
- `user_word_progress(user_id, word_id, proficiency 0-9, memory_level 1-5, ease, interval_days, due_at, last_reviewed_at, correct_count, wrong_count, status, first_learned_at)` — khóa chính `(user_id, word_id)`; index `(user_id, due_at)`.
- `user_streaks(user_id, current_streak, longest_streak, last_active_date, daily_goal)`
- `user_daily_activity(user_id, activity_date, words_learned, words_reviewed, xp)` — unique theo ngày.
- `user_settings(user_id, ...)`

## 6. Các dạng bài tập (client tự sinh 3 đáp án nhiễu từ các từ khác)

1. **Flashcard** — lật thẻ: mặt trước từ + ảnh + audio + phiên âm; mặt sau nghĩa + ví dụ.
2. **Chọn nghĩa đúng** (từ → nghĩa VI, 4 lựa chọn).
3. **Chọn từ đúng** (nghĩa VI → từ EN, 4 lựa chọn).
4. **Chọn phiên âm đúng**.
5. **Chọn hình đúng** (4 ảnh).
6. **Điền từ vào chỗ trống – chọn** (câu ví dụ khuyết từ, 4 lựa chọn).
7. **Điền từ vào chỗ trống – gõ** (nhập text, so khớp linh hoạt).
8. **Nghe & chọn** (phát audio → chọn từ/nghĩa).
9. **Nghe & viết** (phát audio → gõ lại).
10. **Chọn nghĩa của từ gạch chân trong câu**.

Mỗi câu trả lời cập nhật `proficiency`/`memory_level`/`interval`/`due_at` theo SRS.

## 7. Thuật toán SRS (mô phỏng MochiDemy)

- `proficiency` 0–9; `memory_level` 1–5 (map từ proficiency để hiển thị Sổ tay).
- Từ mới: học xong → vào hệ thống với interval ngắn (`first_review`).
- Trả lời **đúng** → tăng proficiency, nhân interval theo ease (kiểu SM-2 rút gọn); **sai** → giảm proficiency, reset interval ngắn.
- `due_at = last_reviewed_at + interval`; "đến hạn" khi `now >= due_at`. "Cảnh báo (is_warning)" khi quá hạn lâu.
- Hàm thuần, có test: `scheduleNew(now)`, `reviewWord(state, result)`, `isDue(state, now)`.

## 8. Pipeline dữ liệu (bao gồm TẢI ẢNH như bạn yêu cầu)

1. Đọc `data/mochidemy_1000_vocab.json`.
2. **Tải toàn bộ ảnh** (`picture`) **và mp3 phát âm** (`audio_word`) của ~1001 từ về `media/images/` và `media/audio/` (đặt tên theo `word id`, có retry, bỏ qua file đã tải, giới hạn song song). Thử resolve thêm mp3 câu ví dụ (`audio_sentence`).
3. Upload media lên **Supabase Storage** (bucket `images`, `audio`) → lấy public URL.
4. Sinh **seed** đổ `courses/lessons/words` vào Supabase với URL Storage.

## 9. Cần BẠN cung cấp (mình không tạo hộ tài khoản được)

- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (tạo app tại dashboard.clerk.com).
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (tạo project tại supabase.com).

Mình sẽ scaffold sẵn `.env.local.example` + script tự động (chạy schema, tải media, upload, seed) để bạn chỉ việc dán key và chạy.

## 10. Lộ trình

- **P0 — Scaffold**: Next 14 + Tailwind + shadcn + Clerk + Supabase client, layout, env mẫu.
- **P1 — Dữ liệu**: schema SQL, tải ảnh+mp3, upload Storage, seed.
- **P2 — Học/Ôn lõi**: SRS lib, server actions, khung phiên, 10 dạng bài tập, dashboard, lessons.
- **P3 — Sổ tay + Thành tích + Streak**.
- **P4 — Hoàn thiện**: settings, responsive, âm thanh, animation, polish; (tùy chọn) Garden/Leaderboard.

## 11. Trạng thái

- [x] Trích xuất 1001 từ + mp3 URL + ảnh URL (đã có trong `data/`).
- [ ] P0 scaffold → đang bắt đầu.
