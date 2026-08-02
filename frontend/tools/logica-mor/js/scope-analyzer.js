// scope-analyzer.js — Identifica, para cada ocorrência de termo na AST,
// se ele é uma variável presa/dependente (ligada por um quantificador que
// a alcança) ou livre/independente (funciona como constante naquela
// sentença). Ver convenção na especificação, seção 2.
//
// Como o mesmo nome pode ser usado como variável em uma parte da fórmula
// e como constante em outra (ou até em fórmulas diferentes), a marcação é
// feita por OCORRÊNCIA, não por nome global.

import { NodeType } from './ast.js';

/**
 * Percorre a AST marcando cada nó TERM com:
 *   - bound: true (presa/dependente) | false (livre/independente)
 *   - boundBy: { variable, pos } do quantificador que a vincula, ou null
 *
 * @param {object} ast raiz da árvore sintática (retornada por parser.parse)
 * @returns {{ occurrences: object[], freeOccurrences: object[], hasFreeVariables: boolean }}
 */
export function analyzeScope(ast) {
  const occurrences = [];
  walk(ast, [], occurrences);
  const freeOccurrences = occurrences.filter((t) => t.bound === false);
  return {
    occurrences,
    freeOccurrences,
    hasFreeVariables: freeOccurrences.length > 0,
  };
}

function walk(node, scopeStack, occurrences) {
  switch (node.type) {
    case NodeType.PROPOSITION:
      return;

    case NodeType.TERM: {
      // busca da mais interna para a mais externa (sombreamento de nomes)
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const frame = scopeStack[i];
        if (frame.variable === node.name) {
          node.bound = true;
          node.boundBy = { variable: frame.variable, pos: frame.pos };
          occurrences.push(node);
          return;
        }
      }
      node.bound = false;
      node.boundBy = null;
      occurrences.push(node);
      return;
    }

    case NodeType.PREDICATE:
      for (const arg of node.args) walk(arg, scopeStack, occurrences);
      return;

    case NodeType.NOT:
      walk(node.operand, scopeStack, occurrences);
      return;

    case NodeType.AND:
    case NodeType.OR:
    case NodeType.IMPLIES:
    case NodeType.IFF:
      walk(node.left, scopeStack, occurrences);
      walk(node.right, scopeStack, occurrences);
      return;

    case NodeType.FORALL:
    case NodeType.EXISTS: {
      scopeStack.push({ variable: node.variable, pos: node.pos });
      walk(node.body, scopeStack, occurrences);
      scopeStack.pop();
      return;
    }

    default:
      throw new Error(`Nó desconhecido na análise de escopo: ${node.type}`);
  }
}
