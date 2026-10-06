# Portal de materiais didáticos

Esta atualização introduz um catálogo de materiais para a seção **Ensino** sem alterar o backend FastAPI.

## Objetivos

- manter a navegação principal do site inalterada;
- organizar materiais por disciplina, semestre e tipo;
- separar conteúdo permanente de conteúdo específico de turma;
- evitar editar manualmente o HTML de cada disciplina a cada novo PDF;
- permitir que provas e gabaritos só apareçam quando o item estiver marcado como `published`;
- preservar Moodle/Blackboard como ambiente institucional oficial.

## Arquivos principais

- `frontend/data/materials.json`: catálogo de disciplinas e recursos;
- `frontend/js/materials.js`: renderização dos recursos;
- `frontend/css/teaching.css`: estilos exclusivos da seção Ensino.

As páginas migradas usam o atributo `data-discipline` para selecionar a disciplina correspondente no catálogo.

## Tipos de recurso

O catálogo reconhece: `slides`, `apostila`, `referencia`, `exercicios`, `avaliacao`, `gabarito`, `ferramenta` e `outros`.

## Estado de publicação

Somente recursos com `"status": "published"` são exibidos. Isso permite manter metadados de materiais ainda não liberados no catálogo sem mostrá-los aos alunos.

## Como testar localmente

Na raiz do repositório:

```bash
python3 -m http.server 8000 --directory frontend
```

Abrir no navegador:

- `http://localhost:8000/ensino.html`
- `http://localhost:8000/ensino-disciplinas.html`
- `http://localhost:8000/logica.html`
- `http://localhost:8000/gestao-projetos.html`
- `http://localhost:8000/introducao-computacao.html`
- `http://localhost:8000/estruturas-dados.html`
- `http://localhost:8000/sistemas-operacionais.html`

O Pacote 1 instala apenas a arquitetura. O Pacote 2 preenche o catálogo e adiciona os materiais selecionados.
