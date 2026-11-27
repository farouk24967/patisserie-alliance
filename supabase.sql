-- À exécuter une fois dans Supabase > SQL Editor
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to anon, authenticated;

create table public.produits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null check (char_length(nom) between 1 and 80),
  categorie text default '',
  prix numeric check (prix >= 0),
  unite text default 'la pièce',
  description text default '',
  ingredients text default '',
  disponible boolean not null default true,
  visible boolean not null default true,
  photo_url text,
  photo_path text
);
alter table public.produits enable row level security;
revoke all on public.produits from anon, authenticated;
grant select on public.produits to anon, authenticated;
grant insert, update, delete on public.produits to authenticated;

-- Tout le monde voit les produits visibles ; seul l'administrateur modifie.
create policy "lecture" on public.produits for select using (visible or public.is_admin());
create policy "ajout" on public.produits for insert to authenticated with check (public.is_admin());
create policy "modification" on public.produits for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "suppression" on public.produits for delete to authenticated using (public.is_admin());

-- Stockage des photos (lecture publique par lien, 5 Mo maximum)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produits', 'produits', true, 5242880, array['image/jpeg']);

create policy "photos lecture admin" on storage.objects for select to authenticated using (bucket_id = 'produits' and public.is_admin());
create policy "photos ajout" on storage.objects for insert to authenticated with check (bucket_id = 'produits' and public.is_admin());
create policy "photos suppression" on storage.objects for delete to authenticated using (bucket_id = 'produits' and public.is_admin());

-- ===== CATÉGORIES =====
-- (si le début de ce fichier a déjà été exécuté, exécutez seulement cette partie)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null check (char_length(nom) between 1 and 40)
);
create unique index categories_nom on public.categories (lower(nom));
alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy "cat lecture" on public.categories for select using (true);
create policy "cat ajout" on public.categories for insert to authenticated with check (public.is_admin());
create policy "cat modification" on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cat suppression" on public.categories for delete to authenticated using (public.is_admin());

-- Renommer ou supprimer une catégorie met à jour ses produits
create function public.suivre_categorie() returns trigger
language plpgsql set search_path = ''
as $$ begin
  update public.produits set categorie = case when tg_op = 'UPDATE' then new.nom else '' end
  where categorie = old.nom;
  return null;
end $$;
create trigger categories_produits after update of nom or delete on public.categories
for each row execute function public.suivre_categorie();
