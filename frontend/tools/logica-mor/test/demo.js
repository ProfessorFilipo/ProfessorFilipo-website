// demo.js — Roda o lexer + parser + análise de escopo contra os 15
// exemplos da especificação (seção 11) e alguns casos extras de erro,
// imprimindo um relatório no console.

import { parse } from '../js/parser.js';
import { analyzeScope } from '../js/scope-analyzer.js';
import { formulaToString } from '../js/ast.js';

const cases = [
  // Nível 1
  { label: '1. Contradição', input: '(p ∧ ¬p)', expectOk: true },
  { label: '2. Tautologia (terceiro excluído)', input: '(p ∨ ¬p)', expectOk: true },
  { label: '3. Contingência', input: '(p ∧ q)', expectOk: true },
  // Nível 2
  { label: '4. Modus Ponens', input: '(((p → q) ∧ p) → q)', expectOk: true },
  { label: '5. Modus Tollens', input: '(((p → q) ∧ ¬q) → ¬p)', expectOk: true },
  { label: '6. Silogismo disjuntivo', input: '(((p ∨ q) ∧ ¬p) → q)', expectOk: true },
  { label: '7. Falácia da afirmação do consequente', input: '(((p → q) ∧ q) → p)', expectOk: true },
  { label: '8. Lei de De Morgan', input: '(¬(p ∧ q) ↔ (¬p ∨ ¬q))', expectOk: true },
  // Nível 3 — erros propositais
  { label: '9. Erro: conectivo mal posicionado', input: '(p ∧ → q)', expectOk: false },
  { label: '10. Erro: parêntese não fechado', input: '((p ∧ q) → r', expectOk: false },
  // Nível 4 — predicados
  { label: '11a. Barbara (premissa 1)', input: '∀x(Homem(x) → Mortal(x))', expectOk: true },
  { label: '11b. Barbara (premissa 2)', input: 'Homem(socrates)', expectOk: true },
  { label: '11c. Barbara (conclusão)', input: 'Mortal(socrates)', expectOk: true },
  { label: '12. Variável presa + livre juntas', input: '∀x(Aluno(x) → Estuda(x, logica))', expectOk: true },
  { label: '13. Dualidade de quantificadores', input: '(¬∀x P(x) ↔ ∃x ¬P(x))', expectOk: true },
  // Nível 5 — quadrado de oposição
  { label: '14a. A (universal afirmativa)', input: '∀x(Aluno(x) → Estuda(x))', expectOk: true },
  { label: '14b. E (universal negativa)', input: '∀x(Aluno(x) → ¬Estuda(x))', expectOk: true },
  { label: '14c. I (particular afirmativa)', input: '∃x(Aluno(x) ∧ Estuda(x))', expectOk: true },
  { label: '14d. O (particular negativa)', input: '∃x(Aluno(x) ∧ ¬Estuda(x))', expectOk: true },
  // Nível 6 — avançado
  { label: '15a. Ordem dos quantificadores (∀∃)', input: '∀x∃y Ama(x, y)', expectOk: true },
  { label: '15b. Ordem dos quantificadores (∃∀)', input: '∃y∀x Ama(x, y)', expectOk: true },
  // Extras: notação ASCII e avisos de convenção
  { label: 'Extra: notação ASCII equivalente ao Modus Ponens', input: '(((p -> q) & p) -> q)', expectOk: true },
  { label: 'Extra: aviso — predicado minúsculo', input: 'aluno(x)', expectOk: true, expectWarning: true },
  { label: 'Extra: aviso — proposição maiúscula', input: 'P', expectOk: true, expectWarning: true },
];

let pass = 0;
let fail = 0;

for (const c of cases) {
  const result = parse(c.input);
  const okMatches = result.ok === c.expectOk;

  console.log(`\n=== ${c.label} ===`);
  console.log(`entrada: ${c.input}`);

  if (!result.ok) {
    console.log(`  resultado: INVÁLIDA — ${result.error.message} (posição ${result.error.pos})`);
  } else {
    console.log(`  resultado: BFF válida`);
    console.log(`  normalizada: ${formulaToString(result.ast)}`);
    if (result.warnings.length) {
      for (const w of result.warnings) {
        console.log(`  aviso (posição ${w.pos}): ${w.message}`);
      }
    }
    const scope = analyzeScope(result.ast);
    if (scope.occurrences.length) {
      const summary = scope.occurrences
        .map((t) => `${t.name}@${t.pos}=${t.bound ? 'presa/dependente' : 'livre/independente'}`)
        .join(', ');
      console.log(`  termos: ${summary}`);
      console.log(`  possui variável livre: ${scope.hasFreeVariables ? 'sim' : 'não'}`);
    }
  }

  const warnOk = !c.expectWarning || (result.ok && result.warnings.length > 0);
  const testPassed = okMatches && warnOk;
  console.log(`  status do teste: ${testPassed ? 'OK' : 'FALHOU (verificar expectativa)'}`);
  if (testPassed) pass++; else fail++;
}

console.log(`\n\n${pass}/${cases.length} casos conforme o esperado, ${fail} falharam.`);
process.exit(fail > 0 ? 1 : 0);
