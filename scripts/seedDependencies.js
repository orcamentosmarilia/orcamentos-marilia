// Migra produtos de acessório → categoria "Materiais" + material_type, e semeia
// as regras de product_dependencies no formato v2 (depende de produto/categoria).
// Idempotente. Uso: node scripts/seedDependencies.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BOLO_GRANDE = "f659c761-d155-45dd-a40c-63fcb9b5a39f"; // 1,3kg
const BOLO_PEQUENO = "0e5aaec1-8a4c-4051-a934-50f0d282b80b"; // 650g

// Produtos de material (descartáveis) a garantir no catálogo.
const ACCESSORIES = [
  { key: "vasilhame", name: "Vasilhame (descartável)", unit: "unidade", price: 15 },
  { key: "isopor", name: "Copos de isopor", unit: "unidade", price: 0.35 },
  { key: "copo", name: "Copos plásticos 300ml", unit: "unidade", price: 0.4 },
  { key: "guardanapo", name: "Guardanapos", unit: "unidade", price: 0.1 },
  { key: "pazinha", name: "Pazinha", unit: "unidade", price: 0.15 },
  { key: "sachet_acucar", name: "Sachê de açúcar", unit: "unidade", price: 0.15 },
  { key: "sachet_adocante", name: "Sachê de adoçante", unit: "unidade", price: 0.15 },
];

async function ensureProduct(name, unit, price) {
  const { data: ex } = await sb.from("products").select("id").eq("name", name).maybeSingle();
  if (ex) {
    await sb.from("products").update({ category: "Materiais", material_type: "descartavel", is_active: true }).eq("id", ex.id);
    return ex.id;
  }
  const { data, error } = await sb.from("products")
    .insert({ name, category: "Materiais", material_type: "descartavel", unit, unit_price: price, is_active: true })
    .select("id").single();
  if (error) throw new Error(`produto ${name}: ${error.message}`);
  return data.id;
}

async function findProductId(name) {
  const { data } = await sb.from("products").select("id").ilike("name", name).maybeSingle();
  return data?.id || null;
}

async function ensureRule(name, rule) {
  const { data: ex } = await sb.from("product_dependencies").select("id").eq("name", name).maybeSingle();
  if (ex) {
    await sb.from("product_dependencies").update(rule).eq("id", ex.id);
    console.log(`~ regra atualizada: ${name}`);
    return;
  }
  const { error } = await sb.from("product_dependencies").insert({ name, ...rule });
  if (error) throw new Error(`regra ${name}: ${error.message}`);
  console.log(`+ regra criada: ${name}`);
}

(async () => {
  // 1. Produtos de material (categoria Materiais + descartavel)
  const id = {};
  for (const a of ACCESSORIES) {
    id[a.key] = await ensureProduct(a.name, a.unit, a.price);
    console.log(`produto ok (Materiais/descartável): ${a.name}`);
  }

  // Produto "Café" do catálogo (para o "depende de")
  const cafeId = await findProductId("Café");
  console.log("produto Café:", cafeId || "(não encontrado — isopor/sachê não vão depender de nada)");

  // 2. Regras v2 — limpar campos antigos para evitar resíduo
  const base = { trigger_type: "always", trigger_value: null, condition_material: null, skip_if_service_id: null, plus_per_bolo: false, rounding_mode: "ceil" };

  await ensureRule("Vasilhame (1 a cada 100 un. de comida)", {
    ...base, product_id: id.vasilhame, qty_base: "per_food_unit", qty_divisor: 100, rounding_multiple: null,
    depends_on_product_id: null, depends_on_category: null, cake_rule: null, sort_order: 1,
  });
  await ensureRule("Guardanapos (4 por pessoa, múltiplo de 100)", {
    ...base, product_id: id.guardanapo, qty_base: "per_person", qty_factor: 4, rounding_multiple: 100,
    depends_on_product_id: null, depends_on_category: null, cake_rule: null, sort_order: 2,
  });
  await ensureRule("Copos de isopor (1 por pessoa)", {
    ...base, product_id: id.isopor, qty_base: "per_person", qty_factor: 1, rounding_multiple: null,
    depends_on_product_id: cafeId, depends_on_category: null, cake_rule: null, sort_order: 3,
  });
  await ensureRule("Pazinha (1 por evento)", {
    ...base, product_id: id.pazinha, qty_base: "per_event", qty_factor: 1, rounding_multiple: null,
    depends_on_product_id: cafeId, depends_on_category: null, cake_rule: null, sort_order: 4,
  });
  await ensureRule("Sachê de açúcar (0,5 por pessoa)", {
    ...base, product_id: id.sachet_acucar, qty_base: "per_person", qty_factor: 0.5, rounding_multiple: null,
    depends_on_product_id: cafeId, depends_on_category: null, cake_rule: null, sort_order: 5,
  });
  await ensureRule("Sachê de adoçante (0,5 por pessoa)", {
    ...base, product_id: id.sachet_adocante, qty_base: "per_person", qty_factor: 0.5, rounding_multiple: null,
    depends_on_product_id: cafeId, depends_on_category: null, cake_rule: null, sort_order: 6,
  });
  await ensureRule("Copos plásticos (2 por pessoa, múltiplo de 50)", {
    ...base, product_id: id.copo, qty_base: "per_person", qty_factor: 2, rounding_multiple: 50,
    depends_on_product_id: null, depends_on_category: "Bebidas", cake_rule: null, sort_order: 7,
  });
  await ensureRule("Bolo (1 grande/50 pessoas + extra por faixa)", {
    ...base, product_id: null, qty_base: "per_event", qty_factor: 0, rounding_multiple: null,
    depends_on_product_id: null, depends_on_category: null, sort_order: 8,
    cake_rule: { guests_per_large: 50, large_product_id: BOLO_GRANDE, small_product_id: BOLO_PEQUENO, extra_small_min: 13, extra_large_min: 38 },
  });

  console.log("\nSeed v2 concluído.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
