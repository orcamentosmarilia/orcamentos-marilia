// Cria os produtos de acessório e semeia as regras de product_dependencies
// espelhando o comportamento atual do quoteCalc. Idempotente.
// Uso: node scripts/seedDependencies.js
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

// Serviços/produtos de bolo já existentes (ids do catálogo).
const SVC_COPO_VIDRO = "afcbcc4f-24c4-4edd-9e0e-17905995a6c4";
const SVC_XICARA = "4f63b70f-25a1-428d-bbb9-1147cdd7bdce";
const BOLO_GRANDE = "f659c761-d155-45dd-a40c-63fcb9b5a39f"; // 1,3kg
const BOLO_PEQUENO = "0e5aaec1-8a4c-4051-a934-50f0d282b80b"; // 650g

// Produtos de acessório a garantir no catálogo (categoria Acessórios).
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
  if (ex) return ex.id;
  const { data, error } = await sb.from("products")
    .insert({ name, category: "Acessórios", unit, unit_price: price, is_active: true })
    .select("id").single();
  if (error) throw new Error(`produto ${name}: ${error.message}`);
  return data.id;
}

async function ensureRule(name, rule) {
  const { data: ex } = await sb.from("product_dependencies").select("id").eq("name", name).maybeSingle();
  if (ex) { console.log(`= regra já existe: ${name}`); return; }
  const { error } = await sb.from("product_dependencies").insert({ name, ...rule });
  if (error) throw new Error(`regra ${name}: ${error.message}`);
  console.log(`+ regra criada: ${name}`);
}

(async () => {
  // 1. Produtos de acessório
  const id = {};
  for (const a of ACCESSORIES) {
    id[a.key] = await ensureProduct(a.name, a.unit, a.price);
    console.log(`produto ok: ${a.name}`);
  }

  // 2. Regras (espelham o quoteCalc atual)
  await ensureRule("Vasilhame (1 a cada 100 un. + 1 por bolo)", {
    trigger_type: "always", product_id: id.vasilhame,
    qty_base: "per_food_unit", qty_divisor: 100, rounding_mode: "ceil", plus_per_bolo: true, sort_order: 1,
  });
  await ensureRule("Guardanapos (4/pessoa, ↓ múltiplo 100)", {
    trigger_type: "always", product_id: id.guardanapo,
    qty_base: "per_person", qty_factor: 4, rounding_mode: "floor_multiple", rounding_multiple: 100, sort_order: 2,
  });
  await ensureRule("Copos de isopor (café, 1/pessoa)", {
    trigger_type: "has_coffee", product_id: id.isopor,
    qty_base: "per_person", qty_factor: 1, rounding_mode: "round",
    skip_if_service_id: SVC_XICARA, sort_order: 3,
  });
  await ensureRule("Pazinha (café, 1 por evento)", {
    trigger_type: "has_coffee", product_id: id.pazinha,
    qty_base: "per_event", qty_factor: 1, rounding_mode: "none", sort_order: 4,
  });
  await ensureRule("Sachê de açúcar (café, 0,5/pessoa)", {
    trigger_type: "has_coffee", product_id: id.sachet_acucar,
    qty_base: "per_person", qty_factor: 0.5, rounding_mode: "ceil", sort_order: 5,
  });
  await ensureRule("Sachê de adoçante (café, 0,5/pessoa)", {
    trigger_type: "has_coffee", product_id: id.sachet_adocante,
    qty_base: "per_person", qty_factor: 0.5, rounding_mode: "ceil", sort_order: 6,
  });
  await ensureRule("Copos plásticos (bebida fria, 2/pessoa, ↓ múltiplo 50)", {
    trigger_type: "has_cold_drink", product_id: id.copo,
    qty_base: "per_person", qty_factor: 2, rounding_mode: "floor_multiple", rounding_multiple: 50,
    condition_material: "Descartável", skip_if_service_id: SVC_COPO_VIDRO, sort_order: 7,
  });
  await ensureRule("Bolo (1 grande/50 pessoas + extra por faixa)", {
    trigger_type: "always", product_id: null,
    qty_base: "per_event", qty_factor: 0, rounding_mode: "none", sort_order: 8,
    cake_rule: {
      guests_per_large: 50, large_product_id: BOLO_GRANDE, small_product_id: BOLO_PEQUENO,
      extra_small_min: 13, extra_large_min: 38,
    },
  });

  console.log("\nSeed de dependências concluído.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
