-- Cria o perfil administrativo para o usuário informado.
-- O usuário precisa existir previamente em Authentication > Users.
insert into public.perfis_usuarios (user_id, nome, perfil, ativo)
select id, 'Pedro Guarconi', 'admin', true
from auth.users
where lower(email) = lower('pedroguarconi@gmail.com')
on conflict (user_id) do update
set nome = excluded.nome,
    perfil = 'admin',
    ativo = true,
    updated_at = now();
