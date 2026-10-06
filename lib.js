import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, OFICINA } from './config.js';

export { OFICINA };
export const configurado = !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('COLE-AQUI');
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- texto e números ----------
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const parseValor = (s) => {
  const t = String(s ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!t) return 0;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0;
};

export const totalItens = (itens = []) =>
  itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valor_unit || 0), 0);

export const normPlaca = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
export const placaValida = (p) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normPlaca(p));

export function desde(ts) {
  const min = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${String(min % 60).padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

export const hora = (ts) => ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
export const dataCurta = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

export const nomeVeiculo = (v) => v ? [v.marca, v.modelo, v.ano].filter(Boolean).join(' ') || v.placa : 'Sem veículo';
export const modeloCurto = (v) => v ? (v.modelo || v.marca || v.placa || 'veículo') : 'veículo';

// ---------- etapas ----------
export const STATUS = {
  entrada:              { label: 'Diagnóstico',  cor: '#FFD60A', passo: 1 },
  aguardando_aprovacao: { label: 'Aprovação',    cor: '#FF8A3D', passo: 2 },
  aguardando_peca:      { label: 'Aguard. peça', cor: '#4DA3FF', passo: 3 },
  em_servico:           { label: 'Em serviço',   cor: '#A78BFA', passo: 4 },
  em_teste:             { label: 'Em teste',     cor: '#A78BFA', passo: 4 },
  pronto:               { label: 'Pronto',       cor: '#34D399', passo: 5 },
  entregue:             { label: 'Entregue',     cor: '#71717A', passo: 5 },
  cancelado:            { label: 'Cancelado',    cor: '#71717A', passo: 0 },
};
export const tint = (hex, a = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const TIPOS = { os: 'OS', rapido: 'Rápido', socorro: 'Socorro' };
export const PAGAMENTOS = ['Pix', 'Dinheiro', 'Cartão débito', 'Cartão crédito', 'Boleto/prazo'];

// ---------- WhatsApp ----------
export function foneWa(f) {
  let d = String(f || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}
export function linkWa(fone, texto) {
  const f = foneWa(fone);
  return `https://wa.me/${f}?text=${encodeURIComponent(texto)}`;
}
export function linkCliente(token) {
  return new URL(`cliente.html?t=${token}`, location.href).href.split('#')[0];
}

// ---------- fotos ----------
export async function comprimir(file, max = 1600, q = 0.8) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', q));
}
export async function enviarFotos(ordemId, files) {
  for (const f of files) {
    const blob = await comprimir(f);
    const caminho = `${ordemId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { error: e2 } = await sb.from('fotos').insert({ ordem_id: ordemId, caminho });
    if (e2) throw e2;
  }
}
export const urlFoto = (caminho) => sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;

// ---------- interface ----------
export function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); }, 2800);
}

export function placaHTML(p, grande = false) {
  return `<span class="placa${grande ? ' placa-g' : ''}"><span class="placa-faixa"></span><span class="placa-txt">${esc(p || '-------')}</span></span>`;
}

export function ditado(textarea, botao) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Use o microfone do teclado do celular', 'info'); textarea.focus(); return; }
  const r = new SR();
  r.lang = 'pt-BR';
  r.interimResults = false;
  r.continuous = false;
  botao.classList.add('gravando');
  r.onresult = (e) => {
    const t = Array.from(e.results).map((x) => x[0].transcript).join(' ');
    textarea.value = (textarea.value ? textarea.value.trim() + ' ' : '') + t.charAt(0).toUpperCase() + t.slice(1);
    textarea.dispatchEvent(new Event('change'));
  };
  r.onerror = () => toast('Não entendi, tente de novo', 'info');
  r.onend = () => botao.classList.remove('gravando');
  r.start();
}

export const ICON = {
  quadro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  peca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></svg>',
  caixa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  raio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
};
