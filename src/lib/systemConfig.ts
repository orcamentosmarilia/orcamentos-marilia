// ──────────────────────────────────────────────────────────────────────────
// Fonte ÚNICA de verdade dos defaults de configuração do sistema.
// Os dados vivem em settingsDefaults.json (lido também pelo seed em
// scripts/seedSettings.js — uma fonte só). Aqui só re-exportamos com tipos e
// documentamos o significado de cada campo. O código lê SEMPRE do banco; nada
// é "fallback silencioso" no meio da lógica.
//
// Campos que valem explicar:
//  - calculation_rules.consumption: unidades de comida por pessoa por faixa de duração.
//  - calculation_rules.rounding: múltiplos de arredondamento (comida/copos/guardanapos).
//  - calculation_rules.bolo: 1 bolo grande a cada guests_per_large; faixas do bolo extra;
//      small_label/small_weight e large_label/large_weight = rótulos antes chumbados no código.
//  - drink_mappings[].counts_as_coffee: dispara acessórios de café (isopor/pazinha/sachê).
//  - drink_mappings[].counts_as_cold_drink: dispara copos plásticos.
//  - drink_mappings[].guests_per_unit: 1 unidade a cada N pessoas (quando o produto
//      não traz "N ml por pessoa" na descrição).
//  - quote_form_config: tudo que é selecionável na tela de Novo Orçamento (períodos,
//      materiais, fontes de lead, limites de pessoas/duração, opções de espeto).
//  - status_config: rótulos/cores/terminalidade dos status.
// ──────────────────────────────────────────────────────────────────────────

import defaults from "./settingsDefaults.json";

// Chaves da tabela `settings`.
export const SETTINGS_KEYS = {
  calculation_rules: "calculation_rules",
  modalidade_config: "modalidade_config",
  composition_rules: "composition_rules",
  drink_mappings: "drink_mappings",
  category_order: "category_order",
  pipeline_stages: "pipeline_stages",
  business_rules: "business_rules",
  quote_form_config: "quote_form_config",
  status_config: "status_config",
} as const;

export const SETTINGS_DEFAULTS = defaults;

export const DEFAULT_CALCULATION_RULES = defaults.calculation_rules;
export const DEFAULT_MODALIDADE_CONFIG = defaults.modalidade_config;
export const DEFAULT_COMPOSITION_RULES = defaults.composition_rules;
export const DEFAULT_DRINK_MAPPINGS = defaults.drink_mappings;
export const DEFAULT_PIPELINE_STAGES = defaults.pipeline_stages;
export const DEFAULT_QUOTE_FORM_CONFIG = defaults.quote_form_config;
export const DEFAULT_STATUS_CONFIG = defaults.status_config;

export type QuoteFormConfig = typeof defaults.quote_form_config;
export type StatusConfig = typeof defaults.status_config;
export type DrinkMapping = (typeof defaults.drink_mappings)[number];
