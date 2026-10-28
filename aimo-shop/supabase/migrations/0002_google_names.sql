-- Google sign-in provides the display name as `full_name` or `name`. Safe to run after 0001.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'name', ''), 60))
  on conflict (id) do nothing;
  return new;
end $$;
