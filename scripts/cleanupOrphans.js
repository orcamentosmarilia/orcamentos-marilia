// Remove dados órfãos de calculation_rules: accessories e bolo agora vivem em
// product_dependencies (Logística → Materiais). Mantém consumption + rounding.
// Uso: node scripts/cleanupOrphans.js
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

(async () => {
  const { data } = await sb.from("settings").select("value").eq("key", "calculation_rules").single();
  if (!data?.value) { console.log("calculation_rules não encontrado."); return; }
  const cur = data.value;
  const removed = [];
  if ("accessories" in cur) { delete cur.accessories; removed.push("accessories"); }
  if ("bolo" in cur) { delete cur.bolo; removed.push("bolo"); }
  await sb.from("settings").update({ value: cur, updated_at: new Date().toISOString() }).eq("key", "calculation_rules");
  console.log("Removido de calculation_rules:", removed.length ? removed.join(", ") : "(nada — já limpo)");
  console.log("Chaves restantes:", Object.keys(cur).join(", "));
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
