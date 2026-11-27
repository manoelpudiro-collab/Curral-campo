// Curral Digital — app de campo.
// Guarda no celular uma cópia do rebanho e funciona sem internet. Com internet, atualiza sozinho.
// Entrada: código de 6 dígitos que o bot do Telegram manda quando a pessoa escreve /app.
'use strict';

const API = 'https://cstwrcymyfqyrjekhcie.supabase.co/functions/v1/app-campo';
const VERSAO_APP = '2.15 · 27/11/2026';
const CH = { chave: 'cd.chave', copia: 'cd.copia', usuario: 'cd.usuario', quando: 'cd.atualizado', recentes: 'cd.recentes', fazenda: 'cd.fazenda' };
const ATUALIZAR_APOS_MIN = 10;

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const apagar = (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
const lerJSON = (k, padrao) => { try { const t = ler(k); return t ? JSON.parse(t) : padrao; } catch { return padrao; } };
const empurrar = (mapa, k, v) => { const l = mapa.get(k); if (l) l.push(v); else mapa.set(k, [v]); };

const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }).format(new Date());
const dt = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const dtc = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
function relativo(iso) {
  const d = diasEntre(hojeISO(), iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}
function idade(nasc) {
  if (!nasc) return null;
  const h = hojeISO();
  const dias = diasEntre(nasc, h);
  if (dias < 0) return null;
  if (dias < 31) return `${dias} dia${dias === 1 ? '' : 's'}`;
  let m = (Number(h.slice(0, 4)) - Number(nasc.slice(0, 4))) * 12 + (Number(h.slice(5, 7)) - Number(nasc.slice(5, 7)));
  if (Number(h.slice(8, 10)) < Number(nasc.slice(8, 10))) m -= 1;
  if (m < 24) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  const a = Math.floor(m / 12), r = m % 12;
  return `${a} anos${r ? ` e ${r} ${r === 1 ? 'mês' : 'meses'}` : ''}`;
}
const kg = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function horaDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const f = (o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Araguaina', ...o }).format(d);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }).format(d);
  const dd = diasEntre(dia, hojeISO());
  const hora = f({ hour: '2-digit', minute: '2-digit' });
  if (dd === 0) return `hoje às ${hora}`;
  if (dd === 1) return `ontem às ${hora}`;
  return `${f({ day: '2-digit', month: '2-digit' })} às ${hora}`;
}

// número do brinco: "0346", "B3C-0826-11", "C0087-0726". Busca ignora traço, espaço e zeros na frente.
const chaveNum = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const semZeros = (s) => s.replace(/^0+(?=\d)/, '');

const NOME_CAT = { matriz: 'Vaca', novilha: 'Novilha', bezerro: 'Bezerro', bezerra: 'Bezerra', touro: 'Touro', boi: 'Boi', garrote: 'Garrote', descarte: 'Descarte' };
const NOME_SR = { prenha: 'Prenha', vazia: 'Vazia', parida: 'Parida', solteira: 'Solteira' };
const NOME_ST = { ativo: 'No rebanho', morto: 'Morto', vendido: 'Vendido', transferido: 'Transferido', descartado: 'Descartado' };
const NOME_ETAPA = {
  inducao: 'Pré-indução', implante: 'Implante', retirada_implante: 'Retirada do implante', cipionato: 'Cipionato',
  prostaglandina: 'Prostaglandina', eCG: 'eCG', inseminacao: 'Inseminação (IATF)', dg: 'Diagnóstico de gestação',
  repasse: 'Repasse com touro', aplicacao: 'Aplicação', outro: 'Manejo',
};
const NOME_EVENTO = {
  nascimento: 'Nascimento', pesagem: 'Pesagem', doenca: 'Doença', tratamento: 'Tratamento', inseminacao: 'Inseminação',
  diagnostico_gestacao: 'Diagnóstico de gestação', parto: 'Parto', secagem: 'Secagem', morte: 'Morte', venda: 'Venda',
  compra: 'Compra', transferencia: 'Transferência', observacao: 'Observação', cio: 'Cio', desmama: 'Desmama',
};

// ícones (traço simples)
const I = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
  busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  listas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  atualizar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
  seta: '<svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 5-7 7 7 7"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="m5 12 5 5 9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  repro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z"/></svg>',
  familia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="7" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M2.5 20c.8-3.6 3-5.5 5.5-5.5s4.7 1.9 5.5 5.5M14 20c.4-2.4 1.6-4 3-4s2.6 1.6 3 4"/></svg>',
  peso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 8h12l2 12H4L6 8Z"/><circle cx="12" cy="5" r="2"/></svg>',
  saude: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m14 4 6 6M17 7l-9 9-3 1 1-3 9-9M4 20l3-3"/></svg>',
  hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  dinheiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  sino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  manejo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15l9 5 9-5-9-5-9 5Z"/><path d="M12 10V3l5 2-5 2"/></svg>',
  lancar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  rebanho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c1 2 2.5 3 4.5 3h7c2 0 3.5-1 4.5-3"/><path d="M7.5 8 7 14c0 3 2 6 5 6s5-3 5-6l-.5-6"/><path d="M10 16.5h.01M14 16.5h.01"/><circle cx="9.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="14.5" cy="11.5" r=".6" fill="currentColor"/></svg>',
  balanca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16M6 20V9h12v11"/><path d="M9 13h6"/><path d="M12 4v5"/></svg>',
  curral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9h18M3 15h18M5 6v14M12 6v14M19 6v14"/></svg>',
  morte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M6 9h12"/></svg>',
  nasc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c1-4 3.8-6.5 7-6.5s6 2.5 7 6.5"/></svg>',
  chuva: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 6.5 4 4 0 0 1 17 15H7Z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/></svg>',
  bezerro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9.5 7.6 14c0 3 2 5.5 4.4 5.5s4.4-2.5 4.4-5.5L16 9.5"/><path d="M8 9.5c-1.6 0-3-.8-3.6-2.2M16 9.5c1.6 0 3-.8 3.6-2.2M8 9.5c1-1.2 2.4-1.8 4-1.8s3 .6 4 1.8"/><circle cx="10" cy="12.5" r=".6" fill="currentColor"/><circle cx="14" cy="12.5" r=".6" fill="currentColor"/></svg>',
  touro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4c.5 3 2.5 4.5 5 4.5h8c2.5 0 4.5-1.5 5-4.5"/><path d="M7.5 8.5 7 14c0 3 2 6 5 6s5-3 5-6l-.5-5.5"/><path d="M10 17h4"/><circle cx="9.5" cy="12" r=".6" fill="currentColor"/><circle cx="14.5" cy="12" r=".6" fill="currentColor"/></svg>',
  pasto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20h18M6 20c0-4 1-7 3-9M12 20c0-5 0-8 1-11M18 20c0-4-1-6-3-8"/></svg>',
  dinheiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
};

// ------------------------------------------------------------------ estado
const S = {
  dados: null, idx: null, usuario: lerJSON(CH.usuario, null), quando: ler(CH.quando),
  online: navigator.onLine, buscando: false, fazenda: ler(CH.fazenda) || 'todas', q: '', teclado: 'numeric',
  tinhaControlador: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
};
const dono = () => (S.usuario && S.usuario.papel) === 'dono';
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function indexar(c) {
  const porId = new Map(), filhos = new Map(), eventos = new Map(), aplic = new Map();
  const faz = new Map(c.fazendas.map((f) => [f.id, f]));
  const lotes = new Map(c.lotes.map((l) => [l.id, l]));
  const pastos = new Map(((c.mapa && c.mapa.pastos) || c.pastos || []).map((p) => [p.id, p]));
  const prot = new Map(c.protocolos.map((p) => [p.id, p]));
  const manejos = new Map(c.manejos.map((m) => [m.id, m]));
  for (const a of c.animais) { porId.set(a.id, a); a._k = chaveNum(a.n); a._kz = semZeros(a._k); a._b = a.b ? semZeros(chaveNum(a.b)) : ''; }
  for (const a of c.animais) if (a.mae) empurrar(filhos, a.mae, a);
  for (const e of c.eventos) { if (e.a) empurrar(eventos, e.a, e); }
  for (const r of c.aplicacoes) {
    const [m, a, st, prev, apl, prod, dose, obs] = r;
    const mj = manejos.get(m);
    if (mj) empurrar(aplic, a, { m: mj, st, prev, apl, prod, dose, obs, data: apl || prev || mj.real || mj.prev });
  }
  const partos = new Map((c.partos || []).map((p) => [p.n, p]));
  const pastoDoLote = new Map();
  for (const o of (c.mapa ? c.mapa.ocupacoes : c.ocupacoes) || []) if (!o.sai && o.lote) pastoDoLote.set(o.lote, o);
  const insem = new Map();   // inseminações (sêmen, inseminador, resultado do DG) de cada fêmea (etapa 3)
  for (const i of c.ins || []) empurrar(insem, i.a, i);
  return { porId, filhos, eventos, aplic, faz, lotes, pastos, prot, manejos, partos, pastoDoLote, insem };
}

function carregar(copia, usuario, quando) {
  S.dados = copia;
  S.idx = indexar(copia);
  if (usuario) S.usuario = usuario;
  if (quando) S.quando = quando;
}

// ------------------------------------------------------------------ conversa com o Supabase
async function pedir(corpo, chave) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (chave) headers['x-curral-chave'] = chave;
    const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify(corpo), cache: 'no-store', signal: ctrl.signal });
    const j = await r.json().catch(() => ({ ok: false, motivo: 'resposta_invalida' }));
    return { status: r.status, j };
  } finally {
    clearTimeout(t);
  }
}

async function atualizar(manual = false) {
  const chave = ler(CH.chave);
  if (!chave || S.buscando) return;
  S.buscando = true;
  if (S.dados) desenharTopo(); else desenhar();
  try {
    const { status, j } = await pedir({ acao: 'copia' }, chave);
    if (status === 401 && j.motivo === 'sem_acesso') {
      sairDoAparelho('O acesso deste celular foi encerrado. Para entrar de novo, mande /app para o bot.');
      return;
    }
    if (!j.ok) throw new Error(j.motivo || 'erro');
    const agora = new Date().toISOString();
    if (!gravar(CH.copia, JSON.stringify(j.copia))) avisar('O celular está sem espaço para guardar a cópia.');
    gravar(CH.usuario, JSON.stringify(j.usuario));
    gravar(CH.quando, agora);
    S.online = true;
    carregar(j.copia, j.usuario, agora);
    if (digitando()) desenharTopo(); else desenhar();
    if (manual) avisar('Atualizado agora.');
    if (nFila()) setTimeout(() => enviarFila(), 0);
  } catch (e) {
    S.online = false;
    if (manual) avisar(navigator.onLine ? 'Não consegui atualizar agora. Mostrando a última cópia.' : 'Sem internet. Mostrando a última cópia.');
  } finally {
    S.buscando = false;
    desenharTopo();
  }
}

function precisaAtualizar() {
  if (!S.quando) return true;
  return Date.now() - Date.parse(S.quando) > ATUALIZAR_APOS_MIN * 60000;
}

function sairDoAparelho(mensagem) {
  for (const k of [CH.chave, CH.copia, CH.usuario, CH.quando, CH.recentes]) apagar(k);
  S.dados = null; S.idx = null; S.usuario = null; S.quando = null;
  history.replaceState(null, '', location.pathname + location.search);  // limpa o endereço sem redesenhar por cima do aviso
  desenhar(mensagem);
}

// ------------------------------------------------------------------ leituras de um animal
function protocolosDo(a) {
  const lista = (S.idx.aplic.get(a.id) || []).filter((x) => x.m.prot);
  const por = new Map();
  for (const x of lista) empurrar(por, x.m.prot, x);
  return [...por.entries()].map(([pid, passos]) => {
    passos.sort((p, q) => (p.data || '').localeCompare(q.data || '') || p.m.id - q.m.id);
    return { p: S.idx.prot.get(pid), passos };
  }).sort((x, y) => (y.p?.d0 || '').localeCompare(x.p?.d0 || ''));
}
function proximaEtapa(a) {
  const h = hojeISO();
  const futuras = (S.idx.aplic.get(a.id) || []).filter((x) => x.st === 'previsto' && x.data && x.data >= h);
  futuras.sort((p, q) => p.data.localeCompare(q.data));
  return futuras[0] || null;
}
const diaProt = (p, data) => (p && p.d0 && data ? diasEntre(p.d0, data) : null);
const rotuloDia = (d) => (d === null ? '' : `D${d}`);
function ultimoDG(a) {
  const dgs = (S.idx.eventos.get(a.id) || []).filter((e) => e.t === 'diagnostico_gestacao');
  return dgs.length ? dgs[dgs.length - 1] : null;
}
function pesos(a) {
  return (S.idx.eventos.get(a.id) || []).filter((e) => e.t === 'pesagem' && e.p).sort((p, q) => p.d.localeCompare(q.d));
}
function lotesDo(a) {
  return (a.lotes || []).map((id) => S.idx.lotes.get(id)).filter(Boolean);
}
const faz = (id) => S.idx.faz.get(id) || { codigo: '?', nome: '?' };

function seloSR(sr) { return sr && NOME_SR[sr] ? `<span class="selo s-${esc(sr)}">${esc(NOME_SR[sr])}</span>` : ''; }
function resumo(a) {
  const partes = [NOME_CAT[a.c] || a.c, faz(a.f).codigo];
  const i = idade(a.nasc);
  if (i) partes.push(i);
  return partes.join(' · ');
}
function itemAnimal(a, extra) {
  const lado = a.st !== 'ativo' ? `<span class="selo s-${esc(a.st)}">${esc(NOME_ST[a.st] || a.st)}</span>` : seloSR(a.sr);
  return `<button class="item" data-ir="#animal/${a.id}">
    <span><span class="item-n">${esc(a.n)}</span><span class="item-m">${esc(extra || resumo(a))}</span></span>
    ${lado || '<span></span>'}${I.seta}</button>`;
}

// ------------------------------------------------------------------ telas
function telaEntrar(mensagem) {
  const naoInstalado = !instalado();
  return `<main class="entrar">
    <img src="icones/icone-180.png" alt="">
    <h1>Curral Digital<br>no campo</h1>
    ${naoInstalado ? `<div class="dica"><b>Primeiro, coloque o app na tela de início</b>
      <span>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima) e depois em <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone novo e entre por lá: é ele que funciona sem internet.</span></div>` : ''}
    <ol class="passos">
      <li>No Telegram, mande <b>/app</b> para o bot do Curral Digital.</li>
      <li>Ele responde com um código de 6 dígitos.</li>
      <li>Digite o código aqui embaixo.</li>
    </ol>
    <input id="codigo" class="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código de 6 dígitos">
    <p id="erro" class="erro" ${mensagem ? '' : 'hidden'}>${esc(mensagem || '')}</p>
    <button id="btn-entrar" class="btn" data-acao="entrar">Entrar</button>
    <p class="versao">Versão ${esc(VERSAO_APP)}</p>
  </main>`;
}

function topo() {
  const quando = horaDe(S.quando);
  const nf = typeof nFila === 'function' ? nFila() : 0;
  const estado = nf ? `${nf} esperando envio` : S.buscando ? 'Atualizando…' : quando ? `Atualizado ${quando}` : 'Sem cópia ainda';
  return `<header class="topo">
    <div class="topo-marca"><img src="icones/icone-180.png" alt="">
      <div><div class="topo-t">Curral Digital</div>
      <div class="topo-s"><span class="ponto ${S.online ? 'on' : ''}"></span>${S.online ? '' : 'Sem internet · '}${esc(estado)}</div></div></div>
    <button class="btn-ic" data-acao="avisos" aria-label="Avisos">${I.sino}${nAvisos() ? `<span class="contador">${nAvisos()}</span>` : ''}</button>
    <button class="btn-ic ${S.buscando ? 'girando' : ''}" data-acao="atualizar" aria-label="Atualizar agora">${I.atualizar}</button>
  </header>`;
}

function abas(atual) {
  const a = (id, rot, ic) => `<button class="aba" data-ir="#${id}" ${atual === id ? 'aria-current="page"' : ''}><span class="aba-ic">${ic}</span><span>${rot}</span></button>`;
  return `<nav class="abas"><div class="abas-dentro">
    ${a('painel', 'Início', I.inicio)}${a('buscar', 'Rebanho', I.rebanho)}
    ${dono() ? a('lancar', 'Manejo', I.manejo) : ''}
    ${a('agenda', 'Agenda', I.agenda)}${a('mais', 'Mais', I.mais)}
  </div></nav>`;
}

function chipsFazenda() {
  const ops = [['todas', 'Todas'], ...S.dados.fazendas.map((f) => [f.codigo, f.codigo])];
  return `<div class="chips" role="group" aria-label="Fazenda">${ops.map(([v, r]) =>
    `<button class="chip" data-acao="fazenda" data-valor="${esc(v)}" aria-pressed="${S.fazenda === v}">${esc(r)}</button>`).join('')}</div>`;
}
const naFazenda = (a) => S.fazenda === 'todas' || faz(a.f).codigo === S.fazenda;

function telaBuscar() {
  return `<section class="pagina">
    <div class="campo-busca">${I.busca}
      <input id="q" type="search" inputmode="${S.teclado}" placeholder="Número do animal" value="${esc(S.q)}"
        autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="Número do animal">
      <button class="teclado" data-acao="teclado">${S.teclado === 'numeric' ? 'ABC' : '123'}</button>
    </div>
    ${chipsFazenda()}
    <div id="resultados">${resultados()}</div>
  </section>`;
}

function buscar(q) {
  const k = chaveNum(q), kz = semZeros(k);
  if (!k) return [];
  const exatos = [], comeca = [], contem = [];
  for (const a of S.dados.animais) {
    if (!naFazenda(a)) continue;
    if (a._kz === kz || a._k === k || (a._b && a._b === kz)) exatos.push(a);
    else if (a._k.startsWith(k) || a._kz.startsWith(kz)) comeca.push(a);
    else if (kz.length >= 2 && (a._k.includes(k) || a._k.includes(kz))) contem.push(a);
  }
  const ord = (x, y) => (x.st === 'ativo' ? 0 : 1) - (y.st === 'ativo' ? 0 : 1) || x.n.localeCompare(y.n, 'pt-BR', { numeric: true });
  return [...exatos.sort(ord), ...comeca.sort(ord), ...contem.sort(ord)];
}

function resultados() {
  if (!S.q.trim()) {
    const ativos = S.dados.animais.filter((a) => a.st === 'ativo' && naFazenda(a));
    const recentes = lerJSON(CH.recentes, []).map((id) => S.idx.porId.get(id)).filter(Boolean);
    const porFaz = S.dados.fazendas.map((f) => `${f.codigo} ${S.dados.animais.filter((a) => a.st === 'ativo' && a.f === f.id).length}`).join(' · ');
    return `<p class="nota"><b>${ativos.length} cabeças</b> ${S.fazenda === 'todas' ? `no rebanho (${esc(porFaz)})` : `na ${esc(S.fazenda)}`}. Digite o número do brinco.</p>
      ${recentes.length ? `<h2 class="h2">Vistos por último</h2><div class="lista">${recentes.map((a) => itemAnimal(a)).join('')}</div>` : ''}
      <h2 class="h2">${I.listas}Listas</h2><div class="grade">${cartoesListas()}</div>`;
  }
  const r = buscar(S.q);
  if (!r.length) return `<p class="vazio">Nenhum animal com “${esc(S.q)}”${S.fazenda !== 'todas' ? ` na ${esc(S.fazenda)}` : ''}.</p>`;
  const mostrar = r.slice(0, 60);
  return `<p class="nota">${r.length === 1 ? '1 animal' : `${r.length} animais`}${r.length > 60 ? ' (mostrando 60)' : ''}</p>
    <div class="lista">${mostrar.map((a) => itemAnimal(a)).join('')}</div>`;
}

function telaAnimal(id) {
  const a = S.idx.porId.get(Number(id));
  if (!a) return `<section class="pagina"><button class="voltar" data-acao="voltar">${I.voltar}Voltar</button><p class="vazio">Esse animal não está na cópia deste celular. Atualize com internet.</p></section>`;
  marcarRecente(a.id);
  if (!dono()) return fichaVaqueiro(a);
  const f = faz(a.f);
  const selos = [];
  selos.push(`<span class="selo s-${esc(a.st)}">${esc(NOME_ST[a.st] || a.st)}</span>`);
  if (a.st === 'ativo' && a.sr) selos.push(seloSR(a.sr));
  const prox = a.st === 'ativo' ? proximaEtapa(a) : null;
  if (prox) selos.push('<span class="selo s-protocolo">Em protocolo</span>');
  const ps = pesos(a);
  const ult = ps[ps.length - 1];
  const nums = [
    ['Idade', idade(a.nasc) || '—', a.nasc ? `nasceu ${dt(a.nasc)}` : 'sem data de nascimento'],
    ['Último peso', ult ? kg(ult.p) : '—', ult ? `em ${dtc(ult.d)}` : 'sem pesagem'],
    ['Próximo manejo', prox ? dtc(prox.data) : '—', prox ? `${NOME_ETAPA[prox.m.etapa] || prox.m.etapa} · ${relativo(prox.data)}` : 'nada previsto'],
  ];
  return `<section class="pagina">
    <button class="voltar" data-acao="voltar">${I.voltar}Voltar</button>
    <div class="ficha-id">
      <div class="ficha-cab">${iconeCat(a.c)}<div><p class="ficha-num${a.n.length > 5 ? ' longo' : ''}">${esc(a.n)}</p><p class="ficha-cat cat-${esc(a.c || 'x')}">${esc(NOME_CAT[a.c] || a.c || 'Animal')}</p></div></div>
      <p class="ficha-sub">${esc([a.s === 'F' ? 'fêmea' : a.s === 'M' ? 'macho' : null, f.nome].filter(Boolean).join(' · '))}${a.b ? ` · brinco ${esc(a.b)}` : ''}</p>
      <div class="selos">${selos.join('')}</div>
    </div>
    ${a.st === 'ativo' && typeof avisoCarencia === 'function' ? avisoCarencia(a) : ''}
    <div class="numeros">${nums.map(([l, v, s]) => `<div class="numero"><p class="numero-l">${esc(l)}</p><p class="numero-v">${esc(v)}</p><p class="numero-s">${esc(s)}</p></div>`).join('')}</div>
    ${a.st === 'ativo' && dono() ? `<div class="chips atalhos">
      <button class="chip" data-ir="#lancar/pesagem/${a.id}">${I.balanca}Pesar</button>
      ${a.s === 'F' && !['bezerra'].includes(a.c) ? `<button class="chip" data-ir="#lancar/nascimento/${a.id}">${I.nasc}Pariu</button>` : ''}
      <button class="chip" data-ir="#lancar/remedio/${a.id}">${I.saude}Remédio</button>
      <button class="chip" data-ir="#lancar/morte/${a.id}">${I.morte}Morte</button>
      <button class="chip" data-ir="#lancar/venda/${a.id}">${I.dinheiro}Vender</button></div>` : ''}
    ${blocoReproducao(a)}
    ${blocoTempo(a)}
    ${blocoFamilia(a)}
    ${blocoCrias(a)}
    ${blocoLoteEPasto(a)}
    ${blocoPeso(a, ps)}
    ${blocoCusto(a)}
    ${a.obs ? `<div class="bloco"><h2 class="h2">Observação</h2><p class="nota">${esc(a.obs)}</p></div>` : ''}
  </section>`;
}

function blocoReproducao(a) {
  if (a.s !== 'F' || ['bezerra'].includes(a.c)) return '';
  const dg = ultimoDG(a);
  const parto = S.idx.partos.get(a.n);
  const prots = protocolosDo(a);
  const linhas = [];
  linhas.push(['Situação', a.sr ? NOME_SR[a.sr] || a.sr : 'não informada']);
  if (dg) {
    const res = dg.dg === 'positivo' ? 'prenha' : dg.dg === 'negativo' ? 'vazia' : dg.dg || '—';
    const det = [dg.mom === 'pre-protocolo' ? 'antes do protocolo' : null, dg.ig ? `${dg.ig} dias de gestação` : null, dg.touro ? `touro ${dg.touro}` : null].filter(Boolean).join(', ');
    linhas.push(['Último diagnóstico', `${dt(dg.d)}: ${res}${det ? ` (${det})` : ''}`]);
  }
  if (parto) {
    linhas.push(['Parto previsto', `${dt(parto.prev)} (${relativo(parto.prev)})`]);
    if (parto.conc) linhas.push(['Concepção', `${dt(parto.conc)}${parto.ref ? ` · ${parto.ref}` : ''}`]);
  }
  const partos = (S.idx.filhos.get(a.id) || []).length;
  if (partos) linhas.push(['Crias no sistema', String(partos)]);
  return `<div class="bloco"><h2 class="h2">${I.repro}Reprodução</h2>
    <dl class="linhas">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${prots.map(blocoProtocolo).join('')}
  </div>`;
}

function blocoProtocolo({ p, passos }) {
  const h = hojeISO();
  const prox = passos.find((x) => x.st === 'previsto' && x.data && x.data >= h);
  const itens = passos.map((x) => {
    const d = diaProt(p, x.data);
    const classe = x.st === 'aplicado' ? 'feita' : x.st === 'falhou' || x.st === 'nao_aplicado' ? 'falhou' : x === prox ? 'proxima' : '';
    const marca = x.st === 'aplicado' ? I.ok : classe === 'falhou' ? I.x : '';
    const prod = x.prod || x.m.prod;
    const sit = x.st === 'aplicado' ? `feito em ${dtc(x.apl || x.data)}` : x.st === 'falhou' ? 'falhou' : x.st === 'nao_aplicado' ? 'não aplicado'
      : `${dtc(x.data)} · ${relativo(x.data)}`;
    return `<li class="etapa ${classe}"><span class="etapa-d">${esc(rotuloDia(d))}</span><span class="etapa-b">${marca}</span>
      <span><p class="etapa-t">${esc(NOME_ETAPA[x.m.etapa] || x.m.etapa)}${prod && prod !== 'IATF' ? ` · ${esc(prod)}` : ''}</p>
      <p class="etapa-s">${esc(sit)}${x.dose || x.m.dose ? ` · ${esc(x.dose || x.m.dose)}` : ''}${x.obs ? ` · ${esc(x.obs)}` : ''}</p></span></li>`;
  }).join('');
  return `<h3 class="h2">${esc(p ? p.nome : 'Protocolo')}</h3>
    ${p && p.d0 ? `<p class="nota">D0 em ${esc(dt(p.d0))}</p>` : ''}
    <ol class="etapas">${itens}</ol>`;
}

function blocoFamilia(a) {
  const mae = a.mae ? S.idx.porId.get(a.mae) : null;
  const filhos = (S.idx.filhos.get(a.id) || []).slice().sort((x, y) => (y.nasc || '').localeCompare(x.nasc || ''));
  const pai = a.pai ? S.idx.porId.get(a.pai) : null;
  if (!mae && !filhos.length && !pai && !a.paie && !['bezerro', 'bezerra'].includes(a.c)) return '';
  const linhas = [];
  linhas.push(`<dt>Mãe</dt><dd>${mae ? `<button class="link" data-ir="#animal/${mae.id}">${esc(mae.n)}</button>` : 'não informada'}</dd>`);
  if (pai || a.paie) linhas.push(`<dt>Pai</dt><dd>${pai ? `<button class="link" data-ir="#animal/${pai.id}">${esc(pai.n)}</button>` : esc(a.paie)}</dd>`);
  return `<div class="bloco"><h2 class="h2">${I.familia}Família</h2>
    <dl class="linhas">${linhas.join('')}</dl>
    ${filhos.length ? `<p class="nota"><b>${filhos.length} ${filhos.length === 1 ? 'cria' : 'crias'}</b></p>
      <div class="lista">${filhos.map((x) => itemAnimal(x, x.nasc ? `${NOME_CAT[x.c] || x.c} · nasceu ${dt(x.nasc)}` : resumo(x))).join('')}</div>` : ''}
  </div>`;
}

function blocoLoteEPasto(a) {
  const ls = lotesDo(a);
  if (!ls.length && !a.lote) return '';
  const linhas = [];
  if (ls.length) {
    for (const l of ls) {
      linhas.push(['Lote', l.nome]);
      const oc = S.idx.pastoDoLote.get(l.id);
      const ids = oc ? [oc.pasto, ...(oc.tambem || [])] : l.pasto ? [l.pasto] : [];
      const nomes = ids.map((id) => (S.idx.pastos.get(id) || {}).nome).filter(Boolean);
      if (nomes.length) linhas.push([nomes.length > 1 ? 'Pastos' : 'Pasto', `${nomes.join(' e ')}${oc ? ` · desde ${dtc(oc.ent)} (${diasEntre(oc.ent, hojeISO())} dias)` : ''}`]);
    }
  } else if (a.lote) linhas.push(['Lote', a.lote]);
  return `<div class="bloco"><h2 class="h2">${I.pasto}Lote e pasto</h2>
    <dl class="linhas">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`;
}

function blocoPeso(a, ps) {
  if (!ps.length) return '';
  const ultimo = ps[ps.length - 1], ant = ps[ps.length - 2];
  const linhas = [['Último', `${kg(ultimo.p)} em ${dt(ultimo.d)} · ${(Number(ultimo.p) / 30).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} @`]];
  const g = ant ? gmd(ant, ultimo) : null;
  if (g !== null) linhas.push(['Ganho', `${g.toLocaleString('pt-BR')} g/dia desde ${dtc(ant.d)} (${kg(ultimo.p - ant.p)} em ${diasEntre(ant.d, ultimo.d)} dias)`]);
  if (ps.length > 2) linhas.push(['Desde a 1ª pesagem', `${kg(ultimo.p - ps[0].p)} em ${diasEntre(ps[0].d, ultimo.d)} dias`]);
  const p2 = linhaP205(a, ps);
  if (p2) linhas.push(p2);
  linhas.push(['Pesagens', String(ps.length)]);
  return `<div class="bloco"><h2 class="h2">${I.peso}Peso</h2>
    ${graficoPesoAnimal(a, ps)}
    <dl class="linhas">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`;
}
const gmd = (ant, e) => { const d = diasEntre(ant.d, e.d); return d > 0 ? Math.round((e.p - ant.p) / d * 1000) : null; };

function blocoCusto(a) {
  if (!dono() || !S.dados.custos) return '';
  const c = S.dados.custos[a.n];
  if (!c) return '';
  const ano = hojeISO().slice(0, 4);
  const partes = [['Reprodutivo', c.rep], ['Sanitário', c.san], ['Nutricional', c.nut], ['Outros', c.out]].filter(([, v]) => Number(v) > 0);
  return `<div class="bloco"><h2 class="h2">${I.dinheiro}Custo em ${esc(ano)}</h2>
    <p class="nota"><b>${esc(brl(c.total))}</b> com este animal até hoje</p>
    ${partes.length ? `<dl class="linhas">${partes.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(brl(v))}</dd>`).join('')}</dl>` : ''}</div>`;
}

// linha do tempo única: tudo o que aconteceu com o animal, do mais novo para o mais velho, e o que vem a seguir
const CAT_IC = { bezerro: 'bezerro', bezerra: 'bezerro', touro: 'touro', boi: 'touro', garrote: 'touro' };
const iconeCat = (c) => `<span class="ficha-ic cat-${esc(c || 'x')}" aria-hidden="true">${I[CAT_IC[c] || 'rebanho']}</span>`;
function itensDoTempo(a) {
  const itens = [];
  const add = (d, tipo, ic, t, s, ir) => { if (d) itens.push({ d, tipo, ic, t, s: s || '', ir }); };
  const evs = S.idx.eventos.get(a.id) || [];
  const nascEv = evs.find((e) => e.t === 'nascimento');
  const gestTxt = (e) => (e && e.gest === 'antes_do_tempo' ? 'parto antes do tempo' : e && e.gest === 'depois_do_previsto' ? 'parto depois do previsto' : null);
  // nascimento do próprio animal
  const nasc = a.nasc || (nascEv && nascEv.d);
  if (nasc) {
    const mae = a.mae ? S.idx.porId.get(a.mae) : null;
    add(nasc, 'nasc', 'nasc', 'Nasceu', [mae ? `mãe ${mae.n}` : null, nascEv && nascEv.aprox ? 'data aproximada' : null, gestTxt(nascEv)].filter(Boolean).join(' · '));
  }
  // pesagens com o ganho desde a anterior
  const ps = pesos(a);
  ps.forEach((e, i) => {
    const g = i ? gmd(ps[i - 1], e) : null;
    add(e.d, 'peso', 'balanca', `Pesagem · ${kg(e.p)}`, g !== null ? `${g > 0 ? '+' : ''}${g.toLocaleString('pt-BR')} g/dia desde ${dtc(ps[i - 1].d)}`
      : `${(Number(e.p) / 30).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} @`);
  });
  // etapas de protocolo e aplicações soltas que foram feitas (ou que falharam)
  const apl = S.idx.aplic.get(a.id) || [];
  const iaFeita = new Set();
  for (const x of apl) {
    if (x.st === 'previsto') continue;
    const prod = x.prod || x.m.prod;
    const nome = `${NOME_ETAPA[x.m.etapa] || x.m.etapa}${prod && prod !== 'IATF' ? ` · ${prod}` : ''}`;
    const falhou = x.st === 'falhou' || x.st === 'nao_aplicado';
    if (x.m.etapa === 'inseminacao' && !falhou) iaFeita.add(x.apl || x.data);
    if (x.m.prot) {
      const p = S.idx.prot.get(x.m.prot);
      const d = diaProt(p, x.data);
      const ia = x.m.etapa === 'inseminacao' && !falhou ? (S.idx.insem.get(a.id) || []).find((i) => i.d === (x.apl || x.data)) : null;
      add(x.apl || x.data, falhou ? 'falhou' : 'prot', falhou ? 'x' : 'repro', nome + (falhou ? ' · não aplicado' : ''),
        [p ? p.nome : null, d !== null ? rotuloDia(d) : null, ia ? `sêmen ${ia.sem}` : null, ia && ia.ins ? `inseminador ${ia.ins}` : null,
          x.dose || x.m.dose, x.obs].filter(Boolean).join(' · '));
    } else {
      add(x.apl || x.data, falhou ? 'falhou' : 'san', falhou ? 'x' : 'saude', nome + (falhou ? ' · não aplicado' : ''), [x.dose || x.m.dose, x.obs].filter(Boolean).join(' · '));
    }
  }
  // eventos (diagnóstico, doença, tratamento, morte, venda…)
  for (const e of evs) {
    if (e.t === 'pesagem' || e.t === 'nascimento') continue;
    if (e.t === 'inseminacao' && iaFeita.has(e.d)) continue;
    if (e.t === 'diagnostico_gestacao') {
      const res = e.dg === 'positivo' ? 'prenha' : e.dg === 'negativo' ? 'vazia' : e.dg || '—';
      add(e.d, 'dg', 'repro', `Diagnóstico de gestação · ${res}`,
        [e.mom === 'pre-protocolo' ? 'antes do protocolo' : null, e.ig ? `${e.ig} dias de gestação` : null, e.touro ? `touro ${e.touro}` : null].filter(Boolean).join(' · '));
    } else if (e.t === 'morte') add(e.d, 'morte', 'morte', 'Morte', e.diag || e.causa || '');
    else if (e.t === 'tratamento' || e.t === 'doenca') add(e.d, 'san', 'saude', `${NOME_EVENTO[e.t]}${e.diag ? ` · ${e.diag}` : ''}`, [e.prod, e.dose].filter(Boolean).join(' · '));
    else add(e.d, 'outro', 'hist', NOME_EVENTO[e.t] || e.t, e.diag || e.prod || '');
  }
  // crias
  for (const f of S.idx.filhos.get(a.id) || []) {
    const ev = (S.idx.eventos.get(f.id) || []).find((e) => e.t === 'nascimento');
    add(f.nasc || (ev && ev.d), 'cria', 'familia', `Pariu ${f.c === 'bezerra' || f.s === 'F' ? 'uma bezerra' : 'um bezerro'}`,
      [f.n, ev && ev.aprox ? 'data aproximada' : null, gestTxt(ev)].filter(Boolean).join(' · '), `#animal/${f.id}`);
  }
  if (typeof pendentesDoAnimal === 'function') itens.push(...pendentesDoAnimal(a));
  itens.sort((x, y) => y.d.localeCompare(x.d) || (x.tipo === 'fila' ? -1 : 0));
  return itens;
}
function itemTempo(x, futuro) {
  const quando = futuro ? `${dt(x.d)} · ${relativo(x.d)}` : dt(x.d);
  const corpo = `<span class="tempo-ic">${I[x.ic] || I.hist}</span><span class="tempo-c"><span class="tempo-d">${esc(quando)}</span>
    <span class="tempo-t">${esc(x.t)}</span>${x.s ? `<span class="tempo-s">${esc(x.s)}</span>` : ''}</span>`;
  return `<li class="t-${esc(x.tipo)}${futuro ? ' futuro' : ''}">${x.ir ? `<button class="tempo-b" data-ir="${esc(x.ir)}">${corpo}${I.seta}</button>` : `<div class="tempo-l">${corpo}</div>`}</li>`;
}
function blocoTempo(a) {
  const itens = itensDoTempo(a);
  const futuros = [];
  if (a.st === 'ativo') {
    const prox = proximaEtapa(a);
    if (prox) {
      const prod = prox.prod || prox.m.prod;
      const pr = prox.m.prot ? S.idx.prot.get(prox.m.prot) : null;
      futuros.push({ d: prox.data, tipo: 'futuro', ic: 'agenda', t: `${NOME_ETAPA[prox.m.etapa] || prox.m.etapa}${prod && prod !== 'IATF' ? ` · ${prod}` : ''}`,
        s: [pr ? pr.nome : null, 'previsto'].filter(Boolean).join(' · ') });
    }
    const parto = S.idx.partos.get(a.n);
    if (parto && parto.prev >= hojeISO()) futuros.push({ d: parto.prev, tipo: 'futuro', ic: 'nasc', t: 'Parto previsto', s: parto.conc ? `concepção ${dtc(parto.conc)}` : '' });
    futuros.sort((x, y) => x.d.localeCompare(y.d));
  }
  if (!itens.length && !futuros.length) return '';
  const N = 12, primeiros = itens.slice(0, N), resto = itens.slice(N);
  return `<div class="bloco"><h2 class="h2">${I.hist}Linha do tempo</h2>
    ${futuros.length ? `<p class="tempo-sep">A seguir</p><ol class="tempo">${futuros.map((x) => itemTempo(x, true)).join('')}</ol><p class="tempo-sep">Já aconteceu</p>` : ''}
    ${primeiros.length ? `<ol class="tempo">${primeiros.map((x) => itemTempo(x)).join('')}</ol>` : '<p class="nota">Nada lançado ainda.</p>'}
    ${resto.length ? `<details class="tempo-mais"><summary>Ver mais ${resto.length}</summary><ol class="tempo">${resto.map((x) => itemTempo(x)).join('')}</ol></details>` : ''}
  </div>`;
}

// ------------------------------------------------------------------ vaqueiro: só consulta (etapa 7, 26/11)
// A cópia dele (app_copia_vaqueiro) não traz R$, painel, histórico nem mapa. Lançar é pelo bot do Telegram.
const DICA_BOT = `<div class="dica"><b>Para lançar, use o bot do Telegram</b><span>Escreva ou mande áudio para o @curral_md3c_bot. Ex.: “a 412 pariu um bezerro macho hoje”.</span></div>`;
function proximosManejos(dias) {
  const h = hojeISO();
  const ate = new Date(Date.parse(h + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10);
  return S.dados.manejos.filter((m) => m.st === 'previsto' && m.prev && m.prev >= h && m.prev <= ate
    && (S.fazenda === 'todas' || faz(m.f).codigo === S.fazenda)).sort((x, y) => x.prev.localeCompare(y.prev) || x.id - y.id);
}
function telaInicioVaqueiro() {
  const prox = proximosManejos(7);
  const contar = (m) => S.dados.aplicacoes.filter((r) => r[0] === m.id && r[2] === 'previsto').length;
  return `<section class="pagina">
    <div class="faixa"><h1>${esc(saudacao())}${S.usuario && S.usuario.nome ? `, ${esc(S.usuario.nome.split(' ')[0])}` : ''}</h1><p>Fazendas MD e 3C</p>
      <button class="busca-faixa" data-ir="#buscar">${I.busca}<span>Buscar animal pelo número</span></button></div>
    ${DICA_BOT}
    <div class="botoes">${[['busca', 'Buscar animal', '#buscar'], ['pasto', 'Mapa e pastos', '#pastos'], ['listas', 'Listas', '#listas'], ['nasc', 'Partos previstos', '#lista/partos'], ['agenda', 'Agenda', '#agenda']]
      .map(([ic, t, h]) => `<button class="botao" data-ir="${h}">${I[ic]}<span>${esc(t)}</span></button>`).join('')}</div>
    <div class="bloco"><div class="bloco-h"><h2 class="h2">${I.agenda}Manejos dos próximos 7 dias</h2></div>
      ${prox.length ? `<div class="lista">${prox.map((m) => { const l = m.lote ? S.idx.lotes.get(m.lote) : null, n = contar(m);
        return `<div class="item item-fixo"><span><span class="item-t">${esc(NOME_ETAPA[m.etapa] || m.etapa)}${m.prod && m.prod !== 'IATF' ? ` · ${esc(m.prod)}` : ''}</span>
          <span class="item-m">${esc([faz(m.f).codigo, l ? `lote ${l.nome}` : null, n ? `${n} animais` : null].filter(Boolean).join(' · '))}</span></span>
          <span class="item-v">${esc(dtc(m.prev))}<small>${esc(relativo(m.prev))}</small></span></div>`; }).join('')}</div>`
        : '<p class="vazio">Nenhum manejo nos próximos 7 dias.</p>'}
      <button class="link" data-ir="#agenda">Ver a agenda completa</button></div>
  </section>`;
}
function telaPastosVaqueiro() {
  const corpo = blocosPastos(true);
  return `<section class="pagina"><button class="voltar" data-ir="#painel">${I.voltar}Início</button>
    <h1 class="h1">Mapa e pastos</h1>${chipsFazenda()}
    ${corpo || '<p class="vazio">Nenhum pasto com mapa nesta fazenda ainda.</p>'}
    <p class="nota">Toque no gado no mapa para ver o lote. Mudança de pasto se avisa pelo bot do Telegram.</p></section>`;
}
// prenhez para o vaqueiro: quando emprenhou e quando vai parir (concepção: IATF, touro ou idade do DG)
function blocoPrenhezVaqueiro(a) {
  const p = S.idx.partos.get(a.n);
  if (!p && a.sr !== 'prenha') return '';
  const linhas = [];
  if (p) {
    linhas.push(['Situação', p.sit === 'prenha' ? 'prenha (confirmada no DG)' : 'aguardando diagnóstico']);
    if (p.conc) linhas.push(['Emprenhou em', dt(p.conc)]);
    if (p.prev) linhas.push(['Parto previsto', `${dt(p.prev)} · ${relativo(p.prev)}`]);
  } else linhas.push(['Situação', 'prenha']);
  if (a.dg) linhas.push(['Diagnóstico (DG)', dt(a.dg)]);
  return `<div class="bloco"><h2 class="h2">${I.repro}Prenhez</h2>
    <dl class="linhas">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${!p ? '<p class="nota">Ainda não tem a data em que emprenhou, então não dá para prever o parto.</p>' : ''}</div>`;
}
function fichaVaqueiro(a) {
  const f = faz(a.f);
  const prox = proximaEtapa(a);
  const selos = [];
  if (a.sr) selos.push(seloSR(a.sr));
  if (prox) selos.push('<span class="selo s-protocolo">Em protocolo</span>');
  const ls = lotesDo(a);
  const nums = [
    ['Lote', ls.length ? ls.map((l) => l.nome).join(', ') : a.lote || '—', ''],
    ['Próximo manejo', prox ? dtc(prox.data) : '—', prox ? `${NOME_ETAPA[prox.m.etapa] || prox.m.etapa} · ${relativo(prox.data)}` : 'nada previsto'],
  ];
  const prots = protocolosDo(a);
  const parto = S.idx.partos.get(a.n);
  if (parto && parto.prev) nums.push(['Parto previsto', dtc(parto.prev), relativo(parto.prev)]);
  return `<section class="pagina">
    <button class="voltar" data-acao="voltar">${I.voltar}Voltar</button>
    <div class="ficha-id">
      <div class="ficha-cab">${iconeCat(a.c)}<div><p class="ficha-num${a.n.length > 5 ? ' longo' : ''}">${esc(a.n)}</p><p class="ficha-cat cat-${esc(a.c || 'x')}">${esc(NOME_CAT[a.c] || a.c || 'Animal')}</p></div></div>
      <p class="ficha-sub">${esc([a.s === 'F' ? 'fêmea' : a.s === 'M' ? 'macho' : null, f.nome].filter(Boolean).join(' · '))}${a.b ? ` · brinco ${esc(a.b)}` : ''}</p>
      ${selos.length ? `<div class="selos">${selos.join('')}</div>` : ''}
    </div>
    <div class="numeros">${nums.map(([l, v, s]) => `<div class="numero"><p class="numero-l">${esc(l)}</p><p class="numero-v">${esc(v)}</p>${s ? `<p class="numero-s">${esc(s)}</p>` : ''}</div>`).join('')}</div>
    ${blocoPrenhezVaqueiro(a)}
    ${prots.length ? `<div class="bloco"><h2 class="h2">${I.repro}A seguir no protocolo</h2>${prots.map(blocoProtocolo).join('')}</div>` : ''}
    ${blocoLoteEPasto(a)}
    ${blocoFamilia(a)}
    ${DICA_BOT}
  </section>`;
}

// listas prontas
const LISTAS = {
  todos: { t: 'Rebanho inteiro', cor: 'var(--acento)', f: () => true },
  prenhas: { t: 'Prenhas', cor: 'var(--c1)', f: (a) => a.sr === 'prenha', x: (a) => { const d = ultimoDG(a); return d ? `${resumo(a)} · DG ${dtc(d.d)}` : resumo(a); } },
  vazias: { t: 'Vazias', cor: 'var(--c5)', f: (a) => a.sr === 'vazia' },
  paridas: { t: 'Paridas', cor: 'var(--c6)', f: (a) => a.sr === 'parida' },
  solteiras: { t: 'Solteiras', cor: 'var(--c7)', f: (a) => a.sr === 'solteira' },
  protocolo: { t: 'Em protocolo', cor: 'var(--c3)', f: (a) => !!proximaEtapa(a),
    x: (a) => { const p = proximaEtapa(a); return `${NOME_ETAPA[p.m.etapa] || p.m.etapa} · ${dtc(p.data)} (${relativo(p.data)})`; } },
  partos: { t: 'Partos previstos', cor: 'var(--c2)', f: (a) => S.idx.partos.has(a.n),
    x: (a) => { const p = S.idx.partos.get(a.n); return `Parto ${dt(p.prev)} · ${relativo(p.prev)}`; },
    o: (a, b) => S.idx.partos.get(a.n).prev.localeCompare(S.idx.partos.get(b.n).prev) },
  bezerros: { t: 'Bezerros e bezerras', cor: 'var(--c4)', f: (a) => a.c === 'bezerro' || a.c === 'bezerra',
    x: (a) => { const m = a.mae ? S.idx.porId.get(a.mae) : null; return `${NOME_CAT[a.c]} · nasceu ${dt(a.nasc)}${m ? ` · mãe ${m.n}` : ''}`; },
    o: (a, b) => (b.nasc || '').localeCompare(a.nasc || '') },
  sairam: { t: 'Mortos e vendidos', cor: 'var(--ruim)', todos: true, f: (a) => a.st !== 'ativo' },
};

function animaisDaLista(id) {
  const L = LISTAS[id];
  const r = S.dados.animais.filter((a) => (L.todos || a.st === 'ativo') && naFazenda(a) && L.f(a));
  r.sort(L.o || ((a, b) => a.n.localeCompare(b.n, 'pt-BR', { numeric: true })));
  return r;
}

const LISTAS_VAQUEIRO = ['todos', 'protocolo', 'prenhas', 'partos', 'vazias', 'paridas', 'solteiras', 'bezerros'];
function cartoesListas() {
  return Object.entries(LISTAS).filter(([id]) => dono() || LISTAS_VAQUEIRO.includes(id)).map(([id, L]) => {
    const n = animaisDaLista(id).length;
    return `<button class="cartao" data-ir="#lista/${id}" data-cor="${esc(id)}"><span class="cartao-v">${n}</span><span class="cartao-l">${esc(L.t)}</span></button>`;
  }).join('');
}
function pintarCartoes(raiz = document) {
  for (const c of raiz.querySelectorAll('.cartao[data-cor]')) c.style.setProperty('--cor', LISTAS[c.dataset.cor].cor);
}
function telaListas() {
  return `<section class="pagina"><h1 class="h1">Listas</h1>${chipsFazenda()}<div class="grade">${cartoesListas()}</div></section>`;
}

const LANCAR = [['balanca', 'Pesagem'], ['pasto', 'Mudar de pasto'], ['nasc', 'Nascimento'], ['saude', 'Vacina ou remédio'],
  ['morte', 'Morte'], ['curral', 'Sessão no curral'], ['chuva', 'Chuva'], ['peso', 'Salga de cocho'], ['repro', 'Protocolo IATF']];
const botoesBreve = (lista) => `<div class="botoes">${lista.map(([ic, t]) => `<div class="botao breve">${I[ic]}<span>${esc(t)}</span><small>em breve</small></div>`).join('')}</div>`;
function abrirJanela(html, textoFechar = 'Fechar') {
  $('.fundo')?.remove();
  const el = document.createElement('div');
  el.className = 'fundo';
  el.innerHTML = `<div class="janela" role="dialog" aria-modal="true">${html}<button class="btn sec" data-acao="fechar">${textoFechar}</button></div>`;
  document.body.appendChild(el);
  return el;
}
function janelaLancar() {
  abrirJanela(`<h2>Manejo</h2>${botoesBreve(LANCAR)}
    <p>Por enquanto, lance pelo bot do Telegram ou pela conversa com o Claude. Lançar pelo app, mesmo sem sinal, é a próxima etapa.</p>`);
}
function avisos() {
  const l = [];
  const r = S.dados && S.dados.painel && S.dados.painel.resumo && S.dados.painel.resumo[0];
  if (r && Number(r.pendencias) > 0) l.push({ t: `${r.pendencias} recado(s) do bot esperando conferência`, s: 'Peça ao Claude: “confere as pendências do bot”.' });
  if (S.dados) {
    const h = hojeISO(), am = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    for (const m of S.dados.manejos.filter((x) => x.st === 'previsto' && (x.prev === h || x.prev === am))) {
      l.push({ t: `${NOME_ETAPA[m.etapa] || m.etapa}${m.prod && m.prod !== 'IATF' ? ` · ${m.prod}` : ''}`, s: `${faz(m.f).codigo} · ${dtc(m.prev)} (${relativo(m.prev)})` });
    }
  }
  return l.concat(typeof avisosSanidade === 'function' ? avisosSanidade() : []);
}
const nAvisos = () => avisos().length;
function janelaAvisos() {
  const l = avisos();
  abrirJanela(`<h2>Avisos</h2>${l.length ? `<div class="lista">${l.map((x) => (x.ir ? `<button class="item" data-ir="${esc(x.ir)}" data-acao="fechar"><span><span class="item-t">${esc(x.t)}</span><span class="item-m">${esc(x.s)}</span></span>${I.seta}</button>`
      : `<div class="item item-fixo"><span><span class="item-t">${esc(x.t)}</span><span class="item-m">${esc(x.s)}</span></span></div>`)).join('')}</div>`
    : '<p class="vazio">Nenhum aviso agora.</p>'}`);
}

// filtros em chips (categoria, situação, lote, pasto) dentro de cada lista
const PLURAL_CAT = { matriz: 'Vacas', novilha: 'Novilhas', bezerra: 'Bezerras', bezerro: 'Bezerros', touro: 'Touros', boi: 'Bois', garrote: 'Garrotes', descarte: 'Descarte' };
const PLURAL_SR = { prenha: 'Prenhas', vazia: 'Vazias', parida: 'Paridas', solteira: 'Solteiras' };
const FILTRO_VAZIO = () => ({ cat: '', sr: '', lote: '', pasto: '' });
S.filtro = FILTRO_VAZIO(); S.filtroDe = '';
function pastosDoAnimal(a) {
  const ids = [];
  for (const l of a.lotes || []) {
    const oc = S.idx.pastoDoLote.get(l);
    if (oc) ids.push(oc.pasto, ...(oc.tambem || []));
    else { const lo = S.idx.lotes.get(l); if (lo && lo.pasto) ids.push(lo.pasto); }
  }
  return ids;
}
const nomePasto = (id) => { const p = S.idx.pastos.get(id); return p ? (p.apelido ? `${p.nome} · ${p.apelido}` : p.nome) : `pasto ${id}`; };
const FILTROS = {
  cat: { t: 'Categoria', de: (a) => [a.c], nome: (v) => PLURAL_CAT[v] || v },
  sr: { t: 'Situação', de: (a) => (a.sr ? [a.sr] : []), nome: (v) => PLURAL_SR[v] || v },
  lote: { t: 'Lote', de: (a) => ((a.lotes || []).length ? a.lotes.map(String) : ['sem']), nome: (v) => (v === 'sem' ? 'Sem lote' : (S.idx.lotes.get(Number(v)) || {}).nome || `lote ${v}`) },
  pasto: { t: 'Pasto', de: (a) => { const ps = pastosDoAnimal(a); return ps.length ? ps.map(String) : ['sem']; }, nome: (v) => (v === 'sem' ? 'Sem pasto' : nomePasto(Number(v))) },
};
const passaFiltros = (a, menos) => Object.entries(S.filtro).every(([k, v]) => !v || k === menos || FILTROS[k].de(a).includes(v));
function chipsFiltros(base) {
  return Object.entries(FILTROS).map(([k, F]) => {
    // opções que existem nesta lista (contando com os outros filtros já escolhidos)
    const cont = new Map();
    for (const a of base) if (passaFiltros(a, k)) for (const v of new Set(F.de(a))) cont.set(v, (cont.get(v) || 0) + 1);
    if (cont.size < 2 && !S.filtro[k]) return '';
    const ops = [...cont.entries()].sort((x, y) => y[1] - x[1] || F.nome(x[0]).localeCompare(F.nome(y[0]), 'pt-BR', { numeric: true }));
    return `<div class="chips filtro" role="group" aria-label="${esc(F.t)}"><span class="chips-t">${esc(F.t)}</span>
      <button class="chip" data-acao="filtro" data-tipo="${k}" data-valor="" aria-pressed="${!S.filtro[k]}">${k === 'cat' || k === 'sr' ? 'Todas' : 'Todos'}</button>
      ${ops.map(([v, n]) => `<button class="chip" data-acao="filtro" data-tipo="${k}" data-valor="${esc(v)}" aria-pressed="${S.filtro[k] === v}">${esc(F.nome(v))} <small>${n}</small></button>`).join('')}</div>`;
  }).join('');
}
function telaLista(id) {
  const L = LISTAS[id];
  if (!L) return telaListas();
  if (S.filtroDe !== id) { S.filtro = FILTRO_VAZIO(); S.filtroDe = id; }
  const base = animaisDaLista(id);
  const r = base.filter((a) => passaFiltros(a));
  const filtrando = Object.values(S.filtro).some(Boolean);
  return `<section class="pagina"><button class="voltar" data-ir="#listas">${I.voltar}Listas</button>
    <h1 class="h1">${esc(L.t)}</h1>${chipsFazenda()}${chipsFiltros(base)}
    ${r.length ? `<p class="nota">${filtrando ? `${r.length} de ${base.length} animais` : r.length === 1 ? '1 animal' : `${r.length} animais`}${filtrando ? ' · <button class="link" data-acao="limpar-filtros">limpar filtros</button>' : ''}</p>
      <div class="lista">${r.map((a) => itemAnimal(a, L.x ? L.x(a) : resumo(a))).join('')}</div>`
      : `<p class="vazio">Nenhum animal nesta lista${filtrando ? ' com esses filtros' : ''}.</p>${filtrando ? '<button class="btn sec" data-acao="limpar-filtros">Limpar filtros</button>' : ''}`}</section>`;
}

function telaAgenda() {
  const h = hojeISO();
  const previstos = S.dados.manejos.filter((m) => m.st === 'previsto' && m.prev && m.prev >= h && (S.fazenda === 'todas' || faz(m.f).codigo === S.fazenda));
  const porDia = new Map();
  for (const m of previstos) empurrar(porDia, m.prev, m);
  const dias = [...porDia.keys()].sort();
  const contar = (m) => S.dados.aplicacoes.filter((r) => r[0] === m.id && r[2] === 'previsto').length;
  const corpo = dias.map((d) => {
    const itens = porDia.get(d).map((m) => {
      const p = m.prot ? S.idx.prot.get(m.prot) : null;
      const l = m.lote ? S.idx.lotes.get(m.lote) : null;
      const n = contar(m);
      const dd = diaProt(p, d);
      return `<div class="agenda-i"><b>${esc(NOME_ETAPA[m.etapa] || m.etapa)}${m.prod && m.prod !== 'IATF' ? ` · ${esc(m.prod)}` : ''}</b>
        <span>${esc([faz(m.f).codigo, p ? p.nome : null, l ? `lote ${l.nome}` : null, dd !== null ? rotuloDia(dd) : null, n ? `${n} animais` : null].filter(Boolean).join(' · '))}</span></div>`;
    }).join('');
    return `<div class="agenda-dia"><p class="agenda-t">${esc(dt(d))} · ${esc(relativo(d))}</p>${itens}</div>`;
  }).join('');
  return `<section class="pagina"><h1 class="h1">Agenda de manejos</h1>${chipsFazenda()}
    ${dias.length ? corpo : '<p class="vazio">Nenhum manejo previsto daqui para frente.</p>'}</section>`;
}

function telaMais() {
  const u = S.usuario || {};
  const tam = (ler(CH.copia) || '').length;
  return `<section class="pagina"><h1 class="h1">${esc(u.nome || 'Você')}</h1>
    <div class="bloco"><dl class="linhas">
      <dt>Acesso</dt><dd>${esc(u.papel === 'dono' ? 'dono (vê custos)' : `${u.papel || 'equipe'} (só consulta)`)}</dd>
      <dt>Cópia no celular</dt><dd>${esc(horaDe(S.quando) || '—')}</dd>
      <dt>Animais na cópia</dt><dd>${S.dados ? S.dados.animais.length : 0}</dd>
      <dt>Espaço usado</dt><dd>${(tam / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB</dd>
      <dt>Instalado na tela de início</dt><dd>${instalado() ? 'sim' : 'não'}</dd>
    </dl></div>
    ${instalado() ? '' : `<div class="dica"><b>Para funcionar sem internet</b><span>No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. Depois abra pelo ícone e entre de novo com um código.</span></div>`}
    ${dono() ? `<button class="btn sec" data-ir="#relatorio">${I.pdf}Relatórios em PDF</button>` : ''}
    <button class="btn sec" data-acao="atualizar">Atualizar agora</button>
    <button class="btn perigo" data-acao="pedir-sair">Sair deste celular</button>
    <p class="nota">Sem internet, o app mostra a última cópia. Assim que pegar sinal, ele atualiza sozinho.</p>
    <p class="versao">Curral Digital · versão ${esc(VERSAO_APP)}</p>
  </section>`;
}

function janelaSair() {
  const el = document.createElement('div');
  el.className = 'fundo';
  el.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-labelledby="js-t">
    <h2 id="js-t">Sair deste celular?</h2>
    <p>A cópia do rebanho é apagada deste aparelho e a chave dele é bloqueada. Para entrar de novo, peça um código ao bot com /app.</p>
    ${nFila() ? `<p class="aviso-t"><b>Atenção: ${nFila()} lançamento(s) ainda não foram para o sistema.</b> Eles ficam guardados neste celular e vão quando você entrar de novo, com internet.</p>` : ''}
    <button class="btn perigo" data-acao="sair">Sim, sair</button>
    <button class="btn sec" data-acao="fechar">Cancelar</button></div>`;
  document.body.appendChild(el);
}

// ------------------------------------------------------------------ desenho e navegação
function rota() {
  const h = location.hash.replace(/^#/, '');
  const [nome, arg] = h.split('/');
  return { nome: nome || 'painel', arg };
}

function desenharTopo() {
  const t = $('.topo');
  if (t) t.outerHTML = topo();
}

function desenhar(mensagem) {
  const app = $('#app');
  if (!ler(CH.chave)) { app.innerHTML = telaEntrar(mensagem); return; }
  if (!S.dados) {
    app.innerHTML = `${topo()}<section class="pagina"><p class="vazio">${S.buscando ? 'Baixando a cópia do rebanho…'
      : 'Ainda não há cópia neste celular. Conecte na internet e toque em atualizar.'}</p></section>`;
    return;
  }
  const r = rota();
  if (!dono() && ['painel', 'lancar', 'relatorio'].includes(r.nome)) r.arg = null, r.nome = 'inicio';
  const telas = { inicio: telaInicioVaqueiro, pastos: telaPastosVaqueiro, painel: () => telaPainel(r.arg), mapa: () => telaMapa(r.arg), buscar: telaBuscar, listas: telaListas, lista: () => telaLista(r.arg), agenda: telaAgenda, animal: () => telaAnimal(r.arg), mais: telaMais, lancar: () => telaLancar(r.arg), relatorio: telaRelatorio };
  let abaGuardada = null;
  try { abaGuardada = sessionStorage.getItem('cd.aba'); } catch { /* nada */ }
  const aba = r.nome === 'animal' || r.nome === 'relatorio' ? (abaGuardada || (r.nome === 'animal' ? 'buscar' : 'mais')) : r.nome === 'lista' || r.nome === 'listas' ? 'buscar' : r.nome === 'mapa' || r.nome === 'inicio' || r.nome === 'pastos' ? 'painel' : telas[r.nome] ? r.nome : 'painel';
  if (r.nome !== 'animal' && r.nome !== 'relatorio') { try { sessionStorage.setItem('cd.aba', aba); } catch { /* nada */ } }
  app.innerHTML = topo() + (telas[r.nome] || telas.painel)() + abas(aba);
  pintarCartoes(app); pintarBarras(app);
  const secAtual = app.querySelector('.secoes [aria-pressed="true"]');
  if (secAtual) secAtual.parentElement.scrollLeft = Math.max(0, secAtual.offsetLeft - 16);
  if (r.nome !== 'buscar') window.scrollTo(0, 0);
}

function marcarRecente(id) {
  const l = lerJSON(CH.recentes, []).filter((x) => x !== id);
  l.unshift(id);
  gravar(CH.recentes, JSON.stringify(l.slice(0, 8)));
}

let tempoAviso;
function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => { el.hidden = true; }, 3200);
}

async function fazerEntrar() {
  const campo = $('#codigo');
  const erro = $('#erro');
  const btn = $('#btn-entrar');
  const codigo = (campo.value || '').replace(/\D/g, '');
  const mostrar = (m) => { erro.textContent = m; erro.hidden = false; };
  if (codigo.length !== 6) return mostrar('O código tem 6 números.');
  btn.disabled = true; btn.textContent = 'Entrando…'; erro.hidden = true;
  try {
    const aparelho = `${/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'navegador'}${instalado() ? ' (app)' : ''}`;
    const { j } = await pedir({ acao: 'entrar', codigo, aparelho });
    if (!j.ok) {
      const m = { codigo_invalido: 'Código errado ou vencido. Mande /app de novo para o bot e use o código novo.',
        muitas_tentativas: 'Muitas tentativas erradas. Espere 15 minutos e peça um código novo.',
        usuario_inativo: 'Seu cadastro está desativado. Fale com o dono da fazenda.' }[j.motivo] || 'Não consegui entrar agora. Tente de novo.';
      return mostrar(m);
    }
    gravar(CH.chave, j.chave);
    S.usuario = { nome: j.nome, papel: j.papel };
    gravar(CH.usuario, JSON.stringify(S.usuario));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    location.hash = '#painel';
    S.buscando = false;
    desenhar();
    await atualizar();
  } catch (e) {
    mostrar('Sem internet agora. Para entrar pela primeira vez, precisa de sinal.');
  } finally {
    if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}

async function fazerSair() {
  const chave = ler(CH.chave);
  $('.fundo')?.remove();
  try { if (chave) await pedir({ acao: 'sair' }, chave); } catch { /* sem internet: a chave fica só neste celular, que é apagado */ }
  sairDoAparelho('Você saiu deste celular.');
}

document.addEventListener('click', (ev) => {
  const pino = ev.target.closest('.pino[data-ocup]');
  if (pino) { janelaLote(Number(pino.dataset.ocup)); return; }
  const ir = ev.target.closest('[data-ir]');
  if (ir) { ev.preventDefault(); location.hash = ir.dataset.ir; return; }
  const b = ev.target.closest('[data-acao]');
  if (!b) return;
  const acao = b.dataset.acao;
  if (acao === 'entrar') fazerEntrar();
  else if (acao === 'atualizar') atualizar(true);
  else if (acao === 'voltar') { if (history.length > 1) history.back(); else location.hash = '#painel'; }
  else if (acao === 'fazenda') {
    S.fazenda = b.dataset.valor; gravar(CH.fazenda, S.fazenda);
    if (rota().nome === 'buscar') {
      for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c.dataset.valor === S.fazenda));
      $('#resultados').innerHTML = resultados(); pintarCartoes();
    } else desenhar();
  } else if (acao === 'filtro') {
    const k = b.dataset.tipo, v = b.dataset.valor;
    S.filtro[k] = S.filtro[k] === v ? '' : v;
    const y = window.scrollY; desenhar(); window.scrollTo(0, y);
  } else if (acao === 'limpar-filtros') {
    S.filtro = FILTRO_VAZIO(); desenhar();
  } else if (acao === 'teclado') {
    S.teclado = S.teclado === 'numeric' ? 'text' : 'numeric';
    const q = $('#q'); q.setAttribute('inputmode', S.teclado); b.textContent = S.teclado === 'numeric' ? 'ABC' : '123';
    q.blur(); setTimeout(() => q.focus(), 30);
  } else if (acao === 'zoom') {
    const svg = $('#mapa-caixa svg'), caixa = $('#mapa-caixa');
    if (svg && caixa) {
      const atual = Number(svg.dataset.zoom || 1);
      const novo = Math.max(1, Math.min(4, atual + Number(b.dataset.valor)));
      const cx = (caixa.scrollLeft + caixa.clientWidth / 2) / caixa.scrollWidth, cy = (caixa.scrollTop + caixa.clientHeight / 2) / caixa.scrollHeight;
      if (novo === atual) return;
      caixa.innerHTML = mapaFazenda(Number(caixa.dataset.f), true, novo);
      caixa.scrollLeft = cx * caixa.scrollWidth - caixa.clientWidth / 2; caixa.scrollTop = cy * caixa.scrollHeight - caixa.clientHeight / 2;
    }
  } else if (acao === 'pedir-sair') janelaSair();
  else if (acao === 'sair') fazerSair();
  else if (acao === 'fechar') $('.fundo')?.remove();
  else if (acao === 'lancar') janelaLancar();
  else if (acao === 'avisos') janelaAvisos();
  else if (acao === 'lote-aba') {
    for (const x of document.querySelectorAll('.abas-lote button')) x.setAttribute('aria-pressed', String(x === b));
    $('#lote-resumo').hidden = b.dataset.valor !== 'resumo'; $('#lote-cats').hidden = b.dataset.valor !== 'cats';
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'q') { S.q = ev.target.value; $('#resultados').innerHTML = resultados(); pintarCartoes(); }
  if (ev.target.id === 'codigo') {
    ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 6);
    if (ev.target.value.length === 6) fazerEntrar();
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'q') {
    const r = buscar(S.q);
    if (r.length === 1) location.hash = `#animal/${r[0].id}`; else ev.target.blur();
  }
  if (ev.target.id === 'codigo') fazerEntrar();
});

window.addEventListener('hashchange', () => { $('.fundo')?.remove(); desenhar(); });
window.addEventListener('online', () => { S.online = true; desenharTopo(); if (precisaAtualizar()) atualizar(); });
window.addEventListener('offline', () => { S.online = false; desenharTopo(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (precisaAtualizar()) atualizar();
  // ao voltar para o app, confere se há versão nova das telas
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
});

// ------------------------------------------------------------------ início
(function iniciar() {
  const guardada = lerJSON(CH.copia, null);
  if (guardada) carregar(guardada, S.usuario, S.quando);
  desenhar();
  if (ler(CH.chave)) atualizar();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // versão nova chegou: recarrega sozinho (o que estava sendo lançado fica no rascunho e na fila do celular)
      if (S.tinhaControlador && !S.recarregando) { S.recarregando = true; location.reload(); return; }
      S.tinhaControlador = true;
    });
  }
})();
