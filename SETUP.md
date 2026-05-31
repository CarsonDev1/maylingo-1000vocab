# Lexi — Hướng dẫn chạy

App học từ vựng cá nhân: **Next.js 14 · React 18 · TailwindCSS · shadcn/ui · Clerk · Supabase**.

## 0. Yêu cầu
- Node 18+ (máy bạn đang có v22).
- Tài khoản Clerk + Supabase (đã có key trong `.env.local`).

## 1. Điền nốt key còn thiếu
Mở `.env.local`, dán **Supabase secret key** (`sb_secret_...`) vào:
```
SUPABASE_SECRET_KEY=sb_secret_xxx
```
(Lấy ở Supabase → Project Settings → API Keys → secret.) Các key Clerk + Supabase publishable đã có sẵn.

## 2. Tạo bảng + bucket trong Supabase
Vào Supabase → **SQL Editor** → dán toàn bộ nội dung `supabase/schema.sql` → Run.
(Tạo các bảng courses/lessons/words/user_* + 2 bucket Storage `images`, `audio`.)

## 3. Nạp media + dữ liệu (chạy 1 lần)
```bash
node scripts/upload-to-storage.mjs   # upload 928 ảnh + 1000 mp3 lên Supabase Storage
node scripts/seed-supabase.mjs       # nạp 100 bài học + 1001 từ (dùng URL Storage)
```
> Ảnh/mp3 đã tải sẵn trong `media/`. Nếu chưa có, chạy `node scripts/download-media.mjs` trước.
> `seed` có thể chạy độc lập trước khi upload — khi đó nó tạm dùng URL gốc của nguồn; chạy lại sau khi upload để đổi sang URL Storage.

## 4. Chạy app
```bash
npm run dev      # http://localhost:3000
npm run build && npm start   # bản production
```

## Cấu trúc
- `src/app/(app)/*` — dashboard, lessons, learn, review, notebook, stats, settings (đã bảo vệ bằng Clerk).
- `src/lib/srs.ts` — thuật toán lặp lại ngắt quãng (proficiency 0–9, mức nhớ 1–5).
- `src/lib/queries.ts` / `src/lib/actions.ts` — đọc/ghi Supabase (service-role, giới hạn theo user Clerk).
- `src/components/session/*` — phiên học/ôn + 10 dạng bài tập (`ExerciseView`).
- `scripts/*` — pipeline tải media, upload Storage, seed.
- `data/` — dữ liệu gốc 1001 từ. `media/` — ảnh + mp3 đã tải.

## Ghi chú
- Đã bỏ MochiHub. Leaderboard/Garden để dành phase sau (mang tính nhiều người dùng).
- Đổi mục tiêu học/ngày trong **Cài đặt**.
