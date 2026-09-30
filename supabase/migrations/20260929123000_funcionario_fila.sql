create or replace function public.remover_senha_da_fila(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_perfil text; v_dep uuid;
begin
  select perfil, departamento_id into v_perfil, v_dep from public.perfis_usuarios where user_id = auth.uid() and ativo;
  if v_perfil is null then raise exception 'Sem permissão para remover da fila'; end if;
  update public.senhas set status = 'removida', finished_at = now()
    where id = p_id and status = 'aguardando'
      and (v_perfil in ('admin','recepcionista') or departamento_id = v_dep);
end; $$;
grant execute on function public.remover_senha_da_fila(uuid) to authenticated;
