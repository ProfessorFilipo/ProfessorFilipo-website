// test-tableau.js — Testa o motor de tableaux contra os exemplos
// proposicionais e de predicados da especificação (seção 11), incluindo
// o quadrado de oposição (exploração para o comparador da seção 8).

import { parse } from '../js/parser.js';
import { checkTautology, checkSatisfiability, checkValidity } from '../js/tableau.js';

function mustParse(input) {
  const r = parse(input);
  if (!r.ok) throw new Error(`Falha ao parsear "${input}": ${r.error.message}`);
  return r.ast;
}

let pass = 0;
let fail = 0;

function report(label, actual, expected, extra = '') {
  const ok = actual === expected;
  console.log(`${ok ? 'OK  ' : 'FALHOU'} — ${label}: obtido=${actual}, esperado=${expected} ${extra}`);
  if (ok) pass++; else fail++;
}

console.log('--- Nível 1-2: proposicional ---');
report('1. p∧¬p é satisfazível?', checkSatisfiability(mustParse('(p ∧ ¬p)')).satisfiable, false);
report('2. p∨¬p é tautologia?', checkTautology(mustParse('(p ∨ ¬p)')).isTautology, true);
report('4. Modus Ponens é tautologia?', checkTautology(mustParse('(((p → q) ∧ p) → q)')).isTautology, true);
report('5. Modus Tollens é tautologia?', checkTautology(mustParse('(((p → q) ∧ ¬q) → ¬p)')).isTautology, true);
report('6. Silogismo disjuntivo é tautologia?', checkTautology(mustParse('(((p ∨ q) ∧ ¬p) → q)')).isTautology, true);

const falacia = checkTautology(mustParse('(((p → q) ∧ q) → p)'));
report('7. Falácia da afirmação do consequente é tautologia?', falacia.isTautology, false);
if (!falacia.isTautology) {
  const openLeaf = falacia.leaves.find((b) => !b.closed);
  console.log(`      contraexemplo: constantes=${[...openLeaf.constants]}, positivos=${[...openLeaf.positiveLiterals]}, negativos=${[...openLeaf.negativeLiterals]}`);
}

report('8. Lei de De Morgan é tautologia?', checkTautology(mustParse('(¬(p ∧ q) ↔ (¬p ∨ ¬q))')).isTautology, true);

console.log('\n--- Nível 4: predicados ---');
const barbara = checkValidity(
  [mustParse('∀x(Homem(x) → Mortal(x))'), mustParse('Homem(socrates)')],
  mustParse('Mortal(socrates)')
);
report('11. Silogismo de Barbara é válido?', barbara.valid, true);

report(
  '13. Dualidade de quantificadores é tautologia?',
  checkTautology(mustParse('(¬∀x P(x) ↔ ∃x ¬P(x))')).isTautology,
  true
);

console.log('\n--- Nível 5: quadrado de oposição (exploração p/ seção 8) ---');
const A = '∀x(Aluno(x) → Estuda(x))';
const E = '∀x(Aluno(x) → ¬Estuda(x))';
const I = '∃x(Aluno(x) ∧ Estuda(x))';
const O = '∃x(Aluno(x) ∧ ¬Estuda(x))';

report(
  'A∧O satisfazível? (contraditórias: nunca ambas V — deve ser INsatisfazível)',
  checkSatisfiability(mustParse(`(${A} ∧ ${O})`)).satisfiable,
  false
);
report(
  'A∧E satisfazível? (contrárias clássicas — em predicados modernos, é satisfazível se a classe "Aluno" for vazia)',
  checkSatisfiability(mustParse(`(${A} ∧ ${E})`)).satisfiable,
  true
);
report(
  '¬I∧¬O satisfazível? (subcontrárias clássicas — mesma ressalva de domínio vazio)',
  checkSatisfiability(mustParse(`(¬${I} ∧ ¬${O})`)).satisfiable,
  true
);
report(
  'A∧¬I satisfazível? (subalternação clássica — quebra sem importação existencial)',
  checkSatisfiability(mustParse(`(${A} ∧ ¬${I})`)).satisfiable,
  true
);

console.log(`\n\n${pass} casos conforme o esperado, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
