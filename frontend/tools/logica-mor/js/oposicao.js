// oposicao.js — Comparador de relações de oposição entre duas fórmulas
// quaisquer (generaliza o quadrado de oposição clássico, que compara só
// as 4 proposições categóricas — aqui funciona pra qualquer par de
// fórmulas, proposicionais ou de predicados).
//
// A ideia é puramente algorítmica: as quatro combinações possíveis —
// P∧Q, P∧¬Q, ¬P∧Q, ¬P∧¬Q — sendo satisfazíveis ou não já determinam
// sozinhas qual relação vale, sem precisar de nenhuma lógica nova no
// motor:
//
//   contraditórias:   P∧Q insat.   E  ¬P∧¬Q insat.  (nunca mesmo valor)
//   contrárias:       P∧Q insat.   E  ¬P∧¬Q satisf. (nunca ambas V)
//   subcontrárias:    ¬P∧¬Q insat. E  P∧Q satisf.   (nunca ambas F)
//   equivalentes:     P∧¬Q insat.  E  ¬P∧Q insat.   (sempre mesmo valor)
//   subalternação:    P∧¬Q insat. (P implica Q) ou ¬P∧Q insat. (Q implica P) — só uma direção
//   independentes:    nenhuma das combinações acima é insatisfazível
//
// Sem importação existencial (só domínio não-vazio, a mesma convenção
// do resto da ferramenta) — por isso o quadrado clássico A/E/I/O só
// mantém a contraditoriedade (A-O, E-I) de forma universal; contrariedade,
// subcontrariedade e subalternação dependem da classe do sujeito não
// ser vazia, o que não é garantido aqui. Isso é testado algoritmicamente
// pra cada par de fórmulas, não hardcoded — então o comparador já reflete
// essa ressalva sozinho, sem precisar de tratamento especial.

import { Not, BinaryOp, NodeType } from './ast.js';
import { checkSatisfiability, checkTautology } from './tableau.js';

/**
 * Compara duas fórmulas (já parseadas, como AST) e retorna quais
 * relações de oposição valem entre elas.
 *
 * @returns {{
 *   relations: string[],  // um ou mais de: 'contraditorias', 'contrarias',
 *                          // 'subcontrarias', 'equivalentes',
 *                          // 'subalterna_a_implica_b', 'subalterna_b_implica_a',
 *                          // 'independentes'
 *   combos: { pAndQ, pAndNotQ, notPAndQ, notPAndNotQ },  // resultado bruto de cada teste
 *   degenerateA: 'tautologia'|'contradição'|null,  // aviso se A já é degenerada sozinha
 *   degenerateB: 'tautologia'|'contradição'|null,
 *   limitReached: boolean,
 * }}
 */
export function compareFormulas(p, q) {
  const notP = Not(p);
  const notQ = Not(q);

  const pAndQ = checkSatisfiability(BinaryOp(NodeType.AND, p, q));
  const pAndNotQ = checkSatisfiability(BinaryOp(NodeType.AND, p, notQ));
  const notPAndQ = checkSatisfiability(BinaryOp(NodeType.AND, notP, q));
  const notPAndNotQ = checkSatisfiability(BinaryOp(NodeType.AND, notP, notQ));

  const relations = [];

  if (!pAndQ.satisfiable && !notPAndNotQ.satisfiable) {
    relations.push('contraditorias');
  } else {
    if (!pAndQ.satisfiable) relations.push('contrarias');
    if (!notPAndNotQ.satisfiable) relations.push('subcontrarias');
  }

  if (!pAndNotQ.satisfiable && !notPAndQ.satisfiable) {
    relations.push('equivalentes');
  } else {
    if (!pAndNotQ.satisfiable) relations.push('subalterna_a_implica_b');
    if (!notPAndQ.satisfiable) relations.push('subalterna_b_implica_a');
  }

  if (relations.length === 0) relations.push('independentes');

  // Diagnóstico extra: se A ou B já é uma tautologia/contradição sozinha,
  // isso costuma explicar resultados que, à primeira vista, parecem
  // estranhos (ex.: uma fórmula sempre falsa é "contrária" e "subalterna"
  // de quase tudo ao mesmo tempo, por vacuidade) — checado direto, sem
  // depender dos combos acima.
  const tautA = checkTautology(p);
  const tautB = checkTautology(q);
  const satA = checkSatisfiability(p);
  const satB = checkSatisfiability(q);
  const degenerateA = tautA.isTautology ? 'tautologia' : !satA.satisfiable ? 'contradição' : null;
  const degenerateB = tautB.isTautology ? 'tautologia' : !satB.satisfiable ? 'contradição' : null;

  return {
    relations,
    combos: { pAndQ, pAndNotQ, notPAndQ, notPAndNotQ },
    degenerateA,
    degenerateB,
    limitReached: [pAndQ, pAndNotQ, notPAndQ, notPAndNotQ, tautA, tautB, satA, satB].some((r) => r.limitReached),
  };
}
