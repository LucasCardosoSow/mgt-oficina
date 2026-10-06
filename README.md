# MGT Oficina · app da MGT Auto Elétrica

App instalável (PWA) para a oficina: entrada de carros, diagnóstico por voz, orçamento,
peças da Eli, caixa da Thaiane e link de acompanhamento para o cliente aprovar pelo WhatsApp.

- **Telas:** hospedadas no GitHub Pages (grátis)
- **Dados, login e fotos:** Supabase (plano grátis serve para começar)

---

## 1. Criar o banco no Supabase (10 min)

1. Entre em supabase.com e crie um projeto novo (ex.: `mgt-oficina`, região São Paulo).
2. Abra **SQL Editor > New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   Pode rodar de novo sem problema se precisar.
3. Em **Authentication > Sign In / Providers**, desligue **Confirm email** e salve.
   O controle de quem entra é feito pelos códigos de convite.
4. Cada pessoa da equipe abre o app, toca em **Primeiro acesso**, digita o código de convite dela,
   um e-mail e cria a própria senha. Cada código vale uma vez só.

   Para criar um convite novo (ex.: um funcionário novo), rode no SQL Editor:

```sql
insert into convites (codigo, nome, funcao) values ('NOVO-12345', 'Nome', 'oficina');
-- funções: admin, oficina, compras, financeiro
```

Quem se cadastra sem um código válido não vê nada do app.

5. Em **Project Settings > API Keys > Legacy**, copie a **Project URL** e a chave **anon public**.

> Na instalação da MGT, os passos 1 a 3 e 5 já foram feitos e o `config.js` já está preenchido.

## 2. Configurar o app

Abra `config.js` e preencha:

```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
export const OFICINA = { nome: 'MGT Auto Elétrica', desde: '2005', whatsapp: '41999990000', endereco: 'Rua ..., Curitiba' };
```

A chave `anon` é pública por natureza (todo app web a expõe). Quem protege os dados são as
regras de segurança do `schema.sql`: sem login de alguém da equipe, ninguém lê nada, e o cliente
só vê a OS dele, pelo código secreto do link.

## 3. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex.: `mgt-oficina`). No plano grátis do GitHub,
   o Pages exige repositório **público**. Não há senha nem dado de cliente no código, então isso é seguro.
2. Envie todos os arquivos desta pasta para o repositório (pode arrastar no site do GitHub, em **Add file > Upload files**).
3. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em 1 ou 2 minutos o app fica no ar em `https://SEU-USUARIO.github.io/mgt-oficina/`.

Quando tiver um domínio (ex.: `app.mgtautoeletrica.com.br`), configure em **Settings > Pages > Custom domain**.
Os links enviados aos clientes passam a usar o domínio novo automaticamente.

## 4. Instalar nos celulares

Abra o endereço no celular e faça login.

- **Android (Chrome):** menu ⋮ > **Instalar app**
- **iPhone (Safari):** botão compartilhar > **Adicionar à Tela de Início**

---

## Como funciona o dia a dia

| Etapa | Quem | O que acontece |
|---|---|---|
| Entrada | Gustavo | Digita a placa. Se o carro já veio antes, cliente e modelo aparecem sozinhos. Fotos e relato por voz. |
| Avisar cliente | Gustavo | Botão verde abre o WhatsApp com a mensagem e o link prontos. |
| Diagnóstico e orçamento | Gustavo | Fala o diagnóstico no microfone, adiciona serviços e peças, toca em **Enviar orçamento**. |
| Peças | Eli | Peças pedidas aparecem na lista dela. **Pedir cotação** monta a mensagem para os distribuidores. Marca comprado e chegou, com o custo. |
| Aprovação | Cliente | Aprova pelo link. Se faltar peça, a OS vai para "aguardando peça"; quando a Eli marca que tudo chegou, o carro volta sozinho para "em serviço". |
| Teste e pronto | Gustavo | **Pronto! Avisar** abre o WhatsApp com a mensagem de retirada. |
| Entrega | Eli | **Entregar e receber**, com a forma de pagamento. |
| Caixa e nota | Thaiane | Faturamento, custo de peças, margem, prontos a receber e lista para emitir nota, com exportação para planilha. |

**Serviço rápido** (lâmpada, fusível): um formulário só, já cai no caixa.
**Socorro**: registra local, cliente e taxa de deslocamento, e segue como uma OS normal.

## Limitações desta versão (v1)

- **Placa:** é digitada (o teclado já abre em maiúsculas). Ler a placa pela câmera exige um
  serviço de reconhecimento pago por consulta; fica para a v2.
- **Modelo do carro:** escolhido na tabela FIPE na primeira visita. Se a FIPE estiver fora do ar,
  o app troca sozinho para digitação manual.
- **Ditado por voz:** funciona no Chrome do Android. No iPhone, use o microfone do próprio teclado.
- **WhatsApp:** o envio é feito pelo celular de quem toca no botão (opção 1, sem custo e sem risco de bloqueio).
- **Nota fiscal:** não emite. A Thaiane exporta a planilha e emite no sistema atual.
- **Supabase grátis:** pausa o projeto após 7 dias sem nenhum uso. Com a oficina usando todo dia, isso não acontece.

## Arquivos

```
index.html / app.js     app da equipe
cliente.html / cliente.js  página que o cliente recebe no WhatsApp
lib.js                  funções compartilhadas
config.js               dados do Supabase e da oficina  <- preencher
styles.css              visual
sw.js / manifest        instalação como app
assets/                 logo e ícones
supabase/schema.sql     banco de dados
```
