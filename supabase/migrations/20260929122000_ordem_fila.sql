alter table public.senhas add column if not exists ordem integer;
create index if not exists senhas_fila_ordem_idx on public.senhas (departamento_id, dia, status, ordem, numero);
drop function if exists public.chamar_proxima(uuid, text, uuid);
create or replace function public.chamar_proxima(p_departamento uuid, p_guiche text, p_id uuid default null)
returns public.senhas language plpgsql security invoker set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; alvo public.senhas;
begin
 update public.senhas set status='atendida', finished_at=now() where dia=hoje and departamento_id=p_departamento and status='chamada' and guiche=p_guiche;
 if p_id is not null then select * into alvo from public.senhas where id=p_id and status='aguardando';
 else select * into alvo from public.senhas where dia=hoje and departamento_id=p_departamento and status='aguardando' order by ordem nulls last, numero limit 1; end if;
 if alvo.id is null then return null; end if;
 update public.senhas set status='chamada', guiche=p_guiche, called_at=now() where id=alvo.id returning * into alvo;
 return alvo;
end; $$;
grant execute on function public.chamar_proxima(uuid,text,uuid) to anon, authenticated;
