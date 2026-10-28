-- Aimo Shop — initial schema, RLS and seed data.
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- Security model: the browser only ever holds the public anon key. Every rule below
-- is enforced by Postgres (RLS), never by client code.

------------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 60),
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Users may read only their own profile. Clients can NEVER change `role`
-- (column-level privilege below), so privilege escalation is impossible from the browser.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''), 60))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by every admin policy. Requires role = admin AND a TOTP-verified
-- session (aal2), so a stolen password alone is never enough.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

------------------------------------------------------------------ products
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  category    text not null check (category in ('ai','num','sub','gift','game','tg')),
  name        text not null check (char_length(name) between 3 and 80),
  price       bigint not null check (price > 0 and price <= 1000000000),
  badge       text check (badge is null or char_length(badge) <= 20),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.products enable row level security;
create policy products_read on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_ins on public.products for insert to authenticated with check (public.is_admin());
create policy products_admin_upd on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_del on public.products for delete to authenticated using (public.is_admin());

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

------------------------------------------------------------------ reviews
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  rating      smallint not null check (rating between 1 and 5),
  body        text not null check (char_length(body) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);
alter table public.reviews enable row level security;
create policy reviews_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy reviews_admin_del on public.reviews for delete to authenticated using (public.is_admin());
revoke update on public.reviews from anon, authenticated;

-- Name is copied from the profile server-side (cannot be spoofed); max 3 reviews per user per day.
create or replace function public.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int; nm text;
begin
  select count(*) into n from public.reviews where user_id = new.user_id and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'review rate limit' using errcode = 'P0001'; end if;
  select full_name into nm from public.profiles where id = new.user_id;
  new.author_name := coalesce(nullif(nm,''), 'کاربر');
  return new;
end $$;
drop trigger if exists reviews_bi on public.reviews;
create trigger reviews_bi before insert on public.reviews
  for each row execute function public.reviews_before_insert();

------------------------------------------------------------------ cart (per user)
create table if not exists public.cart_items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  bigint not null references public.products(id) on delete cascade,
  quantity    int not null check (quantity between 1 and 99),
  updated_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.cart_items enable row level security;
create policy cart_own_select on public.cart_items for select to authenticated using (user_id = auth.uid());
create policy cart_own_insert on public.cart_items for insert to authenticated with check (user_id = auth.uid());
create policy cart_own_update on public.cart_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_own_delete on public.cart_items for delete to authenticated using (user_id = auth.uid());

------------------------------------------------------------------ orders
-- Orders are NOT writable from the browser. They are created only by the server-side
-- function below, which prices items from the products table (never from the client).
create table if not exists public.orders (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete restrict,
  status      text not null default 'awaiting_payment'
              check (status in ('awaiting_payment','paid','cancelled','refunded')),
  total       bigint not null check (total >= 0),
  created_at  timestamptz not null default now()
);
create table if not exists public.order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  product_id  bigint references public.products(id) on delete set null,
  name        text not null,
  unit_price  bigint not null check (unit_price > 0),
  quantity    int not null check (quantity between 1 and 99)
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy orders_own_select on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_upd on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
revoke insert, delete on public.orders, public.order_items from anon, authenticated;
revoke update on public.order_items from anon, authenticated;
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;  -- admin-only via RLS policy above

create or replace function public.create_order_from_cart() returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); oid bigint; tot bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select coalesce(sum(p.price * c.quantity),0) into tot
    from public.cart_items c join public.products p on p.id = c.product_id and p.is_active
   where c.user_id = uid;
  if tot <= 0 then raise exception 'empty cart'; end if;
  insert into public.orders (user_id, total) values (uid, tot) returning id into oid;
  insert into public.order_items (order_id, product_id, name, unit_price, quantity)
    select oid, p.id, p.name, p.price, c.quantity
      from public.cart_items c join public.products p on p.id = c.product_id and p.is_active
     where c.user_id = uid;
  delete from public.cart_items where user_id = uid;
  return oid;
end $$;
-- DISABLED until a real payment gateway exists. When ready, enable with:
--   grant execute on function public.create_order_from_cart() to authenticated;
revoke all on function public.create_order_from_cart() from public, anon, authenticated;

------------------------------------------------------------------ seed products
insert into public.products (category, name, price, badge, sort_order)
select * from (values
  ('ai',  'اشتراک ChatGPT پلاس، اختصاصی',               2450000, 'پرفروش',   1),
  ('num', 'شماره مجازی دائمی',                            695000, null,       2),
  ('num', 'تمدید شماره مجازی دائمی',                      395000, null,       3),
  ('game','اکانت بازی اکشن، ظرفیت اول',                 5200000, 'تحویل آنی', 4),
  ('tg',  'تلگرام پریمیوم، ورود به اکانت',              1050000, null,       5),
  ('tg',  'تلگرام پریمیوم گیفتی',                       3380000, null,       6),
  ('tg',  'استارز تلگرام، بسته ۵۰ عددی',                 218934, null,       7),
  ('gift','گیفت‌کارت ۲۵ دلاری آمریکا',                 4980000, 'پرفروش',   8),
  ('sub', 'اشتراک سالانه فضای ابری ۲ ترابایت',          2150000, null,       9),
  ('sub', 'اشتراک ماهانه موزیک استریم',                   380000, null,      10),
  ('ai',  'اشتراک ابزار تولید تصویر با هوش مصنوعی',     1290000, null,      11),
  ('game','اکانت کنسول، بازی ورزشی',                    3700000, null,      12)
) as v(category, name, price, badge, sort_order)
where not exists (select 1 from public.products);

------------------------------------------------------------------ make the first admin (run manually, once)
-- 1) Sign up on the site with your admin email, confirm the email.
-- 2) In the SQL editor (runs as postgres, so it can edit `role`):
--    update public.profiles set role = 'admin'
--     where id = (select id from auth.users where email = 'YOUR-ADMIN-EMAIL');
-- 3) Open /#admin, enrol TOTP (authenticator app). Admin rights apply only after that (aal2).
