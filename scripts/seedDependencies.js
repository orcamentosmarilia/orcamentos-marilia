// Garante os produtos de material (Materiais/descartável) e escreve a REGRA EM TEXTO
// de cada material em product_dependencies.rule_text. Idempotente (atualiza por nome).
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

const BOLO_GRANDE = "f659c761-d155-45dd-a40c-63fcb9b5a39f"; // 1,3kg

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

// Atualiza (ou cria) a regra por NOME, gravando product_id + rule_text.
async function ensureRule(name, product_id, rule_text, sort_order) {
  const payload = { name, product_id, rule_text, sort_order, trigger_type: "always", active: true };
  const { data: ex } = await sb.from("product_dependencies").select("id").eq("name", name).maybeSingle();
  if (ex) {
    await sb.from("product_dependencies").update(payload).eq("id", ex.id);
    console.log(`~ regra: ${name}`);
  } else {
    const { error } = await sb.from("product_dependencies").insert(payload);
    if (error) throw new Error(`regra ${name}: ${error.message}`);
    console.log(`+ regra: ${name}`);
  }
}

(async () => {
  const id = {};
  for (const a of ACCESSORIES) { id[a.key] = await ensureProduct(a.name, a.unit, a.price); }
  console.log("produtos de material ok (Materiais/descartável).");

  await ensureRule("Vasilhame (descartável)", id.vasilhame,
    "1 unidade a cada 100 unidades de comida do cardápio.", 1);
  await ensureRule("Guardanapos", id.guardanapo,
    "4 por pessoa, arredondando para baixo ao múltiplo de 100.", 2);
  await ensureRule("Copos de isopor", id.isopor,
    "1 por pessoa, somente quando houver café no orçamento.", 3);
  await ensureRule("Pazinha", id.pazinha,
    "1 por evento, somente quando houver café.", 4);
  await ensureRule("Sachê de açúcar", id.sachet_acucar,
    "1 a cada 2 pessoas (0,5 por pessoa), somente quando houver café.", 5);
  await ensureRule("Sachê de adoçante", id.sachet_adocante,
    "1 a cada 2 pessoas (0,5 por pessoa), somente quando houver café.", 6);
  await ensureRule("Copos plásticos 300ml", id.copo,
    "2 por pessoa, arredondando para baixo ao múltiplo de 50. Somente quando houver bebida fria (água/suco/refrigerante) e o material do evento for Descartável.", 7);
  await ensureRule("Bolo", BOLO_GRANDE,
    "1 bolo grande (1,3kg) a cada 50 pessoas. Se sobrarem 13 a 37 pessoas, adicione 1 bolo pequeno (650g); se sobrarem 38 ou mais, adicione mais 1 bolo grande.", 8);

  // Remove regras antigas com nomes anteriores (limpeza de duplicatas).
  const KEEP = ["Vasilhame (descartável)","Guardanapos","Copos de isopor","Pazinha","Sachê de açúcar","Sachê de adoçante","Copos plásticos 300ml","Bolo"];
  const { data: all } = await sb.from("product_dependencies").select("id,name");
  const stale = (all || []).filter(r => !KEEP.includes(r.name));
  if (stale.length) { await sb.from("product_dependencies").delete().in("id", stale.map(r => r.id)); console.log("removidas regras antigas:", stale.map(r=>r.name).join(", ")); }

  console.log("\nSeed v3 (texto) concluído.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
