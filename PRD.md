# PRD — RotaScan

**Documento de Requisitos de Produto**
**Versão:** 1.0
**Data:** 2026-06-22
**Autor:** Mateus Medeiros
**Status:** Aprovado para desenvolvimento (MVP)

---

## 1. Visão Geral

### 1.1 Propósito

**RotaScan** é uma aplicação web (PWA) para gestão de logística de last-mile, voltada para operadores que recebem encomendas de transportadoras (Amazon, Magazine Luiza, e outras a serem adicionadas) e distribuem para entrega via motoristas terceirizados em rotas por bairro.

### 1.2 Problema que resolve

A operação atual em galpão de Jataí/GO depende de processos manuais de conferência, sem rastreabilidade automática entre recebimento e entrega, sujeita a:
- Erros de duplicidade na bipagem (mesmo pacote contado duas vezes)
- Falta de visibilidade entre o que foi recebido e o que efetivamente saiu para entrega
- Ausência de auditoria sobre produtividade de colaboradores e motoristas
- Dificuldade em rastrear encomendas que retornaram ou foram devolvidas à origem

### 1.3 Objetivos

- **Operacional:** reduzir o tempo de bipagem e eliminar erros de duplicidade
- **Gestão:** dashboard em tempo real comparando volumes de recebimento × entrega
- **Auditoria:** rastreio completo do ciclo de vida de cada encomenda
- **Escalabilidade:** arquitetura preparada para múltiplos galpões e novas transportadoras

### 1.4 Não-objetivos (fora do escopo do MVP)

- App nativo iOS/Android (PWA atende como instalável)
- Roteirização inteligente (otimização de rota) — apenas registro manual de bairros por rota
- Integração via API com Amazon/Magalu (importação é via planilha Excel)
- Aplicativo dedicado para motorista (motorista não tem login)
- Pagamentos, financeiro, faturamento

---

## 2. Personas e Papéis

| Papel | Acesso | Responsabilidade |
|---|---|---|
| **Admin** | Total a todos os galpões e cadastros | Configurações globais, cadastro de galpões, gerentes e transportadoras |
| **Gerente de Galpão** | Apenas o próprio galpão | Criar rotas, gerenciar motoristas, ver dashboard do galpão |
| **Colaborador (Bipador)** | Apenas rotas atribuídas | Realizar bipagens (recebimento, entrega, retorno, devolução) |
| **Motorista** | **Sem login** | Recebe rota (impressa ou via WhatsApp) e devolve encomendas não entregues |

**Decisão arquitetural:** motorista é cadastro de referência, não usuário do sistema. Se no futuro precisar de app de motorista, será outra aplicação.

---

## 3. Escopo Funcional

### 3.1 Módulo de Cadastros

| Entidade | Campos principais | Observação |
|---|---|---|
| Cidades | nome, UF | Suporte multi-cidade desde o início |
| Galpões | cidade, nome, endereço | 1:N com cidade |
| Bairros | cidade, nome | Origem para composição de rotas |
| Transportadoras | nome, regex de validação, ativo | Regex permite adicionar nova transportadora sem deploy |
| Colaboradores | galpão, nome, CPF, email (para login) | Usuário Supabase Auth vinculado |
| Motoristas | galpão, nome, CPF, CNH, placa, telefone | Sem login |

### 3.2 Módulo de Operação

#### 3.2.1 Operações (sessão de trabalho)

A **Operação** é a unidade de trabalho que agrupa bipagens feitas por um colaborador em uma sessão. Substitui o modelo anterior onde a bipagem era atrelada diretamente à rota.

**Fluxo de uma operação:**

1. Colaborador inicia operação preenchendo:
   - **Transportadora** (Amazon / Magalu / outra)
   - **Data** (default: hoje)
   - **Tipo de Evento** (`RECEBIMENTO` / `ENTREGA` / `DEVOLUCAO_ORIGEM` / `RETORNO`)
2. Sistema cria operação com status `EM_ANDAMENTO`
3. Dentro da operação, colaborador seleciona a **rota ativa** (dropdown ou tabs) — todas as bipagens vão para essa rota
4. Colaborador pode **trocar de rota a qualquer momento** e **voltar para uma rota anterior** dentro da mesma operação — as bipagens vão se acumulando em cada rota
5. Botão **"Finalizar Operação"** trava a operação (status `FINALIZADA`), bloqueia novas bipagens e libera o relatório consolidado

**Regras:**
- Uma operação é restrita a **uma transportadora** e **um tipo de evento** (não mistura Amazon com Magalu, nem Recebimento com Entrega na mesma operação)
- Múltiplos colaboradores podem ter **operações simultâneas** ativas (cada um com a sua)
- Uma operação pode tocar em quantas rotas o colaborador precisar — N rotas dentro de 1 operação
- Após finalizada, a operação é imutável (edições exigem permissão de Admin + log de auditoria)

**Tela "Operações ativas" (Admin/Gerente):**
- Lista todas as operações `EM_ANDAMENTO` no galpão em tempo real
- Permite ver quem está bipando o quê neste momento
- Admin pode forçar finalização de operação travada (com confirmação + log)

#### 3.2.2 Rotas

- Cadastro prévio independente das operações: galpão, nome, bairros (N:N)
- Rota é um **template reutilizável** — não tem transportadora, tipo, motorista nem data fixos
- O **motorista é vinculado no momento da bipagem**, dentro da operação (qualquer motorista pode fazer qualquer rota)
- A **data** vem da operação que está usando a rota
- Rotas existentes podem receber bipagens de múltiplas operações com motoristas diferentes
- Status derivado por consulta: quantas bipagens hoje, qual motorista atual, última atividade

#### 3.2.3 Importação de Manifesto (Recebimento)

- Importação de planilha `.xlsx` enviada pela transportadora
- Lib client-side: `xlsx` (SheetJS) — sem custo serverless
- Pré-validação: identificar colunas (código, descrição, etc.)
- Manifesto fica vinculado à **operação de Recebimento** (não mais à rota)
- Após finalização da operação, relatório de conferência: **Encontradas** / **Faltantes** / **Extras**
- O manifesto é opcional para finalizar: sem manifesto, o diálogo de finalização avisa que a conferência não será feita e pede confirmação

#### 3.2.4 Bipagem (tela crítica)

**Pré-requisito:** operação ativa selecionada (criada via 3.2.1).

**Layout da tela:**
- Cabeçalho fixo: operação ativa (transportadora · tipo · data · colaborador) + botão "Finalizar Operação"
- **Seletor de Rota Ativa** sempre visível no topo (dropdown ou tabs com contador por rota)
- **Seletor de Motorista** ao lado do seletor de rota (motorista que vai levar essa rota nessa operação)
- Campo de bipagem grande com foco permanente
- Lista das últimas 10 bipagens da rota ativa
- Painel lateral com totais por rota dentro da operação

**Comportamento do input:**
- Foco automático e permanente no campo de código
- Aceita input do scanner USB (digita + Enter)
- Após cada bipe: tocar som correspondente E limpar o campo
- Cada bipagem é gravada com `operacao_id` + `rota_id` + `motorista_id` (rota e motorista selecionados no momento)
- Troca de rota é instantânea (< 100ms) — não interrompe o fluxo de bipagem
- Em operações de ENTREGA/DEVOLUCAO/RETORNO o motorista é obrigatório; em RECEBIMENTO o motorista pode ficar vazio (não se aplica)
- Trocar motorista no meio da rota é permitido (registra na próxima bipagem em diante) — útil quando há revezamento

**Validação por transportadora** (transportadora vem da operação ativa):
- **Amazon:** regex `^TBR\d{9}$` (ex.: `TBR374238668`)
  - Padrão válido → som de **confirmado** + grava bipagem
  - Padrão inválido → som de **erro** + não grava
  - Código já existe globalmente com mesmo `tipo_evento` → som de **duplicado** + não grava
- **Magazine Luiza:** sem regex — aceita qualquer string não vazia (tem código de barras na embalagem)
  - String válida → som de **confirmado** + grava
  - Código já existe globalmente com mesmo `tipo_evento` → som de **duplicado** + não grava

**Observação sobre duplicidade:** a regra `UNIQUE(transportadora_id, codigo, tipo_evento)` continua valendo cross-operação. Se o colaborador A bipa TBR123 em ENTREGA na operação 1, o colaborador B não consegue bipar TBR123 em ENTREGA na operação 2 — mesmo que sejam rotas diferentes.

**Sons (arquivos em `/public/sounds/`):**
- `confirmado.mp3` — beep agudo curto (~150ms)
- `duplicado.mp3` — beep duplo médio (~300ms)
- `erro.mp3` — beep grave longo (~500ms)

**UI:**
- Contador grande no topo: bipados na operação / duplicados / erros
- Sub-contador por rota ativa (ex.: "Rota Centro: 47 · Rota Bairro Alto: 32")
- Lista das últimas 10 bipagens da rota ativa com ícone de status
- Feedback visual de tela cheia (flash verde/amarelo/vermelho)
- Botão "Excluir bipagem": abre uma busca por código (digitado ou bipado) em todas as rotas da operação; o colaborador escolhe a bipagem na lista e confirma a exclusão. Vale para Recebimento, Entrega, Retorno e Devolução, inclui bipagens pendentes de sincronização e registra `bipagem_desfeita` na auditoria. Pelo RLS, em operação `EM_ANDAMENTO`: o colaborador exclui só as próprias bipagens, o gerente exclui as de qualquer colaborador do seu galpão e o admin exclui qualquer uma
- Botão "Trocar Rota" (atalho de teclado: F2 ou similar — não tirar mão do scanner)
- Botão grande "Finalizar Operação" (com confirmação)
- Indicador de modo online/offline
- Badge com nº de bipagens pendentes de sincronização

#### 3.2.4 Tela de Retorno

Tela separada onde colaborador bipa códigos de encomendas que voltaram ao galpão (não entregues). Após bipagem:
- Bipagem original em rota de Entrega é marcada como "retornada"
- Código fica novamente disponível para entrar em nova rota de Entrega
- Registra colaborador, data/hora, e opcionalmente motivo

#### 3.2.5 Tela de Devolução à Origem

Para encomendas que voltam à Amazon/Magalu (não vão mais para entrega):
- Bipagem em rota tipo `DEVOLUCAO_ORIGEM`
- Encerra ciclo de vida da encomenda (status `DEVOLVIDA_ORIGEM`)

### 3.3 Módulo de Análise

#### 3.3.1 Dashboard

**Filtros:**
- Período (data ou intervalo)
- Tipo de transportadora (Amazon / Magalu / outras)
- Tipo de evento (Recebimento / Entrega / Devolução / Retorno)
- Galpão
- Operação (específica ou todas)
- Rota
- Colaborador
- Motorista

**KPIs principais:**
- Total bipado no período
- Total por dia / semana / mês
- Total por transportadora
- Total por motorista
- **Comparação Recebimento × Entrega** (diferença em valor absoluto e percentual)
- Tempo médio de bipagem por colaborador (produtividade)
- Quantidade de duplicidades/erros
- Quantidade de overrides aplicados (alertas)

**Gráficos:**
- Linha: volume diário no período
- Barra: por transportadora
- Barra: por motorista
- Donut: distribuição por tipo de evento

#### 3.3.2 Busca por Código

Tela de busca: digite um código → vê toda a jornada:
- Quando entrou no galpão (recebimento)
- Em qual manifesto estava
- Em qual rota de entrega saiu
- Qual motorista levou
- Se voltou (retorno/devolução)
- Status atual

#### 3.3.3 Pesquisa

Tela `/pesquisa` (menu "Pesquisa", disponível para todos os papéis; o RLS limita o que cada um vê) que lista todas as bipagens com os dados da operação, para localizar encomendas, motoristas, transportadoras e rotas.

**Colunas:** data/hora, código (com marcação de duplicado/override), tipo de evento, transportadora, rota, motorista, colaborador, motivo e operação (data + status, com link para a operação).

**Filtros** (combináveis; cada lista aceita um ou vários itens, nenhum marcado = todos):
- Código: parte do código (busca parcial) ou vários códigos separados por espaço/vírgula (busca exata em lote)
- Período (de / até, pela data da bipagem)
- Tipo de evento
- Transportadora
- Motorista, Rota e Colaborador (com campo para filtrar listas longas)

**Outros:**
- Paginação de 100 linhas, com total de resultados
- Filtros ficam na URL (dá para compartilhar o link da pesquisa)
- Botão "Exportar Excel" com o resultado filtrado (limite de 20.000 linhas)

### 3.4 Módulo de Ferramentas

#### 3.4.1 Geração de QR Code

**Caso de uso principal:** re-etiquetar encomendas com etiqueta original danificada/ilegível.

**Fluxo:**
1. Operador insere lista de códigos (digita ou cola)
2. Sistema gera QR Code para cada (lib `qrcode`)
3. Renderiza PDF A4 com grid de etiquetas 21,0 × 38,2 mm (lib `pdf-lib`)
4. Layout: ~10 colunas × 7 linhas = 70 etiquetas por folha
5. Operador baixa PDF e imprime em folha de etiquetas adesivas

#### 3.4.2 PDF de Rota (Lista de Bairros)

Relatório enxuto para o motorista levar impresso ao sair com a rota.

**Conteúdo:**
- Cabeçalho: nome da rota · data da operação · motorista · transportadora · qtd. de pacotes
- Corpo: **lista numerada de bairros** (na ordem do campo `rota_bairros.ordem`)
- Rodapé: espaço para assinatura do motorista + observações

**Especificações:**
- Tamanho: **1 folha A4** única (retrato)
- Tipografia grande para leitura no veículo
- Lib client-side: `pdf-lib` (mesma já usada para QR Codes)
- Gerado a partir da tela da rota (botão "Imprimir Bairros") ou da operação ativa
- Se houver mais bairros do que cabe em 1 folha, sistema reduz a fonte até caber (jamais quebra para 2 folhas)

#### 3.4.3 Exportação Excel

Botão de export disponível em listagens e dashboard. Colunas:
- Tipo Encomenda (Amazon / Magalu / outras)
- Tipo Evento (Recebimento / Entrega / Devolução / Retorno)
- Operação
- Rota
- Colaborador
- Data/Hora da bipagem
- Motorista
- Código
- Status (OK / Duplicado / Override aplicado)

Geração client-side com `xlsx` (SheetJS).

### 3.5 Módulo de Administração

#### 3.5.1 Painel de Configurações

Configurações editáveis pelo Admin:

| Configuração | Valores | Default |
|---|---|---|
| `bipagem_entrega_sem_recebimento` | `BLOQUEAR` / `PERMITIR_COM_ALERTA` / `PERMITIR` | `PERMITIR` (durante treinamento) |
| `senha_override` | hash bcrypt | hash de `8038` |
| `som_confirmado_arquivo` | URL do arquivo de som | `/sounds/confirmado.mp3` |
| `som_duplicado_arquivo` | URL do arquivo de som | `/sounds/duplicado.mp3` |
| `som_erro_arquivo` | URL do arquivo de som | `/sounds/erro.mp3` |
| `qrcode_etiqueta_largura_mm` | número | `21.0` |
| `qrcode_etiqueta_altura_mm` | número | `38.2` |

#### 3.5.2 Senha de Override

Quando `bipagem_entrega_sem_recebimento = BLOQUEAR` e operador bipa um código sem recebimento prévio:
- Sistema bloqueia + toca som de erro
- Modal aparece pedindo senha de override
- Senha correta → libera a bipagem, marca `override_aplicado = true`, registra em `auditoria`
- Senha errada → mantém bloqueio, registra tentativa em `auditoria`
- Dashboard mostra alerta destacado para bipagens com override

#### 3.5.3 Logs de Auditoria

Tabela `auditoria` registra:
- Aplicação de override (quem, quando, qual código, qual rota)
- Tentativas de override com senha errada
- Edições/exclusões manuais de bipagens (se implementado)
- Alterações em configurações globais

---

## 4. Modelo de Dados

### 4.1 Diagrama de entidades

```
cidades (1) ──< (N) galpoes (1) ──< (N) colaboradores (1:1) → auth.users
                    │
                    └──< (N) motoristas ─────────────────┐ (FK em bipagens)
                    │                                    │
                    └──< (N) bairros [via cidades]       │
                    │                                    │
                    ├──< (N) rotas (N:N) bairros [via rota_bairros]
                    │         │       │
                    │         │       └─ ordem (para PDF do motorista)
                    │         │
                    │         └──< (N) bipagens  (rota_id)
                    │
                    └──< (N) operacoes (transportadora, tipo_evento, data, colaborador)
                              │
                              ├──< (N) bipagens (operacao_id, rota_id, motorista_id)
                              │       │
                              │       └─ UNIQUE(transportadora_id, codigo, tipo_evento)
                              │
                              └──< (0..1) manifesto ──< (N) manifesto_itens

transportadoras (regex)
configuracoes (singleton, key-value)
auditoria (log)

NOTA: bipagens tem 3 FKs: operacao_id (sessão) + rota_id (destino) + motorista_id (quem leva)
NOTA: rotas é template estável de bairros; motorista é selecionado por bipagem
```

### 4.2 Tabelas-chave

#### `operacoes`
```sql
CREATE TABLE operacoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  galpao_id         UUID NOT NULL REFERENCES galpoes(id),
  transportadora_id UUID NOT NULL REFERENCES transportadoras(id),
  tipo_evento       TEXT NOT NULL CHECK (tipo_evento IN ('RECEBIMENTO','ENTREGA','DEVOLUCAO_ORIGEM','RETORNO')),
  data              DATE NOT NULL,
  colaborador_id    UUID NOT NULL REFERENCES colaboradores(id),
  status            TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO','FINALIZADA')),
  iniciada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_em     TIMESTAMPTZ
);

CREATE INDEX idx_operacoes_status ON operacoes(status) WHERE status = 'EM_ANDAMENTO';
CREATE INDEX idx_operacoes_galpao_data ON operacoes(galpao_id, data DESC);
CREATE INDEX idx_operacoes_colab ON operacoes(colaborador_id, iniciada_em DESC);
```

#### `bipagens`
```sql
CREATE TABLE bipagens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id       UUID NOT NULL REFERENCES operacoes(id),
  rota_id           UUID NOT NULL REFERENCES rotas(id),
  motorista_id      UUID REFERENCES motoristas(id),  -- NULL em RECEBIMENTO
  transportadora_id UUID NOT NULL REFERENCES transportadoras(id),  -- denormalizado p/ índice único
  codigo            TEXT NOT NULL,
  tipo_evento       TEXT NOT NULL CHECK (tipo_evento IN ('RECEBIMENTO','ENTREGA','DEVOLUCAO_ORIGEM','RETORNO')),
  colaborador_id    UUID NOT NULL REFERENCES colaboradores(id),
  bipado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  override_aplicado BOOLEAN NOT NULL DEFAULT false,
  sincronizado_em   TIMESTAMPTZ,  -- NULL = ainda offline
  UNIQUE (transportadora_id, codigo, tipo_evento),
  CHECK (
    (tipo_evento = 'RECEBIMENTO' AND motorista_id IS NULL) OR
    (tipo_evento IN ('ENTREGA','DEVOLUCAO_ORIGEM','RETORNO') AND motorista_id IS NOT NULL)
  )
);

CREATE INDEX idx_bipagens_operacao ON bipagens(operacao_id);
CREATE INDEX idx_bipagens_rota ON bipagens(rota_id);
CREATE INDEX idx_bipagens_motorista ON bipagens(motorista_id);
CREATE INDEX idx_bipagens_data ON bipagens(bipado_em DESC);
CREATE INDEX idx_bipagens_codigo ON bipagens(codigo);
CREATE INDEX idx_bipagens_colab_data ON bipagens(colaborador_id, bipado_em);
```

**Nota sobre `transportadora_id` em `bipagens`:** o valor é redundante (já está em `operacoes.transportadora_id`) mas é mantido na tabela para suportar o índice `UNIQUE` cross-operação. Trigger garante consistência com a operação pai.

**Nota sobre `motorista_id` em `bipagens`:** o motorista é vinculado a cada bipagem (não à rota) porque qualquer motorista pode fazer qualquer rota. A UI seleciona o motorista junto com a rota ativa e replica para as bipagens seguintes até o operador trocar.

#### `rotas` (ajustada)
```sql
CREATE TABLE rotas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  galpao_id UUID NOT NULL REFERENCES galpoes(id),
  nome      TEXT NOT NULL,  -- ex.: "Centro - Bairro Alto - Jardim"
  ativa     BOOLEAN NOT NULL DEFAULT true,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (galpao_id, nome)
);
-- NÃO tem mais: transportadora_id, tipo_evento, motorista_id, data_prevista
-- Esses campos migraram para operacoes/bipagens

CREATE TABLE rota_bairros (
  rota_id   UUID NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
  bairro_id UUID NOT NULL REFERENCES bairros(id),
  ordem     INT NOT NULL DEFAULT 0,  -- ordem sugerida no PDF/entrega
  PRIMARY KEY (rota_id, bairro_id)
);
```

#### `transportadoras`
```sql
CREATE TABLE transportadoras (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL UNIQUE,
  regex_validacao   TEXT,  -- NULL = sem validação
  ativo             BOOLEAN NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds iniciais:
INSERT INTO transportadoras (nome, regex_validacao) VALUES
  ('Amazon', '^TBR\d{9}$'),
  ('Magazine Luiza', NULL);
```

### 4.3 Row Level Security (RLS)

- Admins veem tudo
- Gerentes veem apenas registros do próprio `galpao_id`
- Colaboradores veem apenas bipagens das rotas atribuídas a eles
- Policies aplicadas em: `rotas`, `bipagens`, `manifestos`, `colaboradores`, `motoristas`

---

## 5. Requisitos Não-Funcionais

### 5.1 Performance

- Tempo de resposta da bipagem: **< 100ms** (incluindo som)
- Dashboard com até 30 dias de dados: **< 2s** para carregar
- Importação de manifesto até 5.000 linhas: **< 10s**
- Geração de PDF de 70 etiquetas: **< 3s**

### 5.2 Offline-first

- Bipagem **deve funcionar 100% offline**
- Fila de bipagens armazenada em IndexedDB (lib `Dexie`)
- Service Worker intercepta requests e enfileira quando offline
- Sincronização automática ao reconectar (background sync)
- UI mostra: `🟢 Online` / `🔴 Offline (X pendentes)`
- Conflito de sincronização (duplicidade detectada apenas no servidor): bipagem fica marcada como `CONFLITO` e aparece em tela de revisão manual

### 5.3 Segurança

- Autenticação via Supabase Auth (email + senha)
- Senhas com bcrypt
- RLS no Supabase isolando dados por papel
- Senha de override armazenada como hash bcrypt
- Conexão HTTPS obrigatória
- LGPD: CPF de colaboradores/motoristas armazenado, política de acesso restrita

### 5.4 Disponibilidade

- Vercel: 99.99% SLA
- Supabase free tier: SLA não garantido — avaliar upgrade quando crescer
- Backup automático Supabase: diário (retenção 7 dias no free)

### 5.5 Volume e escalabilidade

- Volume previsto: 500–2.000 bipagens/dia
- Em 1 ano: ~720.000 registros em `bipagens`
- Supabase free: 500MB de storage → suficiente para ~1 ano
- Plano de upgrade para Supabase Pro ($25/mês) no segundo ano se volume crescer

---

## 6. Stack Técnico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Repositório | **GitHub** | Definição do usuário |
| Hospedagem | **Vercel** | Definição do usuário; integração nativa com Next.js e Supabase |
| Banco | **Supabase Postgres** | Definição do usuário; auth + storage inclusos |
| Framework | **Next.js 14 (App Router) + TypeScript** | SSR, RSC, rotas API serverless, ecossistema maduro |
| Estilo | **Tailwind CSS + shadcn/ui** | Componentes acessíveis customizáveis |
| Forms | **React Hook Form + Zod** | Validação client/server compartilhada |
| State servidor | **TanStack Query** | Cache + sincronização |
| Tabelas | **TanStack Table** | Filtros, ordenação, paginação |
| Gráficos | **Recharts** | Composable, performático |
| QR Code | **`qrcode`** | Geração client-side |
| PDF | **`pdf-lib`** | Manipulação precisa de A4 em mm |
| Excel | **`xlsx` (SheetJS)** | Parse e geração de .xlsx |
| Offline | **Dexie + Workbox** | IndexedDB + Service Worker |
| Som | **HTML5 Audio API** | Nativo, sem dependência |

---

## 7. Roadmap

| Fase | Entrega | Estimativa |
|---|---|---|
| **0** | Setup: repo GitHub, projeto Vercel, projeto Supabase, Next.js 14 + Tailwind, schema SQL inicial, auth | 1-2 dias |
| **1** | Cadastros básicos (cidades, galpões, bairros, transportadoras) | 2 dias |
| **2** | Cadastro de pessoas (colaboradores com login, motoristas sem login, RLS) | 2 dias |
| **3** | Rotas (cadastro de rotas com bairros + motorista, sem transportadora/tipo) | 2 dias |
| **4** | Operações + manifesto (iniciar operação, importar .xlsx, vincular operação→rota) | 2-3 dias |
| **5** | Bipagem online (sons, validação por regex, undo, duplicidade, seletor de rota ativa, finalizar operação) | 3-4 dias |
| **6** | PWA + offline (Service Worker, Dexie, fila de sync, operação ativa persistida no client) | 2 dias |
| **7** | Retorno + Devolução à origem (como tipos de operação) | 2 dias |
| **8** | Dashboard (filtros por operação, KPIs, gráficos, comparação Receb. × Entrega) | 2-3 dias |
| **9** | Exports (Excel + PDF de QR Codes em A4) | 1-2 dias |
| **10** | Configurações + override (painel admin, senha hashada, log de auditoria, forçar finalizar operação travada) | 1-2 dias |
| **11** | Tela de Pesquisa com filtros múltiplos + exclusão de bipagem por código na tela de bipagem | — |

**Total estimado:** ~3–4 semanas para MVP completo em produção.

---

## 8. Métricas de Sucesso

### 8.1 Operacionais (medir após 30 dias de uso)

- Redução do tempo médio de conferência de carga em **≥ 30%**
- Detecção de **100%** das duplicidades antes do envio
- **Zero** encomendas "perdidas" entre Recebimento e Entrega
- Conformidade Recebido × Entregue (diferença mensal **≤ 2%**)

### 8.2 Adoção

- 100% das bipagens passando pelo sistema (substituindo planilha manual)
- Todos os colaboradores treinados ativos no app

### 8.3 Técnicas

- Disponibilidade ≥ 99.5%
- Tempo de resposta da bipagem < 100ms (P95)
- Zero perda de bipagens offline após sincronização

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| WiFi do galpão instável | Alta | Crítico | Offline-first com Dexie + Service Worker (já no MVP) |
| Scanner USB com encoding diferente | Média | Médio | Testar com hardware real na Fase 4; configurar layout do teclado |
| Volume explode além de 2.000/dia | Baixa | Médio | Índices bem feitos + paginação + upgrade Supabase Pro |
| Colaborador esquecer senha de override | Baixa | Baixo | Admin pode redefinir no painel; modo "PERMITIR" como fallback durante treinamento |
| Mudança de padrão da Amazon | Baixa | Médio | Regex configurável na tabela `transportadoras` (sem deploy) |
| Erro de sincronização offline → bipagem duplicada | Média | Alto | UNIQUE constraint no banco bloqueia; tela de "Conflitos" para revisar |

---

## 10. Evoluções Futuras (pós-MVP)

Ideias mapeadas, fora do escopo do MVP:

- **App nativo de motorista** com confirmação de entrega + foto + assinatura
- **Roteirização inteligente** (otimização de ordem de paradas por bairro)
- **Integração via API com transportadoras** (substituir importação manual)
- **Notificações WhatsApp** para cliente final ("seu pacote saiu para entrega")
- **Multi-tenant SaaS** — vender para outros operadores de last-mile
- **Relatório de produtividade** com bonificação para colaboradores
- **Foto da encomenda** ao bipar duplicidade (auditoria de extravio)
- **Dashboard em TV no galpão** com modo "kiosk"

---

**Fim do documento.**
