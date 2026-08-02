// ast.js — Construtores de nós da árvore sintática (AST) do Lógica Mór

export const NodeType = Object.freeze({
  PROPOSITION: 'PROPOSITION', // proposição atômica: p, chove
  PREDICATE: 'PREDICATE',     // predicado aplicado a termos: Aluno(x)
  TERM: 'TERM',               // termo (variável ou constante): x, pessoa
  NOT: 'NOT',
  AND: 'AND',
  OR: 'OR',
  IMPLIES: 'IMPLIES',
  IFF: 'IFF',
  FORALL: 'FORALL',
  EXISTS: 'EXISTS',
});

export function Proposition(name, pos) {
  return { type: NodeType.PROPOSITION, name, pos };
}

export function Predicate(name, args, pos) {
  return { type: NodeType.PREDICATE, name, args, pos };
}

export function Term(name, pos) {
  // `bound` e `boundBy` são preenchidos posteriormente pela análise de
  // escopo (scope-analyzer.js) — null até lá.
  return { type: NodeType.TERM, name, pos, bound: null, boundBy: null };
}

export function Not(operand, pos) {
  return { type: NodeType.NOT, operand, pos };
}

export function BinaryOp(type, left, right, pos) {
  return { type, left, right, pos };
}

export function Quantifier(type, variable, body, pos) {
  return { type, variable, body, pos };
}

/**
 * Serializa a AST de volta para uma string em notação Unicode normalizada.
 * Útil para exibição e para depuração.
 */
export function formulaToString(node) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      return node.name;
    case NodeType.PREDICATE:
      return `${node.name}(${node.args.map(formulaToString).join(', ')})`;
    case NodeType.TERM:
      return node.name;
    case NodeType.NOT:
      return `¬${formulaToString(node.operand)}`;
    case NodeType.AND:
      return `(${formulaToString(node.left)} ∧ ${formulaToString(node.right)})`;
    case NodeType.OR:
      return `(${formulaToString(node.left)} ∨ ${formulaToString(node.right)})`;
    case NodeType.IMPLIES:
      return `(${formulaToString(node.left)} → ${formulaToString(node.right)})`;
    case NodeType.IFF:
      return `(${formulaToString(node.left)} ↔ ${formulaToString(node.right)})`;
    case NodeType.FORALL:
      return `∀${node.variable} ${formulaToString(node.body)}`;
    case NodeType.EXISTS:
      return `∃${node.variable} ${formulaToString(node.body)}`;
    default:
      throw new Error(`Nó desconhecido: ${node.type}`);
  }
}
