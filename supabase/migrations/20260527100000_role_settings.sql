-- Cria tabela role_settings com permissões por cargo
-- Usada pelo layout para controlar visibilidade do menu

CREATE TABLE IF NOT EXISTS role_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamp DEFAULT now()
);

-- Admin: acesso total
INSERT INTO role_settings (role, permissions) VALUES (
  'admin',
  '{
    "dashboard_view": true,
    "pipeline_view": true,
    "quotes_view_all": true,
    "catalog_manage": true,
    "logistics_view": true,
    "logs_view": true,
    "users_manage": true,
    "quotes_create": true,
    "quotes_edit": true,
    "quotes_delete": true,
    "clients_manage": true,
    "agent_use": true
  }'::jsonb
) ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Televendas: foco em orçamentos e clientes
INSERT INTO role_settings (role, permissions) VALUES (
  'televendas',
  '{
    "dashboard_view": true,
    "pipeline_view": true,
    "quotes_view_all": false,
    "catalog_manage": false,
    "logistics_view": false,
    "logs_view": false,
    "users_manage": false,
    "quotes_create": true,
    "quotes_edit": true,
    "quotes_delete": false,
    "clients_manage": true,
    "agent_use": true
  }'::jsonb
) ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Escritório: acesso amplo mas sem admin
INSERT INTO role_settings (role, permissions) VALUES (
  'escritorio',
  '{
    "dashboard_view": true,
    "pipeline_view": true,
    "quotes_view_all": true,
    "catalog_manage": true,
    "logistics_view": true,
    "logs_view": true,
    "users_manage": false,
    "quotes_create": true,
    "quotes_edit": true,
    "quotes_delete": true,
    "clients_manage": true,
    "agent_use": true
  }'::jsonb
) ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;
