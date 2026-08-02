// parser.js — Analisador sintático (recursive descent) para o Lógica Mór
//
// Gramática (ver especificação técnica, seção 3):
//   formula   := atomica | "¬" formula | "(" formula conectivo formula ")"
//              | quantificador IDENT formula
//   atomica   := IDENT | IDENT "(" termo ("," termo)* ")"
//   termo     := IDENT
//
// Erros de estrutura (parênteses desbalanceados, conectivo ausente, etc.)
// são erros "duros" (a fórmula não é bem formada). Violações da convenção
// de maiúscula/minúscula (seção 2 da especificação) são avisos "leves":
// a fórmula continua sendo bem formada, mas foge do estilo recomendado —
// isso é reportado separadamente para não confundir "sintaxe inválida"
// com "estilo não recomendado".

import { tokenize, TokenType, LexError } from './lexer.js';
import { Proposition, Predicate, Term, Not, BinaryOp, Quantifier, NodeType } from './ast.js';

export class ParseError extends Error {
  constructor(message, pos) {
    super(message);
    this.name = 'ParseError';
    this.pos = pos;
  }
}

function startsUpper(s) {
  const c = s[0];
  return c === c.toUpperCase() && c !== c.toLowerCase();
}

function startsLower(s) {
  const c = s[0];
  return c === c.toLowerCase() && c !== c.toUpperCase();
}

const CONNECTIVE_NODE_TYPE = {
  [TokenType.AND]: NodeType.AND,
  [TokenType.OR]: NodeType.OR,
  [TokenType.IMPLIES]: NodeType.IMPLIES,
  [TokenType.IFF]: NodeType.IFF,
};

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.warnings = [];
  }

  peek() {
    return this.tokens[this.pos];
  }

  advance() {
    return this.tokens[this.pos++];
  }

  expect(type, message) {
    const tok = this.peek();
    if (tok.type !== type) {
      const found = tok.type === TokenType.EOF ? 'fim da entrada' : `"${tok.value}"`;
      throw new ParseError(message || `Esperado ${type}, encontrado ${found}`, tok.pos);
    }
    return this.advance();
  }

  parseFormula() {
    const tok = this.peek();

    if (tok.type === TokenType.NOT) {
      this.advance();
      const operand = this.parseFormula();
      return Not(operand, tok.pos);
    }

    if (tok.type === TokenType.FORALL || tok.type === TokenType.EXISTS) {
      this.advance();
      const varTok = this.expect(TokenType.IDENT, 'Esperado um identificador de variável após o quantificador');
      this.checkLowerCase(varTok, 'termos e variáveis');
      const body = this.parseFormula();
      const nodeType = tok.type === TokenType.FORALL ? NodeType.FORALL : NodeType.EXISTS;
      return Quantifier(nodeType, varTok.value, body, tok.pos);
    }

    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const left = this.parseFormula();
      const opTok = this.parseConnective();
      const right = this.parseFormula();
      this.expect(TokenType.RPAREN, 'Parêntese de fechamento ")" esperado');
      return BinaryOp(CONNECTIVE_NODE_TYPE[opTok.type], left, right, tok.pos);
    }

    if (tok.type === TokenType.IDENT) {
      return this.parseAtomic();
    }

    const found = tok.type === TokenType.EOF ? '(fim da entrada)' : `"${tok.value}"`;
    throw new ParseError(`Token inesperado ${found}`, tok.pos);
  }

  parseConnective() {
    const tok = this.peek();
    if (!(tok.type in CONNECTIVE_NODE_TYPE)) {
      const found = tok.type === TokenType.EOF ? 'fim da entrada' : `"${tok.value}"`;
      throw new ParseError(`Esperado um conectivo binário (∧ ∨ → ↔), encontrado ${found}`, tok.pos);
    }
    return this.advance();
  }

  parseAtomic() {
    const nameTok = this.expect(TokenType.IDENT, 'Esperado um identificador');

    if (this.peek().type === TokenType.LPAREN) {
      // predicado: Nome(termo, termo, ...)
      if (!startsUpper(nameTok.value)) {
        this.warnings.push({
          message: `Por convenção, nomes de predicado começam com letra maiúscula (recebido "${nameTok.value}")`,
          pos: nameTok.pos,
        });
      }
      this.advance(); // consome "("
      const args = this.parseTermList();
      this.expect(TokenType.RPAREN, 'Parêntese de fechamento ")" esperado na lista de termos');
      return Predicate(nameTok.value, args, nameTok.pos);
    }

    // proposição atômica (lógica proposicional)
    this.checkLowerCase(nameTok, 'proposições');
    return Proposition(nameTok.value, nameTok.pos);
  }

  parseTermList() {
    const terms = [this.parseTerm()];
    while (this.peek().type === TokenType.COMMA) {
      this.advance();
      terms.push(this.parseTerm());
    }
    return terms;
  }

  parseTerm() {
    const tok = this.expect(TokenType.IDENT, 'Esperado um termo (constante ou variável)');
    this.checkLowerCase(tok, 'termos e variáveis');
    return Term(tok.value, tok.pos);
  }

  checkLowerCase(tok, label) {
    if (!startsLower(tok.value)) {
      this.warnings.push({
        message: `Por convenção, ${label} começam com letra minúscula (recebido "${tok.value}")`,
        pos: tok.pos,
      });
    }
  }
}

/**
 * Analisa uma string de entrada e retorna o resultado.
 *
 * Sucesso: { ok: true, ast, warnings: [{message, pos}, ...] }
 * Falha:   { ok: false, error: { message, pos } }
 */
export function parse(input) {
  let tokens;
  try {
    tokens = tokenize(input);
  } catch (e) {
    if (e instanceof LexError) {
      return { ok: false, error: { message: e.message, pos: e.pos } };
    }
    throw e;
  }

  const parser = new Parser(tokens);
  try {
    const ast = parser.parseFormula();
    const trailing = parser.peek();
    if (trailing.type !== TokenType.EOF) {
      const found = `"${trailing.value}"`;
      return {
        ok: false,
        error: { message: `Texto inesperado após o fim da fórmula: ${found}`, pos: trailing.pos },
      };
    }
    return { ok: true, ast, warnings: parser.warnings };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: { message: e.message, pos: e.pos } };
    }
    throw e;
  }
}
