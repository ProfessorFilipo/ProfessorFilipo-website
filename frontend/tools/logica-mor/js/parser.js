// parser.js — Analisador sintático (recursive descent com precedência de
// operadores) para o Lógica Mór
//
// Gramática (ver especificação técnica, seção 3), por nível de precedência
// — do mais frouxo (mais externo) ao mais apertado (mais interno):
//   formula      := iff
//   iff          := implicacao ( "↔" implicacao )*        (associativo — não importa)
//   implicacao   := disjuncao ( "→" implicacao )?          (associativo à direita)
//   disjuncao    := conjuncao ( "∨" conjuncao )*           (associativo à esquerda)
//   conjuncao    := unario ( "∧" unario )*                 (associativo à esquerda)
//   unario       := "¬" unario | primario
//   primario     := atomica | "(" formula ")" | quantificador IDENT unario
//   atomica      := IDENT | IDENT "(" termo ("," termo)* ")"
//   termo        := IDENT
//
// Precedência padrão ¬ > ∧ > ∨ > → > ↔ permite escrever "p∧q∨p∧r" sem
// parênteses — mas SEMPRE que mais de um conectivo é combinado dentro do
// mesmo trecho sem parênteses explícitos (mesmo que seja o mesmo operador
// repetido), um aviso é emitido mostrando a forma canônica totalmente
// parenteizada, pra deixar claro como a ferramenta interpretou. Um único
// conectivo isolado (ex.: "p→q") não gera aviso — não há nada pra
// desambiguar aí.
//
// O corpo de um quantificador (∀x/∃x) continua no nível "unário" — ou
// seja, o quantificador liga só à próxima subfórmula imediata (átomo,
// negação, grupo parenteizado ou outro quantificador), igual já era antes
// desta mudança. "∀x P(x) ∧ Q(x)" continua sendo "(∀x P(x)) ∧ Q(x)", não
// "∀x (P(x) ∧ Q(x))" — pra isso, o parêntese em volta do corpo continua
// necessário, como sempre foi.
//
// Erros de estrutura (parênteses desbalanceados, conectivo ausente, etc.)
// são erros "duros" (a fórmula não é bem formada). Violações da convenção
// de maiúscula/minúscula (seção 2 da especificação) são avisos "leves":
// a fórmula continua sendo bem formada, mas foge do estilo recomendado —
// isso é reportado separadamente para não confundir "sintaxe inválida"
// com "estilo não recomendado".

import { tokenize, TokenType, LexError } from './lexer.js';
import { Proposition, Predicate, Term, Not, BinaryOp, Quantifier, NodeType, formulaToString } from './ast.js';

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

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.warnings = [];
    this.usedPrecedence = false;
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

  // Ponto de entrada da gramática de fórmulas — nível mais frouxo (↔).
  // Cada nível de precedência retorna { node, count }, onde count é
  // quantos operadores binários foram combinados nesta "corrida" sem
  // atravessar parênteses explícitos. Um parêntese SEMPRE reinicia a
  // contagem pra 0 na volta pro contexto de fora — o grupo parenteizado
  // já foi explicitamente desambiguado pelo usuário, então não deve
  // "contaminar" a contagem do que está ao redor dele. Só quando o total
  // de operadores combinados numa mesma corrida é MAIOR QUE 1 é que a
  // precedência foi de fato necessária pra decidir o agrupamento — um
  // único conectivo isolado (ex.: "p→q") nunca precisa disso.
  parseFormula() {
    const { node, count } = this.parseIff();
    if (count > 1) this.usedPrecedence = true;
    return node;
  }

  parseIff() {
    let { node: left, count } = this.parseImplication();
    while (this.peek().type === TokenType.IFF) {
      const tok = this.advance();
      const { node: right, count: rCount } = this.parseImplication();
      left = BinaryOp(NodeType.IFF, left, right, tok.pos);
      count += rCount + 1;
    }
    return { node: left, count };
  }

  parseImplication() {
    const { node: left, count } = this.parseDisjunction();
    if (this.peek().type === TokenType.IMPLIES) {
      const tok = this.advance();
      const { node: right, count: rCount } = this.parseImplication(); // associativo à direita: p→q→r = p→(q→r)
      return { node: BinaryOp(NodeType.IMPLIES, left, right, tok.pos), count: count + rCount + 1 };
    }
    return { node: left, count };
  }

  parseDisjunction() {
    let { node: left, count } = this.parseConjunction();
    while (this.peek().type === TokenType.OR) {
      const tok = this.advance();
      const { node: right, count: rCount } = this.parseConjunction();
      left = BinaryOp(NodeType.OR, left, right, tok.pos);
      count += rCount + 1;
    }
    return { node: left, count };
  }

  parseConjunction() {
    let { node: left, count } = this.parseUnary();
    while (this.peek().type === TokenType.AND) {
      const tok = this.advance();
      const { node: right, count: rCount } = this.parseUnary();
      left = BinaryOp(NodeType.AND, left, right, tok.pos);
      count += rCount + 1;
    }
    return { node: left, count };
  }

  parseUnary() {
    const tok = this.peek();

    if (tok.type === TokenType.NOT) {
      this.advance();
      const { node: operand, count } = this.parseUnary();
      return { node: Not(operand, tok.pos), count };
    }

    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === TokenType.FORALL || tok.type === TokenType.EXISTS) {
      this.advance();
      const varTok = this.expect(TokenType.IDENT, 'Esperado um identificador de variável após o quantificador');
      this.checkLowerCase(varTok, 'termos e variáveis');
      const { node: body, count } = this.parseUnary();
      const nodeType = tok.type === TokenType.FORALL ? NodeType.FORALL : NodeType.EXISTS;
      return { node: Quantifier(nodeType, varTok.value, body, tok.pos), count };
    }

    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const inner = this.parseFormula(); // já resolve/registra a contagem própria e retorna só o nó
      this.expect(TokenType.RPAREN, 'Parêntese de fechamento ")" esperado');
      return { node: inner, count: 0 }; // grupo parenteizado é sempre explícito — não conta pra fora
    }

    if (tok.type === TokenType.IDENT) {
      return { node: this.parseAtomic(), count: 0 };
    }

    const found = tok.type === TokenType.EOF ? '(fim da entrada)' : `"${tok.value}"`;
    throw new ParseError(`Token inesperado ${found}`, tok.pos);
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

    const warnings = [...parser.warnings];
    if (parser.usedPrecedence) {
      warnings.push({
        message: `A precedência padrão dos operadores (¬ > ∧ > ∨ > → > ↔) foi usada pra interpretar esta fórmula sem parênteses explícitos. Interpretada como: ${formulaToString(ast)} — se não era essa a intenção, adicione parênteses.`,
        pos: tokens[0] ? tokens[0].pos : 0,
      });
    }

    return { ok: true, ast, warnings };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: { message: e.message, pos: e.pos } };
    }
    throw e;
  }
}
