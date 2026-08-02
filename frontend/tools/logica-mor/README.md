# Lógica Mór — núcleo lógico (v1)

Módulos implementados até agora (JavaScript puro, ES modules, sem dependências):

- `js/lexer.js` — tokenizador (aceita notação Unicode e ASCII)
- `js/ast.js` — construtores de nós da AST + `formulaToString` (serialização normalizada)
- `js/parser.js` — parser recursive descent; retorna `{ ok, ast, warnings }` ou `{ ok: false, error }`
- `js/scope-analyzer.js` — marca cada termo como presa/dependente ou livre/independente
- `js/evaluator.js` — avalia uma fórmula sob uma valoração; `generateTruthTable` gera a tabela-verdade completa (só para fórmulas puramente proposicionais)
- `js/tableau.js` — motor de tableaux (árvore de refutação): `checkTautology`, `checkSatisfiability`, `checkValidity`

## Rodando os testes

```
node test/demo.js
node test/test-evaluator.js
node test/test-tableau.js
```

## Uso básico

```js
import { parse } from './js/parser.js';
import { checkValidity } from './js/tableau.js';

const p1 = parse('∀x(Homem(x) → Mortal(x))').ast;
const p2 = parse('Homem(socrates)').ast;
const conclusao = parse('Mortal(socrates)').ast;

const resultado = checkValidity([p1, p2], conclusao);
console.log(resultado.valid); // true
```

## Achado durante a implementação (seção 8 da especificação)

Testando o motor de tableaux contra o quadrado de oposição, confirmou-se que — assumindo apenas domínio não-vazio, sem importação existencial da classe do sujeito — **só as relações contraditórias (A–O, E–I) permanecem válidas**; contrariedade, subcontrariedade e subalternação clássicas todas quebram quando a classe do sujeito pode ser vazia. Ver seção 8 da especificação para a explicação completa.

## Próximos módulos (ver seção 12/13 da especificação técnica)

- Comparador de relações de oposição (módulo fino sobre `tableau.js`)
- Renderizador (SVG/HTML) + UI
