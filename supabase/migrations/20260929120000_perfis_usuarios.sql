create table public.perfis_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  perfil text not null default 'funcionario' check (perfil in ('admin','gerente','funcionario','recepcionista')),
  departamento_id uuid references public.departamentos(id) on delete set null,
  guiche_id uuid references public.guiches(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.perfis_usuarios enable row level security;
create policy "usuario ve o proprio perfil" on public.perfis_usuarios for select to authenticated using (user_id = auth.uid());
create or replace function public.usuario_e_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.perfis_usuarios where user_id = auth.uid() and perfil = 'admin' and ativo); $$;
create policy "admin gerencia perfis" on public.perfis_usuarios for all to authenticated using (public.usuario_e_admin()) with check (public.usuario_e_admin());
grant select on public.perfis_usuarios to authenticated;
grant all on public.perfis_usuarios to service_role;

create or replace function public.remover_senha_da_fila(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_perfil text; v_dep uuid;
begin
  select perfil, departamento_id into v_perfil, v_dep from public.perfis_usuarios
    where user_id = auth.uid() and ativo;
  if v_perfil is null and exists (select 1 from auth.users where id = auth.uid() and lower(email) = lower('pedroguarconi@gmail.com')) then
    v_perfil := 'admin';
  end if;
  if v_perfil is null or v_perfil not in ('admin','gerente','recepcionista') then
    raise exception 'Sem permissão para remover da fila';
  end if;
  update public.senhas set status = 'removida', finished_at = now()
    where id = p_id and status = 'aguardando'
      and (v_perfil in ('admin','recepcionista') or departamento_id = v_dep);
end;
$$;
grant execute on function public.remover_senha_da_fila(uuid) to authenticated;
