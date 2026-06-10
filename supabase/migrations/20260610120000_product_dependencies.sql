-- Sistema de DEPENDÊNCIAS de produtos.
-- Unifica acessórios/descartáveis, itens dependentes (café → copo/garrafa) e o bolo.
-- Cada regra: um GATILHO ativa a inclusão de um PRODUTO do catálogo, numa QUANTIDADE,
-- com CONDIÇÃO e SUBSTITUIÇÃO opcionais. Tudo editável pela tela de Configurações.

CREATE TABLE IF NOT EXISTS product_dependencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                 -- rótulo da regra (ex.: "Café → Garrafa de café")
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,

  -- GATILHO: o que ativa a regra
  --  'always'        → sempre
  --  'has_coffee'    → há bebida marcada como café
  --  'has_cold_drink'→ há bebida fria (água/suco/refri)
  --  'drink'         → bebida específica (trigger_value = id da bebida)
  --  'category'      → categoria presente no cardápio (trigger_value = nome)
  --  'service'       → serviço selecionado (trigger_value = id do serviço)
  --  'material'      → material escolhido (trigger_value = 'Descartável'/'Louça')
  trigger_type  text NOT NULL DEFAULT 'always',
  trigger_value text,

  -- PRODUTO exigido (vem do catálogo — preço/foto reais)
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,

  -- QUANTIDADE
  qty_base          text NOT NULL DEFAULT 'per_person', -- 'per_person'|'per_food_unit'|'per_event'
  qty_factor        numeric NOT NULL DEFAULT 1,         -- fator por pessoa / por evento
  qty_divisor       numeric,                            -- para per_food_unit (1 a cada N unidades)
  rounding_mode     text NOT NULL DEFAULT 'ceil',       -- 'none'|'round'|'ceil'|'floor_multiple'
  rounding_multiple numeric,                            -- para floor_multiple
  plus_per_bolo     boolean NOT NULL DEFAULT false,     -- soma 1 por bolo (ex.: vasilhame)

  -- CONDIÇÃO / SUBSTITUIÇÃO
  condition_material text,                              -- só aplica se material = X
  skip_if_service_id uuid REFERENCES services(id) ON DELETE SET NULL, -- pula se este serviço foi escolhido

  -- BOLO (opcional): escolhe o tamanho pelo resto de pessoas.
  -- { guests_per_large, large_product_id, small_product_id, extra_small_min, extra_large_min }
  cake_rule jsonb,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- RLS: leitura e escrita públicas (ferramenta interna), igual a settings/products.
ALTER TABLE product_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deps_read"   ON product_dependencies;
DROP POLICY IF EXISTS "deps_write"  ON product_dependencies;
CREATE POLICY "deps_read"  ON product_dependencies FOR SELECT USING (true);
CREATE POLICY "deps_write" ON product_dependencies FOR ALL USING (true) WITH CHECK (true);
