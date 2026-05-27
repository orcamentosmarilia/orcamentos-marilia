-- Supabase Initial Schema for Marília Orçamentos

CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id),
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  role            text NOT NULL CHECK (role IN ('televendas', 'escritorio', 'admin')),
  active          boolean DEFAULT true,
  last_login_at   timestamp,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('salgados','doces','bebidas','servicos','decoracao','outros')),
  unit        text NOT NULL DEFAULT 'unidade',
  base_price  numeric(10,2) NOT NULL,
  description text,
  active      boolean DEFAULT true,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

CREATE TABLE quotes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number      text UNIQUE,
  user_id           uuid REFERENCES users(id) NOT NULL,
  client_name       text NOT NULL,
  client_phone      text,
  event_name        text,
  event_type        text NOT NULL,
  event_date        date NOT NULL,
  event_address     text,
  guests            integer NOT NULL,
  duration_hours    numeric(4,1) NOT NULL,
  period            text NOT NULL,
  services          jsonb DEFAULT '[]',
  beverages         jsonb DEFAULT '[]',
  notes             text,
  ai_prompt_used    text,
  ai_output_raw     text,
  status            text NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','enviado','pago','cancelado')),
  total_value       numeric(10,2),
  pdf_url           text,
  share_token       text UNIQUE,
  share_expires_at  timestamp,
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamp,
  valid_until       date,
  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now()
);

CREATE TABLE quote_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  product_id   uuid REFERENCES products(id),
  description  text NOT NULL,
  quantity     numeric(8,2) NOT NULL,
  unit         text NOT NULL DEFAULT 'unidade',
  unit_price   numeric(10,2) NOT NULL,
  subtotal     numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order   integer DEFAULT 0,
  created_at   timestamp DEFAULT now()
);

CREATE TABLE role_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role         text NOT NULL CHECK (role IN ('televendas', 'escritorio', 'admin')),
  permission   text NOT NULL,
  enabled      boolean DEFAULT true,
  locked       boolean DEFAULT false,
  description  text,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamp DEFAULT now(),
  UNIQUE(role, permission)
);

CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  action       text NOT NULL,
  entity_type  text,
  entity_id    uuid,
  old_value    jsonb,
  new_value    jsonb,
  description  text,
  ip_address   text,
  user_agent   text,
  created_at   timestamp DEFAULT now()
);

CREATE TABLE system_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamp DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Initial RLS Policies
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin_all_users" ON users FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE POLICY "televendas_own_quotes" ON quotes
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND role IN ('escritorio', 'admin')
    )
  );

CREATE POLICY "staff_products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND role IN ('escritorio', 'admin')
    )
  );
  
CREATE POLICY "read_products_all" ON products
  FOR SELECT USING (true); -- everyone can read products for generating quotes

CREATE POLICY "admin_audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND role = 'admin'
    )
  );
  
CREATE POLICY "read_config" ON system_config FOR SELECT USING (true);
CREATE POLICY "admin_config" ON system_config FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE POLICY "quote_items_access" ON quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('escritorio', 'admin')))
    )
  );

CREATE POLICY "read_role_permissions" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "admin_role_permissions" ON role_permissions FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));
