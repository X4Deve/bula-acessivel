# Arquitetura e operação — Bula Acessível

Este documento preserva as decisões técnicas do MVP. Para contexto de produto, mercado e entrega DIO, consulte o [README principal](../README.md). A especificação original está no [mega prompt](MEGA_PROMPT.md).

## Stack e limites de confiança

- React 19 e TypeScript.
- TanStack Start e TanStack Router.
- Tailwind CSS e shadcn/ui.
- Lovable Cloud com PostgreSQL, autenticação e Row Level Security (RLS).
- Funções de servidor com `createServerFn` para lógica interna.
- Validação Zod para entradas e respostas externas.

O navegador nunca recebe `MEDICAMENTOS_API_KEY`. Resultados externos não são promovidos automaticamente a conteúdo curado.

## Princípio: zero alucinação médica

- Nenhum conteúdo clínico é gerado, completado, traduzido ou inferido por IA.
- Bulas locais verificadas só aparecem após curadoria humana, com fonte, versão, data de conferência e aprovação registradas.
- Texto externo é reproduzido verbatim em visualização separada e identificado como não validado.
- Resultados externos nunca são salvos automaticamente como bula local, medicamento em uso ou conteúdo verificado.
- Se todas as fontes retornarem zero, a interface informa “Ainda não temos esta bula em texto acessível no aplicativo” e oferece o Bulário oficial.
- Falha de provedor é indisponibilidade, nunca evidência de medicamento inexistente.
- Links rotulados “Anvisa” são validados no cliente e no banco. Hosts permitidos: `https://consultas.anvisa.gov.br`, `https://anvisa.gov.br`, `https://www.anvisa.gov.br` e `https://www.gov.br/anvisa/...`.
- Publicação local usa `publish_leaflet_version`, com role administrativa e auditoria. Um trigger bloqueia publicação direta.
- Curadoria vencida mostra aviso, padrão de 180 dias configurável, sem remover o link oficial.
- Não há medicamentos fictícios ou seed clínico.

## Fluxo de pesquisa

```text
Formulário acessível
        |
        v
searchMedicines (servidor, validação e limite por instância)
        |
        +--> Catálogo local publicado no PostgreSQL
        |
        +--> medicamentos.api.br, quando MEDICAMENTOS_API_KEY existe
        |       fallback openFDA se a fonte brasileira falhar
        |
        +--> openFDA quando não há chave brasileira
        |
        v
Normalização e lista unificada no cliente
        |
        +--> Identidade local: /medicamentos/:id/bula
        +--> Identidade externa: /medicamentos/externos/:provider/:externalId
```

As identidades não são fundidas por nome: apresentações distintas permanecem distintas. A lista é ordenada de forma estável por origem e nome, sem depender do tempo de resposta.

### 1. Catálogo curado

Consulta real a `medicine_catalog` e `leaflet_versions`. Somente registros publicados e bulas publicadas ficam disponíveis publicamente. Rascunhos são restritos a administradores.

### 2. Fonte brasileira independente

- Provedor: `medicamentos.api.br`; **não é API oficial da Anvisa**.
- Pesquisa: `GET https://medicamentos.api.br/api/v1/medicamentos?nome=...&porPagina=20`.
- Leitura: `GET /api/v1/medicamentos/{registro}/bula`.
- Host fixo no código; não aceita URL do usuário, evitando proxy aberto/SSRF.
- `X-API-Key` somente no servidor, timeout de oito segundos, `cache: no-store` e validação Zod.
- Erros 401, 403, 404, 429, 5xx e timeout são normalizados sem declarar inexistência.
- No plano Free informado pelo provedor, a pesquisa tem limites próprios. A leitura da bula pode exigir Pro/Business do fornecedor.
- Um 403 de nível insuficiente explica a limitação e oferece o Bulário oficial; isso não altera o Premium do Bula Acessível.
- `urlBulaOficial` só é preservada em HTTPS no host `consultas.anvisa.gov.br`; qualquer outro endereço retorna à raiz oficial do Bulário.
- Antes de produção, é necessário revisar termos e licença de uso dos dados do provedor.

### 3. openFDA

- Fallback real sem chave brasileira ou quando a fonte brasileira falha.
- Pesquisa em `https://api.fda.gov/drug/label.json`, com campos de nome, princípio ativo ou fabricante conforme o filtro.
- O detalhe usa `set_id` e apresenta somente seções fornecidas pela API, no inglês original.
- Todo resultado informa que é FDA (Estados Unidos), não é bula aprovada no Brasil, está em inglês e precisa ser conferido com o correspondente da Anvisa.
- Não há tradução, equivalência de composição/concentração ou aconselhamento para produtos brasileiros.
- A cobertura de medicamentos brasileiros é limitada; limites de uso e 429 são tratados como indisponibilidade.

### 4. Anvisa

O [Bulário Eletrônico](https://consultas.anvisa.gov.br/#/bulario/) continua sendo a referência brasileira. O [guia oficial de acesso](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico) é oferecido ao usuário. Não foi identificada uma API pública oficial, estável e documentada do Bulário; não são usados endpoints privados nem scraping.

A importação de PDF local não é automatizada: o curador cola manualmente o texto oficial em cada seção para revisão humana.

## Rotas

### Públicas

- `/`
- `/buscar`
- `/medicamentos/:id/bula`, com `?versao=` para snapshot histórico
- `/medicamentos/externos/:provider/:externalId`
- `/entrar`
- `/cadastro`
- `/recuperar-senha`
- `/redefinir-senha`
- `/planos`
- `/privacidade`
- `/termos`

### Protegidas

As rotas sob `_authenticated` não usam SSR para dados pessoais.

- `/app`
- `/app/minha-biblioteca`
- `/app/medicamentos/:id`
- `/app/assinatura`
- `/app/lembretes` — Premium
- `/app/acompanhamento` — Premium e consentimento
- `/app/configuracoes`
- `/admin` — role `admin`

## Banco e permissões

O schema e as migrações estão em:

- `drizzle/schema.ts`
- `drizzle/migrations/0000_bula_acessivel_schema.sql`
- `drizzle/migrations/0001_fix_publication_guard.sql`
- `drizzle/migrations/0002_revoke_anon_definer_exec.sql`

As principais entidades são perfis, roles, configurações, catálogo, versões de bulas, medicamentos do usuário, categorias, histórico opcional, pedidos e entitlements, lembretes, eventos de notificação, check-ins e auditoria.

### Regras

- RLS habilitada e permissões explícitas nas tabelas públicas.
- Dados pessoais: `auth.uid() = user_id`.
- Catálogo e bulas publicadas: leitura pública.
- Rascunhos e auditoria: acesso administrativo conforme a política.
- Roles ficam em `public.user_roles`; não derivam de metadados editáveis pelo usuário.
- Privilégios e publicação usam funções `SECURITY DEFINER` com `has_role`.
- Premium é verificado por `is_premium()` na RLS, não apenas na interface.
- O histórico de busca é opt-in e a tentativa de escrita não ocorre quando está desativado.
- Check-ins exigem consentimento explícito.

## Bootstrap seguro do administrador

Não há admin automático, e-mail fixo no código ou concessão no primeiro cadastro. Depois que a pessoa autorizada criar e confirmar a conta, o proprietário executa uma operação controlada no banco:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'email-da-pessoa@exemplo.com';
```

Para remover:

```sql
delete from public.user_roles where user_id = 'uuid-da-pessoa';
```

Usuários não escrevem em `user_roles`; só leem a própria linha. O menu “Gerenciar assinaturas” aparece somente para a role administrativa. Em uma sessão antiga, pode ser necessário atualizar a página ou entrar novamente.

## Premium sem pagamento

1. “Solicitar Premium” cria pedido `pending`; nada é cobrado.
2. O painel administrativo lista pendentes primeiro, com contadores e filtros.
3. Aprovar ou rejeitar exige diálogo acessível de confirmação.
4. Rejeição exige motivo; envio duplicado é bloqueado.
5. `review_subscription_request` valida admin, registra auditoria e é idempotente.
6. Aprovação cria entitlement com `is_payment_confirmed = false`.
7. Um gateway futuro deverá confirmar pagamento no servidor; o MVP não simula essa etapa.

## Lembretes e check-ins

- Fuso `America/Sao_Paulo`.
- Dias, recorrência, período e horários vêm do usuário conforme sua prescrição.
- Nenhum horário ou dose é sugerido.
- A agenda é persistida em `reminder_schedules`; ocorrências são calculadas e exibidas.
- Não há entrega externa de e-mail ou push implementada ou simulada.
- Uma integração futura precisa de canal real, agenda idempotente e `notification_events` único por lembrete e horário.
- `RESEND_API_KEY` não está configurado e não existe integração Resend no código desta entrega.
- Check-ins são subjetivos e não concluem eficácia, falha, diagnóstico, troca, interrupção ou dose.

## Segurança e LGPD

- Dados de medicamentos e check-ins são dados sensíveis de saúde.
- Minimização, consentimento granular e histórico desligado por padrão.
- Exportação em JSON, exclusão de dados pessoais e exclusão de conta nas configurações.
- Termos de busca não entram na URL nem em analytics.
- Validação Zod, sanitização antes dos filtros e timeout externo.
- Rate limit de 30 buscas por minuto por IP em cada instância do Worker, sem guardar o termo; não é distribuído nem substitui limites dos provedores.
- Respostas de busca e detalhe externo usam `Cache-Control: private, no-store`.
- Segredos apenas em Project Settings → Secrets.
- Não registrar termos de saúde, dados pessoais ou segredos em logs.
- `.env.example` tem nomes sem valores. `.env` não deve ser versionado; o estado rastreado atual está explicitamente pendente no checklist do README.
- Textos de privacidade e termos são introdutórios e precisam de revisão jurídica; não há declaração de conformidade certificada.

## Acessibilidade — meta WCAG 2.2 AA, não certificada

- Idioma `pt-BR`, skip-link e landmarks.
- Um `h1` por página e hierarquia de títulos.
- Foco visível, alvos com pelo menos 44 px nos controles principais e navegação por teclado.
- `aria-live` para busca e ações.
- Erros associados aos campos com `aria-describedby`.
- Diálogos Radix com foco gerenciado, Escape e retorno ao acionador.
- Controles nativos para seleção e consentimento.
- Preferências de fonte, contraste e espaçamento salvas localmente e na conta.

### Checklist manual NVDA + Chrome

- [ ] `H` percorre títulos; cada seção da bula é um `h2` e o sumário leva às âncoras.
- [ ] `D` lista banner, navegação principal, conteúdo principal, rodapé e busca.
- [ ] Tab e Shift+Tab não encontram armadilhas; o skip-link é o primeiro item.
- [ ] Enter envia a pesquisa; o total é anunciado sem mover o foco.
- [ ] `H` chega ao total unificado e aos nomes dos cartões.
- [ ] Falhas 401, 429 e timeout são anunciadas como indisponibilidade, não inexistência.
- [ ] Resultados externos informam proveniência; o aviso internacional permanece audível.
- [ ] Detalhe externo percorre seções e não oferece salvar ou marcar como em uso.
- [ ] Cadastro vazio anuncia o resumo e cada campo lê seu erro.
- [ ] Diálogo “Marcar como estou tomando” recebe foco, fecha com Esc e devolve o foco.
- [ ] Admin: Aprovar/Rejeitar apenas abre o diálogo; Cancelar/Esc não altera o pedido.
- [ ] Rejeição sem motivo não envia a ação.
- [ ] A+/A− e alto contraste anunciam o estado.
- [ ] Zoom de 200% e 400% não elimina conteúdo nem ações.
- [ ] Repetir com VoiceOver e TalkBack.

O teste com NVDA real continua pendente; as capturas e os testes automatizados não substituem essa etapa.

## Testes automatizados

Scripts disponíveis em `package.json`:

```bash
bun run test
bun run test:watch
bun run lint
bun run build
```

Na verificação de 16 de novembro de 2026, quatro arquivos e **28 testes** passaram. A suíte cobre links oficiais, curadoria, seções vazias, lembretes, rotas externas, normalização, isolamento das fontes, lista unificada, falhas 401/403/404/429, timeout e preservação do texto FDA. Parte dos testes usa mocks; a busca brasileira ao vivo é evidenciada separadamente no README.
