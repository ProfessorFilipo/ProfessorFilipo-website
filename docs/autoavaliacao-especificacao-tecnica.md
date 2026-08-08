# Autoavaliação de Participação — especificação técnica

Gerador do relatório de autoavaliação de participação individual (Prática
em Engenharia de Software, e possivelmente outras disciplinas/professores
no futuro), em PDF, para entrega em uma tarefa do Moodle.

## Decisão central: sem persistência

Esta funcionalidade **não usa o banco de dados nem o bucket R2**. O aluno
preenche o formulário em `frontend/autoavaliacao.html`, o backend processa
tudo em memória e devolve um PDF para download — nada é gravado em disco,
banco ou cache em nenhuma etapa. Isso foi uma decisão deliberada (não uma
limitação temporária): o histórico completo já fica registrado no Moodle,
porque o aluno reenvia um PDF a cada sprint numa tarefa própria de lá.

Consequência prática: o professor não tem um painel consolidado por turma
neste site — a consolidação, se necessária, é feita a partir dos PDFs
entregues no Moodle.

## Fluxo

1. Professor publica no Moodle um link para `autoavaliacao.html`, com a
   turma/professor/disciplina/sprint como parâmetros de URL (ex.:
   `?turma=PES-2026-2&professor=...&disciplina=...&sprint=3&total=6`).
2. Aluno preenche um assistente em etapas (identificação → 5 critérios →
   reflexão → distribuição de contribuição, só no sprint final → resumo
   editável).
3. Ao confirmar, o frontend envia tudo — texto + até 5 arquivos de
   evidência — como `multipart/form-data` para
   `POST /autoavaliacao/gerar-relatorio`.
4. O backend valida e reprocessa cada evidência, monta o PDF, e devolve
   como download (`Content-Disposition: attachment`,
   `Cache-Control: no-store`).
5. Aluno baixa o PDF e sobe manualmente na tarefa correspondente do Moodle.

## Limites de evidência (aplicados nas duas camadas — client-side por
conforto, server-side como barreira real)

| | Imagem | PDF |
|---|---|---|
| Formatos | JPEG, PNG, WebP | PDF |
| Tamanho máx. | 5 MB | 5 MB |
| Outros limites | até 6000×6000 px | até 5 páginas |
| Por critério | até 1 evidência (pode ampliar para 3 depois, se necessário) | até 1 |

Soma de todas as evidências de uma submissão: até 20 MB (margem segura
abaixo do limite de 32 MiB por requisição do Cloud Run em HTTP/1.1).

## Segurança das evidências

- Tipo real do arquivo verificado pela assinatura binária
  (`app/services/validacao_arquivos.py::sniff_type`), nunca pela extensão
  ou pelo `Content-Type` declarado pelo navegador.
- Imagens são sempre recodificadas (nunca repassadas byte a byte): removem
  EXIF, são redimensionadas e recomprimidas — isso também neutraliza a
  maior parte de payloads maliciosos escondidos no arquivo original.
- PDFs de evidência são sanitizados com `pikepdf` antes de entrar no
  relatório final: remove JavaScript embutido (`OpenAction`, `AA`,
  `Names/JavaScript`) e anexos internos (`EmbeddedFiles`,
  `FileAttachment`).

## Numeração automática dos anexos

Cada evidência do tipo "documento" vira um "Anexo A", "Anexo B"... na
ordem dos critérios (`CRITERIOS_ORDEM` em `relatorio_pdf.py`) — a letra
nunca é escolhida pelo aluno, nasce da ordem de geração. Cada anexo tem
uma página divisória própria (sem o rodapé do relatório) antes das
páginas originais do PDF anexado.

## Nota calculada — sempre condicionada

A nota que aparece na seção final do relatório (`(média das 5 notas − 1)
× 2,5`, escala 0–10) é puramente aritmética sobre a autoavaliação — o
sistema não julga a qualidade da evidência, só a presença dela. O
relatório traz um aviso explícito sobre isso (uma única evidência pode
justificar nota alta em um critério; vários anexos podem não justificar
nota alta em outro) — a validação final é sempre manual, pelo professor.
Este mesmo aviso deve aparecer também na tela de geração (já implementado
no assistente).

## Hash de integridade

Não é hash dos bytes finais do PDF (seria autorreferente — o hash mudaria
o arquivo que muda o hash). É SHA3-224 sobre: nome do aluno + timestamp de
geração (UTC) + notas de cada critério + checksum de cada arquivo de
evidência processado, concatenados. Muda se qualquer nota for alterada
depois ou se uma evidência for trocada. Exibido por completo (sem abreviar
— o SHA3-224 já é curto o bastante, 56 caracteres hex) no rodapé e na
seção de resultado.

## Identidade visual

O PDF reaproveita as fontes (Silkscreen, Source Serif 4) e ícones
(`icon-gear`, `icon-cap`, `icon-chart`, `icon-seal`, `icon-doc`) já usados
no site, agora também copiados para `backend/app/assets/` — o container
do backend precisa da própria cópia desses arquivos porque roda
separado do frontend (Cloud Run vs. Cloudflare Workers), sem acesso aos
assets publicados no domínio.

## Dependências novas (backend)

`weasyprint` (geração do PDF a partir de HTML/CSS), `pikepdf`
(sanitização de PDF), `pypdf` (leitura/fusão de páginas), `Pillow`
(reprocessamento de imagem). O `Dockerfile` foi atualizado com as
bibliotecas de sistema que o WeasyPrint exige em tempo de execução
(Pango, cairo, gdk-pixbuf, HarfBuzz, fontconfig) — sem elas, `pip
install weasyprint` funciona mas a geração do PDF falha em runtime.

## O que ficou fora deste primeiro recorte

- Painel do professor com consolidação por turma/grupo (exigiria
  persistência — decisão deliberada de não incluir por ora).
- Assinatura digital de verdade (PAdES, via `pyHanko`) como alternativa
  mais forte ao hash simples — considerado, não implementado.
- Suporte oficial a múltiplos professores/turmas simultâneos: já funciona
  na prática (os campos turma/professor/disciplina são livres e vêm da
  URL), mas ainda não foi testado com outro professor de verdade.
