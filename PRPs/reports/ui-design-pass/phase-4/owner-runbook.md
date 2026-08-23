# Roteiro do dono — verificação da fase 4 (ui-design-pass)

Este documento é escrito em português porque é para você seguir — os outros
dois registros desta fase (`level-a-walk.md`, `build-report.md`) ficam em
inglês, como todo o resto do repositório. Siga os passos em ordem. O que
fecha a atividade A5 é a sua resposta no passo 7 — não uma suíte verde
sozinha.

## 1. Os gates que você pode rodar você mesmo

Antes de mais nada, confirme que a base está verde (o Implementer já rodou os
três abaixo nesta sessão, mas vale conferir de novo se algo mudou):

```
npm run check
npm test
```

Os dois devem terminar sem erro. Se algum falhar, pare aqui e volte para o
pipeline — não faça deploy com um gate vermelho.

## 2. O deploy

Citando `documentation/40-engineering/dev-environment.md:70-77` (o passo a
passo do deploy recorrente):

| # | Comando | O que esperar |
|---|---|---|
| 5 | `npm run check` e `npm test` | Os dois verdes *antes* de tocar em produção. Não é negociável. |
| 6 | Ler o SQL pendente em `migrations/` | Confirmar que não há `PRAGMA foreign_keys=OFF/ON` solto. |
| 7 | `npm run db:migrate:remote` | Aplica em **produção** e confirma sozinho num shell não interativo. |
| 8 | `npm run deploy` | Termina com a URL e `schedule: */5 * * * *`. |

**Nota importante desta fase: não há migração nova.** A pasta `migrations/`
tem só `0000_neat_the_fallen.sql` e `0001_violet_pretty_boy.sql`, os dois já
aplicados desde o deploy da unidade 2 — confirmado nesta sessão (nenhum
arquivo novo em `migrations/`). Isso quer dizer que o passo 7
(`npm run db:migrate:remote`) **não faz nada desta vez** — ele roda, mas não
encontra migração pendente para aplicar. O comando que de fato muda produção
nesta fase é só o passo 8, `npm run deploy`. Rode o passo 7 mesmo assim (é
seguro e é o hábito certo), apenas não espere nenhuma mudança de schema dele.

**Ninguém além de você roda isso.** O pipeline (o plano, os agentes) nunca
chama `wrangler deploy` — confirmado nesta sessão: nenhum script em
`scripts/` contém essa chamada. O deploy é decisão e ação sua.

## 3. Teste de fumaça (depois do deploy)

Citando `documentation/40-engineering/dev-environment.md:106-119`. Com
`$TOKEN` = o `API_BEARER_TOKEN` de produção e `$BASE` =
`https://praesto.fabiobarreto.workers.dev`:

| Verificação | Comando | Esperado |
|---|---|---|
| Portão fechado | `curl -i $BASE/api/health` | `401 {"error":"Unauthorized"}` |
| Portão aberto | `curl -H "Authorization: Bearer $TOKEN" $BASE/api/health` | `200 {"ok":true}` |
| SPA servida | `curl $BASE/` | `200 text/html`, a casca do `Praesto Sum` |
| PWA instalável | `curl -o /dev/null $BASE/manifest.webmanifest` e cada `/icons/*.png` | `200`, tamanhos corretos |
| Ligação com D1 + migrações | `POST /api/tasks` depois `GET /api/tasks` | `201` e depois a mesma Tarefa de volta |
| Schema realmente aplicado | `npx wrangler d1 execute praesto-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` | `life_areas`, `push_subscriptions`, `recurrence_series`, `reminders`, `tasks`, `d1_migrations` |

A última verificação do teste de fumaça não tem equivalente em `curl`:
**instale o PWA e use de verdade.** É exatamente isso que os passos 4 e 5
abaixo pedem, já contra a nova aparência.

## 4. No celular Android

Cada linha é uma coisa para olhar, não um teste automático:

- [ ] **Início a frio (AC-1):** feche o app de vez, abra de novo — a tela de
      splash, a primeira pintura e o app já rodando devem mostrar a mesma cor
      `#161012`, sem nenhum flash branco no meio.
- [ ] **Campo de captura e teclado (AC-17):** toque no campo "O que precisa
      ser feito?" — o teclado deve abrir sem espremer nem cortar o rodapé; a
      lista continua rolando por trás dele.
- [ ] **Alvos de toque (AC-8):** percorra a lista tocando nos controles
      (círculo de concluir, lápis de editar, o próprio texto da tarefa) — nada
      deve exigir mira de precisão.
- [ ] **A folha de detalhe abre e o gesto de voltar do Android a fecha
      (AC-12; esta é a pergunta em aberto da PRD):** toque numa tarefa para
      abrir a folha de detalhe, depois use o gesto de **voltar** do Android
      (não o botão *Fechar* na tela). A folha deve fechar e você deve
      continuar dentro do app — nunca deve te jogar para fora do Praesto.
- [ ] **O mesmo gesto na confirmação de exclusão:** dentro da folha, toque em
      *Excluir*, depois use o gesto de voltar de novo — a folha deve fechar
      **sem excluir nada**.
- [ ] **Se o gesto de voltar te jogar para fora do app** em qualquer um dos
      dois casos acima: isso significa que o `<dialog>` nativo não está
      capturando o gesto neste seu Chrome. Nesse caso, peça para ligar o
      reforço já preparado (`history.pushState` ao abrir a folha, com
      `popstate` fechando-a) dentro de `Sheet.tsx` — é a única mudança de
      código prevista para esta fase além das quatro já feitas — e repita os
      dois testes acima depois.

## 5. No PC com Windows

Abra o mesmo endereço numa janela larga:

- [ ] A tela deve ficar centrada com uma coluna de largura limitada — nunca
      esticada de ponta a ponta da janela.
- [ ] Ao abrir a folha de detalhe, ela deve aparecer como um **cartão
      centrado de 560 px**, não como uma folha subindo do rodapé (isso só
      acontece no celular).

## 6. Lighthouse (opcional)

Nenhuma ferramenta de Lighthouse está instalada neste repositório, e nenhuma
vai ser instalada — a decisão do projeto é rodar isso à mão, do seu próprio
Chrome, quando quiser (`documentation/40-engineering/testing-strategy.md`).
Se quiser rodar:

- **No celular:** `chrome://inspect` no seu computador, conectado ao telefone
  por USB com a depuração ligada, rodando contra a URL de produção.
- **No PC:** abra a URL de produção, DevTools → aba Lighthouse, gere o
  relatório.

Os alvos (guidelines §11), caso rode:

| Medida | Alvo |
|---|---|
| LCP (maior pintura) | ≤ 2,5 s |
| INP (resposta à interação) | ≤ 200 ms |
| CLS (deslocamento de layout) | ≤ 0,1 |
| Nota de performance do Lighthouse (build de produção) | ≥ 90 |

Se não rodar, não tem problema — não é obrigatório, e o registro desta fase já
diz isso com todas as letras.

## 7. Seu veredito

Depois de passar pelos passos 3 a 6:

- [ ] **"Nada a mudar antes da unidade 3."** — se for isso, escreva a frase
      aqui embaixo com a data. É essa frase que fecha a atividade A5 e libera
      a A6 (o fechamento de documentação) para começar.
- [ ] **Ou a lista do que precisa mudar.** — se algo incomodar, liste aqui, um
      item por linha. Cada item vira uma nova tentativa deste mesmo plano
      (como aconteceu nas fases 2 e 3, quando o passo de verificação encontrou
      algo para ajustar).

```
Veredito: "testei, tudo funcionando" — nada a mudar antes da unidade 3.
Data: 2026-08-23
```

**Registrado.** O dono fez o deploy (Version `a312fa7c`), abriu o app no celular
Android e no PC com Windows e deu o veredito acima. Com isso:

- A atividade **A5 (`design-pass`) está `done`** em
  `documentation/50-planning/ui-ux-plan.md` — o sinal de saída dela era
  exatamente essa frase.
- A **A6 (`close-out`) está liberada**: sincronizar a documentação derivada,
  tirar a pausa do roadmap, marcar este plano como `deprecated` e levar as
  divergências acumuladas (listadas no plano da fase 4) para as guidelines.
- O veredito foi dado como um "tudo funcionando" global, não item a item. O
  único ponto que tinha consequência de código era a **Pergunta Aberta 1 da
  PRD** (o gesto de voltar do Android fechando a folha): como nada foi
  reportado, o reforço `history.pushState` previsto em `Sheet.tsx` **não foi
  ligado** — o `<dialog>` nativo dá conta. Se algum dia a folha deixar de
  fechar no gesto de voltar, é esse o reforço a acionar.

---

*Gerado pelo agente Implementer, tentativa 1, 2026-08-22. Este arquivo é a
única peça desta fase escrita para você — o resto (o passeio pelos 31
critérios de Nível A e o relatório de build) fica em inglês, como sempre.*
