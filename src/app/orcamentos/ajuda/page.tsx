"use client";

import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";

/* ─── Content ────────────────────────────────────────────────── */
interface Step {
  text: string;
  tip?: string;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  blocks: Block[];
}

interface Block {
  heading: string;
  steps: Step[];
}

const SECTIONS: Section[] = [
  {
    id: "visao-geral",
    icon: "auto_awesome",
    title: "Visão Geral do Sistema",
    subtitle: "Entenda como tudo se conecta",
    blocks: [
      {
        heading: "O que é este sistema?",
        steps: [
          { text: "O sistema de orçamentos da Marília de Dirceu permite criar, acompanhar e gerenciar todos os pedidos de coffee break e eventos de forma centralizada." },
          { text: "Cada orçamento passa por etapas: começa como Rascunho, vai para Aguardando aprovação do cliente, e depois é Aprovado, Pago ou Realizado." },
          { text: "Leads perdidos podem ser marcados como Perdido com um motivo, alimentando relatórios de oportunidade de melhoria." },
        ],
      },
      {
        heading: "Navegação",
        steps: [
          { text: "Use o menu lateral esquerdo para navegar entre as seções: Dashboard, Kanban, Lista Geral, Clientes, Catálogo e mais." },
          { text: "O botão vermelho \"+ Novo Orçamento\" na sidebar cria um orçamento rapidamente de qualquer tela." },
          { text: "Clique no seu avatar no rodapé da sidebar para acessar seu perfil e alterar foto, e-mail ou senha." },
        ],
      },
    ],
  },
  {
    id: "orcamento",
    icon: "description",
    title: "Criar um Orçamento",
    subtitle: "Passo a passo para montar uma proposta",
    blocks: [
      {
        heading: "1. Iniciando o orçamento",
        steps: [
          { text: "Clique em \"+ Novo Orçamento\" no menu lateral ou em qualquer botão de novo orçamento no sistema." },
          { text: "Preencha os dados do cliente: nome, tipo de evento (casamento, formatura, corporativo etc.), data do evento e número de convidados." },
          { text: "Informe a origem do lead (Instagram, indicação, site etc.) — isso alimenta relatórios de marketing.", tip: "Essa informação ajuda a identificar quais canais geram mais negócios." },
        ],
      },
      {
        heading: "2. Adicionando itens",
        steps: [
          { text: "Na seção de itens, escolha a categoria do produto (Pastéis, Doces, Bebidas etc.) e selecione o produto desejado." },
          { text: "Defina a quantidade. Produtos como pastéis e docinhos são vendidos em múltiplos de 25 — o sistema avisa se a quantidade não está correta." },
          { text: "O preço é preenchido automaticamente com base no catálogo. Você pode ajustá-lo manualmente se necessário.", tip: "Produtos com tier Econômico ou Elaborado têm preços diferentes — escolha o correto para o perfil do cliente." },
        ],
      },
      {
        heading: "3. Taxas e resumo",
        steps: [
          { text: "A Taxa de Entrega e os Serviços (encargos) são calculados automaticamente com base nas configurações do sistema." },
          { text: "O resumo lateral mostra o total separado por Alimentação, Taxa de Entrega e Serviços." },
          { text: "Salve o orçamento como Rascunho para continuar editando, ou avance para enviar ao cliente." },
        ],
      },
      {
        heading: "4. Enviando a proposta",
        steps: [
          { text: "Clique em \"Ver Proposta\" para abrir o link da proposta formatada — esta é a versão que o cliente vê." },
          { text: "Copie o link e envie via WhatsApp, e-mail ou onde preferir. A proposta tem visual profissional com logo e todos os detalhes.", tip: "O link da proposta é público — qualquer pessoa com o link pode visualizar." },
        ],
      },
    ],
  },
  {
    id: "dashboard",
    icon: "dashboard",
    title: "Dashboard",
    subtitle: "Acompanhe a saúde financeira do negócio",
    blocks: [
      {
        heading: "Filtros de período",
        steps: [
          { text: "Use os botões \"Este mês\", \"Últimos 3 meses\", \"Este ano\" para filtrar rapidamente os dados." },
          { text: "Selecione \"Personalizado\" para definir um intervalo de datas específico com os campos de início e fim." },
          { text: "O filtro afeta os KPIs e a tabela de orçamentos, mas o gráfico de barras sempre mostra os últimos 6 meses para referência histórica." },
        ],
      },
      {
        heading: "KPIs (indicadores principais)",
        steps: [
          { text: "Total Gerado: soma de todos os orçamentos criados no período, independente do status." },
          { text: "Em Aberto: orçamentos em Rascunho ou Aguardando — valor que ainda pode virar receita." },
          { text: "Aprovados: total de orçamentos confirmados. O subtítulo mostra o tempo médio de aprovação (desde a criação até o aceite do cliente).", tip: "Um tempo médio alto pode indicar que o processo de follow-up precisa melhorar." },
          { text: "Perdidos: total de orçamentos perdidos e o percentual em relação ao total gerado." },
        ],
      },
      {
        heading: "Gráficos",
        steps: [
          { text: "O gráfico de barras mostra, mês a mês, o valor gerado (cor clara) vs. aprovado (cor vermelha) — ideal para ver a taxa de conversão ao longo do tempo." },
          { text: "O gráfico de pizza mostra a distribuição dos orçamentos por status no período filtrado." },
        ],
      },
    ],
  },
  {
    id: "kanban",
    icon: "view_kanban",
    title: "Kanban de Vendas",
    subtitle: "Acompanhe o pipeline de leads ativos",
    blocks: [
      {
        heading: "Como funciona",
        steps: [
          { text: "O Kanban mostra apenas leads ativos — orçamentos que ainda não foram ganhos ou perdidos." },
          { text: "Cada coluna representa uma etapa do funil (ex.: Rascunho, Aguardando). As colunas podem ser configuradas conforme a necessidade da equipe." },
          { text: "Os cards mostram: nome do cliente, valor do orçamento, data do evento, quantos dias faltam para o evento, número de convidados e quem criou o orçamento." },
        ],
      },
      {
        heading: "Movendo cards",
        steps: [
          { text: "Arraste um card de uma coluna para outra para atualizar o status do orçamento." },
          { text: "Também é possível clicar nos botões do card: \"Ganho\" para marcar como aprovado, ou \"Perdido\" para registrar a perda.", tip: "Ao marcar como Perdido, escolha um motivo da lista. Isso alimenta o relatório de Motivos de Perda." },
          { text: "Cards marcados como Ganho ou Perdido saem do Kanban e ficam apenas na Lista Geral." },
        ],
      },
      {
        heading: "Indicador de urgência (dias para o evento)",
        steps: [
          { text: "Cada card exibe quantos dias faltam para a data do evento." },
          { text: "Vermelho: evento em 7 dias ou menos — ação urgente necessária." },
          { text: "Âmbar: evento entre 8 e 30 dias — atenção recomendada." },
          { text: "Cinza: evento já passou." },
        ],
      },
      {
        heading: "Configurar etapas",
        steps: [
          { text: "Clique em \"Configurar etapas\" no canto superior direito do Kanban." },
          { text: "Digite o nome da nova etapa e clique em Adicionar. As etapas padrão (Rascunho e Aguardando) não podem ser removidas." },
          { text: "Etapas personalizadas podem ser removidas clicando no ícone de lixeira ao lado do nome." },
        ],
      },
    ],
  },
  {
    id: "lista-geral",
    icon: "list_alt",
    title: "Lista Geral",
    subtitle: "Visão completa de todos os orçamentos",
    blocks: [
      {
        heading: "Filtros e busca",
        steps: [
          { text: "Use a barra de busca para encontrar orçamentos por nome de cliente." },
          { text: "Filtre por status (Todos, Rascunho, Aguardando, Aprovado, Perdido etc.) para focar em um grupo específico." },
          { text: "Clique em qualquer linha para abrir o orçamento completo e editá-lo." },
        ],
      },
      {
        heading: "Ações rápidas",
        steps: [
          { text: "O ícone de olho abre a proposta do cliente em nova aba." },
          { text: "O ícone de lápis abre o orçamento em modo de edição." },
          { text: "O ícone de lixeira apaga o orçamento permanentemente — é necessária a senha mestra de segurança para confirmar.", tip: "A exclusão é irreversível. Use com cautela." },
        ],
      },
    ],
  },
  {
    id: "clientes",
    icon: "contacts",
    title: "Clientes",
    subtitle: "Gerencie sua base de clientes",
    blocks: [
      {
        heading: "Clientes dos orçamentos",
        steps: [
          { text: "A seção \"Dos orçamentos — não cadastrados\" exibe clientes que já fizeram pedidos mas ainda não têm cadastro formal." },
          { text: "Clique em \"Cadastrar\" em qualquer um deles para abrir o formulário com o nome pré-preenchido. Ao salvar, o histórico de orçamentos é automaticamente vinculado.", tip: "Recomendamos formalizar os clientes recorrentes para aproveitar os relatórios de frequência e valor." },
        ],
      },
      {
        heading: "Cadastrando um cliente",
        steps: [
          { text: "Clique em \"Novo cliente\" e preencha o tipo (Pessoa Física ou Jurídica)." },
          { text: "Para PJ, informe CNPJ. Para PF, informe CPF. Ambos são opcionais." },
          { text: "Adicione quantos contatos/responsáveis quiser clicando em \"Adicionar contato\" — informe nome e cargo de cada um." },
          { text: "Os campos de endereço, cidade, aniversário, avaliação (estrelas) e observações internas são todos opcionais mas úteis para atendimento personalizado." },
        ],
      },
      {
        heading: "Histórico e métricas",
        steps: [
          { text: "Cada cliente cadastrado exibe: total de pedidos, total gasto em orçamentos aprovados e data do último evento." },
          { text: "Clique na setinha para expandir e ver CPF/CNPJ, endereço, contatos e observações cadastradas." },
        ],
      },
    ],
  },
  {
    id: "catalogo",
    icon: "restaurant_menu",
    title: "Catálogo de Produtos",
    subtitle: "Mantenha o cardápio sempre atualizado",
    blocks: [
      {
        heading: "Navegando pelo catálogo",
        steps: [
          { text: "Use a barra de busca no topo para encontrar produtos por nome ou descrição." },
          { text: "A coluna esquerda lista todas as categorias com o número de produtos em cada uma. Clique para filtrar." },
          { text: "Produtos inativos aparecem na lista mas não ficam disponíveis para novos orçamentos." },
        ],
      },
      {
        heading: "Criando e editando produtos",
        steps: [
          { text: "Clique em \"Novo Produto\" e preencha: nome, categoria, preço e unidade de medida (ex.: cento, unidade, kg)." },
          { text: "Marque \"Vendido em múltiplos de 25\" para produtos como pastéis e docinhos — o sistema vai alertar se a quantidade digitada num orçamento não respeitar essa regra." },
          { text: "O Tier (Econômico / Elaborado) diferencia variações de preço para salgados e sanduíches.", tip: "Mantenha os preços sempre atualizados — eles são a base de todos os orçamentos." },
          { text: "Faça upload da foto do produto para deixar a proposta mais visual e profissional." },
        ],
      },
      {
        heading: "Gerenciando categorias",
        steps: [
          { text: "Clique em \"Categorias\" no canto superior para adicionar, renomear ou remover categorias." },
          { text: "Ao remover uma categoria que tem produtos, os produtos continuam existindo mas ficam sem categoria — você precisará reatribuí-los manualmente." },
          { text: "Use a seleção múltipla (checkboxes) para mover vários produtos de categoria de uma vez." },
        ],
      },
    ],
  },
  {
    id: "motivos-perda",
    icon: "sentiment_dissatisfied",
    title: "Motivos de Perda",
    subtitle: "Entenda por que negócios são perdidos",
    blocks: [
      {
        heading: "Para que serve",
        steps: [
          { text: "Sempre que um orçamento é marcado como \"Perdido\" no Kanban, é obrigatório selecionar (ou digitar) o motivo da perda." },
          { text: "Esses dados são consolidados nesta página com gráficos de frequência, permitindo identificar os principais obstáculos: preço, concorrência, prazo etc." },
        ],
      },
      {
        heading: "Gerenciando os motivos",
        steps: [
          { text: "Digite um novo motivo no campo e clique em Adicionar (ou pressione Enter)." },
          { text: "Cada motivo pode ser ativado ou inativado. Motivos inativos não aparecem na lista de seleção ao marcar um orçamento como perdido, mas os dados históricos são preservados." },
          { text: "O gráfico na parte inferior mostra a frequência de cada motivo — quanto maior a barra, mais vezes ele foi registrado.", tip: "Use esses dados em reuniões de equipe para ajustar a estratégia comercial." },
        ],
      },
    ],
  },
  {
    id: "perfil",
    icon: "manage_accounts",
    title: "Meu Perfil",
    subtitle: "Personalize sua conta",
    blocks: [
      {
        heading: "Acessando o perfil",
        steps: [
          { text: "Clique no seu avatar ou nome no rodapé da sidebar para abrir o modal de perfil." },
          { text: "O modal tem três abas: Foto, E-mail e Senha." },
        ],
      },
      {
        heading: "Alterando a foto",
        steps: [
          { text: "Na aba Foto, clique na imagem ou no botão \"Trocar foto\" e selecione uma imagem do seu computador." },
          { text: "A foto é salva automaticamente após o upload — ela aparece imediatamente na sidebar." },
        ],
      },
      {
        heading: "Alterando o e-mail",
        steps: [
          { text: "Na aba E-mail, informe o novo endereço de e-mail desejado." },
          { text: "Digite sua senha atual para confirmar a alteração e clique em \"Atualizar e-mail\".", tip: "Após a alteração, o novo e-mail será usado no próximo login." },
        ],
      },
      {
        heading: "Alterando a senha",
        steps: [
          { text: "Na aba Senha, informe a senha atual, a nova senha e confirme a nova senha." },
          { text: "A nova senha deve ter pelo menos 6 caracteres." },
          { text: "Clique em \"Atualizar senha\". Se a senha atual estiver incorreta, o sistema avisará." },
        ],
      },
    ],
  },
];

/* ─── Page ───────────────────────────────────────────────────── */
export default function AjudaPage() {
  const [activeId, setActiveId] = useState("visao-geral");
  const active = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="max-w-6xl mx-auto">

      <PageHeader
        title="Central de Ajuda"
        description="Tudo o que você precisa saber para usar o sistema."
      />

      <div className="flex gap-6 items-start">

        {/* ── Left nav ── */}
        <aside className="w-56 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden sticky top-6">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-dm font-bold text-rose-300 uppercase tracking-widest px-2">Tópicos</p>
          </div>
          <nav className="flex flex-col gap-0.5 px-3 pb-4">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl text-sm font-dm font-bold transition-all ${
                  activeId === s.id
                    ? "bg-[#5C1F2E] text-white"
                    : "text-rose-400 hover:bg-rose-50 hover:text-[#5C1F2E]"
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] flex-shrink-0 ${activeId === s.id ? "text-rose-200" : "text-rose-300"}`}>
                  {s.icon}
                </span>
                <span className="leading-tight">{s.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Section header */}
          <div className="bg-gradient-to-br from-[#5C1F2E] to-[#7A2A3A] rounded-2xl p-7 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">{active.icon}</span>
              </div>
              <div>
                <h2 className="font-lora text-2xl font-bold leading-tight">{active.title}</h2>
                <p className="font-dm text-rose-200 text-sm mt-0.5">{active.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Blocks */}
          {active.blocks.map((block, bi) => (
            <div key={bi} className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden">
              <div className="px-6 py-4 border-b border-rose-50 bg-rose-50/30">
                <h3 className="font-lora font-bold text-[#5C1F2E] text-base">{block.heading}</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                {block.steps.map((step, si) => (
                  <div key={si} className="flex gap-4">
                    {/* Step number */}
                    <div className="w-6 h-6 rounded-full bg-[#5C1F2E]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-[#5C1F2E] font-dm">{si + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-dm text-sm text-[#5C1F2E] leading-relaxed">{step.text}</p>
                      {step.tip && (
                        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-500 flex-shrink-0 mt-0.5">lightbulb</span>
                          <p className="text-xs font-dm text-amber-700 leading-relaxed">{step.tip}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Navigation between sections */}
          <div className="flex items-center justify-between pt-2">
            {SECTIONS.findIndex(s => s.id === activeId) > 0 ? (
              <button
                onClick={() => setActiveId(SECTIONS[SECTIONS.findIndex(s => s.id === activeId) - 1].id)}
                className="flex items-center gap-2 text-sm font-dm font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {SECTIONS[SECTIONS.findIndex(s => s.id === activeId) - 1].title}
              </button>
            ) : <div />}
            {SECTIONS.findIndex(s => s.id === activeId) < SECTIONS.length - 1 ? (
              <button
                onClick={() => setActiveId(SECTIONS[SECTIONS.findIndex(s => s.id === activeId) + 1].id)}
                className="flex items-center gap-2 text-sm font-dm font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors"
              >
                {SECTIONS[SECTIONS.findIndex(s => s.id === activeId) + 1].title}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm font-dm text-emerald-600 font-bold">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Você chegou ao fim!
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
