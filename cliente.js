import { sb, OFICINA, esc, brl, totalItens, nomeVeiculo, modeloCurto, hora, dataCurta, urlFoto, linkWa, foneWa, placaHTML, toast, ICON } from './lib.js';

const app = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t') || '';

const PASSOS = [
  { k: 'entrada', label: 'Veículo recebido' },
  { k: 'aguardando_aprovacao', label: 'Orçamento enviado' },
  { k: 'aprovado', label: 'Orçamento aprovado' },
  { k: 'em_servico', label: 'Em serviço' },
  { k: 'em_teste', label: 'Em teste' },
  { k: 'pronto', label: 'Pronto para retirada' },
];
const INDICE = { entrada: 0, aguardando_aprovacao: 1, aguardando_peca: 3, em_servico: 3, em_teste: 4, pronto: 5, entregue: 6 };

function titulo(o) {
  const carro = modeloCurto(o.veiculo);
  return {
    entrada: `Estamos fazendo o diagnóstico do seu ${carro}`,
    aguardando_aprovacao: 'Seu orçamento está pronto',
    aguardando_peca: 'Aprovado! Aguardando a peça chegar',
    em_servico: `Seu ${carro} está em serviço`,
    em_teste: 'Serviço feito, agora em teste',
    pronto: `Seu ${carro} está pronto!`,
    entregue: 'Serviço concluído. Obrigado!',
  }[o.status] || 'Acompanhe seu veículo';
}

function quando(o, k) {
  if (k === 'aprovado') return o.aprovado_em;
  const ev = (o.eventos || []).find((e) => e.status === k);
  return ev?.em || (k === 'entrada' ? o.criado_em : null);
}

async function carregar() {
  if (!token) return vazio();
  const { data, error } = await sb.rpc('os_publica', { p_token: token });
  if (error || !data) return vazio();
  desenhar(data);
}

function vazio() {
  app.innerHTML = `<div class="login" style="text-align:center">
    <img src="assets/logo.png" alt="${esc(OFICINA.nome)}">
    <h1>Link não encontrado</h1>
    <p class="mut">Confira se o link está completo ou fale com a oficina.</p>
    ${foneWa(OFICINA.whatsapp) ? `<a class="btn btn-wa" href="${linkWa(OFICINA.whatsapp, 'Olá! Não consegui abrir o link do meu carro.')}">${ICON.wa} Falar com a oficina</a>` : ''}
  </div>`;
}

function desenhar(o) {
  const atual = INDICE[o.status] ?? 0;
  const total = totalItens(o.itens);
  const aprovar = o.status === 'aguardando_aprovacao';
  const mostraOrc = o.itens.length && atual >= 1;
  const cor = (i) => (i < atual ? 'var(--y)' : i === atual ? 'var(--or)' : 'var(--s3)');

  app.innerHTML = `<div class="brilho" style="left:-60px;right:auto"></div><div class="tela">
    <div class="topo">
      <img src="assets/logo.png" alt="${esc(OFICINA.nome)}" style="width:54px;height:54px">
      <div class="cresce"><div class="t1">${esc(OFICINA.nome)}</div><div class="t2">desde ${esc(OFICINA.desde)}</div></div>
      ${o.status !== 'entregue' ? `<span class="peq" style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--y)"><span style="width:7px;height:7px;border-radius:50%;background:var(--y);box-shadow:0 0 10px var(--y)"></span>ao vivo</span>` : ''}
    </div>

    <div style="margin-top:6px">
      ${o.cliente ? `<div class="mut">Olá, ${esc(o.cliente)}</div>` : ''}
      <h1 style="margin-top:4px">${esc(titulo(o))}</h1>
    </div>

    <div class="card">
      <div class="linha">
        <div class="cresce"><div style="font-weight:600">${esc(nomeVeiculo(o.veiculo))}</div><div class="peq mut" style="margin-top:2px">OS ${o.numero} · entrada ${dataCurta(o.criado_em)} ${hora(o.criado_em)}</div></div>
        ${o.veiculo ? placaHTML(o.veiculo.placa) : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px">
        ${PASSOS.map((_, i) => `<span style="height:6px;border-radius:3px;background:${cor(i)}"></span>`).join('')}
      </div>
      <div class="tl">
        ${PASSOS.map((p, i) => {
          const cls = i < atual || o.status === 'entregue' ? 'feito' : i === atual ? 'agora' : 'depois';
          const t = cls === 'feito' ? quando(o, p.k) : null;
          const label = cls === 'agora' && o.status === 'aguardando_peca' ? 'Aguardando a peça chegar' : p.label;
          return `<div class="${cls}"><i>${cls === 'feito' ? ICON.check : ''}</i><span>${label}</span><em>${cls === 'agora' ? 'agora' : t ? hora(t) : ''}</em></div>`;
        }).join('')}
      </div>
    </div>

    ${o.diagnostico || o.fotos.length || mostraOrc ? `<div class="card">
      <h2>O que encontramos</h2>
      ${o.diagnostico ? `<div style="color:#D4D4D8;line-height:1.5">${esc(o.diagnostico)}</div>` : ''}
      ${o.fotos.length ? `<div class="galeria">${o.fotos.map((f) => `<a href="${urlFoto(f)}" target="_blank"><img src="${urlFoto(f)}" alt="Foto do serviço" loading="lazy"></a>`).join('')}</div>` : ''}
      ${mostraOrc ? `<div style="border-top:1px solid var(--line);padding-top:4px">
        ${o.itens.map((i) => `<div class="linha" style="padding:8px 0;font-size:14px"><span class="cresce">${esc(i.descricao)}${Number(i.quantidade) !== 1 ? ` <span class="dim">x${Number(i.quantidade)}</span>` : ''}</span><span class="mono">${brl(Number(i.quantidade) * Number(i.valor_unit))}</span></div>`).join('')}
        <div class="linha" style="padding-top:10px;border-top:1px solid var(--line)"><span class="cresce mut">Total</span><b style="font-family:var(--disp);font-size:24px">${brl(total)}</b></div>
      </div>` : ''}
    </div>` : ''}

    ${foneWa(OFICINA.whatsapp) ? `<a class="btn" href="${linkWa(OFICINA.whatsapp, `Olá! Sobre a OS ${o.numero} (${o.veiculo?.placa || ''}):`)}" target="_blank">${ICON.wa} Falar com a oficina</a>` : ''}
    ${OFICINA.endereco ? `<div class="peq dim" style="text-align:center">${esc(OFICINA.endereco)}</div>` : ''}
  </div>
  ${aprovar ? `<div class="barra">
    <div class="cresce"><div class="peq mut">Total</div><div class="tot">${brl(total)}</div></div>
    <button class="btn btn-y" id="aprovar" style="height:56px;padding:0 24px">Aprovar</button>
  </div>` : ''}`;

  document.getElementById('aprovar')?.addEventListener('click', () => confirmar(o));
}

function confirmar(o) {
  const fundo = document.createElement('div');
  fundo.className = 'folha-fundo';
  fundo.innerHTML = `<div class="folha">
    <div class="alca"></div>
    <h2>Aprovar orçamento?</h2>
    <p class="mut" style="margin:0;line-height:1.5">Ao aprovar, a ${esc(OFICINA.nome)} começa o serviço no seu ${esc(modeloCurto(o.veiculo))} no valor de <b style="color:var(--tx)">${brl(totalItens(o.itens))}</b>.</p>
    <button class="btn btn-y btn-g" id="sim">Sim, pode fazer</button>
    <button class="btn" id="nao">Ainda não</button>
  </div>`;
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.querySelector('#nao').onclick = fechar;
  fundo.onclick = (e) => { if (e.target === fundo) fechar(); };
  fundo.querySelector('#sim').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const { error } = await sb.rpc('aprovar_os', { p_token: token });
    fechar();
    if (error) return toast('Não foi possível aprovar. Tente de novo.', 'erro');
    toast('Orçamento aprovado. Obrigado!');
    carregar();
  };
}

carregar();
setInterval(() => { if (!document.hidden && !document.querySelector('.folha-fundo')) carregar(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(); });
