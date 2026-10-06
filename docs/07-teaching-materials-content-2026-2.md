# Conteúdo didático — carga inicial 2026/II

Este pacote preenche o catálogo criado em `docs/06-teaching-materials.md` e adiciona a primeira carga de PDFs públicos.

## Estratégia desta primeira carga

Os 14 PDFs desta carga inicial são servidos como ativos estáticos do próprio frontend, sob `frontend/assets/materiais/`. O conjunto tem tamanho moderado e isso permite aplicar a atualização integralmente com o mecanismo já existente (`scripts/apply-update.sh`), sem alterar backend, banco de dados ou credenciais.

Para uma biblioteca futura significativamente maior, o armazenamento pode ser migrado para Cloudflare R2 sem mudar o modelo do catálogo; os campos `url` do `frontend/data/materials.json` passam a apontar para os objetos publicados no R2.

## Estrutura de diretórios

- `frontend/assets/materiais/logica/2026-2/`
- `frontend/assets/materiais/introducao-computacao/2026-2/`
- `frontend/assets/materiais/gestao-projetos/2026-2/`
- `frontend/assets/materiais/estruturas-dados/2026-2/`

Os nomes físicos dos arquivos usam apenas caracteres ASCII, minúsculas e hífens para evitar problemas de URL e de sistemas de arquivos.

## Publicação

Todos os itens desta carga estão marcados como `published`. Provas e gabaritos podem ser ocultados a qualquer momento alterando o campo `status` para outro valor; `materials.js` só renderiza itens cujo estado seja `published`.

## Validação antes do commit

Na raiz do repositório:

```bash
python3 -m http.server 8000 --directory frontend
```

Verifique as páginas de Lógica, Introdução à Computação, Gestão de Projetos, Estruturas de Dados e Sistemas Operacionais. Abra ao menos um PDF de cada disciplina e teste os filtros de tipo e os botões de download.

Depois:

```bash
git status --short
git diff --stat
```

Somente após a revisão local faça `git add`, `git commit` e `git push`.
