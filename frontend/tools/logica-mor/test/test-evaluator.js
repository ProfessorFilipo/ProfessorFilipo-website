// test-evaluator.js — Testa evaluate() e generateTruthTable() contra os
// exemplos proposicionais da especificação (seção 11) e garante que
// fórmulas com predicados são corretamente recusadas.

import { parse } from '../js/parser.js';
import { generateTruthTable, isPropositional, EvaluationError } from '../js/evaluator.js';

const propositionalCases = [
  { label: '1. Contradição', input: '(p ∧ ¬p)', expectClass: 'contradição' },
  { label: '2. Tautologia (terceiro excluído)', input: '(p ∨ ¬p)', expectClass: 'tautologia' },
  { label: '3. Contingência', input: '(p ∧ q)', expectClass: 'contingência' },
  { label: '4. Modus Ponens', input: '(((p → q) ∧ p) → q)', expectClass: 'tautologia' },
  { label: '5. Modus Tollens', input: '(((p → q) ∧ ¬q) → ¬p)', expectClass: 'tautologia' },
  { label: '6. Silogismo disjuntivo', input: '(((p ∨ q) ∧ ¬p) → q)', expectClass: 'tautologia' },
  { label: '7. Falácia da afirmação do consequente', input: '(((p → q) ∧ q) → p)', expectClass: 'contingência' },
  { label: '8. Lei de De Morgan', input: '(¬(p ∧ q) ↔ (¬p ∨ ¬q))', expectClass: 'tautologia' },
];

let pass = 0;
let fail = 0;

for (const c of propositionalCases) {
  const parsed = parse(c.input);
  if (!parsed.ok) {
    console.log(`\n=== ${c.label} === FALHOU AO PARSEAR: ${parsed.error.message}`);
    fail++;
    continue;
  }
  const table = generateTruthTable(parsed.ast);
  const ok = table.classification === c.expectClass;
  console.log(`\n=== ${c.label} ===`);
  console.log(`  proposições: ${table.propositions.join(', ')}`);
  console.log(`  linhas: ${table.rows.length}`);
  console.log(`  classificação: ${table.classification} (esperado: ${c.expectClass})`);
  console.log(`  status: ${ok ? 'OK' : 'FALHOU'}`);
  if (ok) pass++; else fail++;
}

// Fórmula com predicado deve ser recusada pela geração de tabela-verdade
console.log('\n=== Extra: predicado deve ser recusado ===');
const barbara = parse('∀x(Homem(x) → Mortal(x))');
console.log(`  isPropositional: ${isPropositional(barbara.ast)} (esperado: false)`);
try {
  generateTruthTable(barbara.ast);
  console.log('  status: FALHOU (deveria ter lançado EvaluationError)');
  fail++;
} catch (e) {
  const ok = e instanceof EvaluationError;
  console.log(`  erro lançado corretamente: ${ok} — "${e.message}"`);
  console.log(`  status: ${ok ? 'OK' : 'FALHOU'}`);
  if (ok) pass++; else fail++;
}

console.log(`\n\n${pass} casos OK, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
