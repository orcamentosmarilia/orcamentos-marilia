// ──────────────────────────────────────────────────────────────────────────
// Classificação UNIFICADA de itens do orçamento.
// Fonte única usada por TODAS as telas (proposta pública, tela interna).
// A decisão vem do DADO carimbado no item (item_type / product_id / categoria),
// nunca de adivinhação por palavra-chave na descrição.
// ──────────────────────────────────────────────────────────────────────────

// Vocabulário canônico de item_type — gravado na criação do orçamento.
export type ItemType = "food" | "beverage" | "accessory" | "service" | "fee";

// Rótulos dos grupos operacionais (não vêm da hierarquia de categorias).
export const GROUP_ACCESSORIES = "Acessórios e Descartáveis";
export const GROUP_LOGISTICS = "Logística e Serviços";
export const GROUP_OTHER = "Outros itens";

// Forma mínima de um item de orçamento (quote_items + join opcional de products).
export interface QuoteItemLike {
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_price?: number | string | null;
  item_type?: string | null;
  product_id?: string | null;
  products?: { category?: string | null; image_url?: string | null } | null;
}

// Grupo da hierarquia de categorias (settings.category_order).
export interface CategoryGroup {
  id?: string;
  label: string;
  subcategories: string[];
}

// Mapa categoria→grupo e a ordem dos grupos, derivados da hierarquia.
export function buildCategoryIndex(hierarchy: unknown): {
  catToGroup: Record<string, string>;
  groupOrder: string[];
} {
  const catToGroup: Record<string, string> = {};
  const groupOrder: string[] = [];
  const groups = Array.isArray(hierarchy) ? (hierarchy as CategoryGroup[]) : [];
  for (const g of groups) {
    if (g && typeof g === "object" && Array.isArray(g.subcategories)) {
      groupOrder.push(g.label);
      for (const sub of g.subcategories) catToGroup[sub] = g.label;
    }
  }
  return { catToGroup, groupOrder };
}

// Item cujo valor é um percentual sobre o subtotal (ex.: taxa de serviço).
// A unidade carrega "%" — é dado do item, não adivinhação de descrição.
export function isPercentItem(item: QuoteItemLike): boolean {
  return (item.unit || "").toLowerCase().includes("%");
}

// Total da linha — UMA regra só, em todo lugar.
// Itens normais: quantidade × preço unitário. (Acabou o "dividir por 25".)
// Itens percentuais: subtotal × (preço/100) × quantidade.
export function lineTotal(item: QuoteItemLike, subtotalNonPercent = 0): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  if (isPercentItem(item)) return subtotalNonPercent * (price / 100) * qty;
  return qty * price;
}

// Totais do orçamento, calculados de forma idêntica em todas as telas:
// subtotal dos itens não-percentuais e total geral (com as taxas %).
export function computeQuoteTotals(items: QuoteItemLike[]): {
  subtotalNonPercent: number;
  grandTotal: number;
} {
  const subtotalNonPercent = items
    .filter((i) => !isPercentItem(i))
    .reduce((acc, i) => acc + lineTotal(i), 0);
  const grandTotal = items.reduce((acc, i) => acc + lineTotal(i, subtotalNonPercent), 0);
  return { subtotalNonPercent, grandTotal };
}

// Grupo de exibição do item — lookup puro, sem palavra-chave.
export function classifyItem(
  item: QuoteItemLike,
  catToGroup: Record<string, string>,
): string {
  const type = (item.item_type || "").toLowerCase();
  if (type === "service") return GROUP_LOGISTICS;
  if (type === "fee") return GROUP_LOGISTICS;
  if (type === "accessory") return GROUP_ACCESSORIES;

  const cat = item.products?.category;
  if (cat && catToGroup[cat]) return catToGroup[cat];
  return GROUP_OTHER;
}

// Detalhamento financeiro por seção (para o resumo lateral), por item_type —
// idêntico em todas as telas. Alimentação = comida/bebida/descartável;
// Taxa de Entrega = fees; Serviços = serviços + taxas percentuais.
export function computeSectionBreakdown(items: QuoteItemLike[]): {
  food: number;
  delivery: number;
  services: number;
} {
  const { subtotalNonPercent } = computeQuoteTotals(items);
  let food = 0, delivery = 0, services = 0;
  for (const item of items) {
    const type = (item.item_type || "").toLowerCase();
    const value = lineTotal(item, subtotalNonPercent);
    if (isPercentItem(item)) services += value;
    else if (type === "fee") delivery += value;
    else if (type === "service") services += value;
    else food += value; // food | beverage | accessory | (sem tipo)
  }
  return { food, delivery, services };
}

// Ícone (material-symbols) do item, derivado do item_type.
export function itemIcon(item: QuoteItemLike): string {
  switch ((item.item_type || "").toLowerCase()) {
    case "service": return "groups";
    case "fee": return "local_shipping";
    case "accessory": return "takeout_dining";
    case "beverage": return "local_cafe";
    case "food": return "restaurant";
    default: return "restaurant";
  }
}

// Agrupa e ordena os itens: grupos da hierarquia (com itens) →
// Acessórios → Logística/Serviços → Outros. Mesma ordem em todas as telas.
export function groupItems(
  items: QuoteItemLike[],
  hierarchy: unknown,
): { order: string[]; groups: Record<string, QuoteItemLike[]> } {
  const { catToGroup, groupOrder } = buildCategoryIndex(hierarchy);
  const groups: Record<string, QuoteItemLike[]> = {};
  for (const item of items) {
    const g = classifyItem(item, catToGroup);
    (groups[g] ??= []).push(item);
  }
  const order = [
    ...groupOrder.filter((g) => groups[g]?.length),
    ...(groups[GROUP_ACCESSORIES]?.length ? [GROUP_ACCESSORIES] : []),
    ...(groups[GROUP_LOGISTICS]?.length ? [GROUP_LOGISTICS] : []),
    ...(groups[GROUP_OTHER]?.length ? [GROUP_OTHER] : []),
  ];
  return { order, groups };
}
