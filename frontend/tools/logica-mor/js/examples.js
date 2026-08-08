// examples.js — conjunto de exemplos prontos (ver especificação técnica,
// seção 11, e a página "Ferramenta: Lógica Mór" no Notion).
//
// Cada exemplo é ou modo "formula" (uma fórmula única — testa
// satisfatibilidade dela mesma) ou modo "argument" (premissas ⊢
// conclusão — testa validade). Os quatro itens do quadrado de oposição
// (nível 5) foram desmembrados em quatro exemplos individuais
// carregáveis — o conjunto original os listava como um grupo de 4 para
// comparação par a par, mas o comparador de oposição (fase 3) ainda não
// existe, então cada um é útil isoladamente por enquanto.

export const EXAMPLE_LEVELS = [
  {
    id: 'proposicional',
    label: 'Proposicional básico e argumentos clássicos',
    examples: [
      { id: 'contradicao', title: 'Contradição pura', mode: 'formula', formula: '(p ∧ ¬p)' },
      { id: 'tautologia-terceiro-excluido', title: 'Tautologia (terceiro excluído)', mode: 'formula', formula: '(p ∨ ¬p)' },
      { id: 'contingencia', title: 'Contingência simples', mode: 'formula', formula: '(p ∧ q)' },
      { id: 'modus-ponens', title: 'Modus Ponens', mode: 'formula', formula: '(((p → q) ∧ p) → q)' },
      { id: 'modus-tollens', title: 'Modus Tollens', mode: 'formula', formula: '(((p → q) ∧ ¬q) → ¬p)' },
      { id: 'silogismo-disjuntivo', title: 'Silogismo disjuntivo', mode: 'formula', formula: '(((p ∨ q) ∧ ¬p) → q)' },
      { id: 'falacia-consequente', title: 'Falácia da afirmação do consequente (inválido)', mode: 'formula', formula: '(((p → q) ∧ q) → p)' },
      { id: 'de-morgan', title: 'Lei de De Morgan', mode: 'formula', formula: '(¬(p ∧ q) ↔ (¬p ∨ ¬q))' },
    ],
  },
  {
    id: 'sintaxe',
    label: 'Erros de sintaxe (propositais)',
    examples: [
      { id: 'erro-conectivo', title: 'Conectivo mal posicionado', mode: 'formula', formula: '(p ∧ → q)' },
      { id: 'erro-parenteses', title: 'Parêntese não fechado', mode: 'formula', formula: '((p ∧ q) → r' },
    ],
  },
  {
    id: 'predicados',
    label: 'Predicados — primeiro contato',
    examples: [
      {
        id: 'barbara',
        title: 'Silogismo de Barbara',
        mode: 'argument',
        premises: ['∀x(Homem(x) → Mortal(x))', 'Homem(socrates)'],
        conclusion: 'Mortal(socrates)',
      },
      {
        id: 'livre-presa',
        title: 'Variável presa e livre na mesma fórmula',
        mode: 'formula',
        formula: '∀x(Aluno(x) → Estuda(x, logica))',
      },
      {
        id: 'dualidade-quantificadores',
        title: 'Dualidade de quantificadores',
        mode: 'formula',
        formula: '(¬∀x P(x) ↔ ∃x ¬P(x))',
      },
    ],
  },
  {
    id: 'oposicao',
    label: 'Quadrado de oposição',
    examples: [
      { id: 'categorica-a', title: 'A — Universal afirmativa', mode: 'formula', formula: '∀x(Aluno(x) → Estuda(x))' },
      { id: 'categorica-e', title: 'E — Universal negativa', mode: 'formula', formula: '∀x(Aluno(x) → ¬Estuda(x))' },
      { id: 'categorica-i', title: 'I — Particular afirmativa', mode: 'formula', formula: '∃x(Aluno(x) ∧ Estuda(x))' },
      { id: 'categorica-o', title: 'O — Particular negativa', mode: 'formula', formula: '∃x(Aluno(x) ∧ ¬Estuda(x))' },
    ],
  },
  {
    id: 'avancado',
    label: 'Avançado',
    examples: [
      {
        id: 'ordem-quantificadores',
        title: 'A ordem dos quantificadores importa (argumento inválido)',
        mode: 'argument',
        premises: ['∀x∃y Ama(x, y)'],
        conclusion: '∃y∀x Ama(x, y)',
      },
    ],
  },
];
