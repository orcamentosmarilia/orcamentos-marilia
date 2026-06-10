// Reset de dados transacionais: apaga orçamentos e clientes para começar do zero.
// PRESERVA catálogo (products/services), categorias, bairros/taxas, usuários,
// cargos e TODAS as configurações (settings/system_config).
// Uso: node scripts/resetData.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALL = "00000000-0000-0000-0000-000000000000"; // sentinela p/ deletar tudo

async function wipe(table) {
  // Deleta todas as linhas (neq num id impossível). Ignora tabela inexistente.
  const { error, count } = await sb.from(table).delete({ count: "exact" }).neq("id", ALL);
  if (error) {
    console.log(`! ${table}: ${error.message}`);
    return false;
  }
  console.log(`- ${table}: ${count ?? 0} linha(s) removida(s)`);
  return true;
}

(async () => {
  // Ordem segura de FK: dependentes de quotes → quotes → clients.
  await wipe("quote_items");
  await wipe("ai_corrections");
  await wipe("quotes");
  await wipe("clients");
  console.log("\nReset concluído. Catálogo e configurações preservados.");
})().catch((e) => {
  console.error("ERRO no reset:", e.message);
  process.exit(1);
});
