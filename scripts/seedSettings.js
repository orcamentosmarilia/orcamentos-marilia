// Seed/merge das configurações do sistema na tabela `settings`.
// Idempotente: cria chaves novas e completa campos estendidos SEM sobrescrever
// valores já editados pelo usuário. Lê os defaults de src/lib/settingsDefaults.json
// (mesma fonte que o app). Uso: node scripts/seedSettings.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const defaults = require(path.join(__dirname, "..", "src", "lib", "settingsDefaults.json"));

// Carrega .env.local (Node não faz isso sozinho).
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getValue(key) {
  const { data } = await sb.from("settings").select("value").eq("key", key).single();
  return data ? data.value : undefined;
}

async function upsert(key, value) {
  const { error } = await sb
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`${key}: ${error.message}`);
}

(async () => {
  const log = [];

  // 1. Chaves NOVAS — só inserir se ainda não existem (não sobrescreve edições).
  for (const key of ["quote_form_config", "status_config"]) {
    const existing = await getValue(key);
    if (existing === undefined) {
      await upsert(key, defaults[key]);
      log.push(`+ criada: ${key}`);
    } else {
      log.push(`= mantida: ${key}`);
    }
  }

  // 2. calculation_rules — completa rótulos/peso do bolo se faltarem.
  {
    const cur = (await getValue("calculation_rules")) || defaults.calculation_rules;
    const bolo = { ...defaults.calculation_rules.bolo, ...(cur.bolo || {}) };
    // garante presença dos campos de rótulo/peso (default só preenche o que falta)
    for (const f of ["small_label", "small_weight", "large_label", "large_weight"]) {
      if (bolo[f] === undefined) bolo[f] = defaults.calculation_rules.bolo[f];
    }
    const merged = { ...defaults.calculation_rules, ...cur, bolo };
    await upsert("calculation_rules", merged);
    log.push("~ mesclado: calculation_rules (bolo labels)");
  }

  // 3. drink_mappings — adiciona flags por bebida sem perder entradas customizadas.
  {
    const cur = await getValue("drink_mappings");
    const base = Array.isArray(cur) ? cur : defaults.drink_mappings;
    const byId = Object.fromEntries(defaults.drink_mappings.map((d) => [d.id, d]));
    const merged = base.map((d) => {
      const def = byId[d.id] || {};
      return {
        ...d,
        counts_as_coffee: d.counts_as_coffee ?? def.counts_as_coffee ?? false,
        counts_as_cold_drink: d.counts_as_cold_drink ?? def.counts_as_cold_drink ?? false,
        guests_per_unit: d.guests_per_unit ?? def.guests_per_unit ?? 10,
      };
    });
    await upsert("drink_mappings", merged);
    log.push("~ mesclado: drink_mappings (flags)");
  }

  // 4. Chaves base que devem existir (não sobrescreve se já há valor).
  for (const key of ["modalidade_config", "composition_rules", "pipeline_stages"]) {
    const existing = await getValue(key);
    if (existing === undefined) {
      await upsert(key, defaults[key]);
      log.push(`+ criada: ${key}`);
    } else {
      log.push(`= mantida: ${key}`);
    }
  }

  console.log(log.join("\n"));
  console.log("\nSeed concluído.");
})().catch((e) => {
  console.error("ERRO no seed:", e.message);
  process.exit(1);
});
