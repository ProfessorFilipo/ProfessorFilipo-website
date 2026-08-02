# Lógica Mór — Especificação Técnica

Ferramenta client-side (JavaScript puro, sem backend) para análise de sentenças de lógica proposicional e de predicados, com geração de árvores de refutação. Parte da seção **Ferramentas** de filipomor.com.

---

## 1. Localização no repositório

`frontend/tools/logica-mor/` dentro do repositório `ProfessorFilipo-website`, como módulo isolado (sem chamadas ao backend/Cloud Run), permitindo extração futura para repositório próprio se desejado.

---

## 2. Convenção de nomenclatura

Como variáveis e predicados podem ter mais de uma letra (ex: `pessoa`, `Aluno`), a distinção não é pelo tamanho do nome, e sim por **capitalização + contexto de uso**:

| Elemento | Convenção | Exemplo |
|---|---|---|
| Proposição atômica (lógica proposicional) | identificador iniciado por letra minúscula | `chove`, `p`, `estaFrio` |
| Predicado (lógica de predicados) | identificador iniciado por letra maiúscula, seguido de `(...)` | `Aluno(pessoa)`, `Estuda(x, y)` |
| Termo (constante ou variável) | identificador iniciado por letra minúscula | `pessoa`, `x`, `maria` |
| Variável vs. constante | determinado pelo **escopo**: se o termo aparece ligado por um quantificador (`∀pessoa`, `∃x`) em algum ponto que o alcança, é **variável (dependente/presa)**; caso contrário, é **constante (independente/livre)** naquela sentença |

Identificador = `letra (letra | dígito | "_")*` — sempre iniciando por letra, sem espaços.

---

## 3. Gramática (EBNF)

```
<sentença>          ::= <fórmula>

<fórmula>           ::= <atômica>
                       | "¬" <fórmula>
                       | "(" <fórmula> <conectivo> <fórmula> ")"
                       | <quantificador> <termo> <fórmula>

<atômica>           ::= <proposição>
                       | <predicado> "(" <lista_termos> ")"

<lista_termos>      ::= <termo> ("," <termo>)*

<conectivo>         ::= "∧" | "∨" | "→" | "↔"
<quantificador>     ::= "∀" | "∃"

<proposição>        ::= identificador minúsculo
<predicado>          ::= identificador iniciado por maiúscula
<termo>              ::= identificador minúsculo
```

Parênteses obrigatórios em conectivos binários evitam ambiguidade de precedência (mais simples de validar e de explicar em sala do que uma tabela de precedência).

---

## 4. Tabela de notação (Unicode ↔ ASCII)

Entrada aceita nos dois formatos; exibição sempre normalizada em Unicode.

| Símbolo | ASCII alternativo |
|---|---|
| ¬ | `!` ou `~` |
| ∧ | `&` |
| ∨ | `\|` |
| → | `->` |
| ↔ | `<->` |
| ∀ | `forall` |
| ∃ | `exists` |

> **Ajuste em relação à v1 desta especificação:** o atalho de uma letra (`A`/`E`) para quantificadores foi removido. Como predicados podem ter uma única letra maiúscula (ex.: `P(x)`), `A` e `E` isolados ficariam ambíguos com nomes de predicado — descoberto ao implementar o tokenizer (seção 13).

---

## 5. Pipeline de processamento

```
entrada (string)
   │
   ▼
Tokenizer  →  lista de tokens (com posição p/ mensagens de erro)
   │
   ▼
Parser (descida recursiva)  →  AST
   │
   ├──► Validador de BFF  → OK / erro com posição exata
   │
   ├──► Analisador de escopo  → marca cada ocorrência de termo como
   │       livre (independente) ou presa (dependente), com referência
   │       ao quantificador que a vincula
   │
   ├──► Avaliador de fórmulas → usado por tabela-verdade (seção 7) e
   │       pelo comparador de oposição (seção 8)
   │
   └──► Motor de Tableaux  → aplica regras α/β/γ/δ, controla ramos,
           detecta fechamento, extrai contramodelo de ramos abertos
   │
   ▼
Renderizador da árvore (SVG/HTML) + explicações passo a passo
```

---

## 6. Regras do método de tableaux

**α-regras (não ramificam):**
- `¬¬A` → `A`
- `A ∧ B` → `A`, `B`
- `¬(A ∨ B)` → `¬A`, `¬B`
- `¬(A → B)` → `A`, `¬B`

**β-regras (ramificam):**
- `A ∨ B` → `A` | `B`
- `A → B` → `¬A` | `B`
- `¬(A ∧ B)` → `¬A` | `¬B`
- `A ↔ B` → `(A, B)` | `(¬A, ¬B)`
- `¬(A ↔ B)` → `(A, ¬B)` | `(¬A, B)`

**γ-regras (quantificador universal, reaplicável):**
- `∀x A(x)` → `A(t)` para qualquer termo `t` já presente no ramo (ou uma constante nova se o ramo ainda não tiver nenhuma)

**δ-regras (quantificador existencial, aplicada uma vez, gera constante nova):**
- `∃x A(x)` → `A(c)`, `c` constante fresca (nunca usada antes no ramo) — passo anotado como "skolemização" com explicação

**Quantificadores negados (reescrita, descoberta necessária ao implementar):**
- `¬∀x A(x)` → equivale a `∃x ¬A(x)` → tratada como δ-regra
- `¬∃x A(x)` → equivale a `∀x ¬A(x)` → tratada como γ-regra

**Fechamento de ramo:** quando o ramo contém uma fórmula atômica `φ` e sua negação `¬φ` (igualdade sintática — sem unificação plena, adequado ao nível da disciplina).

**Ramo aberto → contramodelo:** literais atômicos do ramo viram a atribuição de verdade (proposicional) ou a interpretação de domínio (predicados) que testemunha não-validade/satisfatibilidade.

---

## 7. Tabelas-verdade automáticas

Aplicável apenas a fórmulas **puramente proposicionais** (sem quantificadores/predicados) — em lógica de predicados o domínio é potencialmente infinito, não há tabela finita a gerar.

- Detecção automática: se a fórmula parseada não contém quantificadores nem predicados, o botão "gerar tabela-verdade" fica disponível.
- Enumera as 2ⁿ valorações das n proposições atômicas (ordem de aparição na fórmula).
- Avalia a fórmula linha a linha percorrendo a AST recursivamente.
- Classificação automática ao final: todas as linhas V → tautologia; todas F → contradição; caso contrário → contingência.
- Rolagem horizontal para fórmulas com muitas proposições atômicas (5+).
- Reaproveita o mesmo avaliador de fórmulas usado pelo comparador de oposição (seção 8) e pela extração de contramodelo do motor de tableaux (seção 6).

---

## 8. Comparador de relações de oposição

Compara semanticamente **duas fórmulas quaisquer** (não só o par sujeito-predicado clássico) e classifica automaticamente a relação:

| Relação | Condição |
|---|---|
| Contraditórias | nunca ambas V, nunca ambas F |
| Contrárias | nunca ambas V, podem ambas ser F |
| Subcontrárias | podem ambas ser V, nunca ambas F |
| Subalternas | uma implica a outra, não vice-versa |
| Equivalentes | mesmo valor em toda valoração |
| Independentes | nenhuma das relações acima se aplica |

- Implementação: testa a satisfatibilidade de φ∧ψ, φ∧¬ψ, ¬φ∧ψ e ¬φ∧¬ψ via o motor de tableaux (seção 6) — a combinação de resultados classifica as seis relações de uma vez.
- Funciona tanto em lógica proposicional (via tabela-verdade, mais rápido) quanto em predicados (via tableaux).
- O quadrado de oposição aristotélico clássico (Todo S é P / Nenhum S é P / Algum S é P / Algum S não é P) entra como um **exemplo pronto** que demonstra o comparador, em vez de lógica hard-coded específica para essas quatro sentenças.
- **Nota didática a incluir na UI (confirmada empiricamente ao testar o motor de tableaux — seção 13):** o achado é mais amplo do que só a subalternação. Assumindo apenas que o domínio como um todo é não-vazio (convenção padrão da lógica de predicados moderna), mas **sem** assumir que a classe do sujeito (ex.: "Aluno") é não-vazia, das seis relações clássicas do quadrado **só as contraditórias (A–O, E–I) permanecem válidas incondicionalmente**. Contrariedade (A,E), subcontrariedade (I,O) e subalternação (A→I, E→O) todas quebram quando a classe do sujeito pode ser vazia — confirmado testando o motor: `A ∧ E` é satisfazível (ambas vacuamente verdadeiras se não há Alunos), `¬I ∧ ¬O` é satisfazível (ambas vacuamente falsas pelo mesmo motivo), e `A ∧ ¬I` é satisfazível (subalternação falha). Isso é uma ótima oportunidade de discutir a diferença entre lógica aristotélica (que assume a classe do sujeito não-vazia) e lógica moderna — não um erro da ferramenta.

---

## 9. Suporte bilíngue (PT-BR / EN-CA)

- **Escopo:** apenas rótulos de interface, mensagens de erro, nomes das regras do tableau e texto de ajuda/documentação. A notação lógica (∧, ∨, ¬, →, ↔, ∀, ∃) é universal e não muda entre idiomas.
- **Implementação:** dicionário de strings de UI externalizado desde o início do desenvolvimento (chave → texto PT-BR / EN-CA), para não exigir refatoração posterior.
- **Sequência:** construir e estabilizar a versão PT-BR primeiro; ligar o toggle EN-CA depois — consistente com a abordagem já adotada no restante do site.

---

## 10. Checklist de funcionalidades confirmadas

**Pedagógicas**
- [ ] Expansão passo a passo (botão "próximo passo"), com legenda da regra aplicada
- [ ] Indicação de ramo fechado/aberto + conclusão final (válida/contraditória/satisfazível)
- [ ] Geração de contramodelo a partir de ramo aberto
- [ ] Suporte a sequentes com múltiplas premissas (Γ ⊢ φ)
- [ ] Modo desafio/quiz
- [ ] Geração automática de tabela-verdade (fórmulas proposicionais)
- [ ] Comparador de relações de oposição (contraditórias/contrárias/subcontrárias/subalternas/equivalentes/independentes)

**Parser / robustez**
- [ ] Identificadores multi-letra para termos e predicados
- [ ] Notação Unicode + ASCII intercambiável
- [ ] Validação de BFF com posição exata do erro
- [ ] Destaque de variáveis livres (independentes) vs. presas (dependentes) na fórmula, com tooltip do quantificador vinculante
- [ ] Explicação da skolemização nos passos δ

**UX**
- [ ] Teclado virtual de símbolos lógicos
- [ ] Exportar árvore (PNG/SVG)
- [ ] Compartilhamento via URL (fórmula codificada na query string)
- [ ] Histórico local de fórmulas testadas
- [ ] Responsivo (mobile)
- [ ] Identidade visual do site (Silkscreen + Source Serif 4, paleta Paper/Ink/Teal/Amber/Royal/Stone)
- [ ] Interface bilíngue PT-BR / EN-CA (PT-BR primeiro, toggle EN-CA depois)

**Extras**
- [ ] Página de ajuda/documentação do método
- [ ] Botão de exemplos prontos (lista a definir)

---

## 11. Exemplos prontos — v1 (15 exemplos)

Lista inicial aprovada; pode ser expandida com novos casos ao longo do desenvolvimento.

**Nível 1 — Lógica proposicional, primeiro contato**
1. `p ∧ ¬p` — contradição pura (ramo fecha imediatamente)
2. `p ∨ ¬p` — tautologia (Lei do Terceiro Excluído)
3. `p ∧ q` — contingência simples (boa para introduzir a tabela-verdade)

**Nível 2 — Argumentos clássicos (proposicional)**
4. Modus Ponens: `((p → q) ∧ p) → q`
5. Modus Tollens: `((p → q) ∧ ¬q) → ¬p`
6. Silogismo disjuntivo: `((p ∨ q) ∧ ¬p) → q`
7. Falácia da afirmação do consequente: `((p → q) ∧ q) → p` (inválido — ramo aberto/contramodelo)
8. Leis de De Morgan: `¬(p ∧ q) ↔ (¬p ∨ ¬q)` (tautologia)

**Nível 3 — Sintaxe (erros propositais)**
9. `(p ∧ → q)` — conectivo mal posicionado
10. `((p ∧ q) → r` — parêntese não fechado

**Nível 4 — Predicados, primeiro contato**
11. Silogismo de Barbara: premissas `∀x(Homem(x) → Mortal(x))` e `Homem(socrates)`, conclusão `Mortal(socrates)` (testa constante multi-letra + variável)
12. `∀x(Aluno(x) → Estuda(x, logica))` — `x` preso/dependente, `logica` livre/independente na mesma fórmula
13. Dualidade de quantificadores: `¬∀x P(x) ↔ ∃x ¬P(x)` (tautologia)

**Nível 5 — Quadrado de oposição (usa o comparador da seção 8)**
14. As quatro proposições categóricas sobre o mesmo domínio, para comparação par a par (A×E contrárias, I×O subcontrárias, A×O e E×I contraditórias, A×I e E×O subalternas — com nota sobre importação existencial):
    - A: `∀x(Aluno(x) → Estuda(x))`
    - E: `∀x(Aluno(x) → ¬Estuda(x))`
    - I: `∃x(Aluno(x) ∧ Estuda(x))`
    - O: `∃x(Aluno(x) ∧ ¬Estuda(x))`

**Nível 6 — Avançado**
15. Ordem dos quantificadores importa: `∀x∃y Ama(x, y)` vs. `∃y∀x Ama(x, y)` (não equivalentes)

Backlog: outros casos a definir posteriormente pelo usuário.

---

## 12. Próximos passos sugeridos

1. ~~Definir a lista inicial de exemplos prontos~~ — concluído (seção 11)
2. ~~Prototipar o tokenizer + parser (AST) isoladamente, com testes~~ — concluído (seção 13)
3. ~~Implementar o avaliador de fórmulas~~ — concluído (seção 13)
4. ~~Implementar o motor de tableaux sobre o AST~~ — concluído (seção 13)
5. Construir o renderizador da árvore e a UI (e/ou o comparador de oposição como módulo fino sobre o motor de tableaux — seção 8)

---

## 13. Estado da implementação

**Concluído:**
- `js/lexer.js` — tokenizador (notação Unicode + ASCII, ver ajuste na seção 4)
- `js/ast.js` — construtores de nós da AST + serialização de volta para string normalizada
- `js/parser.js` — parser recursive descent conforme a gramática (seção 3); separa erros de sintaxe (fórmula inválida) de avisos de convenção de maiúscula/minúscula (fórmula válida, mas fora do estilo recomendado)
- `js/scope-analyzer.js` — marca cada ocorrência de termo como presa/dependente ou livre/independente, por ocorrência (não por nome global)
- `js/evaluator.js` — avalia uma fórmula sob uma valoração; `generateTruthTable` implementa a seção 7 (só aceita fórmulas puramente proposicionais, recusa formalmente predicados/quantificadores); avaliador genérico o bastante para reaproveitar futuramente em checagem de modelo com domínio finito
- `js/tableau.js` — motor de tableaux completo: regras α/β/γ/δ + reescrita de quantificadores negados (seção 6), fechamento de ramo, extração de contramodelo, e as funções de conveniência `checkTautology`, `checkSatisfiability`, `checkValidity`. Limitação assumida por design: domínio sempre não-vazio (convenção padrão), sem unificação plena, com limite de passos (`maxSteps`, padrão 500) para evitar loops infinitos em fórmulas de primeira ordem não terminantes
- `test/demo.js` — 24/24 (lexer/parser/escopo)
- `test/test-evaluator.js` — 9/9 (avaliador/tabela-verdade)
- `test/test-tableau.js` — 13/13 (tableaux proposicional, Barbara, dualidade de quantificadores, e exploração do quadrado de oposição — achado registrado na seção 8)

**Pendente:** comparador de oposição (módulo fino sobre `tableau.js`), renderizador/UI, i18n.
