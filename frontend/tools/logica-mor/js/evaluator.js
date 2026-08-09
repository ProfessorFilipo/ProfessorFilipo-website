// evaluator.js — Avalia uma fórmula sob uma valoração (atribuição de
// valores-verdade) e gera tabelas-verdade para fórmulas puramente
// proposicionais (ver especificação, seção 7).
//
// O avaliador em si (evaluate) é genérico o bastante para, no futuro,
// avaliar predicados sob um domínio finito também — mas a geração de
// tabela-verdade (generateTruthTable) é restrita a fórmulas sem
// quantificadores/predicados, conforme a seção 7 da especificação
// (domínio de predicados é potencialmente infinito).

import { NodeType, formulaToString } from './ast.js';

export class EvaluationError extends Error {}

/**
 * Chave canônica de um átomo (proposição ou predicado aplicado a termos),
 * usada como identificador na valoração.
 */
export function atomKey(node) {
  if (node.type === NodeType.PROPOSITION) return node.name;
  if (node.type === NodeType.PREDICATE) {
    return `${node.name}(${node.args.map((t) => t.name).join(',')})`;
  }
  throw new EvaluationError(`Nó não é um átomo: ${node.type}`);
}

/**
 * Verifica se a fórmula é puramente proposicional (sem predicados,
 * termos ou quantificadores) — pré-requisito para tabela-verdade.
 */
export function isPropositional(node) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      return true;
    case NodeType.PREDICATE:
    case NodeType.TERM:
    case NodeType.FORALL:
    case NodeType.EXISTS:
      return false;
    case NodeType.NOT:
      return isPropositional(node.operand);
    case NodeType.AND:
    case NodeType.OR:
    case NodeType.IMPLIES:
    case NodeType.IFF:
      return isPropositional(node.left) && isPropositional(node.right);
    default:
      throw new EvaluationError(`Nó desconhecido: ${node.type}`);
  }
}

/**
 * Retorna os nomes das proposições atômicas distintas, na ordem de
 * primeira aparição na fórmula. Só faz sentido para fórmulas
 * puramente proposicionais.
 */
export function collectPropositions(node, seen = [], acc = new Set()) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      if (!acc.has(node.name)) {
        acc.add(node.name);
        seen.push(node.name);
      }
      return seen;
    case NodeType.NOT:
      return collectPropositions(node.operand, seen, acc);
    case NodeType.AND:
    case NodeType.OR:
    case NodeType.IMPLIES:
    case NodeType.IFF:
      collectPropositions(node.left, seen, acc);
      collectPropositions(node.right, seen, acc);
      return seen;
    default:
      throw new EvaluationError(
        `collectPropositions só se aplica a fórmulas puramente proposicionais (encontrado: ${node.type})`
      );
  }
}

/**
 * Coleta as subfórmulas compostas (não-atômicas) de uma fórmula
 * proposicional, em pós-ordem (filhos antes do pai — "de dentro pra
 * fora", esquerda pra direita) — a ordem em que uma tabela-verdade de
 * livro-texto costuma construir as colunas intermediárias, cada uma a
 * partir das anteriores. Deduplicada pelo texto (formulaToString): a
 * mesma subfórmula aparecendo em dois pontos da árvore vira uma única
 * coluna, já que tem sempre o mesmo valor sob a mesma valoração.
 */
export function collectSubformulas(node, acc = [], seen = new Set()) {
  if (node.type === NodeType.PROPOSITION) return acc;
  if (node.type === NodeType.NOT) {
    collectSubformulas(node.operand, acc, seen);
  } else if (
    node.type === NodeType.AND ||
    node.type === NodeType.OR ||
    node.type === NodeType.IMPLIES ||
    node.type === NodeType.IFF
  ) {
    collectSubformulas(node.left, acc, seen);
    collectSubformulas(node.right, acc, seen);
  }
  const label = formulaToString(node);
  if (!seen.has(label)) {
    seen.add(label);
    acc.push(node);
  }
  return acc;
}

/**
 * Avalia a fórmula sob uma valoração — objeto { chaveDoAtomo: boolean }.
 * Lança EvaluationError se algum átomo não tiver valor na valoração,
 * ou se a fórmula tiver quantificadores (não suportado sem domínio).
 */
export function evaluate(node, valuation) {
  switch (node.type) {
    case NodeType.PROPOSITION:
    case NodeType.PREDICATE: {
      const key = atomKey(node);
      if (!(key in valuation)) {
        throw new EvaluationError(`Valoração não define o átomo "${key}"`);
      }
      return valuation[key];
    }
    case NodeType.NOT:
      return !evaluate(node.operand, valuation);
    case NodeType.AND:
      return evaluate(node.left, valuation) && evaluate(node.right, valuation);
    case NodeType.OR:
      return evaluate(node.left, valuation) || evaluate(node.right, valuation);
    case NodeType.IMPLIES:
      return !evaluate(node.left, valuation) || evaluate(node.right, valuation);
    case NodeType.IFF:
      return evaluate(node.left, valuation) === evaluate(node.right, valuation);
    case NodeType.FORALL:
    case NodeType.EXISTS:
      throw new EvaluationError(
        'Avaliação de quantificadores requer um domínio finito — não suportado por este avaliador (use o motor de tableaux)'
      );
    default:
      throw new EvaluationError(`Nó desconhecido: ${node.type}`);
  }
}

/**
 * Gera a tabela-verdade completa de uma fórmula puramente proposicional
 * — inclui as colunas intermediárias (cada subfórmula composta), no
 * estilo de livro-texto, além do resultado final.
 *
 * @returns {{
 *   propositions: string[],
 *   subformulaLabels: string[],
 *   rows: { valuation: Record<string, boolean>, subformulaResults: boolean[], result: boolean }[],
 *   classification: 'tautologia' | 'contradição' | 'contingência'
 * }}
 */
export function generateTruthTable(node) {
  if (!isPropositional(node)) {
    throw new EvaluationError(
      'Tabela-verdade só está disponível para fórmulas puramente proposicionais (sem predicados/quantificadores)'
    );
  }

  const propositions = collectPropositions(node);
  // A raiz da fórmula também é "composta", então entra na lista de
  // subfórmulas — mas ela já vira a coluna final "resultado" separada,
  // então é removida daqui pra não duplicar (sempre a última entrada,
  // já que collectSubformulas é pós-ordem e a raiz nunca é sintaticamente
  // igual a nenhuma subfórmula própria dela mesma).
  const subformulas = collectSubformulas(node).slice(0, -1);
  const subformulaLabels = subformulas.map((n) => formulaToString(n));
  const n = propositions.length;
  const rows = [];

  for (let mask = 0; mask < 2 ** n; mask++) {
    const valuation = {};
    // bit mais significativo corresponde à primeira proposição
    for (let i = 0; i < n; i++) {
      const bit = (mask >> (n - 1 - i)) & 1;
      valuation[propositions[i]] = bit === 1;
    }
    const subformulaResults = subformulas.map((sub) => evaluate(sub, valuation));
    const result = evaluate(node, valuation);
    rows.push({ valuation, subformulaResults, result });
  }

  const allTrue = rows.every((r) => r.result === true);
  const allFalse = rows.every((r) => r.result === false);
  const classification = allTrue ? 'tautologia' : allFalse ? 'contradição' : 'contingência';

  return { propositions, subformulaLabels, rows, classification };
}
