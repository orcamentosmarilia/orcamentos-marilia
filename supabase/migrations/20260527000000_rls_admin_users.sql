-- Protege a tabela admin_users bloqueando acesso via anon key (browser)
-- O login agora passa pela rota /api/login que usa a service_role key (servidor)

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Sem policies = nenhum acesso via anon/authenticated JWT
-- Apenas a service_role key (usada no servidor) bypassa o RLS por padrão
