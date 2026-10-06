import {
  sb, configurado, OFICINA, esc, brl, parseValor, totalItens, normPlaca, placaValida, desde, hora,
  dataCurta, nomeVeiculo, modeloCurto, STATUS, tint, TIPOS, PAGAMENTOS, linkWa, foneWa, linkCliente,
  enviarFotos, urlFoto, toast, placaHTML, ditado, ICON,
} from './lib.js';

const app = document.getElementById('app');
const q = (s, el = document) => el.querySelector(s);
const qa = (s, el = document) => [...el.querySelectorAll(s)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let eu = null;
let rotaAtual = '';
let filtroQuadro = 'todos';
let filtroPecas = 'cotando';
let periodoCaixa = 'mes';
let osRecemCriada = null;
let canal = null;

const HOME = { compras: '#/pecas', financeiro: '#/caixa' };

// =====================================================================
// Início, login e navegação
// =====================================================================
async function iniciar() {
  if (!configurado) return telaConfig();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return telaLogin();
  const { data: perfil } = await sb.from('perfis').select('*').eq('id', session.user.id).maybeSingle();
  if (!perfil) {
    await sb.auth.signOut();
    return telaLogin('Este acesso não foi liberado. Confira o código de convite com o Lucas.');
  }
  eu = perfil;
  ouvirMudancas();
  if (!location.hash || location.hash === '#') location.hash = HOME[eu.funcao] || '#/';
  rotear();
}

window.addEventListener('hashchange', () => { if (eu) rotear(); });

function rotear() {
  rotaAtual = location.hash.replace(/^#/, '') || '/';
  window.scrollTo(0, 0);
  const [, r, id] = rotaAtual.split('/');
  if (r === 'entrada') return telaEntrada();
  if (r === 'os' && id) return telaOS(id);
  if (r === 'pecas') return telaPecas();
  if (r === 'caixa') return telaCaixa();
  if (r === 'conta') return telaConta();
  return telaQuadro();
}
const naRota = (prefixo) => rotaAtual === prefixo || (prefixo !== '/' && rotaAtual.startsWith(prefixo));

function ouvirMudancas() {
  if (canal) return;
  let t;
  const atualizar = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (document.querySelector('.folha-fundo')) return;
      if (document.activeElement?.matches('input, textarea, select')) return;
      if (naRota('/') || naRota('/pecas') || naRota('/caixa')) rotear();
    }, 700);
  };
  canal = sb.channel('oficina')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens' }, atualizar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'itens' }, atualizar)
    .subscribe();
}

function render(html) { app.innerHTML = html; }
function falha(error) {
  console.error(error);
  toast(error?.message || 'Algo deu errado. Tente de novo.', 'erro');
}

function nav(ativo) {
  const a = (k, href, icon, label) =>
    `<a href="${href}" class="${ativo === k ? 'on' : ''}">${ICON[icon]}${label}</a>`;
  return `<nav class="nav">
    ${a('quadro', '#/', 'quadro', 'Quadro')}
    ${a('pecas', '#/pecas', 'peca', 'Peças')}
    <a href="#/entrada" class="centro" aria-label="Nova entrada">${ICON.scan}</a>
    ${a('caixa', '#/caixa', 'caixa', 'Caixa')}
    ${a('conta', '#/conta', 'mais', 'Conta')}
  </nav>`;
}

function topo() {
  return `<div class="topo">
    <img src="assets/logo.png" alt="${esc(OFICINA.nome)}">
    <div class="cresce"><div class="t1">${esc(OFICINA.nome)}</div><div class="t2">${esc(eu.nome)}</div></div>
  </div>`;
}

function folha(html) {
  const fundo = document.createElement('div');
  fundo.className = 'folha-fundo';
  fundo.innerHTML = `<div class="folha" role="dialog" aria-modal="true"><div class="alca"></div>${html}</div>`;
  const fechar = () => fundo.remove();
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo || e.target.closest('[data-fechar]')) fechar();
  });
  document.body.appendChild(fundo);
  return { el: fundo.querySelector('.folha'), fechar };
}

async function ocupado(botao, fn) {
  const txt = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = 'Salvando...';
  try { await fn(); } catch (e) { falha(e); } finally {
    if (botao.isConnected) { botao.disabled = false; botao.innerHTML = txt; }
  }
}

function telaConfig() {
  render(`<div class="login">
    <img src="assets/logo.png" alt="">
    <h1>Falta configurar</h1>
    <p class="mut">Preencha o arquivo <b class="mono">config.js</b> com a URL e a chave do projeto Supabase. O passo a passo está no README.</p>
  </div>`);
}

function telaLogin(msg = '', primeiro = false) {
  render(`<form class="login" id="f">
    <img src="assets/logo.png" alt="${esc(OFICINA.nome)}">
    <h1>${primeiro ? 'Primeiro acesso' : 'Entrar'}</h1>
    <p class="mut" style="margin:-8px 0 0">${primeiro ? 'Use o código que você recebeu e crie sua senha.' : 'App da oficina'}</p>
    ${msg ? `<p style="color:var(--rd);margin:0">${esc(msg)}</p>` : ''}
    ${primeiro ? `<label class="campo">Código de convite<input name="convite" autocapitalize="characters" autocomplete="off" required></label>` : ''}
    <label class="campo">E-mail<input name="email" type="email" autocomplete="username" required></label>
    <label class="campo">${primeiro ? 'Crie uma senha (mínimo 6 caracteres)' : 'Senha'}<input name="senha" type="password" minlength="6" autocomplete="${primeiro ? 'new-password' : 'current-password'}" required></label>
    <button class="btn btn-y btn-g">${primeiro ? 'Criar acesso' : 'Entrar'}</button>
    <button type="button" class="btn" id="trocar">${primeiro ? 'Já tenho senha' : 'Primeiro acesso? Tenho um código'}</button>
  </form>`);
  q('#trocar').onclick = () => telaLogin('', !primeiro);
  q('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const b = q('button', e.target);
    b.disabled = true;
    const email = String(fd.get('email')).trim().toLowerCase();
    if (primeiro) {
      const { data, error } = await sb.auth.signUp({
        email, password: fd.get('senha'),
        options: { data: { convite: String(fd.get('convite')).trim().toUpperCase() } },
      });
      b.disabled = false;
      if (error) {
        const jaExiste = /registered|exists/i.test(error.message);
        return toast(jaExiste ? 'Esse e-mail já tem acesso. Use "Já tenho senha".' : error.message, 'erro');
      }
      if (!data.session) return toast('Confira seu e-mail para confirmar o acesso.', 'info');
      return iniciar();
    }
    const { error } = await sb.auth.signInWithPassword({ email, password: fd.get('senha') });
    if (error) { b.disabled = false; return toast('E-mail ou senha incorretos', 'erro'); }
    iniciar();
  };
}

// =====================================================================
// Clientes e veículos
// =====================================================================
async function garantirVeiculo({ placa, marca, modelo, ano, cliente_id }) {
  const dados = Object.fromEntries(
    Object.entries({ marca, modelo, ano, cliente_id }).filter(([, v]) => v));
  const { data: existe } = await sb.from('veiculos').select('id').eq('placa', placa).maybeSingle();
  if (existe) {
    if (Object.keys(dados).length) {
      const { error } = await sb.from('veiculos').update(dados).eq('id', existe.id);
      if (error) throw error;
    }
    return existe.id;
  }
  const { data, error } = await sb.from('veiculos').insert({ placa, ...dados }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function salvarCliente({ id, nome, whatsapp }) {
  if (!nome) return null;
  if (id) {
    const { error } = await sb.from('clientes').update({ nome, whatsapp }).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from('clientes').insert({ nome, whatsapp }).select('id').single();
  if (error) throw error;
  return data.id;
}

// =====================================================================
// Quadro da oficina
// =====================================================================
const PRIORIDADE = ['pronto', 'aguardando_aprovacao', 'entrada', 'em_teste', 'em_servico', 'aguardando_peca'];
const GRUPOS = [
  { k: 'diag', label: 'diagnóst.', st: ['entrada'] },
  { k: 'aprov', label: 'aprovação', st: ['aguardando_aprovacao'] },
  { k: 'peca', label: 'peça', st: ['aguardando_peca'] },
  { k: 'serv', label: 'serviço', st: ['em_servico', 'em_teste'] },
  { k: 'pronto', label: 'pronto', st: ['pronto'] },
];

async function telaQuadro() {
  render(`<div class="brilho"></div><div class="tela">${topo()}<div class="carregando"></div></div>${nav('quadro')}`);
  const { data, error } = await sb.from('ordens')
    .select('id,numero,tipo,status,relato,criado_em,local_socorro,veiculos(placa,marca,modelo,ano),clientes(nome)')
    .not('status', 'in', '(entregue,cancelado)')
    .order('criado_em');
  if (error) return falha(error);
  if (!naRota('/')) return;
  desenharQuadro(data.sort((a, b) =>
    PRIORIDADE.indexOf(a.status) - PRIORIDADE.indexOf(b.status) || new Date(a.criado_em) - new Date(b.criado_em)));
}

function desenharQuadro(ords) {
  const cont = Object.fromEntries(GRUPOS.map((g) => [g.k, ords.filter((o) => g.st.includes(o.status)).length]));
  const grupo = GRUPOS.find((g) => g.k === filtroQuadro);
  const lista = grupo ? ords.filter((o) => grupo.st.includes(o.status)) : ords;
  const hoje = cap(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
  const chip = (k, label, n, cor) => `<button class="chip ${filtroQuadro === k ? 'on' : ''}" data-f="${k}">
    <span class="ponto" style="background:${cor}"></span>${label}<span class="mono" style="opacity:.6">${n}</span></button>`;

  q('.tela').innerHTML = `${topo()}
    <div><div class="sobre">${esc(hoje)}</div><h1>Oficina hoje</h1></div>
    <div class="card-y">
      <div class="linha" style="align-items:flex-end;gap:12px">
        <span class="grande">${ords.length}</span>
        <span style="font-size:15px;font-weight:500;line-height:1.2;padding-bottom:4px">${ords.length === 1 ? 'carro' : 'carros'}<br>na oficina</span>
        <span class="vivo" style="margin-left:auto">ao vivo</span>
      </div>
      <div class="resumo">${GRUPOS.map((g) => `<div><b>${cont[g.k]}</b><span>${g.label}</span></div>`).join('')}</div>
    </div>
    <div class="atalhos">
      <button class="atalho" id="rapido"><i style="background:${tint('#FFD60A')};color:var(--y)">${ICON.raio}</i>Serviço rápido</button>
      <button class="atalho" id="socorro"><i style="background:${tint('#FF8A3D')};color:var(--or)">${ICON.pin}</i>Socorro</button>
    </div>
    <div class="chips">
      ${chip('todos', 'Todos', ords.length, '#FAFAFA')}
      ${GRUPOS.map((g) => chip(g.k, cap(g.label.replace('.', 'ico')), cont[g.k], STATUS[g.st[0]].cor)).join('')}
    </div>
    ${lista.length ? lista.map(cardOS).join('') : `<div class="vazio"><b>Nenhum carro aqui</b>Toque no botão amarelo para dar entrada.</div>`}`;

  qa('.chip').forEach((c) => { c.onclick = () => { filtroQuadro = c.dataset.f; desenharQuadro(ords); }; });
  q('#rapido').onclick = folhaRapido;
  q('#socorro').onclick = folhaSocorro;
}

function cardOS(o) {
  const s = STATUS[o.status];
  const v = o.veiculos;
  const titulo = v?.modelo ? nomeVeiculo(v) : (o.tipo === 'socorro' ? 'Socorro' : (v?.placa || 'Sem veículo'));
  const sub = o.tipo === 'socorro' && o.local_socorro ? o.local_socorro : (o.relato || o.clientes?.nome || '');
  const tag = o.tipo !== 'os' ? ` <span class="tag-tipo">${TIPOS[o.tipo].toUpperCase()}</span>` : '';
  const marcador = v?.placa ? placaHTML(v.placa)
    : `<span style="width:86px;height:34px;flex-shrink:0;border-radius:8px;background:${tint('#FF8A3D')};color:var(--or);display:flex;align-items:center;justify-content:center">${ICON.pin}</span>`;
  return `<a class="carro" href="#/os/${o.id}">
    <div class="linha">${marcador}
      <div class="cresce"><div class="nome">${esc(titulo)}${tag}</div><div class="rel">${esc(sub)}</div></div>${ICON.chev}
    </div>
    <div class="linha">
      <span class="pill" style="color:${s.cor};background:${tint(s.cor)}">${s.label}</span>
      <div class="segs">${[1, 2, 3, 4, 5].map((i) => `<span${i <= s.passo ? ` style="background:${s.cor}"` : ''}></span>`).join('')}</div>
      <span class="mono peq mut">${desde(o.criado_em)}</span>
    </div>
  </a>`;
}

function opcoesPagamento() {
  return PAGAMENTOS.map((p) => `<option>${p}</option>`).join('');
}

function folhaRapido() {
  const { el, fechar } = folha(`
    <h2>Serviço rápido</h2>
    <p class="mut med" style="margin:-8px 0 0">Lâmpada, fusível, bateria. Sem orçamento, já entra no caixa.</p>
    <label class="campo">O que foi feito<input name="desc" placeholder="Troca de lâmpada do farol"></label>
    <div class="dupla">
      <label class="campo">Valor<input name="valor" inputmode="decimal" placeholder="0,00"></label>
      <label class="campo">Pagamento<select name="pag">${opcoesPagamento()}</select></label>
    </div>
    <label class="campo">Placa (opcional)<input name="placa" autocapitalize="characters" maxlength="8"></label>
    <button class="btn btn-y btn-g" id="ok">Registrar</button>`);
  q('#ok', el).onclick = (e) => ocupado(e.currentTarget, async () => {
    const desc = q('[name=desc]', el).value.trim();
    const valor = parseValor(q('[name=valor]', el).value);
    if (!desc || !valor) return toast('Preencha o serviço e o valor', 'erro');
    const placa = normPlaca(q('[name=placa]', el).value);
    const veiculo_id = placaValida(placa) ? await garantirVeiculo({ placa }) : null;
    const { data: o, error } = await sb.from('ordens').insert({
      tipo: 'rapido', status: 'entregue', veiculo_id, relato: desc,
      forma_pagamento: q('[name=pag]', el).value, pago_em: new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;
    const { error: e2 } = await sb.from('itens').insert({ ordem_id: o.id, tipo: 'servico', descricao: desc, valor_unit: valor });
    if (e2) throw e2;
    fechar();
    toast(`Registrado: ${brl(valor)}`);
  });
}

function folhaSocorro() {
  const { el, fechar } = folha(`
    <h2>Socorro</h2>
    <label class="campo">Onde está o carro<input name="local" placeholder="Rua, bairro ou referência"></label>
    <label class="campo">O que aconteceu<input name="relato" placeholder="Bateria arriada, não pega"></label>
    <div class="dupla">
      <label class="campo">Cliente<input name="nome" autocomplete="off"></label>
      <label class="campo">WhatsApp<input name="whats" inputmode="tel" placeholder="41 9 0000-0000"></label>
    </div>
    <div class="dupla">
      <label class="campo">Placa (opcional)<input name="placa" autocapitalize="characters" maxlength="8"></label>
      <label class="campo">Taxa de deslocamento<input name="taxa" inputmode="decimal" placeholder="0,00"></label>
    </div>
    <button class="btn btn-y btn-g" id="ok">Abrir socorro</button>`);
  q('#ok', el).onclick = (e) => ocupado(e.currentTarget, async () => {
    const local = q('[name=local]', el).value.trim();
    if (!local) return toast('Informe onde está o carro', 'erro');
    const cliente_id = await salvarCliente({ nome: q('[name=nome]', el).value.trim(), whatsapp: q('[name=whats]', el).value.trim() });
    const placa = normPlaca(q('[name=placa]', el).value);
    const veiculo_id = placaValida(placa) ? await garantirVeiculo({ placa, cliente_id }) : null;
    const { data: o, error } = await sb.from('ordens').insert({
      tipo: 'socorro', status: 'entrada', local_socorro: local, cliente_id, veiculo_id,
      relato: q('[name=relato]', el).value.trim() || null,
    }).select('id').single();
    if (error) throw error;
    const taxa = parseValor(q('[name=taxa]', el).value);
    if (taxa) {
      const { error: e2 } = await sb.from('itens').insert({ ordem_id: o.id, tipo: 'servico', descricao: 'Socorro / deslocamento', valor_unit: taxa });
      if (e2) throw e2;
    }
    fechar();
    location.hash = `#/os/${o.id}`;
  });
}

// =====================================================================
// Nova entrada
// =====================================================================
const FIPE = 'https://parallelum.com.br/fipe/api/v1/carros';
async function fipe(caminho) {
  const r = await fetch(FIPE + caminho);
  if (!r.ok) throw new Error('Tabela FIPE indisponível');
  return r.json();
}
const anoFipe = (nome) => (nome.startsWith('32000') ? '0 km' : nome.split(' ')[0]);

function telaEntrada() {
  let conhecido = null;
  let fotos = [];
  render(`<div class="brilho"></div><div class="tela">
    <div class="linha">
      <a href="#/" class="icone-btn" aria-label="Cancelar">${ICON.x}</a>
      <h2 class="cresce" style="text-align:center">Nova entrada</h2>
      <span style="width:44px"></span>
    </div>

    <div class="card" style="align-items:center;padding:22px 16px">
      <span class="mut med">Placa do veículo</span>
      <label class="placa placa-g" style="width:220px">
        <span class="placa-faixa" style="height:10px"></span>
        <input id="placa" aria-label="Placa" autocapitalize="characters" autocomplete="off" maxlength="8" placeholder="ABC1D23"
          style="border:0;background:transparent;text-align:center;font:600 32px var(--mono);letter-spacing:.06em;color:#09090B;padding:6px 0 8px;width:100%;outline:none">
      </label>
      <div id="placaInfo" class="med mut" style="text-align:center;min-height:20px"></div>
    </div>

    <div id="blocoVeiculo" class="card">
      <div class="linha"><h2 class="cresce">Veículo</h2><button class="btn btn-p" id="manual">Digitar</button></div>
      <div id="fipe" class="tripla">
        <label class="campo">Marca<select id="marca"><option value="">Carregando...</option></select></label>
        <label class="campo">Modelo<select id="modelo" disabled><option value="">-</option></select></label>
        <label class="campo">Ano<select id="ano" disabled><option value="">-</option></select></label>
      </div>
      <div id="digitado" class="tripla hidden">
        <label class="campo">Marca<input id="marcaT"></label>
        <label class="campo">Modelo<input id="modeloT"></label>
        <label class="campo">Ano<input id="anoT" inputmode="numeric" maxlength="4"></label>
      </div>
    </div>

    <div class="dupla">
      <label class="campo">Cliente<input id="nome" autocomplete="off"></label>
      <label class="campo">WhatsApp<input id="whats" inputmode="tel" placeholder="41 9 0000-0000"></label>
    </div>

    <div class="card" style="flex-direction:row;align-items:center">
      <button class="btn-mic" id="mic" aria-label="Ditar relato por voz">${ICON.mic}</button>
      <label class="cresce" style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--dim)">O que o cliente relatou
        <textarea id="relato" rows="2" style="border:0;background:transparent;resize:none;font-size:15px;color:var(--tx);outline:none;padding:0"></textarea>
      </label>
    </div>

    <div class="card">
      <div class="linha"><h2 class="cresce">Fotos</h2><span class="peq dim">frente, painel, km, avarias</span></div>
      <div class="fotos" id="fotos">
        <label class="foto-add">${ICON.cam}<input type="file" accept="image/*" capture="environment" multiple id="fotoIn"></label>
      </div>
    </div>

    <button class="btn btn-y btn-g" id="salvar">Abrir ordem de serviço ${ICON.seta}</button>
  </div>`);

  const $ = (id) => q('#' + id);
  let modoManual = false;

  // FIPE em cascata
  fipe('/marcas').then((ms) => {
    $('marca').innerHTML = `<option value="">Escolha</option>` + ms.map((m) => `<option value="${m.codigo}">${esc(m.nome)}</option>`).join('');
  }).catch(() => alternarManual(true));
  $('marca').onchange = async () => {
    $('modelo').disabled = true; $('ano').disabled = true;
    $('modelo').innerHTML = '<option value="">Carregando...</option>';
    if (!$('marca').value) return;
    try {
      const r = await fipe(`/marcas/${$('marca').value}/modelos`);
      $('modelo').innerHTML = `<option value="">Escolha</option>` + r.modelos.map((m) => `<option value="${m.codigo}">${esc(m.nome)}</option>`).join('');
      $('modelo').disabled = false;
    } catch { alternarManual(true); }
  };
  $('modelo').onchange = async () => {
    $('ano').disabled = true;
    if (!$('modelo').value) return;
    try {
      const r = await fipe(`/marcas/${$('marca').value}/modelos/${$('modelo').value}/anos`);
      $('ano').innerHTML = `<option value="">Escolha</option>` + r.map((a) => `<option>${esc(anoFipe(a.nome))}</option>`)
        .filter((v, i, arr) => arr.indexOf(v) === i).join('');
      $('ano').disabled = false;
    } catch { alternarManual(true); }
  };
  function alternarManual(forcar) {
    modoManual = forcar ?? !modoManual;
    $('fipe').classList.toggle('hidden', modoManual);
    $('digitado').classList.toggle('hidden', !modoManual);
    $('manual').textContent = modoManual ? 'Tabela FIPE' : 'Digitar';
  }
  $('manual').onclick = () => alternarManual();

  // placa conhecida
  $('placa').oninput = async () => {
    const p = normPlaca($('placa').value);
    $('placa').value = p;
    conhecido = null;
    $('blocoVeiculo').classList.remove('hidden');
    $('placaInfo').textContent = '';
    if (!placaValida(p)) return;
    const { data: v } = await sb.from('veiculos').select('*, clientes(id,nome,whatsapp)').eq('placa', p).maybeSingle();
    if (normPlaca($('placa').value) !== p) return;
    if (!v) { $('placaInfo').textContent = 'Primeira visita deste carro'; return; }
    conhecido = v;
    const { data: abertas } = await sb.from('ordens').select('id,numero').eq('veiculo_id', v.id).not('status', 'in', '(entregue,cancelado)');
    $('placaInfo').innerHTML = abertas?.length
      ? `<a href="#/os/${abertas[0].id}" style="color:var(--or)">Já tem OS aberta (nº ${abertas[0].numero}). Abrir</a>`
      : `<span style="color:var(--gr)">Cliente da casa:</span> ${esc(nomeVeiculo(v))}`;
    if (v.modelo) $('blocoVeiculo').classList.add('hidden');
    if (v.clientes) {
      $('nome').value = v.clientes.nome || '';
      $('whats').value = v.clientes.whatsapp || '';
    }
  };

  $('mic').onclick = () => ditado($('relato'), $('mic'));

  $('fotoIn').onchange = () => {
    fotos = fotos.concat([...$('fotoIn').files]);
    qa('#fotos img').forEach((i) => i.remove());
    fotos.forEach((f) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      img.alt = 'Foto do veículo';
      $('fotos').appendChild(img);
    });
  };

  $('salvar').onclick = (e) => ocupado(e.currentTarget, async () => {
    const placa = normPlaca($('placa').value);
    if (!placaValida(placa)) return toast('Confira a placa', 'erro');
    const nome = $('nome').value.trim();
    if (!nome) return toast('Informe o nome do cliente', 'erro');
    const whatsapp = $('whats').value.trim();

    let marca, modelo, ano;
    if (!$('blocoVeiculo').classList.contains('hidden')) {
      if (modoManual) {
        marca = $('marcaT').value.trim(); modelo = $('modeloT').value.trim(); ano = $('anoT').value.trim();
      } else {
        marca = $('marca').selectedOptions[0]?.value ? $('marca').selectedOptions[0].text : '';
        modelo = $('modelo').selectedOptions[0]?.value ? $('modelo').selectedOptions[0].text.split(' ').slice(0, 3).join(' ') : '';
        ano = $('ano').value;
      }
    }

    const mesmoCliente = conhecido?.clientes &&
      (foneWa(conhecido.clientes.whatsapp) === foneWa(whatsapp) || conhecido.clientes.nome === nome);
    const cliente_id = await salvarCliente({ id: mesmoCliente ? conhecido.clientes.id : null, nome, whatsapp });
    const veiculo_id = await garantirVeiculo({ placa, marca, modelo, ano, cliente_id });
    const { data: o, error } = await sb.from('ordens').insert({
      tipo: 'os', veiculo_id, cliente_id, relato: $('relato').value.trim() || null,
    }).select('id').single();
    if (error) throw error;
    if (fotos.length) {
      try { await enviarFotos(o.id, fotos); } catch (err) { falha(err); }
    }
    osRecemCriada = o.id;
    location.hash = `#/os/${o.id}`;
  });
}

// =====================================================================
// Ordem de serviço
// =====================================================================
function mensagem(o, tipo) {
  const nome = (o.clientes?.nome || '').trim().split(' ')[0];
  const carro = modeloCurto(o.veiculos);
  const link = linkCliente(o.token);
  const tot = brl(totalItens(o.itens));
  const ola = nome ? `Olá, ${nome}!` : 'Olá!';
  switch (tipo) {
    case 'entrada':
      return `${ola} Aqui é da ${OFICINA.nome}. Recebemos seu ${carro} e já vamos fazer o diagnóstico. Acompanhe tudo por aqui:\n${link}`;
    case 'orcamento':
      return `${ola} O orçamento do seu ${carro} está pronto: ${tot}.\nVeja o que encontramos e aprove por aqui:\n${link}`;
    case 'pronto':
      return `${ola} Seu ${carro} está pronto para retirada! Total: ${tot}.\nDetalhes do serviço:\n${link}`;
    default:
      return `${ola} Segue o acompanhamento do seu ${carro} na ${OFICINA.nome}:\n${link}`;
  }
}
const tipoMensagem = (st) => ({ entrada: 'entrada', aguardando_aprovacao: 'orcamento', pronto: 'pronto' }[st] || 'geral');

function abrirWhats(o, tipo) {
  if (!foneWa(o.clientes?.whatsapp)) {
    toast('Cliente sem WhatsApp. Cadastre em "Mais opções".', 'erro');
    return false;
  }
  window.open(linkWa(o.clientes.whatsapp, mensagem(o, tipo)), '_blank');
  return true;
}

async function mudarStatus(o, status, extra = {}) {
  const { error } = await sb.from('ordens').update({ status, ...extra }).eq('id', o.id);
  if (error) throw error;
}

const faltaPeca = (o) => o.itens.some((i) => i.tipo === 'peca' && i.status_peca !== 'chegou');

async function telaOS(id) {
  render(`<div class="tela"><div class="carregando"></div></div>`);
  const { data: o, error } = await sb.from('ordens')
    .select('*, veiculos(*), clientes(*), itens(*), fotos(*)')
    .eq('id', id).single();
  if (error) { falha(error); location.hash = '#/'; return; }
  if (!naRota(`/os/${id}`)) return;
  o.itens.sort((a, b) => (a.tipo === b.tipo ? new Date(a.criado_em) - new Date(b.criado_em) : a.tipo === 'servico' ? -1 : 1));
  o.fotos.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  desenharOS(o);
}

const ACAO = {
  entrada: { txt: 'Enviar orçamento', icon: 'wa' },
  aguardando_aprovacao: { txt: 'Registrar aprovação', icon: 'check' },
  aguardando_peca: { txt: 'Iniciar serviço', icon: 'seta' },
  em_servico: { txt: 'Enviar para teste', icon: 'seta' },
  em_teste: { txt: 'Pronto! Avisar', icon: 'wa' },
  pronto: { txt: 'Entregar e receber', icon: 'check' },
};

function desenharOS(o) {
  const s = STATUS[o.status];
  const v = o.veiculos;
  const total = totalItens(o.itens);
  const fechada = ['entregue', 'cancelado'].includes(o.status);
  const labels = ['Entrada', 'Orçamento', 'Peças', 'Serviço', 'Pronto'];
  const acao = ACAO[o.status];
  const novo = osRecemCriada === o.id;
  osRecemCriada = null;

  const linhaItem = (i) => {
    const peca = i.tipo === 'peca';
    const cor = peca ? '#4DA3FF' : '#A78BFA';
    const sub = peca
      ? `<span style="color:var(--bl)">Eli: ${esc(i.status_peca || 'cotando')}</span>${i.custo ? ` · custo ${brl(i.custo)}` : ''}`
      : 'mão de obra';
    return `<div class="item">
      <span class="ic" style="background:${tint(cor)};color:${cor}">${peca ? 'PÇ' : 'SV'}</span>
      <div class="cresce"><div class="d">${esc(i.descricao)}${Number(i.quantidade) !== 1 ? ` <span class="dim">x${Number(i.quantidade)}</span>` : ''}</div><div class="s">${sub}</div></div>
      <span class="v">${brl(Number(i.quantidade) * Number(i.valor_unit))}</span>
      ${fechada ? '' : `<button class="rm" data-rm="${i.id}" aria-label="Remover item">${ICON.x}</button>`}
    </div>`;
  };

  render(`<div class="tela">
    <div class="linha">
      <a href="#/" class="icone-btn" aria-label="Voltar ao quadro">${ICON.voltar}</a>
      <span class="cresce mono med mut">OS ${String(o.numero).padStart(4, '0')}${o.tipo !== 'os' ? ` · ${TIPOS[o.tipo]}` : ''}</span>
      <span class="pill" style="color:${s.cor};background:${tint(s.cor)}">${s.label}</span>
    </div>

    <div class="linha" style="align-items:flex-start;gap:14px">
      <div class="cresce">
        <h1 style="font-size:26px">${esc(v?.modelo ? nomeVeiculo(v) : (o.tipo === 'socorro' ? 'Socorro' : v?.placa || 'Sem veículo'))}</h1>
        <div class="med mut" style="margin-top:4px">${esc(o.clientes?.nome || 'Sem cliente')} · entrou ${dataCurta(o.criado_em)} ${hora(o.criado_em)}</div>
      </div>
      ${v ? placaHTML(v.placa) : ''}
    </div>

    ${o.tipo !== 'rapido' ? `<div class="passos">${labels.map((l, i) => {
      const n = i + 1;
      const cor = n < s.passo ? 'var(--y)' : n === s.passo ? s.cor : '';
      return `<div class="${n <= s.passo ? 'ok' : ''}"><span${cor ? ` style="background:${cor}"` : ''}></span>${l}</div>`;
    }).join('')}</div>` : ''}

    ${novo ? `<div class="card" style="border-color:#1FAF55">
      <div class="med">OS aberta. Mande o link de acompanhamento para o cliente:</div>
      <button class="btn btn-wa" id="avisarNovo">${ICON.wa} Avisar cliente no WhatsApp</button>
    </div>` : ''}

    ${o.local_socorro ? `<div class="card"><div class="peq dim">Local do socorro</div><div>${esc(o.local_socorro)}</div>
      <a class="btn btn-p" style="align-self:flex-start" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.local_socorro)}">${ICON.pin} Abrir no mapa</a></div>` : ''}

    ${o.relato ? `<div class="card"><div class="peq dim">${o.tipo === 'rapido' ? 'Serviço' : 'Cliente relatou'}</div><div style="line-height:1.4">${esc(o.relato)}</div></div>` : ''}

    ${o.tipo !== 'rapido' ? `<div class="card">
      <div class="linha"><h2 class="cresce">Diagnóstico</h2>
        ${fechada ? '' : `<button class="btn-mic" id="mic" style="width:40px;height:40px;border-radius:14px" aria-label="Ditar por voz">${ICON.mic}</button>`}</div>
      <textarea id="diag" rows="3" ${fechada ? 'readonly' : ''} placeholder="O que você encontrou? Toque no microfone e fale."
        style="border:0;background:var(--s2);border-radius:14px;padding:12px;resize:vertical;font-size:15px;line-height:1.45;color:var(--tx);outline:none">${esc(o.diagnostico || '')}</textarea>
      <div class="fotos">
        ${o.fotos.map((f) => `<a href="${urlFoto(f.caminho)}" target="_blank"><img src="${urlFoto(f.caminho)}" alt="Foto da OS" loading="lazy"></a>`).join('')}
        ${fechada ? '' : `<label class="foto-add" aria-label="Adicionar foto">${ICON.cam}<input type="file" accept="image/*" capture="environment" multiple id="fotoIn"></label>`}
      </div>
      <div class="peq dim">Fotos e vídeo do defeito aparecem para o cliente no link.</div>
    </div>` : ''}

    <div class="card" style="padding:6px 16px">
      <div class="linha" style="padding:10px 0">
        <h2 class="cresce">Itens</h2>
        ${fechada ? '' : `<button class="btn btn-p" data-add="servico">+ Serviço</button><button class="btn btn-p" data-add="peca">+ Peça</button>`}
      </div>
      ${o.itens.length ? o.itens.map(linhaItem).join('') : `<div class="item"><span class="mut med">Nenhum item ainda.</span></div>`}
    </div>

    ${o.status === 'entregue' ? `<div class="card"><div class="med">Pago${o.forma_pagamento ? ` via <b>${esc(o.forma_pagamento)}</b>` : ''} em ${dataCurta(o.pago_em)} ${hora(o.pago_em)}</div></div>` : ''}
    ${o.aprovado_em ? `<div class="peq dim" style="text-align:center">Aprovado em ${dataCurta(o.aprovado_em)} ${hora(o.aprovado_em)} (${esc(o.aprovado_por || '')})</div>` : ''}

    <div class="dupla">
      ${o.tipo !== 'rapido' ? `<button class="btn" id="whats">${ICON.wa} Avisar cliente</button>` : ''}
      <button class="btn" id="mais">Mais opções</button>
    </div>
  </div>

  <div class="barra">
    <div class="cresce"><div class="peq mut">Total</div><div class="tot">${brl(total)}</div></div>
    ${acao && !fechada ? `<button class="btn btn-y" id="acao" style="height:56px">${acao.txt} ${ICON[acao.icon]}</button>` : ''}
  </div>`);

  const recarregar = () => telaOS(o.id);

  q('#avisarNovo')?.addEventListener('click', () => abrirWhats(o, 'entrada'));
  q('#whats')?.addEventListener('click', () => abrirWhats(o, tipoMensagem(o.status)));
  q('#mais').onclick = () => folhaMaisOS(o, recarregar);

  const diag = q('#diag');
  if (diag && !fechada) {
    diag.onchange = async () => {
      const { error } = await sb.from('ordens').update({ diagnostico: diag.value.trim() || null }).eq('id', o.id);
      if (error) return falha(error);
      o.diagnostico = diag.value.trim();
      toast('Diagnóstico salvo');
    };
    q('#mic').onclick = () => ditado(diag, q('#mic'));
  }

  q('#fotoIn')?.addEventListener('change', async (e) => {
    toast('Enviando fotos...', 'info');
    try { await enviarFotos(o.id, [...e.target.files]); recarregar(); } catch (err) { falha(err); }
  });

  qa('[data-add]').forEach((b) => { b.onclick = () => folhaItem(o, b.dataset.add, recarregar); });
  qa('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Remover este item?')) return;
      const { error } = await sb.from('itens').delete().eq('id', b.dataset.rm);
      if (error) return falha(error);
      recarregar();
    };
  });

  q('#acao')?.addEventListener('click', (e) => executarAcao(o, e.currentTarget, recarregar));
}

async function executarAcao(o, botao, recarregar) {
  switch (o.status) {
    case 'entrada': {
      if (!o.itens.length) return toast('Adicione os serviços e peças antes', 'erro');
      if (foneWa(o.clientes?.whatsapp)) abrirWhats(o, 'orcamento');
      else if (!confirm('Cliente sem WhatsApp cadastrado. Marcar como enviado mesmo assim?')) return;
      return ocupado(botao, async () => { await mudarStatus(o, 'aguardando_aprovacao'); recarregar(); });
    }
    case 'aguardando_aprovacao': {
      if (!confirm('O cliente aprovou por telefone ou pessoalmente?')) return;
      return ocupado(botao, async () => {
        await mudarStatus(o, faltaPeca(o) ? 'aguardando_peca' : 'em_servico',
          { aprovado_em: new Date().toISOString(), aprovado_por: eu.nome });
        recarregar();
      });
    }
    case 'aguardando_peca':
      if (faltaPeca(o) && !confirm('Ainda tem peça que não chegou. Iniciar mesmo assim?')) return;
      return ocupado(botao, async () => { await mudarStatus(o, 'em_servico'); recarregar(); });
    case 'em_servico':
      return ocupado(botao, async () => { await mudarStatus(o, 'em_teste'); recarregar(); });
    case 'em_teste':
      abrirWhats(o, 'pronto');
      return ocupado(botao, async () => { await mudarStatus(o, 'pronto'); recarregar(); });
    case 'pronto':
      return folhaReceber(o, recarregar);
    default:
  }
}

function folhaItem(o, tipo, recarregar) {
  const peca = tipo === 'peca';
  const { el, fechar } = folha(`
    <h2>${peca ? 'Adicionar peça' : 'Adicionar serviço'}</h2>
    <label class="campo">${peca ? 'Peça' : 'Serviço'}<input name="desc" placeholder="${peca ? 'Kit escovas do motor de arranque' : 'Revisão do motor de arranque'}"></label>
    <div class="dupla">
      <label class="campo">Quantidade<input name="qtd" inputmode="decimal" value="1"></label>
      <label class="campo">Valor ${peca ? 'para o cliente' : ''}<input name="valor" inputmode="decimal" placeholder="0,00"></label>
    </div>
    ${peca ? `<label class="campo">Custo (se já souber)<input name="custo" inputmode="decimal" placeholder="a Eli preenche na cotação"></label>
      <p class="peq dim" style="margin:0">A peça vai direto para a lista da Eli cotar.</p>` : ''}
    <button class="btn btn-y btn-g" id="ok">Adicionar</button>`);
  q('[name=desc]', el).focus();
  q('#ok', el).onclick = (e) => ocupado(e.currentTarget, async () => {
    const descricao = q('[name=desc]', el).value.trim();
    if (!descricao) return toast('Descreva o item', 'erro');
    const item = {
      ordem_id: o.id, tipo, descricao,
      quantidade: parseValor(q('[name=qtd]', el).value) || 1,
      valor_unit: parseValor(q('[name=valor]', el).value),
    };
    if (peca) {
      item.status_peca = 'cotando';
      const custo = parseValor(q('[name=custo]', el).value);
      if (custo) item.custo = custo;
    }
    const { error } = await sb.from('itens').insert(item);
    if (error) throw error;
    fechar();
    recarregar();
  });
}

function folhaReceber(o, recarregar) {
  const { el, fechar } = folha(`
    <h2>Entregar e receber</h2>
    <div class="card" style="flex-direction:row;align-items:center">
      <span class="cresce mut">Total da OS</span><span class="tot" style="font-family:var(--disp);font-weight:700;font-size:24px">${brl(totalItens(o.itens))}</span>
    </div>
    <label class="campo">Forma de pagamento<select name="pag">${opcoesPagamento()}</select></label>
    <button class="btn btn-y btn-g" id="ok">Confirmar entrega</button>`);
  q('#ok', el).onclick = (e) => ocupado(e.currentTarget, async () => {
    await mudarStatus(o, 'entregue', { forma_pagamento: q('[name=pag]', el).value, pago_em: new Date().toISOString() });
    fechar();
    toast('Entregue e lançado no caixa');
    recarregar();
  });
}

function folhaMaisOS(o, recarregar) {
  const etapas = Object.entries(STATUS).filter(([k]) => k !== 'cancelado');
  const { el, fechar } = folha(`
    <h2>Mais opções</h2>
    <div class="dupla">
      <label class="campo">Cliente<input name="nome" value="${esc(o.clientes?.nome || '')}"></label>
      <label class="campo">WhatsApp<input name="whats" inputmode="tel" value="${esc(o.clientes?.whatsapp || '')}"></label>
    </div>
    <button class="btn" id="salvarCli">Salvar cliente</button>
    ${o.tipo !== 'rapido' ? `<button class="btn" id="copiar">${ICON.link} Copiar link do cliente</button>
    <a class="btn" href="${linkCliente(o.token)}" target="_blank">Ver como o cliente vê</a>` : ''}
    <label class="campo">Mudar etapa manualmente<select name="etapa">
      ${etapas.map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v.label}</option>`).join('')}
    </select></label>
    ${o.status !== 'cancelado' ? `<button class="btn" id="cancelar" style="color:var(--rd)">Cancelar OS</button>` : ''}
    <button class="btn" data-fechar>Fechar</button>`);

  q('#salvarCli', el).onclick = (e) => ocupado(e.currentTarget, async () => {
    const nome = q('[name=nome]', el).value.trim();
    if (!nome) return toast('Informe o nome', 'erro');
    const id = await salvarCliente({ id: o.cliente_id, nome, whatsapp: q('[name=whats]', el).value.trim() });
    if (!o.cliente_id) {
      await sb.from('ordens').update({ cliente_id: id }).eq('id', o.id);
      if (o.veiculo_id) await sb.from('veiculos').update({ cliente_id: id }).eq('id', o.veiculo_id);
    }
    fechar(); toast('Cliente salvo'); recarregar();
  });
  q('#copiar', el)?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(linkCliente(o.token)); toast('Link copiado'); } catch { toast(linkCliente(o.token), 'info'); }
  });
  q('[name=etapa]', el).onchange = async (e) => {
    const extra = e.target.value === 'entregue' && !o.pago_em ? { pago_em: new Date().toISOString() } : {};
    try { await mudarStatus(o, e.target.value, extra); fechar(); recarregar(); } catch (err) { falha(err); }
  };
  q('#cancelar', el)?.addEventListener('click', async () => {
    if (!confirm('Cancelar esta OS? Ela sai do quadro e do caixa.')) return;
    try { await mudarStatus(o, 'cancelado'); fechar(); location.hash = '#/'; } catch (err) { falha(err); }
  });
}

// =====================================================================
// Peças (Eli)
// =====================================================================
const FLUXO_PECA = {
  cotando: { prox: 'comprado', txt: 'Comprei', cor: '#FF8A3D' },
  comprado: { prox: 'chegou', txt: 'Chegou', cor: '#4DA3FF' },
  chegou: { prox: null, txt: '', cor: '#34D399' },
};

async function telaPecas() {
  render(`<div class="tela"><div class="carregando"></div></div>${nav('pecas')}`);
  const { data, error } = await sb.from('itens')
    .select('id,descricao,quantidade,custo,status_peca,criado_em,ordem_id,ordens!inner(id,numero,status,veiculos(placa,marca,modelo,ano))')
    .eq('tipo', 'peca')
    .not('ordens.status', 'in', '(entregue,cancelado)')
    .order('criado_em');
  if (error) return falha(error);
  if (!naRota('/pecas')) return;
  desenharPecas(data);
}

function desenharPecas(pecas) {
  const cont = (st) => pecas.filter((p) => (p.status_peca || 'cotando') === st).length;
  const lista = pecas.filter((p) => (p.status_peca || 'cotando') === filtroPecas);
  const aba = (k, label) => {
    const on = filtroPecas === k;
    return `<button data-aba="${k}" style="height:76px;border-radius:20px;border:1px solid ${on ? 'var(--y)' : 'var(--line)'};background:${on ? 'var(--y)' : 'var(--s1)'};color:${on ? 'var(--bg)' : 'var(--tx)'};display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;padding:0 14px">
      <b style="font-family:var(--disp);font-size:26px;line-height:1">${cont(k)}</b><span style="font-size:12px;font-weight:600">${label}</span></button>`;
  };

  q('.tela').innerHTML = `
    <div class="linha" style="align-items:flex-end">
      <div class="cresce"><div class="sobre">Compras</div><h1>Peças</h1></div>
      ${cont('cotando') ? `<button class="btn btn-p" id="cotacao" style="background:#1FAF55;color:#fff">${ICON.wa} Pedir cotação</button>` : ''}
    </div>
    <div class="tripla">${aba('cotando', 'Cotar')}${aba('comprado', 'Comprado')}${aba('chegou', 'Chegou')}</div>
    ${lista.length ? lista.map((p) => {
      const f = FLUXO_PECA[p.status_peca || 'cotando'];
      const v = p.ordens.veiculos;
      return `<div class="card">
        <div class="linha" style="align-items:flex-start;gap:12px">
          <span style="width:40px;height:40px;border-radius:14px;background:${tint(f.cor)};color:${f.cor};display:flex;align-items:center;justify-content:center">${ICON.peca}</span>
          <div class="cresce">
            <div style="font-weight:600">${esc(p.descricao)}</div>
            <div class="med mut" style="margin-top:3px">${Number(p.quantidade)} un · ${esc(v ? modeloCurto(v) : 'sem veículo')} · <span class="mono">${esc(v?.placa || '')}</span></div>
          </div>
          <a href="#/os/${p.ordens.id}" class="mono peq dim">OS ${p.ordens.numero}</a>
        </div>
        <div class="linha" style="gap:8px">
          <label class="campo cresce" style="flex-direction:row;align-items:center;gap:8px;padding:0 14px;height:48px;border-radius:16px">Custo
            <input data-custo="${p.id}" inputmode="decimal" placeholder="R$ 0,00" value="${p.custo ? String(p.custo).replace('.', ',') : ''}" style="font-family:var(--mono)">
          </label>
          ${f.prox ? `<button class="btn btn-y" data-prox="${p.id}" style="height:48px;border-radius:16px">${f.txt} ${ICON.seta}</button>`
            : `<span class="pill" style="color:var(--gr);background:${tint('#34D399')};height:48px;padding:0 14px">${ICON.check} Na oficina</span>`}
        </div>
      </div>`;
    }).join('') : `<div class="vazio"><b>Nada aqui</b>${filtroPecas === 'cotando' ? 'Quando o Gustavo pedir uma peça, ela aparece aqui.' : 'Nenhuma peça nesta etapa.'}</div>`}`;

  qa('[data-aba]').forEach((b) => { b.onclick = () => { filtroPecas = b.dataset.aba; desenharPecas(pecas); }; });

  qa('[data-custo]').forEach((inp) => {
    inp.onchange = async () => {
      const { error } = await sb.from('itens').update({ custo: parseValor(inp.value) || null }).eq('id', inp.dataset.custo);
      if (error) return falha(error);
      toast('Custo salvo');
    };
  });

  qa('[data-prox]').forEach((b) => {
    b.onclick = () => ocupado(b, async () => {
      const p = pecas.find((x) => x.id === b.dataset.prox);
      const prox = FLUXO_PECA[p.status_peca || 'cotando'].prox;
      const { error } = await sb.from('itens').update({ status_peca: prox }).eq('id', p.id);
      if (error) throw error;
      p.status_peca = prox;
      if (prox === 'chegou') await liberarSeTudoChegou(p.ordens);
      desenharPecas(pecas);
    });
  });

  q('#cotacao')?.addEventListener('click', () => {
    const itens = pecas.filter((p) => (p.status_peca || 'cotando') === 'cotando');
    const linhas = itens.map((p) => {
      const v = p.ordens.veiculos;
      return `- ${Number(p.quantidade)}x ${p.descricao}${v ? ` (${nomeVeiculo(v)})` : ''}`;
    });
    const texto = `Olá! Aqui é da ${OFICINA.nome}. Pode me passar o preço e a disponibilidade destas peças?\n\n${linhas.join('\n')}\n\nObrigado!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  });
}

async function liberarSeTudoChegou(ordem) {
  if (ordem.status !== 'aguardando_peca') return;
  const { data } = await sb.from('itens').select('status_peca').eq('ordem_id', ordem.id).eq('tipo', 'peca');
  if (data && data.every((i) => i.status_peca === 'chegou')) {
    await sb.from('ordens').update({ status: 'em_servico' }).eq('id', ordem.id);
    toast(`Peças da OS ${ordem.numero} completas. Carro liberado para o serviço.`);
  }
}

// =====================================================================
// Caixa (Thaiane)
// =====================================================================
function inicioPeriodo(p) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === 'semana') d.setDate(d.getDate() - 6);
  if (p === 'mes') d.setDate(1);
  return d;
}

async function telaCaixa() {
  render(`<div class="tela"><div class="carregando"></div></div>${nav('caixa')}`);
  const inicio = inicioPeriodo(periodoCaixa);
  const seteDias = inicioPeriodo('semana');
  const desdeQuando = inicio < seteDias ? inicio : seteDias;
  const campos = 'id,numero,tipo,status,forma_pagamento,pago_em,nota_emitida,criado_em,clientes(nome),veiculos(placa,marca,modelo,ano),itens(tipo,quantidade,valor_unit,custo)';
  const [pagos, receber] = await Promise.all([
    sb.from('ordens').select(campos).eq('status', 'entregue').gte('pago_em', desdeQuando.toISOString()).order('pago_em', { ascending: false }),
    sb.from('ordens').select(campos).eq('status', 'pronto'),
  ]);
  if (pagos.error || receber.error) return falha(pagos.error || receber.error);
  if (!naRota('/caixa')) return;
  desenharCaixa(pagos.data, receber.data, inicio, seteDias);
}

function desenharCaixa(todos, aReceber, inicio, seteDias) {
  const doPeriodo = todos.filter((o) => new Date(o.pago_em) >= inicio);
  const tot = (o) => totalItens(o.itens);
  const custo = (o) => o.itens.filter((i) => i.tipo === 'peca').reduce((s, i) => s + Number(i.custo || 0) * Number(i.quantidade || 1), 0);
  const faturado = doPeriodo.reduce((s, o) => s + tot(o), 0);
  const custos = doPeriodo.reduce((s, o) => s + custo(o), 0);
  const nomesPeriodo = { hoje: 'hoje', semana: 'nos últimos 7 dias', mes: 'no mês' };

  const dias = [...Array(7)].map((_, i) => {
    const d = new Date(seteDias); d.setDate(d.getDate() + i);
    const fim = new Date(d); fim.setDate(fim.getDate() + 1);
    const v = todos.filter((o) => { const t = new Date(o.pago_em); return t >= d && t < fim; }).reduce((s, o) => s + tot(o), 0);
    return { v, rot: d.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(), hoje: i === 6 };
  });
  const maxDia = Math.max(1, ...dias.map((d) => d.v));

  const porTipo = (t) => doPeriodo.filter((o) => o.tipo === t);
  const kpi = (t, label, cor) => {
    const l = porTipo(t);
    return `<div class="kpi"><span style="width:8px;height:8px;border-radius:50%;background:${cor}"></span>
      <b>${l.length}</b><span>${label}</span><span class="mono" style="color:var(--tx)">${brl(l.reduce((s, o) => s + tot(o), 0))}</span></div>`;
  };
  const pendentes = doPeriodo.filter((o) => !o.nota_emitida);
  const emitidas = doPeriodo.filter((o) => o.nota_emitida);
  const linhaOS = (o) => `<label class="item" style="cursor:pointer">
      <input type="checkbox" class="check" data-nota="${o.id}" ${o.nota_emitida ? 'checked' : ''}>
      <div class="cresce">
        <div class="d">${o.tipo === 'os' ? `OS ${o.numero}` : TIPOS[o.tipo]} · ${esc(o.veiculos ? modeloCurto(o.veiculos) : (o.clientes?.nome || ''))}</div>
        <div class="s">${dataCurta(o.pago_em)} · ${esc(o.forma_pagamento || '')}${o.clientes?.nome ? ` · ${esc(o.clientes.nome)}` : ''}</div>
      </div>
      <span class="v">${brl(tot(o))}</span>
    </label>`;

  q('.tela').innerHTML = `
    <div class="linha" style="align-items:flex-end">
      <div class="cresce"><div class="sobre">Financeiro e fiscal</div><h1>Caixa</h1></div>
      <div class="seg" style="width:170px">
        ${['hoje', 'semana', 'mes'].map((p) => `<button data-per="${p}" class="${periodoCaixa === p ? 'on' : ''}">${{ hoje: 'Dia', semana: 'Sem', mes: 'Mês' }[p]}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="border-radius:28px;padding:20px;gap:16px">
      <div class="med mut">Faturado ${nomesPeriodo[periodoCaixa]}</div>
      <div style="font-family:var(--disp);font-weight:700;font-size:40px;letter-spacing:-.04em;line-height:1">${brl(faturado)}</div>
      <div class="linha med"><span class="mut">Peças</span><span class="mono">${brl(custos)}</span><span class="cresce"></span><span class="mut">Margem</span><span class="mono" style="color:var(--gr)">${brl(faturado - custos)}</span></div>
      <div class="barras">${dias.map((d) => `<div><span style="height:${Math.round((d.v / maxDia) * 100)}%;${d.hoje ? 'background:var(--y)' : ''}"></span>${d.rot}</div>`).join('')}</div>
    </div>

    <div class="kpis">${kpi('os', 'OS completas', '#A78BFA')}${kpi('rapido', 'Rápidos', '#FFD60A')}${kpi('socorro', 'Socorros', '#FF8A3D')}</div>

    ${aReceber.length ? `<div class="card" style="border-color:${tint('#34D399', .5)}">
      <div class="linha"><h2 class="cresce">Prontos, aguardando pagamento</h2><span class="mono">${brl(aReceber.reduce((s, o) => s + tot(o), 0))}</span></div>
      ${aReceber.map((o) => `<a class="item" href="#/os/${o.id}"><div class="cresce"><div class="d">OS ${o.numero} · ${esc(modeloCurto(o.veiculos))}</div><div class="s">${esc(o.clientes?.nome || '')}</div></div><span class="v">${brl(tot(o))}</span></a>`).join('')}
    </div>` : ''}

    <div class="card" style="padding:6px 16px 8px">
      <div class="linha" style="padding:10px 0">
        <h2 class="cresce">Para emitir nota</h2>
        <button class="btn btn-p" id="exportar" style="background:var(--y);color:var(--bg)">${ICON.down} Exportar</button>
      </div>
      ${pendentes.length ? pendentes.map(linhaOS).join('') : `<div class="item"><span class="mut med">Tudo emitido neste período.</span></div>`}
      ${emitidas.length ? `<details style="border-top:1px solid var(--line);padding:10px 0"><summary class="med mut" style="cursor:pointer">${emitidas.length} já emitida(s)</summary>${emitidas.map(linhaOS).join('')}</details>` : ''}
    </div>`;

  qa('[data-per]').forEach((b) => { b.onclick = () => { periodoCaixa = b.dataset.per; telaCaixa(); }; });
  qa('[data-nota]').forEach((c) => {
    c.onchange = async () => {
      const { error } = await sb.from('ordens').update({ nota_emitida: c.checked }).eq('id', c.dataset.nota);
      if (error) return falha(error);
      const o = todos.find((x) => x.id === c.dataset.nota);
      o.nota_emitida = c.checked;
      desenharCaixa(todos, aReceber, inicio, seteDias);
    };
  });
  q('#exportar').onclick = () => exportarCSV(doPeriodo, tot, custo);
}

function exportarCSV(lista, tot, custo) {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const n = (v) => Number(v).toFixed(2).replace('.', ',');
  const linhas = [['OS', 'Data', 'Tipo', 'Cliente', 'Placa', 'Veículo', 'Pagamento', 'Total', 'Custo peças', 'Nota emitida']];
  lista.forEach((o) => linhas.push([
    o.numero, new Date(o.pago_em).toLocaleDateString('pt-BR'), TIPOS[o.tipo], o.clientes?.nome || '',
    o.veiculos?.placa || '', o.veiculos ? nomeVeiculo(o.veiculos) : '', o.forma_pagamento || '',
    n(tot(o)), n(custo(o)), o.nota_emitida ? 'sim' : 'não',
  ]));
  const csv = '\uFEFF' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `caixa-mgt-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// =====================================================================
// Conta
// =====================================================================
function telaConta() {
  const funcoes = { admin: 'Administrador', oficina: 'Oficina', compras: 'Compras', financeiro: 'Financeiro e fiscal' };
  const instalado = matchMedia('(display-mode: standalone)').matches;
  render(`<div class="brilho"></div><div class="tela">
    ${topo()}
    <h1>Conta</h1>
    <div class="card">
      <div class="linha"><span class="cresce mut">Nome</span><b>${esc(eu.nome)}</b></div>
      <div class="linha"><span class="cresce mut">Função</span><span>${funcoes[eu.funcao] || eu.funcao}</span></div>
    </div>
    ${instalado ? '' : `<div class="card">
      <h2>Instalar no celular</h2>
      <div class="med mut" style="line-height:1.5"><b style="color:var(--tx)">Android:</b> menu do Chrome (⋮) e "Instalar app".<br>
      <b style="color:var(--tx)">iPhone:</b> botão compartilhar do Safari e "Adicionar à Tela de Início".</div>
    </div>`}
    <button class="btn" id="sair">Sair da conta</button>
    <div class="peq dim" style="text-align:center">MGT Oficina · v1 · feito pela Sow MKT</div>
  </div>${nav('conta')}`);
  q('#sair').onclick = async () => { await sb.auth.signOut(); eu = null; location.hash = ''; telaLogin(); };
}

iniciar();
