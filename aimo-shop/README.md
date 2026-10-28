# آیمو شاپ — Vite + Supabase + Vercel

نسخه اصلی HTML در `original/index.original.html` حفظ شده است.

## وضعیت
**هنوز آماده فروش واقعی نیست.** Build و تست‌های امنیتی/ورود هنوز اجرا نشده‌اند (فهرست زیر را ببینید).

## راه‌اندازی Supabase
1. پروژه بسازید؛ در SQL Editor فایل `supabase/migrations/0001_init.sql` را یک‌بار اجرا کنید.
2. Authentication → Providers → Email: فعال؛ **Confirm email** روشن؛ حداقل طول رمز ۸ (ترجیحاً ۱۲) و گزینه‌های رمز قوی.
3. Authentication → URL Configuration: `Site URL` = دامنه Vercel؛ در `Redirect URLs` دامنه اصلی، دامنه preview و `http://localhost:5173` را اضافه کنید.
4. Authentication → Sign In / Providers → **MFA (TOTP)** را فعال کنید (برای ورود مدیر الزامی است).
5. Authentication → Rate Limits و CAPTCHA (hCaptcha/Turnstile) را برای signup/sign-in روشن کنید؛ SMTP اختصاصی تنظیم کنید.
6. ساخت اولین مدیر: با ایمیل مدیر ثبت‌نام و تایید کنید، سپس در SQL Editor:
   `update public.profiles set role='admin' where id=(select id from auth.users where email='ایمیل-مدیر');`
7. ورود با گوگل: در Google Cloud یک OAuth Client (Web) بسازید؛ در Supabase → Authentication → Providers → Google فعال و Client ID/Secret را همان‌جا وارد کنید؛ آدرس callback نمایش‌داده‌شده را در Authorized redirect URIs گوگل بگذارید. فایل `0002_google_names.sql` را هم اجرا کنید.
8. Project Settings → API: فقط `Project URL` و کلید `anon/publishable` را بردارید. **service_role / secret را هرگز در Vercel با پیشوند VITE_ یا در کد نگذارید.**

## راه‌اندازی Vercel
- Framework: Vite — Install: `npm ci` (ابتدا یک‌بار `npm install` و commit کردن `package-lock.json`) — Build: `npm run build` — Output: `dist`
- Environment Variables (Production و Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- هدرهای امنیتی و CSP در `vercel.json` هستند. اگر از دامنه سفارشی Supabase استفاده می‌کنید، `connect-src` را به‌روز کنید.

## پرداخت
غیرفعال است (`PAYMENTS_ENABLED=false` و تابع `create_order_from_cart` برای کاربران بسته است). فقط پس از اتصال درگاه و تایید سمت سرور (webhook) فعال شود.

## تست‌های لازم قبل از فروش
- ثبت‌نام/تایید ایمیل/ورود/خروج/بازیابی رمز
- کاربر عادی: خواندن `profiles.role` ممکن است اما تغییر آن، نوشتن در `products`، `orders` و حذف نظر باید خطا بدهد
- مدیر بدون TOTP نباید بتواند محصول ذخیره کند؛ با TOTP باید بتواند
- سبد: افزودن به‌صورت مهمان، ورود، ادغام، ورود از دستگاه دیگر
- `npm run build` موفق و اسکن `dist` (اجرا خودکار در postbuild)
