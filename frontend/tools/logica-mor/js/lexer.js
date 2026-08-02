// lexer.js — Tokenizador para o Lógica Mór
// Converte uma string de entrada em uma lista de tokens, aceitando tanto
// notação Unicode quanto ASCII equivalente (ver tabela na especificação, seção 4).

export const TokenType = Object.freeze({
  IDENT: 'IDENT',       // identificador: proposição, predicado ou termo
  NOT: 'NOT',           // ¬ ! ~
  AND: 'AND',           // ∧ &
  OR: 'OR',             // ∨ |
  IMPLIES: 'IMPLIES',   // → ->
  IFF: 'IFF',           // ↔ <->
  FORALL: 'FORALL',     // ∀ forall
  EXISTS: 'EXISTS',     // ∃ exists
  LPAREN: 'LPAREN',     // (
  RPAREN: 'RPAREN',     // )
  COMMA: 'COMMA',       // ,
  EOF: 'EOF',
});

export class LexError extends Error {
  constructor(message, pos) {
    super(message);
    this.name = 'LexError';
    this.pos = pos;
  }
}

function isLetter(ch) {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
}

function isIdentChar(ch) {
  return /[A-Za-z0-9_À-ÖØ-öø-ÿ]/.test(ch);
}

// Palavras-chave ASCII para quantificadores. Não há abreviação de uma letra
// (ex.: "A"/"E") porque predicados de uma letra maiúscula (ex.: P(x)) já
// ocupam esse espaço — ver nota na seção 4 da especificação.
const KEYWORDS = {
  forall: TokenType.FORALL,
  exists: TokenType.EXISTS,
};

/**
 * Tokeniza uma string de entrada.
 * @param {string} input
 * @returns {{type: string, value: string, pos: number}[]}
 */
export function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // espaço em branco
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // identificadores e palavras-chave ASCII
    if (isLetter(ch)) {
      const start = i;
      let value = '';
      while (i < n && isIdentChar(input[i])) {
        value += input[i];
        i++;
      }
      const keyword = KEYWORDS[value];
      if (keyword) {
        tokens.push({ type: keyword, value, pos: start });
      } else {
        tokens.push({ type: TokenType.IDENT, value, pos: start });
      }
      continue;
    }

    // símbolos únicos (unicode)
    if (ch === '¬' || ch === '~' || ch === '!') {
      tokens.push({ type: TokenType.NOT, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '∧' || ch === '&') {
      tokens.push({ type: TokenType.AND, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '∨' || ch === '|') {
      tokens.push({ type: TokenType.OR, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '→') {
      tokens.push({ type: TokenType.IMPLIES, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '↔') {
      tokens.push({ type: TokenType.IFF, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '∀') {
      tokens.push({ type: TokenType.FORALL, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '∃') {
      tokens.push({ type: TokenType.EXISTS, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: TokenType.LPAREN, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: TokenType.RPAREN, value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: TokenType.COMMA, value: ch, pos: i });
      i++;
      continue;
    }

    // símbolos ASCII de dois/três caracteres: -> e <->
    if (ch === '-' && input[i + 1] === '>') {
      tokens.push({ type: TokenType.IMPLIES, value: '->', pos: i });
      i += 2;
      continue;
    }
    if (ch === '<' && input[i + 1] === '-' && input[i + 2] === '>') {
      tokens.push({ type: TokenType.IFF, value: '<->', pos: i });
      i += 3;
      continue;
    }

    throw new LexError(`Caractere inesperado "${ch}"`, i);
  }

  tokens.push({ type: TokenType.EOF, value: '', pos: n });
  return tokens;
}
