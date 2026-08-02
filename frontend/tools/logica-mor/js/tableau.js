// tableau.js — Motor do método de árvores de refutação (tableaux)
// para lógica proposicional e de predicados. Ver especificação, seção 6.
//
// Limitação conhecida (adequada ao nível da disciplina — sem unificação
// plena nem alpha-renaming de variáveis capturadas): o fechamento de
// ramo usa igualdade sintática de átomos, e a substituição de variáveis
// não faz renomeação para evitar captura em casos de sombreamento
// patológico de nomes. Um limite de passos (maxSteps) evita loops
// infinitos em fórmulas de primeira ordem que não terminam (o método de
// tableaux para lógica de predicados é apenas semidecidível).

import { NodeType, Not, Term, Predicate, BinaryOp, Quantifier } from './ast.js';
import { atomKey } from './evaluator.js';

export class TableauError extends Error {}

// ---------------------------------------------------------------------
// Classificação de regras (α, β, γ, δ) — seção 6 da especificação,
// incluindo a reescrita de quantificadores negados (¬∀ ↔ ∃¬, ¬∃ ↔ ∀¬).
// ---------------------------------------------------------------------

function classify(node) {
  if (node.type === NodeType.PROPOSITION || node.type === NodeType.PREDICATE) {
    return { kind: 'literal', polarity: 'positive', atom: node };
  }

  if (node.type === NodeType.NOT) {
    const inner = node.operand;

    if (inner.type === NodeType.PROPOSITION || inner.type === NodeType.PREDICATE) {
      return { kind: 'literal', polarity: 'negative', atom: inner };
    }
    if (inner.type === NodeType.NOT) {
      return { kind: 'alpha', rule: 'dupla_negação', results: [inner.operand] };
    }
    if (inner.type === NodeType.AND) {
      return {
        kind: 'beta',
        rule: 'negação_da_conjunção',
        branches: [[Not(inner.left, node.pos)], [Not(inner.right, node.pos)]],
      };
    }
    if (inner.type === NodeType.OR) {
      return {
        kind: 'alpha',
        rule: 'negação_da_disjunção',
        results: [Not(inner.left, node.pos), Not(inner.right, node.pos)],
      };
    }
    if (inner.type === NodeType.IMPLIES) {
      return {
        kind: 'alpha',
        rule: 'negação_do_condicional',
        results: [inner.left, Not(inner.right, node.pos)],
      };
    }
    if (inner.type === NodeType.IFF) {
      return {
        kind: 'beta',
        rule: 'negação_do_bicondicional',
        branches: [
          [inner.left, Not(inner.right, node.pos)],
          [Not(inner.left, node.pos), inner.right],
        ],
      };
    }
    if (inner.type === NodeType.FORALL) {
      // ¬∀x A(x)  ≡  ∃x ¬A(x)
      return { kind: 'delta', rule: 'negação_do_universal', variable: inner.variable, body: Not(inner.body, node.pos) };
    }
    if (inner.type === NodeType.EXISTS) {
      // ¬∃x A(x)  ≡  ∀x ¬A(x)
      return { kind: 'gamma', rule: 'negação_do_existencial', variable: inner.variable, body: Not(inner.body, node.pos) };
    }
    throw new TableauError(`NOT com operando inesperado: ${inner.type}`);
  }

  if (node.type === NodeType.AND) {
    return { kind: 'alpha', rule: 'conjunção', results: [node.left, node.right] };
  }
  if (node.type === NodeType.OR) {
    return { kind: 'beta', rule: 'disjunção', branches: [[node.left], [node.right]] };
  }
  if (node.type === NodeType.IMPLIES) {
    return { kind: 'beta', rule: 'condicional', branches: [[Not(node.left, node.pos)], [node.right]] };
  }
  if (node.type === NodeType.IFF) {
    return {
      kind: 'beta',
      rule: 'bicondicional',
      branches: [
        [node.left, node.right],
        [Not(node.left, node.pos), Not(node.right, node.pos)],
      ],
    };
  }
  if (node.type === NodeType.FORALL) {
    return { kind: 'gamma', rule: 'universal', variable: node.variable, body: node.body };
  }
  if (node.type === NodeType.EXISTS) {
    return { kind: 'delta', rule: 'existencial', variable: node.variable, body: node.body };
  }

  throw new TableauError(`Nó não é uma fórmula expansível: ${node.type}`);
}

// ---------------------------------------------------------------------
// Substituição de variável por termo (sem alpha-renaming — ver nota no
// topo do arquivo)
// ---------------------------------------------------------------------

function substitute(node, varName, termName) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      return node;
    case NodeType.TERM:
      return node.name === varName ? Term(termName, node.pos) : node;
    case NodeType.PREDICATE:
      return Predicate(node.name, node.args.map((a) => substitute(a, varName, termName)), node.pos);
    case NodeType.NOT:
      return Not(substitute(node.operand, varName, termName), node.pos);
    case NodeType.AND:
    case NodeType.OR:
    case NodeType.IMPLIES:
    case NodeType.IFF:
      return BinaryOp(node.type, substitute(node.left, varName, termName), substitute(node.right, varName, termName), node.pos);
    case NodeType.FORALL:
    case NodeType.EXISTS:
      if (node.variable === varName) return node; // sombreado: variável interna não se refere à externa
      return Quantifier(node.type, node.variable, substitute(node.body, varName, termName), node.pos);
    default:
      throw new TableauError(`Nó desconhecido na substituição: ${node.type}`);
  }
}

// Coleta nomes de constantes/termos "concretos" já presentes num nó —
// não desce em quantificadores ainda não expandidos (suas variáveis
// ainda não são constantes do ramo).
function collectConstants(node, acc = new Set()) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      return acc;
    case NodeType.TERM:
      acc.add(node.name);
      return acc;
    case NodeType.PREDICATE:
      node.args.forEach((a) => collectConstants(a, acc));
      return acc;
    case NodeType.NOT:
      return collectConstants(node.operand, acc);
    case NodeType.AND:
    case NodeType.OR:
    case NodeType.IMPLIES:
    case NodeType.IFF:
      collectConstants(node.left, acc);
      collectConstants(node.right, acc);
      return acc;
    case NodeType.FORALL:
    case NodeType.EXISTS:
      return acc; // variável presa: ainda não é constante do ramo
    default:
      return acc;
  }
}

// ---------------------------------------------------------------------
// Construção do tableau
// ---------------------------------------------------------------------

class TableauBuilder {
  constructor(initialFormulas, { maxSteps = 500 } = {}) {
    this.maxSteps = maxSteps;
    this.stepCount = 0;
    this.nextBranchId = 1;
    this.nextConstantIndex = 1;
    this.steps = [];
    this.branches = new Map();

    const root = this.newBranch(null);
    for (const f of initialFormulas) this.addFormula(root, f);
    this.root = root;
  }

  newBranch(parentId) {
    const branch = {
      id: this.nextBranchId++,
      parentId,
      formulas: [],
      children: [],
      closed: false,
      closedPair: null,
      status: 'open',
      constants: new Set(),
      positiveLiterals: new Set(),
      negativeLiterals: new Set(),
    };
    this.branches.set(branch.id, branch);
    return branch;
  }

  addFormula(branch, node) {
    const classification = classify(node);
    const entry = {
      node,
      classification,
      done: classification.kind === 'literal',
      gammaUsedConstants: new Set(),
    };
    branch.formulas.push(entry);

    for (const c of collectConstants(node)) branch.constants.add(c);

    if (classification.kind === 'literal') {
      const key = atomKey(classification.atom);
      if (classification.polarity === 'positive') {
        branch.positiveLiterals.add(key);
        if (branch.negativeLiterals.has(key)) this.closeBranch(branch, key);
      } else {
        branch.negativeLiterals.add(key);
        if (branch.positiveLiterals.has(key)) this.closeBranch(branch, key);
      }
    }
    return entry;
  }

  closeBranch(branch, atomKeyStr) {
    branch.closed = true;
    branch.status = 'closed';
    branch.closedPair = atomKeyStr;
  }

  pickNext(branch) {
    for (const e of branch.formulas) {
      if (!e.done && e.classification.kind === 'alpha') return e;
    }
    for (const e of branch.formulas) {
      if (!e.done && e.classification.kind === 'delta') return e;
    }
    for (const e of branch.formulas) {
      if (e.classification.kind === 'gamma') {
        const hasUnused = branch.constants.size === 0 || [...branch.constants].some((c) => !e.gammaUsedConstants.has(c));
        if (hasUnused) return e;
      }
    }
    for (const e of branch.formulas) {
      if (!e.done && e.classification.kind === 'beta') return e;
    }
    return null;
  }

  run() {
    this.expand(this.root);
    return this;
  }

  expand(branch) {
    while (true) {
      if (branch.closed) return;
      if (this.stepCount >= this.maxSteps) {
        branch.status = 'undeterminado';
        return;
      }
      const entry = this.pickNext(branch);
      if (!entry) {
        branch.status = 'open';
        return;
      }
      this.stepCount++;
      this.applyRule(branch, entry);
      if (branch.closed) return;
      if (branch.children.length) {
        for (const child of branch.children) this.expand(child);
        return;
      }
    }
  }

  applyRule(branch, entry) {
    const c = entry.classification;

    if (c.kind === 'alpha') {
      entry.done = true;
      for (const r of c.results) this.addFormula(branch, r);
      this.steps.push({ rule: c.rule, kind: 'alpha', branchId: branch.id, source: entry.node });
      return;
    }

    if (c.kind === 'delta') {
      entry.done = true;
      const fresh = `c${this.nextConstantIndex++}`;
      const instance = substitute(c.body, c.variable, fresh);
      this.addFormula(branch, instance);
      this.steps.push({ rule: c.rule, kind: 'delta', branchId: branch.id, source: entry.node, freshConstant: fresh });
      return;
    }

    if (c.kind === 'gamma') {
      let constants = [...branch.constants];
      let seeded = null;
      if (constants.length === 0) {
        seeded = `c${this.nextConstantIndex++}`;
        branch.constants.add(seeded);
        constants = [seeded];
      }
      const unused = constants.find((cst) => !entry.gammaUsedConstants.has(cst));
      if (unused === undefined) return; // nada a fazer agora (será revisitado se surgir constante nova)
      entry.gammaUsedConstants.add(unused);
      const instance = substitute(c.body, c.variable, unused);
      this.addFormula(branch, instance);
      this.steps.push({
        rule: c.rule,
        kind: 'gamma',
        branchId: branch.id,
        source: entry.node,
        instantiatedWith: unused,
        seededFreshConstant: seeded,
      });
      return;
    }

    if (c.kind === 'beta') {
      entry.done = true;
      const [optionA, optionB] = c.branches;
      const childA = this.fork(branch, optionA);
      const childB = this.fork(branch, optionB);
      branch.children = [childA, childB];
      this.steps.push({
        rule: c.rule,
        kind: 'beta',
        branchId: branch.id,
        source: entry.node,
        resultBranchIds: [childA.id, childB.id],
      });
      return;
    }

    throw new TableauError(`Regra desconhecida: ${c.kind}`);
  }

  fork(parent, newNodes) {
    const child = this.newBranch(parent.id);
    child.formulas = parent.formulas.map((e) => ({
      node: e.node,
      classification: e.classification,
      done: e.done,
      gammaUsedConstants: new Set(e.gammaUsedConstants),
    }));
    child.constants = new Set(parent.constants);
    child.positiveLiterals = new Set(parent.positiveLiterals);
    child.negativeLiterals = new Set(parent.negativeLiterals);
    if (parent.closed) this.closeBranch(child, parent.closedPair);
    for (const n of newNodes) {
      if (child.closed) break;
      this.addFormula(child, n);
    }
    return child;
  }
}

function getLeaves(node, acc = []) {
  if (node.children.length === 0) {
    acc.push(node);
    return acc;
  }
  for (const c of node.children) getLeaves(c, acc);
  return acc;
}

function allClosed(node) {
  if (node.children.length === 0) return node.closed;
  return node.children.every(allClosed);
}

/**
 * Constrói o tableau completo a partir de uma lista de fórmulas iniciais
 * (ex.: premissas + negação da conclusão).
 */
export function buildTableau(formulas, options) {
  const builder = new TableauBuilder(formulas, options);
  builder.run();
  const leaves = getLeaves(builder.root);
  return {
    root: builder.root,
    branches: builder.branches,
    leaves,
    steps: builder.steps,
    allClosed: allClosed(builder.root),
    stepCount: builder.stepCount,
    limitReached: leaves.some((b) => b.status === 'undeterminado'),
  };
}

/**
 * Extrai um contramodelo (interpretação que testemunha um ramo aberto):
 * domínio = constantes do ramo; literais positivos/negativos observados.
 */
export function extractModel(branch) {
  return {
    domain: [...branch.constants],
    positiveLiterals: [...branch.positiveLiterals],
    negativeLiterals: [...branch.negativeLiterals],
  };
}

/** Testa se uma fórmula é uma tautologia (nega a fórmula; tableau deve fechar). */
export function checkTautology(formula, options) {
  const result = buildTableau([Not(formula, formula.pos)], options);
  return { isTautology: result.allClosed, ...result };
}

/** Testa se uma fórmula é satisfazível (ao menos um ramo aberto). */
export function checkSatisfiability(formula, options) {
  const result = buildTableau([formula], options);
  const openLeaf = result.leaves.find((b) => !b.closed);
  return { satisfiable: !!openLeaf, model: openLeaf ? extractModel(openLeaf) : null, ...result };
}

/** Testa a validade de um argumento: premissas ⊢ conclusão. */
export function checkValidity(premises, conclusion, options) {
  const result = buildTableau([...premises, Not(conclusion, conclusion.pos)], options);
  const openLeaf = result.leaves.find((b) => !b.closed);
  return {
    valid: result.allClosed,
    counterexample: openLeaf ? extractModel(openLeaf) : null,
    ...result,
  };
}
