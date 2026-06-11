// ──────────────────────────────────────────────────────────────────────────
// Engine de DEPENDÊNCIAS de produtos — v2 (simples e determinística).
// Cada regra adiciona um PRODUTO numa quantidade. Aplica quando:
//   (a) não tem "depende de", OU o produto/categoria de quem depende está no
//       orçamento; E
//   (b) o produto não é material, OU seu material_type bate com o material do
//       evento (descartável × louça sai daqui — sem regra de substituição).
// Substitui o bloco hardcoded antigo. Bolo continua via cake_rule.
// ──────────────────────────────────────────────────────────────────────────

export type QtyBase = "per_person" | "per_food_unit" | "per_event";
export type MaterialType = "descartavel" | "louca";

export interface CakeRule {
  guests_per_large: number;
  large_product_id: string;
  small_product_id?: string | null;
  extra_small_min: number;
  extra_large_min: number;
}

export interface DependencyRule {
  id: string;
  name: string;
  active: boolean;
  sort_order?: number;
  product_id?: string | null;
  qty_base: QtyBase;
  qty_factor: number;
  qty_divisor?: number | null;
  rounding_multiple?: number | null; // se setado, arredonda ↓ ao múltiplo; senão, ↑ ao inteiro
  depends_on_product_id?: string | null;
  depends_on_category?: string | null;
  cake_rule?: CakeRule | null;
}

export interface ResolvedProduct {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  material_type?: string | null;
  category?: string | null;
}

export interface DepContext {
  guests: number;
  totalFoodUnits: number;
  totalBolos: number;
  material: string; // material do evento: "Descartável" | "Louça"
  presentProductIds: Set<string>;   // produtos presentes no orçamento (bebidas, cardápio, serviços)
  presentCategories: Set<string>;   // categorias presentes no orçamento
}

export interface DepLine {
  product_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: "accessory";
  rule_name: string;
}

// "Descartável"/"Louça" do evento → token do material_type do produto.
function eventMaterialToken(material: string): MaterialType | null {
  const m = (material || "").toLowerCase();
  if (m.includes("louç") || m.includes("louc")) return "louca";
  if (m.includes("descart")) return "descartavel";
  return null;
}

function ruleApplies(rule: DependencyRule, product: ResolvedProduct, ctx: DepContext): boolean {
  // (a) "depende de" — produto OU categoria presente no orçamento
  if (rule.depends_on_product_id && !ctx.presentProductIds.has(rule.depends_on_product_id)) return false;
  if (rule.depends_on_category && !ctx.presentCategories.has(rule.depends_on_category)) return false;
  // (b) tipo de material vs material do evento
  if (product.material_type) {
    const ev = eventMaterialToken(ctx.material);
    if (ev && product.material_type !== ev) return false;
  }
  return true;
}

function ruleQuantity(rule: DependencyRule, ctx: DepContext): number {
  let base: number;
  if (rule.qty_base === "per_person") base = ctx.guests * rule.qty_factor;
  else if (rule.qty_base === "per_food_unit") base = ctx.totalFoodUnits / (rule.qty_divisor || 1);
  else base = rule.qty_factor; // per_event

  if (rule.rounding_multiple && rule.rounding_multiple > 1) {
    return Math.floor(base / rule.rounding_multiple) * rule.rounding_multiple;
  }
  return Math.ceil(base);
}

export function computeCakeLines(
  cake: CakeRule,
  products: Record<string, ResolvedProduct>,
  guests: number,
): { lines: DepLine[]; totalBolos: number } {
  const lines: DepLine[] = [];
  const large = products[cake.large_product_id];
  const small = cake.small_product_id ? products[cake.small_product_id] : undefined;

  const nGrandes = Math.floor(guests / cake.guests_per_large);
  const resto = guests - nGrandes * cake.guests_per_large;
  let extraLarge = 0, extraSmall = 0;
  if (resto >= cake.extra_large_min) extraLarge = 1;
  else if (resto >= cake.extra_small_min) extraSmall = 1;

  const totalLarge = nGrandes + extraLarge;
  if (large && totalLarge > 0) {
    lines.push({ product_id: large.id, description: large.name, quantity: totalLarge, unit: large.unit, unit_price: large.unit_price, item_type: "accessory", rule_name: "Bolo" });
  }
  if (small && extraSmall > 0) {
    lines.push({ product_id: small.id, description: small.name, quantity: extraSmall, unit: small.unit, unit_price: small.unit_price, item_type: "accessory", rule_name: "Bolo" });
  }
  return { lines, totalBolos: totalLarge + extraSmall };
}

// Avalia TODAS as regras: bolo primeiro (para totalBolos), depois as demais.
export function evaluateDependencies(
  rules: DependencyRule[],
  products: Record<string, ResolvedProduct>,
  ctxBase: Omit<DepContext, "totalBolos">,
): DepLine[] {
  const cakeRules = rules.filter(r => r.active && r.cake_rule);
  const normalRules = rules.filter(r => r.active && !r.cake_rule);

  let totalBolos = 0;
  const out: DepLine[] = [];
  for (const r of cakeRules) {
    const { lines, totalBolos: n } = computeCakeLines(r.cake_rule as CakeRule, products, ctxBase.guests);
    out.push(...lines);
    totalBolos += n;
  }

  const ctx: DepContext = { ...ctxBase, totalBolos };
  for (const rule of normalRules) {
    const product = rule.product_id ? products[rule.product_id] : undefined;
    if (!product) continue;
    if (!ruleApplies(rule, product, ctx)) continue;
    const quantity = ruleQuantity(rule, ctx);
    if (quantity <= 0) continue;
    out.push({ product_id: product.id, description: product.name, quantity, unit: product.unit, unit_price: product.unit_price, item_type: "accessory", rule_name: rule.name });
  }
  return out;
}
