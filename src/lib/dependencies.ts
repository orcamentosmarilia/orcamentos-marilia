// ──────────────────────────────────────────────────────────────────────────
// Engine de DEPENDÊNCIAS de produtos (pura e testável).
// Avalia as regras de product_dependencies contra o contexto do evento e
// devolve as linhas (produtos reais) a adicionar ao orçamento.
// Substitui o bloco hardcoded de acessórios/dependências do quoteCalc.ts.
// ──────────────────────────────────────────────────────────────────────────

export type TriggerType =
  | "always" | "has_coffee" | "has_cold_drink" | "drink" | "category" | "service" | "material";
export type QtyBase = "per_person" | "per_food_unit" | "per_event";
export type RoundingMode = "none" | "round" | "ceil" | "floor_multiple";

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
  trigger_type: TriggerType;
  trigger_value?: string | null;
  product_id?: string | null;
  qty_base: QtyBase;
  qty_factor: number;
  qty_divisor?: number | null;
  rounding_mode: RoundingMode;
  rounding_multiple?: number | null;
  plus_per_bolo?: boolean;
  condition_material?: string | null;
  skip_if_service_id?: string | null;
  cake_rule?: CakeRule | null;
}

export interface ResolvedProduct {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
}

export interface DepContext {
  guests: number;
  totalFoodUnits: number;
  totalBolos: number;
  hasCoffee: boolean;
  hasColdDrink: boolean;
  selectedDrinkIds: Set<string>;
  presentCategories: Set<string>;
  selectedServiceIds: Set<string>;
  material: string;
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

function triggerApplies(rule: DependencyRule, ctx: DepContext): boolean {
  switch (rule.trigger_type) {
    case "always": return true;
    case "has_coffee": return ctx.hasCoffee;
    case "has_cold_drink": return ctx.hasColdDrink;
    case "drink": return !!rule.trigger_value && ctx.selectedDrinkIds.has(rule.trigger_value);
    case "category": return !!rule.trigger_value && ctx.presentCategories.has(rule.trigger_value);
    case "service": return !!rule.trigger_value && ctx.selectedServiceIds.has(rule.trigger_value);
    case "material": return rule.trigger_value === ctx.material;
    default: return false;
  }
}

function ruleApplies(rule: DependencyRule, ctx: DepContext): boolean {
  if (!rule.active) return false;
  if (!triggerApplies(rule, ctx)) return false;
  if (rule.condition_material && ctx.material !== rule.condition_material) return false;
  if (rule.skip_if_service_id && ctx.selectedServiceIds.has(rule.skip_if_service_id)) return false;
  return true;
}

function ruleQuantity(rule: DependencyRule, ctx: DepContext): number {
  let base: number;
  if (rule.qty_base === "per_person") base = ctx.guests * rule.qty_factor;
  else if (rule.qty_base === "per_food_unit") base = ctx.totalFoodUnits / (rule.qty_divisor || 1);
  else base = rule.qty_factor; // per_event

  let qty: number;
  switch (rule.rounding_mode) {
    case "round": qty = Math.round(base); break;
    case "ceil": qty = Math.ceil(base); break;
    case "floor_multiple": {
      const m = rule.rounding_multiple || 1;
      qty = Math.floor(base / m) * m; break;
    }
    default: qty = base;
  }
  if (rule.plus_per_bolo) qty += ctx.totalBolos;
  return qty;
}

// Calcula as linhas do BOLO a partir de uma regra com cake_rule.
// Retorna as linhas e o total de bolos (para alimentar plus_per_bolo de outras regras).
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

// Avalia TODAS as regras. Primeiro o bolo (para saber totalBolos), depois as demais.
export function evaluateDependencies(
  rules: DependencyRule[],
  products: Record<string, ResolvedProduct>,
  ctxBase: Omit<DepContext, "totalBolos">,
): DepLine[] {
  const cakeRules = rules.filter(r => r.active && r.cake_rule);
  const normalRules = rules.filter(r => r.active && !r.cake_rule);

  // 1. Bolo
  let totalBolos = 0;
  const cakeLines: DepLine[] = [];
  for (const r of cakeRules) {
    const { lines, totalBolos: n } = computeCakeLines(r.cake_rule as CakeRule, products, ctxBase.guests);
    cakeLines.push(...lines);
    totalBolos += n;
  }

  // 2. Demais regras (com totalBolos no contexto)
  const ctx: DepContext = { ...ctxBase, totalBolos };
  const out: DepLine[] = [...cakeLines];
  for (const rule of normalRules) {
    if (!ruleApplies(rule, ctx)) continue;
    const product = rule.product_id ? products[rule.product_id] : undefined;
    if (!product) continue; // regra sem produto válido é ignorada
    const quantity = ruleQuantity(rule, ctx);
    if (quantity <= 0) continue;
    out.push({ product_id: product.id, description: product.name, quantity, unit: product.unit, unit_price: product.unit_price, item_type: "accessory", rule_name: rule.name });
  }
  return out;
}
