# Simulador de substituição de páginas — integração

Preparado em 29/09/2026 a partir do ZIP do repositório fornecido pelo professor.
Base do ZIP: `855ac40a541280db613fce5c2e07f8eb262f89f9`.

## Arquivos deste pacote

| Arquivo | Alteração |
|---|---|
| `frontend/simulador-paginacao.html` | Novo simulador autônomo, com CSS/JS incorporados e links de retorno ao site. |
| `frontend/ferramentas.html` | Acrescenta o simulador ao catálogo de ferramentas e atualiza a descrição da página. |
| `frontend/sistemas-operacionais.html` | Acrescenta o acesso ao simulador na disciplina. |
| `docs/simulador-paginacao-integracao.md` | Este guia de aplicação, teste e publicação. |

O pacote contém somente esses quatro arquivos, com caminhos relativos à raiz do repositório. Não há pasta adicional envolvendo `frontend/` e `docs/`. Os dois HTML existentes preservam seu conteúdo e navegação anteriores.

## 1. Aplicar no Mac / PyCharm

Baixe `Atualizacao_Simulador_Paginacao.zip` para Downloads. No terminal do PyCharm:

```bash
cd /Users/fmor/PycharmProjects/ProfessorFilipo-website
git status
bash scripts/apply-update.sh "$HOME/Downloads/Atualizacao_Simulador_Paginacao.zip"
```

O estado inicial informado pelo professor era limpo e sincronizado. Se você tiver editado `ferramentas.html` ou `sistemas-operacionais.html` depois disso, compare os arquivos antes de aplicar: o script existente usa `unzip -o` e substitui esses dois arquivos. Os demais arquivos do projeto permanecem como estão.

Se o navegador tiver alterado o nome do ZIP ou salvado em outra pasta, ajuste o caminho. Também é possível extrair o ZIP em uma pasta temporária e copiar individualmente os quatro arquivos para seus destinos. No Finder, não substitua a pasta `frontend` inteira.

Confira:

```bash
git status --short
git diff --stat
git diff -- frontend/ferramentas.html frontend/sistemas-operacionais.html
```

O resultado deve conter somente dois HTML modificados e dois arquivos novos. `git diff` ainda não mostra o conteúdo dos arquivos não rastreados; abra os dois novos arquivos no PyCharm para vê-los.

## 2. Testar localmente

Na raiz do projeto:

```bash
python3 -m http.server 8000 --directory frontend
```

Mantenha esse terminal aberto. Acesse:

- http://localhost:8000/simulador-paginacao.html
- http://localhost:8000/ferramentas.html
- http://localhost:8000/sistemas-operacionais.html

No servidor Python local, use a extensão `.html`. Para encerrar o servidor, pressione Ctrl+C.

Roteiro de conferência:

1. Abra o simulador pelos dois links novos e confira os links de retorno.
2. Use **Próximo**, **Anterior** e **Ir ao final**. Na sequência padrão, espere FIFO **10**, LRU **9**, OPT **7** e Clock **9** faltas.
3. Abra **Por quê?** no Clock e reveja a varredura. Execute, pause e reinicie.
4. Em **Configuração**, escolha **Anomalia de Belady**, clique em **Aplicar e reiniciar** e vá ao final. O quadro adicional deve mostrar **9 faltas com 3 frames** e **10 com 4**.
5. Confira a visualização em janela larga (quatro algoritmos lado a lado), janela menor e celular. Abaixo de 1151 px a interface passa a duas colunas; em até 650 px, uma coluna.

O simulador não depende da API, do banco ou do backend. As páginas existentes mantêm o rodapé de status da API; eventual falha desse rodapé no teste local não afeta o simulador.

## 3. Publicar depois da conferência

Conforme `docs/03-deployment-guide.md`, o projeto usa Cloudflare Workers com ativos estáticos, e o push de alterações do frontend para `main` aciona a publicação automática. O README mais antigo cita Pages, mas a configuração `frontend/wrangler.jsonc` e o guia de deploy descrevem Workers. Este pacote não altera a configuração da hospedagem.

No terminal, após encerrar o servidor ou em uma segunda aba:

```bash
git add frontend/simulador-paginacao.html frontend/ferramentas.html frontend/sistemas-operacionais.html docs/simulador-paginacao-integracao.md
git diff --cached --stat
git commit -m "Adiciona simulador de substituicao de paginas"
git push origin main
```

O último comando envia os arquivos ao GitHub e pode publicar a atualização automaticamente. Execute-o depois da revisão local. Nenhum commit, push ou deploy foi feito na preparação deste pacote.

Depois que o deploy terminar, o caminho esperado é:

`https://filipomor.com/simulador-paginacao`

O Wrangler atual usa o comportamento padrão `auto-trailing-slash`, que serve arquivos como `simulador-paginacao.html` na URL sem extensão. Os links internos preservam `.html`, como os demais links do site, funcionando também no servidor Python local. A Cloudflare faz a normalização em produção.

Documentação oficial: https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/

Acompanhe o resultado no painel da Cloudflare, no projeto existente e na seção Deployments; a integração remota não foi consultada nesta preparação. Se não houver novo deploy após o push, confira a conexão Git e a branch configurada.

## Implementação e verificação

- JavaScript puro, incorporado no HTML, com estratégias FIFO, LRU, OPT e Clock separadas logicamente, snapshots e execução sincronizada.
- 1–8 frames; até 100 referências, de 0 a 999; memória inicialmente vazia.
- Clock: ponteiro começa em F0; cargas/hits atribuem R=1; falta limpa R=1 e avança; insere em livre/R=0 e avança; hit não move ponteiro.
- OPT usa o futuro completo e desempata pelo menor índice de frame.
- Oito testes do motor passaram, incluindo 160 sequências determinísticas e comparação com busca exaustiva para casos pequenos do OPT.
- Os testes dos controles em DOM emulado passaram. A variante integrada foi submetida ao mesmo teste funcional; os novos links e seus destinos também foram verificados.
- A inspeção visual renderizada local não pôde ser realizada pelo navegador remoto deste ambiente. Faça a conferência visual no navegador usado em aula antes de publicar.
- O código modular e os testes estão no pacote original `Simulador_Paginacao_Codigo_Completo.zip`. Esta integração usa a distribuição autônoma para seguir o padrão de `editor-tabelas-c.html`.

## Remover a funcionalidade no futuro

Se a alteração foi publicada em um commit exclusivo, `git revert` desse commit produz uma nova alteração que desfaz a integração preservando o histórico. Revise o revert e publique-o pelo mesmo fluxo do projeto.
