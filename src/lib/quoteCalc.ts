// ──────────────────────────────────────────────────────────────────────────
// Cálculo determinístico de quantidades (comida, bolos, acessórios).
// Extraído de generate-quote para ser PURO e TESTÁVEL — sem mudança de
// comportamento. É a base para unificar o motor de cálculo com verificação.
// ──────────────────────────────────────────────────────────────────────────

export interface CalcInput {
  guests: number;
  duration_hours: number;
  modalidade: string;
  inclui_doces: boolean;
  has_cafe: boolean;
  has_agua_suco_refri: boolean;
  has_tableware: boolean;
  has_glass_cup: boolean;
  has_porcelain_cup: boolean;
  material: "Descartável" | "Louça" | string;
}

export interface AccessoryLine {
  item: string;
  quantity: number;
  unit: string;
  unit_price: number;
  rule?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// MOTOR UNIFICADO DE ITENS (regra editável por item, dirigido por dados).
// Cada item (acessório/serviço/material) é uma regra com: preço + fórmula de
// quantidade + arredondamento + aplicação + condição. Sem nada chumbado.
// ──────────────────────────────────────────────────────────────────────────

export type QtyBase = "per_person" | "per_food_unit" | "per_event";
export type RoundingMode = "none" | "round" | "ceil" | "floor_multiple";
export type ApplicationMode = "selectable" | "auto_always" | "auto_if_coffee" | "auto_if_cold_drinks";

export interface ItemRule {
  name: string;
  unit?: string;
  base_price: number;
  qty_base: QtyBase;
  qty_factor: number;        // fator por pessoa / por evento (qtd fixa)
  qty_divisor?: number;      // para per_food_unit (ex.: 1 a cada 100 unidades)
  rounding_mode: RoundingMode;
  rounding_multiple?: number; // para floor_multiple
  plus_bolos?: boolean;       // soma 1 por bolo (ex.: vasilhame)
  application: ApplicationMode;
  requires_disposable?: boolean;      // só se material = Descartável (copos plásticos)
  replaced_by?: "glass" | "porcelain" | null; // omitir se o serviço substituto está presente
}

export interface ItemCtx {
  guests: number;
  total_units: number;
  total_bolos: number;
  has_cafe: boolean;
  has_cold_drinks: boolean;
  material: string;
  has_glass_cup: boolean;
  has_porcelain_cup: boolean;
}

export function itemApplies(rule: ItemRule, ctx: ItemCtx): boolean {
  if (rule.application === "selectable") return false; // selecionável é escolhido pelo usuário, não auto
  if (rule.application === "auto_if_coffee" && !ctx.has_cafe) return false;
  if (rule.application === "auto_if_cold_drinks" && !ctx.has_cold_drinks) return false;
  if (rule.requires_disposable && ctx.material !== "Descartável") return false;
  if (rule.replaced_by === "glass" && ctx.has_glass_cup) return false;
  if (rule.replaced_by === "porcelain" && ctx.has_porcelain_cup) return false;
  return true;
}

export function itemQuantity(rule: ItemRule, ctx: ItemCtx): number {
  let base: number;
  if (rule.qty_base === "per_person") base = ctx.guests * rule.qty_factor;
  else if (rule.qty_base === "per_food_unit") base = ctx.total_units / (rule.qty_divisor || 1);
  else base = rule.qty_factor; // per_event (qtd fixa)

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
  if (rule.plus_bolos) qty += ctx.total_bolos;
  return qty;
}

// Aplica as regras automáticas e retorna as linhas (mesma forma de AccessoryLine)
export function computeAutoItems(rules: ItemRule[], ctx: ItemCtx): AccessoryLine[] {
  const out: AccessoryLine[] = [];
  for (const rule of rules) {
    if (!itemApplies(rule, ctx)) continue;
    out.push({ item: rule.name, quantity: itemQuantity(rule, ctx), unit: rule.unit || "unidade", unit_price: rule.base_price });
  }
  return out;
}

export function calcularTotais(input: CalcInput, calcRules: any, modalidades: any[]) {
  const { guests, duration_hours, modalidade, inclui_doces, has_cafe, has_agua_suco_refri, has_glass_cup, has_porcelain_cup, material } = input;

  // Consumo por duração
  const consumption: { max_hours: number; units_per_person: number }[] = calcRules.consumption || [];
  let unitsPerPerson = 10;
  for (const entry of consumption) {
    if (duration_hours <= entry.max_hours) { unitsPerPerson = entry.units_per_person; break; }
  }
  const totalUnitsRaw = unitsPerPerson * guests;

  // Arredondamento
  const foodMultiple: number = calcRules.rounding?.food_multiple ?? 25;
  const lower = Math.floor(totalUnitsRaw / foodMultiple) * foodMultiple;
  const upper = lower + foodMultiple;
  const totalUnits = (totalUnitsRaw - lower) >= (upper - totalUnitsRaw) ? upper : lower;

  // Modalidade: divisão por tier
  const modalConfig = modalidades.find((m: any) => m.name === modalidade)
    ?? { name: modalidade, tier_split: { Econômico: 1.0, Elaborado: 0.0 }, requires_crocante: false };
  const splitEco = (modalConfig.tier_split as any).Econômico ?? 1.0;
  const economicoUnits = Math.round(totalUnits * splitEco);
  const elaboradoUnits = totalUnits - economicoUnits;

  // Regra 6: bolo
  const bf = calcRules.bolo ?? { guests_per_large: 50, extra_small_min: 13, extra_small_max: 37, extra_large_min: 38 };
  const nGrandes = Math.floor(guests / bf.guests_per_large);
  const resto = guests - nGrandes * bf.guests_per_large;
  let extraBoloSize = '';
  if (resto >= bf.extra_large_min) extraBoloSize = 'grande (1300g)';
  else if (resto >= bf.extra_small_min) extraBoloSize = 'pequeno (650g)';
  const extraBolos = extraBoloSize ? 1 : 0;
  const totalBolos = nGrandes + extraBolos;

  // Acessórios
  const ac = calcRules.accessories ?? {};
  const accessories: AccessoryLine[] = [];

  const vasilhameQty = Math.ceil(totalUnits / (ac.vasilhame_per_units ?? 100)) + totalBolos;
  accessories.push({ item: 'Vasilhame', quantity: vasilhameQty, unit: 'unidade', unit_price: ac.vasilhame_price ?? 15 });

  if (has_cafe) {
    // Copos de isopor: omitir se xícara de porcelana foi selecionada
    if (!has_porcelain_cup) {
      const isopQty = Math.round((ac.isopor_per_person ?? 1) * guests);
      accessories.push({ item: 'Copos isopor', quantity: isopQty, unit: 'unidade', unit_price: ac.isopor_price ?? 0.35, rule: `${ac.isopor_per_person ?? 1}/pessoa` });
    }
    accessories.push({ item: 'Pazinha', quantity: 1, unit: 'unidade', unit_price: ac.pazinha_price ?? 0.15, rule: '1 por evento' });
    const sachetQty = Math.ceil((ac.sachet_ratio ?? 0.5) * guests);
    accessories.push({ item: 'Sachê açúcar', quantity: sachetQty, unit: 'unidade', unit_price: ac.sachet_price ?? 0.15, rule: `${ac.sachet_ratio ?? 0.5}/pessoa` });
    accessories.push({ item: 'Sachê adoçante', quantity: sachetQty, unit: 'unidade', unit_price: ac.sachet_price ?? 0.15, rule: `${ac.sachet_ratio ?? 0.5}/pessoa` });
  }

  // Copos plásticos: omitir se copo de vidro foi selecionado
  if (has_agua_suco_refri && !has_glass_cup && material === 'Descartável') {
    const rawCopos = (ac.copo_per_person ?? 2) * guests;
    const coposMultiple = calcRules.rounding?.copos_multiple ?? 50;
    const coposQty = Math.floor(rawCopos / coposMultiple) * coposMultiple;
    accessories.push({ item: 'Copos plásticos 300ml', quantity: coposQty, unit: 'unidade', unit_price: ac.copo_price ?? 0.40, rule: `${ac.copo_per_person ?? 2}/pessoa, arredondar PARA BAIXO ao múltiplo de ${coposMultiple}` });
  }

  const rawGuardanapos = (ac.guardanapo_per_person ?? 4) * guests;
  const guardaMultiple = calcRules.rounding?.guardanapos_multiple ?? 100;
  const guardanapQty = Math.floor(rawGuardanapos / guardaMultiple) * guardaMultiple;
  accessories.push({ item: 'Guardanapos', quantity: guardanapQty, unit: 'unidade', unit_price: ac.guardanapo_price ?? 0.10, rule: `${ac.guardanapo_per_person ?? 4}/pessoa, arredondar PARA BAIXO ao múltiplo de ${guardaMultiple}` });

  return {
    guests,
    duration_hours,
    modalidade,
    units_per_person: unitsPerPerson,
    total_units_raw: totalUnitsRaw,
    total_units: totalUnits,
    food_multiple: foodMultiple,
    tier_breakdown: {
      Econômico: economicoUnits,
      Elaborado: elaboradoUnits,
      requires_crocante: modalConfig.requires_crocante,
    },
    inclui_doces,
    bolo: {
      total_bolos: totalBolos,
      n_grandes: nGrandes,
      extra_bolo_size: extraBoloSize || null,
    },
    accessories,
    instrucoes: [
      `Use EXATAMENTE ${totalUnits} unidades de alimentos no cardápio (múltiplo de ${foodMultiple}).`,
      `Tier Econômico: ${economicoUnits} un | Tier Elaborado: ${elaboradoUnits} un.`,
      modalConfig.requires_crocante ? 'OBRIGATÓRIO ao menos 1 pastel crocante (tier Elaborado).' : '',
      inclui_doces ? 'Inclua doces no cardápio dentro do total de unidades.' : 'NÃO inclua doces.',
      totalBolos > 0 ? `Inclua ${totalBolos} bolo(s): ${nGrandes}× grande${extraBoloSize ? ` + 1× ${extraBoloSize}` : ''}. Bolos não entram no total de unidades.` : 'Nenhum bolo neste evento.',
      `Acessórios já calculados acima — inclua-os no JSON com os preços indicados.`,
    ].filter(Boolean),
  };
}
