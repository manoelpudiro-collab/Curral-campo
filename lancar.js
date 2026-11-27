// Curral Digital — lançar pelo app, mesmo sem internet (etapas 2A e 2B do plano do app).
// 2A: pesagem, mudança de pasto, nascimento, morte, chuva. 2B: vacina/remédio, salga de cocho e modo Curral (em curral.js).
// O que é confirmado vai para uma fila guardada no celular e segue para o sistema quando houver sinal.
// Cada lançamento leva um número próprio (uid): se o envio cair no meio e for repetido, o sistema grava uma vez só.
// O rascunho de cada tela também fica guardado: se o celular fechar o app no meio da pesagem, nada se perde.
'use strict';

const CHL = { fila: 'cd.fila', enviados: 'cd.enviados', rascunho: 'cd.rascunho' };
const TIPOS_L = {
  pesagem: { t: 'Pesagem', ic: 'balanca' },
  pasto: { t: 'Mudar de pasto', ic: 'pasto' },
  nascimento: { t: 'Nascimento', ic: 'nasc' },
  morte: { t: 'Morte', ic: 'morte' },
  chuva: { t: 'Chuva', ic: 'chuva' },
  remedio: { t: 'Vacina ou remédio', ic: 'saude' },
  salga: { t: 'Salga de cocho', ic: 'peso' },
  curral: { t: 'Modo Curral', ic: 'curral' },
  dg: { t: 'Diagnóstico de gestação', ic: 'repro' },
};
const BREVE_L = [];
const CAT_REMEDIO = ['vacina', 'vermifugo', 'carrapaticida', 'antibiotico', 'anti_inflamatorio', 'vitamina', 'outro'];
const CAT_SAL = ['sal_mineral', 'suplemento', 'racao'];
const MOTIVOS = ['Vacinação', 'Vermifugação', 'Carrapato e mosca', 'Tratamento (doente)', 'Bicheira'];
const UN = { ml: 'mL', dose: 'dose', unidade: 'un.', kg: 'kg', saco: 'saco', litro: 'L' };
const produtos = (cats) => (S.dados.produtos || []).filter((p) => cats.includes(p.cat));
const prodPorId = (id) => (S.dados.produtos || []).find((p) => p.id === id) || null;
const doseNum = (p) => { const m = String((p && p.dose) || '').match(/\d+(?:[.,]\d+)?/); return m ? m[0] : ''; };
const animaisDoLote = (id) => S.dados.animais.filter((a) => a.st === 'ativo' && (a.lotes || []).includes(id));
function somarDias(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const CAUSAS = ['Picada de cobra', 'Tristeza parasitária', 'Bicheira', 'Problema no parto', 'Raio', 'Não sei'];

// ------------------------------------------------------------------ fila no celular
const fila = () => lerJSON(CHL.fila, []);
const guardarFila = (l) => gravar(CHL.fila, JSON.stringify(l));
const enviados = () => lerJSON(CHL.enviados, []);
const guardarEnviados = (l) => gravar(CHL.enviados, JSON.stringify(l.slice(0, 40)));
const nFila = () => fila().length;
function novoUid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let enviandoFila = false;
async function enviarFila(manual = false) {
  const chave = ler(CH.chave);
  const l = fila();
  if (enviandoFila || !chave || !l.length) return;
  enviandoFila = true;
  desenharTopo();
  let gravou = 0, recusou = 0;
  try {
    const { status, j } = await pedir({ acao: 'lancar', lancamentos: l.slice(0, 50).map((x) => x.dados) }, chave);
    if (status === 401) throw new Error('sem_acesso');   // a fila fica guardada; vai quando entrar de novo
    if (!j.ok || !Array.isArray(j.resultados)) throw new Error(j.motivo || 'erro');
    S.online = true;
    const porUid = new Map(j.resultados.filter((r) => r && r.uid).map((r) => [r.uid, r]));
    const resto = [], env = enviados();
    for (const x of l) {
      const r = porUid.get(x.uid);
      if (!r || r.erro) { resto.push(x); continue; }   // não chegou ou erro do sistema: tenta de novo depois
      env.unshift({ uid: x.uid, tipo: x.tipo, resumo: x.resumo, ok: !!r.ok, texto: r.texto || '', feito: x.feito, enviado: new Date().toISOString(),
        ...(!r.ok && x.rasc ? { rasc: x.rasc } : {}) });   // recusado: guarda o que foi digitado para corrigir e mandar de novo
      if (r.ok) gravou++; else recusou++;
    }
    guardarFila(resto); guardarEnviados(env);
    if (recusou) avisar(`${recusou} lançamento(s) recusado(s). Veja em Manejo.`);
    else if (gravou) avisar(gravou === 1 ? '✅ Lançamento gravado no sistema.' : `✅ ${gravou} lançamentos gravados no sistema.`);
  } catch (e) {
    if (manual) avisar('Sem sinal agora. Os lançamentos continuam guardados e vão sozinhos quando pegar internet.');
  } finally {
    enviandoFila = false;
  }
  if (gravou) await atualizar();           // traz a cópia nova (com o que acabou de ser gravado)
  else if (!digitando()) desenhar(); else desenharTopo();
}
setInterval(() => { if (nFila() && navigator.onLine) enviarFila(); }, 60000);

function confirmarLancamento(tipo, dados, resumo) {
  const uid = novoUid(), feito = new Date().toISOString();
  const l = fila();
  const r = rasc(tipo);
  delete r.revisar;
  l.push({ uid, tipo, resumo, feito, dados: { uid, tipo, feito, ...dados }, rasc: r });
  guardarFila(l);
  limparRascunho(tipo);
  location.hash = '#lancar';
  avisar(navigator.onLine ? 'Guardado. Enviando para o sistema…' : 'Guardado no celular. Vai para o sistema quando pegar sinal.');
  enviarFila();
}

async function desfazerEnviado(uid) {
  const chave = ler(CH.chave);
  $('.fundo')?.remove();
  if (!chave) return;
  try {
    const { j } = await pedir({ acao: 'desfazer', uid }, chave);
    const r = j.resultado || {};
    const env = enviados();
    const x = env.find((e) => e.uid === uid);
    if (x && (r.ok || /já tinha sido desfeito/.test(r.texto || ''))) { x.desfeito = new Date().toISOString(); guardarEnviados(env); }
    avisar(r.texto || 'Não consegui desfazer agora.');
    if (r.ok) await atualizar(); else desenhar();
  } catch {
    avisar('Para desfazer precisa de internet. Tente de novo quando pegar sinal.');
  }
}

// ------------------------------------------------------------------ rascunho de cada tela
const rascunhos = () => lerJSON(CHL.rascunho, {});
function rasc(tipo) {
  const r = rascunhos()[tipo] || {};
  if (!r.data) r.data = hojeISO();
  return r;
}
function guardarRasc(tipo, r) { const t = rascunhos(); t[tipo] = r; gravar(CHL.rascunho, JSON.stringify(t)); }
function limparRascunho(tipo) { const t = rascunhos(); delete t[tipo]; gravar(CHL.rascunho, JSON.stringify(t)); }
const digitando = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest('.form-lancar')); };

// acha o animal pelo número (só os que estão no rebanho)
function acharAnimal(q, filtro) {
  const k = chaveNum(q), kz = semZeros(k);
  if (!k) return null;
  const vivos = S.dados.animais.filter((a) => a.st === 'ativo' && (!filtro || filtro(a)));
  return vivos.find((a) => a._kz === kz) || vivos.find((a) => a._k === k) || vivos.find((a) => a._b && a._b === kz) || null;
}
const ontemISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }).format(new Date(Date.now() - 864e5));
const numBR = (v, casas = 1) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });
const lerNum = (t) => { const v = Number(String(t ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };

// ------------------------------------------------------------------ telas
function telaManejo() {
  const f = fila(), env = enviados();
  const pode = dono();
  const botoes = Object.entries(TIPOS_L).map(([k, T]) => pode
    ? `<button class="botao" data-ir="#lancar/${k}">${I[T.ic]}<span>${esc(T.t)}</span></button>`
    : `<div class="botao breve">${I[T.ic]}<span>${esc(T.t)}</span></div>`).join('')
    + BREVE_L.map(([ic, t]) => `<div class="botao breve">${I[ic]}<span>${esc(t)}</span><small>em breve</small></div>`).join('');
  const quando = (iso) => horaDe(iso) || '';
  return `<section class="pagina">
    <h1 class="h1">Manejo</h1>
    ${pode ? '<p class="nota">Funciona sem internet: o que você confirmar fica guardado no celular e vai sozinho para o sistema quando pegar sinal.</p>'
      : '<div class="dica"><b>Por enquanto só o dono lança pelo app.</b><span>Vaqueiro lança pelo bot do Telegram.</span></div>'}
    <div class="botoes">${botoes}</div>
    ${f.length ? `<div class="bloco"><div class="bloco-h"><h2 class="h2">${I.atualizar}Esperando envio (${f.length})</h2>
        <button class="link" data-acao="l-enviar">enviar agora</button></div>
      <div class="lista">${f.map((x) => `<div class="item item-fixo"><span><span class="item-t">${esc(x.resumo)}</span>
        <span class="item-m">lançado ${esc(quando(x.feito))}${enviandoFila ? ' · enviando…' : ''}</span></span>
        <button class="link perigo-t" data-acao="l-cancelar" data-uid="${esc(x.uid)}">cancelar</button></div>`).join('')}</div></div>` : ''}
    ${env.length ? `<div class="bloco"><h2 class="h2">${I.hist}Últimos lançamentos deste celular</h2>
      <div class="lista">${env.slice(0, 15).map((x) => `<div class="item item-fixo${x.ok ? '' : ' recusado'}"><span>
        <span class="item-t">${esc(x.desfeito ? `↩️ ${x.resumo}` : x.texto || x.resumo)}</span>
        <span class="item-m">${esc(x.desfeito ? `desfeito ${quando(x.desfeito)}` : x.ok ? `gravado ${quando(x.enviado)}` : `${x.resumo} · recusado`)}</span></span>
        ${x.ok && !x.desfeito && pode ? `<button class="link" data-acao="l-desfazer" data-uid="${esc(x.uid)}">desfazer</button>` : ''}
        ${!x.ok && x.rasc && pode ? `<button class="link" data-acao="l-reabrir" data-uid="${esc(x.uid)}">corrigir</button>` : ''}</div>`).join('')}</div></div>` : ''}
  </section>`;
}

function campoData(r) {
  const h = hojeISO(), o = ontemISO();
  return `<div class="campo"><span>Data</span><div class="linha-data">
    <input id="l-data" type="date" value="${esc(r.data)}" max="${esc(h)}">
    <div class="chips"><button class="chip" data-acao="l-dia" data-valor="${h}" aria-pressed="${r.data === h}">Hoje</button>
    <button class="chip" data-acao="l-dia" data-valor="${o}" aria-pressed="${r.data === o}">Ontem</button></div></div></div>`;
}
function cabForm(tipo, extra = '') {
  const T = TIPOS_L[tipo];
  return `<button class="voltar" data-ir="#lancar">${I.voltar}Manejo</button>
    <h1 class="h1 h1-ic">${I[T.ic]}${esc(T.t)}</h1>${extra}`;
}
function animalAchado(a, vazio) {
  if (!a) return `<p class="achado ${vazio ? '' : 'nao'}">${vazio ? 'Digite o número do brinco.' : 'Não achei esse número no rebanho.'}</p>`;
  const ps = pesos(a), u = ps[ps.length - 1];
  return `<p class="achado sim"><b>${esc(a.n)}</b> · ${esc(resumo(a))}${u ? ` · último peso ${esc(kg(u.p))} em ${esc(dtc(u.d))}` : ''}</p>`;
}

// aviso de peso que não bate com o último (Herdwatch: conferir na hora)
function avisoPeso(a, kgv, data) {
  const ps = pesos(a).filter((p) => p.d < data), u = ps[ps.length - 1];
  if (!u) return kgv < 20 || kgv > 1100 ? 'peso fora do normal' : '';
  const d = diasEntre(u.d, data);
  const g = d > 0 ? (kgv - u.p) / d : null;
  if (Math.abs(kgv - u.p) / u.p > 0.35 || (g !== null && (g > 2.5 || g < -1.5))) {
    return `último peso ${kg(u.p)} em ${dtc(u.d)}${g !== null ? ` (${g > 0 ? '+' : ''}${numBR(g * 1000, 0)} g/dia)` : ''}: confere`;
  }
  return '';
}

function telaLancar(tipo) {
  if (!tipo) return telaManejo();
  if (!TIPOS_L[tipo]) return telaManejo();
  if (!dono()) return telaManejo();
  const r = rasc(tipo);
  const pre = location.hash.split('/')[2] || '';
  if (pre && r._pre !== pre) aplicarPre(tipo, r, pre);
  return `<section class="pagina form-lancar" data-tipo="${tipo}">${r.revisar ? revisao(tipo, r) : (FORMS[tipo])(r)}</section>`;
}
function aplicarPre(tipo, r, pre) {
  r._pre = pre;
  if (pre.startsWith('lote-')) r.lote = Number(pre.slice(5));
  else {
    const a = S.idx.porId.get(Number(pre));
    if (a) {
      if (tipo === 'nascimento') r.mae = a.id; else if (tipo === 'morte') r.a = a.id; else if (tipo === 'pesagem') r.num = a.n;
      else if (tipo === 'remedio') { r.alvo = 'animais'; r.itens = [...new Set([...(r.itens || []), a.id])]; }
    }
  }
  if (r.lote && (tipo === 'pasto' || tipo === 'salga')) { const l = S.idx.lotes.get(r.lote); if (l) { r.f = l.f; r.pasto = null; } }
  if (r.lote && tipo === 'remedio') r.alvo = 'lote';
  guardarRasc(tipo, r);
}

const FORMS = {
  pesagem(r) {
    const itens = r.itens || [];
    const lote = r.lote ? S.idx.lotes.get(r.lote) : null;
    const doLote = lote ? S.dados.animais.filter((a) => a.st === 'ativo' && (a.lotes || []).includes(lote.id)) : [];
    const pesados = new Set(itens.map((x) => x.a));
    const faltam = doLote.filter((a) => !pesados.has(a.id));
    const soma = itens.reduce((t, x) => t + x.kg, 0);
    const lotes = S.dados.lotes.filter((l) => S.dados.animais.some((a) => a.st === 'ativo' && (a.lotes || []).includes(l.id)));
    const achado = r.num ? acharAnimal(r.num) : null;
    return `${cabForm('pesagem')}${campoData(r)}
      ${lotes.length ? `<div class="campo"><span>Lote (opcional, mostra quem falta pesar)</span><div class="chips">
        <button class="chip" data-acao="l-lote" data-valor="" aria-pressed="${!r.lote}">Nenhum</button>
        ${lotes.map((l) => `<button class="chip" data-acao="l-lote" data-valor="${l.id}" aria-pressed="${r.lote === l.id}">${esc(l.nome)} <small>${esc(faz(l.f).codigo)}</small></button>`).join('')}</div></div>` : ''}
      <div class="pesar">
        <label class="campo"><span>Número</span><input id="l-num" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" value="${esc(r.num || '')}" placeholder="brinco"></label>
        <label class="campo"><span>Peso (kg)</span><input id="l-kg" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(r.kgTxt || '')}" placeholder="kg"></label>
      </div>
      <div id="l-achado">${animalAchado(achado, !r.num)}</div>
      <button class="btn sec" data-acao="l-add">Pôr na lista</button>
      ${itens.length ? `<p class="nota"><b>${itens.length} ${itens.length === 1 ? 'animal' : 'animais'}</b> · média ${esc(kg(Math.round(soma / itens.length)))}${lote ? ` · faltam ${faltam.length} do lote ${esc(lote.nome)}` : ''}</p>
        <div class="lista">${itens.slice().reverse().map((x) => { const a = S.idx.porId.get(x.a);
          return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : '?')} · ${esc(kg(x.kg))}</span>
            ${x.aviso ? `<span class="item-m aviso-t">⚠️ ${esc(x.aviso)}</span>` : `<span class="item-m">${esc(a ? resumo(a) : '')}</span>`}</span>
            <button class="link perigo-t" data-acao="l-tirar" data-valor="${x.a}">tirar</button></div>`; }).join('')}</div>`
        : '<p class="vazio">Nenhum animal na lista ainda.</p>'}
      ${lote && faltam.length && itens.length ? `<details class="tempo-mais"><summary>Ver quem falta pesar (${faltam.length})</summary><p class="nota">${esc(faltam.map((a) => a.n).join(', '))}</p></details>` : ''}
      <button class="btn" data-acao="l-revisar" ${itens.length ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  pasto(r) {
    const fz = S.dados.fazendas;
    if (!r.f) r.f = S.fazenda !== 'todas' ? (fz.find((x) => x.codigo === S.fazenda) || fz[0]).id : null;
    const lotes = r.f ? S.dados.lotes.filter((l) => l.f === r.f) : [];
    const pastos = r.f ? [...S.idx.pastos.values()].filter((p) => p.f === r.f).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })) : [];
    const ondeLote = (l) => { const o = S.idx.pastoDoLote.get(l.id); return o ? `está no ${nomePasto(o.pasto)} desde ${dtc(o.ent)}` : 'pasto não informado'; };
    const quemNoPasto = (p) => {
      const ocs = ((S.dados.mapa && S.dados.mapa.ocupacoes) || []).filter((o) => !o.sai && (o.pasto === p.id || (o.tambem || []).includes(p.id)));
      if (ocs.length) return `com ${ocs.map((o) => (S.idx.lotes.get(o.lote) || {}).nome || 'lote').join(', ')}`;
      const saidas = ((S.dados.mapa && S.dados.mapa.ocupacoes) || []).filter((o) => o.sai && o.pasto === p.id).map((o) => o.sai).sort();
      return saidas.length ? `descanso há ${diasEntre(saidas[saidas.length - 1], hojeISO())} dias` : 'sem gado';
    };
    return `${cabForm('pasto')}${campoData(r)}
      <div class="campo"><span>Fazenda</span><div class="chips">${fz.map((x) => `<button class="chip" data-acao="l-faz" data-valor="${x.id}" aria-pressed="${r.f === x.id}">${esc(x.codigo)}</button>`).join('')}</div></div>
      ${r.f ? `<div class="campo"><span>Qual lote mudou?</span><div class="opcoes">${lotes.map((l) => `<button class="opcao" data-acao="l-lote" data-valor="${l.id}" aria-pressed="${r.lote === l.id}">
          <b>${esc(l.nome)}</b><small>${esc(ondeLote(l))}</small></button>`).join('') || '<p class="vazio">Nenhum lote nesta fazenda.</p>'}</div></div>
        <div class="campo"><span>Foi para qual pasto?</span><div class="opcoes">${pastos.map((p) => `<button class="opcao" data-acao="l-pasto" data-valor="${p.id}" aria-pressed="${r.pasto === p.id}">
          <b>${esc(nomePasto(p.id))}</b><small>${esc([p.ha ? `${numBR(p.ha)} ha` : null, quemNoPasto(p)].filter(Boolean).join(' · '))}</small></button>`).join('')}</div></div>
        <label class="campo"><span>Cabeças (se não souber, deixe em branco)</span><input id="l-cab" inputmode="numeric" value="${esc(r.cab || '')}" placeholder="—"></label>
        <label class="campo"><span>Observação</span><input id="l-obs" value="${esc(r.obs || '')}" placeholder="opcional"></label>` : '<p class="nota">Escolha a fazenda.</p>'}
      <button class="btn" data-acao="l-revisar" ${r.lote && r.pasto ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  nascimento(r) {
    const mae = r.mae ? S.idx.porId.get(r.mae) : (r.num ? acharAnimal(r.num, (a) => a.s !== 'M') : null);
    return `${cabForm('nascimento')}${campoData(r)}
      <label class="campo"><span>Número da mãe</span><input id="l-num" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(r.num ?? (mae ? mae.n : ''))}" placeholder="brinco da vaca"></label>
      <div id="l-achado">${animalAchado(mae, !(r.num ?? mae))}</div>
      <div id="l-avisos">${avisosParto(mae, r.data)}</div>
      <div class="campo"><span>A cria é</span><div class="duas-op">
        <button class="opcao grande" data-acao="l-sexo" data-valor="F" aria-pressed="${r.sexo === 'F'}"><b>Fêmea</b><small>bezerra</small></button>
        <button class="opcao grande" data-acao="l-sexo" data-valor="M" aria-pressed="${r.sexo === 'M'}"><b>Macho</b><small>bezerro</small></button></div></div>
      <div class="chips"><button class="chip" data-acao="l-natimorto" aria-pressed="${!!r.natimorto}">Nasceu morto</button></div>
      <label class="campo"><span>Observação</span><input id="l-obs" value="${esc(r.obs || '')}" placeholder="opcional"></label>
      <button class="btn" data-acao="l-revisar" ${mae && r.sexo ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  morte(r) {
    const a = r.a ? S.idx.porId.get(r.a) : (r.num ? acharAnimal(r.num) : null);
    return `${cabForm('morte')}${campoData(r)}
      <label class="campo"><span>Número do animal</span><input id="l-num" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(r.num ?? (a ? a.n : ''))}" placeholder="brinco"></label>
      <div id="l-achado">${animalAchado(a, !(r.num ?? a))}</div>
      <div class="campo"><span>Causa</span><div class="chips quebra">${CAUSAS.map((c) => `<button class="chip" data-acao="l-causa" data-valor="${esc(c)}" aria-pressed="${r.causa === c}">${esc(c)}</button>`).join('')}</div>
        <input id="l-causa" value="${esc(CAUSAS.includes(r.causa) ? '' : r.causa || '')}" placeholder="ou escreva a causa"></div>
      <button class="btn" data-acao="l-revisar" ${a ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  chuva(r) {
    const fz = S.dados.fazendas;
    if (!r.f) r.f = 'ambas';
    return `${cabForm('chuva')}${campoData(r)}
      <label class="campo"><span>Quantos milímetros?</span><input id="l-mm" class="num-grande" inputmode="decimal" value="${esc(r.mmTxt || '')}" placeholder="mm"></label>
      <div class="campo"><span>Onde choveu</span><div class="chips">${fz.map((x) => `<button class="chip" data-acao="l-faz" data-valor="${x.id}" aria-pressed="${r.f === x.id}">${esc(x.codigo)}</button>`).join('')}
        <button class="chip" data-acao="l-faz" data-valor="ambas" aria-pressed="${r.f === 'ambas'}">Nas duas</button></div></div>
      <button class="btn" data-acao="l-revisar" ${lerNum(r.mmTxt) !== null && r.mmTxt !== '' ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  remedio(r) {
    const ps = produtos(CAT_REMEDIO);
    const p = r.prod ? prodPorId(r.prod) : null;
    if (!r.alvo) r.alvo = 'animais';
    const itens = r.itens || [];
    const lotes = S.dados.lotes.filter((l) => animaisDoLote(l.id).length);
    const achado = r.num ? acharAnimal(r.num) : null;
    return `${cabForm('remedio')}${campoData(r)}
      <div class="campo"><span>Produto</span><div class="chips quebra">
        ${ps.map((x) => `<button class="chip" data-acao="l-prod" data-valor="${x.id}" aria-pressed="${r.prod === x.id}">${esc(x.nome)}</button>`).join('')}
        <button class="chip" data-acao="l-prod" data-valor="" aria-pressed="${!r.prod}">Outro (escrever)</button></div>
        ${p ? '' : `<input id="r-nome" value="${esc(r.nome || '')}" placeholder="nome do produto (ex.: Ivomec)" autocomplete="off">`}</div>
      ${p ? `<label class="campo"><span>Dose por animal (${esc(UN[p.un] || p.un || '')})</span><input id="r-qtd" inputmode="decimal" value="${esc(r.qtdTxt || '')}" placeholder="${esc(doseNum(p) || 'dose')}"></label>`
        : `<label class="campo"><span>Dose por animal</span><input id="r-dose" value="${esc(r.dose || '')}" placeholder="ex.: 5 ml" autocomplete="off"></label>`}
      <div class="campo"><span>Para quê</span><div class="chips quebra">${MOTIVOS.map((m) => `<button class="chip" data-acao="l-motivo" data-valor="${esc(m)}" aria-pressed="${r.motivo === m}">${esc(m)}</button>`).join('')}</div></div>
      <label class="campo"><span>Carência (dias sem vender ou abater; vazio = sem carência)</span><input id="r-car" inputmode="numeric" value="${esc(r.carTxt || '')}" placeholder="0"></label>
      <div class="campo"><span>Em quem</span><div class="duas-op">
        <button class="opcao grande" data-acao="l-alvo" data-valor="animais" aria-pressed="${r.alvo === 'animais'}"><b>Animais</b><small>pelo número</small></button>
        <button class="opcao grande" data-acao="l-alvo" data-valor="lote" aria-pressed="${r.alvo === 'lote'}"><b>Lote inteiro</b><small>todos do lote</small></button></div></div>
      ${r.alvo === 'lote'
        ? `<div class="opcoes">${lotes.map((l) => `<button class="opcao" data-acao="l-lote" data-valor="${l.id}" aria-pressed="${r.lote === l.id}">
            <b>${esc(l.nome)}</b><small>${esc(faz(l.f).codigo)} · ${animaisDoLote(l.id).length} animais cadastrados</small></button>`).join('') || '<p class="vazio">Nenhum lote com animais.</p>'}</div>`
        : `<div class="pesar"><label class="campo"><span>Número</span><input id="r-num" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" value="${esc(r.num || '')}" placeholder="brinco"></label>
            <button class="btn sec" data-acao="l-rem-add">Pôr na lista</button></div>
          <div id="l-achado">${animalAchado(achado, !r.num)}</div>
          ${itens.length ? `<p class="nota"><b>${itens.length} ${itens.length === 1 ? 'animal' : 'animais'}</b></p><div class="lista">${itens.slice().reverse().map((id) => { const a = S.idx.porId.get(id);
            return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : '?')}</span><span class="item-m">${esc(a ? resumo(a) : '')}</span></span>
              <button class="link perigo-t" data-acao="l-rem-tirar" data-valor="${id}">tirar</button></div>`; }).join('')}</div>` : '<p class="vazio">Nenhum animal na lista ainda.</p>'}`}
      <label class="campo"><span>Observação</span><input id="l-obs" value="${esc(r.obs || '')}" placeholder="opcional"></label>
      <button class="btn" data-acao="l-revisar" ${PRONTO.remedio(r) ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
  salga(r) {
    const fz = S.dados.fazendas;
    if (!r.f) r.f = S.fazenda !== 'todas' ? (fz.find((x) => x.codigo === S.fazenda) || fz[0]).id : null;
    if (!r.un) r.un = 'sacos';
    const ps = produtos(CAT_SAL);
    const p = r.prod ? prodPorId(r.prod) : null;
    const lotes = r.f ? S.dados.lotes.filter((l) => l.f === r.f) : [];
    const pastos = r.f ? [...S.idx.pastos.values()].filter((x) => x.f === r.f).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })) : [];
    const ondeLote = (l) => { const o = S.idx.pastoDoLote.get(l.id); const n = animaisDoLote(l.id).length;
      return [o ? `no ${nomePasto(o.pasto)}` : null, n ? `${n} cabeças` : null].filter(Boolean).join(' · ') || 'sem animais cadastrados'; };
    return `${cabForm('salga')}${campoData(r)}
      <div class="campo"><span>Fazenda</span><div class="chips">${fz.map((x) => `<button class="chip" data-acao="l-faz" data-valor="${x.id}" aria-pressed="${r.f === x.id}">${esc(x.codigo)}</button>`).join('')}</div></div>
      ${r.f ? `<div class="campo"><span>Cocho de qual lote?</span><div class="opcoes">${lotes.map((l) => `<button class="opcao" data-acao="l-lote" data-valor="${l.id}" aria-pressed="${r.lote === l.id}">
          <b>${esc(l.nome)}</b><small>${esc(ondeLote(l))}</small></button>`).join('') || '<p class="vazio">Nenhum lote nesta fazenda.</p>'}</div></div>
        ${pastos.length ? `<div class="campo"><span>ou só o pasto</span><div class="chips quebra">${pastos.map((x) => `<button class="chip" data-acao="l-pasto" data-valor="${x.id}" aria-pressed="${r.pasto === x.id}">${esc(nomePasto(x.id))}</button>`).join('')}</div></div>` : ''}
        <div class="campo"><span>O que foi posto no cocho</span><div class="chips quebra">
          ${ps.map((x) => `<button class="chip" data-acao="l-prod" data-valor="${x.id}" aria-pressed="${r.prod === x.id}">${esc(x.nome)}</button>`).join('')}
          <button class="chip" data-acao="l-prod" data-valor="" aria-pressed="${!r.prod}">Outro (escrever)</button></div>
          ${p ? '' : `<input id="r-nome" value="${esc(r.nome || '')}" placeholder="ex.: sal mineral" autocomplete="off">`}</div>
        <div class="campo"><span>Quantidade</span><div class="pesar">
          <input id="s-qtd" class="num-grande" inputmode="decimal" value="${esc(r.qtdTxt || '')}" placeholder="${r.un === 'kg' ? 'kg' : 'sacos'}">
          <div class="chips"><button class="chip" data-acao="l-un" data-valor="sacos" aria-pressed="${r.un === 'sacos'}">Sacos</button>
            <button class="chip" data-acao="l-un" data-valor="kg" aria-pressed="${r.un === 'kg'}">kg</button></div></div>
          ${p && p.kgun && r.un === 'sacos' ? `<small class="nota">saco de ${esc(numBR(p.kgun))} kg</small>` : ''}</div>
        <label class="campo"><span>Observação</span><input id="l-obs" value="${esc(r.obs || '')}" placeholder="opcional"></label>` : '<p class="nota">Escolha a fazenda.</p>'}
      <button class="btn" data-acao="l-revisar" ${PRONTO.salga(r) ? '' : 'disabled'}>Revisar e confirmar</button>`;
  },
};

// quando o botão "Revisar e confirmar" pode ser tocado (conferido de novo a cada letra digitada)
const PRONTO = {
  chuva: (r) => lerNum(r.mmTxt) !== null && r.mmTxt !== '',
  nascimento: (r) => !!(r.mae && r.sexo),
  morte: (r) => !!r.a,
  remedio: (r) => !!((r.prod || (r.nome || '').trim()) && (r.alvo === 'lote' ? r.lote : (r.itens || []).length)),
  salga: (r) => !!(r.f && (r.lote || r.pasto) && (r.prod || (r.nome || '').trim()) && (lerNum(r.qtdTxt) || 0) > 0),
};

function avisosParto(mae, data) {
  if (!mae) return '';
  const l = [];
  const crias = (S.idx.filhos.get(mae.id) || []).filter((c) => c.nasc && c.nasc < data).sort((x, y) => y.nasc.localeCompare(x.nasc));
  if (crias.length) {
    const d = diasEntre(crias[0].nasc, data);
    if (d < 300) l.push(`A ${mae.n} já pariu há ${d} dias (${crias[0].n}, ${dt(crias[0].nasc)}). Confere o número da mãe.`);
  }
  const p = S.idx.partos.get(mae.n);
  if (p && p.prev && diasEntre(data, p.prev) > 20) l.push(`Parto previsto só para ${dt(p.prev)}: pode ser prematuro.`);
  return l.map((t) => `<p class="achado aviso-t">⚠️ ${esc(t)}</p>`).join('');
}

// o resumo que o produtor confere antes de confirmar (regra: repetir o que entendeu e esperar o "confirma")
function montar(tipo, r) {
  const d = dtc(r.data);
  if (tipo === 'pesagem') {
    const itens = r.itens || [];
    const soma = itens.reduce((t, x) => t + x.kg, 0);
    return { dados: { data: r.data, itens: itens.map((x) => ({ a: x.a, kg: x.kg })) },
      resumo: `Pesagem ${d}: ${itens.length} ${itens.length === 1 ? 'animal' : 'animais'}, média ${kg(Math.round(soma / itens.length))}`,
      linhas: itens.map((x) => `${(S.idx.porId.get(x.a) || {}).n || '?'}: ${kg(x.kg)}${x.aviso ? ` ⚠️ ${x.aviso}` : ''}`),
      total: `${itens.length} ${itens.length === 1 ? 'animal' : 'animais'} · ${kg(soma)} no total · média ${kg(Math.round(soma / itens.length))}` };
  }
  if (tipo === 'pasto') {
    const l = S.idx.lotes.get(r.lote), o = S.idx.pastoDoLote.get(r.lote);
    const cab = lerNum(r.cab);
    return { dados: { data: r.data, lote: r.lote, pasto: r.pasto, cab: cab && cab > 0 ? Math.round(cab) : null, obs: r.obs || null },
      resumo: `Mudança de pasto ${d}: ${l ? l.nome : 'lote'} para o ${nomePasto(r.pasto)}`,
      linhas: [`Lote: ${l ? l.nome : '?'}${cab ? ` (${Math.round(cab)} cabeças)` : ''}`,
        o ? `Sai do ${nomePasto(o.pasto)}, onde estava desde ${dtc(o.ent)} (${diasEntre(o.ent, r.data)} dias)` : 'Pasto anterior: não informado',
        `Vai para o ${nomePasto(r.pasto)} em ${d}`, r.obs ? `Obs.: ${r.obs}` : null].filter(Boolean) };
  }
  if (tipo === 'nascimento') {
    const m = r.mae ? S.idx.porId.get(r.mae) : acharAnimal(r.num, (a) => a.s !== 'M');
    const cria = r.sexo === 'M' ? 'bezerro' : 'bezerra';
    return { dados: { data: r.data, mae: m.id, sexo: r.sexo, natimorto: !!r.natimorto, obs: r.obs || null },
      resumo: `Nascimento ${d}: ${cria} da ${m.n}${r.natimorto ? ' (nasceu morto)' : ''}`,
      linhas: [`Mãe: ${m.n} · ${resumo(m)}`, `Cria: ${cria}${r.natimorto ? ', nasceu morta' : ''}`, `Data: ${dt(r.data)}`, r.obs ? `Obs.: ${r.obs}` : null,
        'O sistema dá um número provisório até brincar.'].filter(Boolean) };
  }
  if (tipo === 'morte') {
    const a = r.a ? S.idx.porId.get(r.a) : acharAnimal(r.num);
    return { dados: { data: r.data, a: a.id, causa: r.causa || null },
      resumo: `Morte ${d}: ${a.n}${r.causa ? `, ${r.causa}` : ''}`,
      linhas: [`Animal: ${a.n} · ${resumo(a)}`, `Causa: ${r.causa || 'não informada'}`, `Data: ${dt(r.data)}`, '⚠️ O animal sai do rebanho como morto.'] };
  }
  if (tipo === 'chuva') {
    const mm = lerNum(r.mmTxt);
    const onde = r.f === 'ambas' ? 'MD e 3C' : faz(r.f).codigo;
    return { dados: { data: r.data, mm, f: r.f === 'ambas' ? 'ambas' : r.f },
      resumo: `Chuva ${d}: ${numBR(mm)} mm (${onde})`, linhas: [`${numBR(mm)} mm em ${dt(r.data)}`, `Onde: ${onde}`] };
  }
  return MONTAR[tipo] ? MONTAR[tipo](r) : null;
}
const MONTAR = {
  remedio(r) {
    const d = dtc(r.data);
    const p = r.prod ? prodPorId(r.prod) : null;
    const nome = p ? p.nome : (r.nome || '').trim();
    const qtd = p ? lerNum(r.qtdTxt) : null;
    const un = p ? (UN[p.un] || p.un || '') : '';
    const dose = p ? (qtd ? `${numBR(qtd, 2)} ${un}` : '') : (r.dose || '').trim();
    const car = Math.round(lerNum(r.carTxt) || 0);
    const lote = r.alvo === 'lote' && r.lote ? S.idx.lotes.get(r.lote) : null;
    const ids = lote ? animaisDoLote(lote.id).map((a) => a.id) : (r.itens || []);
    const n = ids.length;
    const nums = ids.map((id) => (S.idx.porId.get(id) || {}).n).filter(Boolean);
    const quem = lote ? `lote ${lote.nome} (${n})` : n <= 4 ? nums.join(', ') : `${n} animais`;
    return { dados: { data: r.data, prod: p ? p.id : null, nome: p ? null : nome, qtd: qtd || null, dose: p ? null : dose || null,
        carencia: car || null, motivo: r.motivo || null, alvo: lote ? 'lote' : 'animais', lote: lote ? lote.id : null, itens: lote ? null : ids, obs: r.obs || null },
      resumo: `${nome}${dose ? ` ${dose}` : ''} ${d}: ${quem}`,
      linhas: [`Produto: ${nome}${dose ? ` · ${dose} por animal` : ''}`, r.motivo ? `Para: ${r.motivo}` : null,
        lote ? `Lote inteiro: ${lote.nome} (${faz(lote.f).codigo}) · ${n} animais cadastrados` : `${n} ${n === 1 ? 'animal' : 'animais'}: ${nums.join(', ')}`,
        car > 0 ? `Carência: ${car} dias · liberado para venda em ${dt(somarDias(r.data, car))}` : 'Sem carência',
        p && qtd ? (p.compra ? `Baixa no estoque: ${numBR(qtd * n, 2)} ${un} no total` : 'Sem baixa no estoque (a compra desse produto ainda não foi lançada)') : null,
        `Data: ${dt(r.data)}`, r.obs ? `Obs.: ${r.obs}` : null].filter(Boolean),
      total: `${n} ${n === 1 ? 'animal' : 'animais'}${qtd ? ` · ${numBR(qtd * n, 2)} ${un} no total` : ''}` };
  },
  salga(r) {
    const fz = faz(r.f);
    const l = r.lote ? S.idx.lotes.get(r.lote) : null;
    const p = r.prod ? prodPorId(r.prod) : null;
    const nome = p ? p.nome : (r.nome || '').trim();
    const q = lerNum(r.qtdTxt);
    const sacos = r.un === 'kg' ? null : q;
    const kgTot = r.un === 'kg' ? q : p && p.kgun ? q * p.kgun : null;
    const qtdTxt = r.un === 'kg' ? `${numBR(q)} kg` : `${numBR(q)} ${q === 1 ? 'saco' : 'sacos'}`;
    const o = l ? S.idx.pastoDoLote.get(l.id) : null;
    const cab = l ? animaisDoLote(l.id).length : 0;
    const onde = l ? `lote ${l.nome}` : nomePasto(r.pasto);
    return { dados: { data: r.data, f: r.f, lote: l ? l.id : null, pasto: l ? null : r.pasto, prod: p ? p.id : null, nome: p ? null : nome,
        sacos, kg: r.un === 'kg' ? q : null, obs: r.obs || null },
      resumo: `Salga ${dtc(r.data)}: ${qtdTxt} de ${nome}, ${onde} (${fz.codigo})`,
      linhas: [`${qtdTxt} de ${nome}${kgTot && r.un !== 'kg' ? ` (${numBR(kgTot)} kg)` : ''}`,
        `Onde: ${onde}${o ? `, no ${nomePasto(o.pasto)}` : ''} (${fz.codigo})`, cab ? `${cab} cabeças no lote` : null,
        `Data: ${dt(r.data)}`, r.obs ? `Obs.: ${r.obs}` : null].filter(Boolean) };
  },
};
function revisao(tipo, r) {
  const m = montar(tipo, r);
  return `${cabForm(tipo)}
    <div class="bloco revisao"><h2 class="h2">${I.ok}Confere antes de gravar</h2>
      <ul class="rev-linhas">${m.linhas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      ${m.total ? `<p class="nota"><b>${esc(m.total)}</b></p>` : ''}</div>
    <button class="btn" data-acao="l-confirmar">Confirmar</button>
    <button class="btn sec" data-acao="l-corrigir">Corrigir</button>`;
}

// ------------------------------------------------------------------ toques e digitação nas telas de lançamento
const tipoAtual = () => { const f = $('.form-lancar'); return f ? f.dataset.tipo : null; };
function mexer(fn, redesenhar = true) {
  const tipo = tipoAtual();
  if (!tipo) return;
  const r = rasc(tipo);
  fn(r, tipo);
  guardarRasc(tipo, r);
  if (redesenhar) { const y = window.scrollY; desenhar(); window.scrollTo(0, y); }
}
function porNaLista(r) {
  const a = acharAnimal(r.num || '');
  const v = lerNum(r.kgTxt);
  if (!a) { avisar('Não achei esse número no rebanho.'); return false; }
  if (v === null || v <= 0) { avisar('Digite o peso em kg.'); return false; }
  if (v < 10 || v > 1500) { avisar('Peso fora do normal. Confere.'); return false; }
  r.itens = (r.itens || []).filter((x) => x.a !== a.id);
  r.itens.push({ a: a.id, kg: Math.round(v * 10) / 10, aviso: avisoPeso(a, v, r.data) });
  r.num = ''; r.kgTxt = '';
  return true;
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="l-"]');
  if (!b) return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'l-enviar') { enviarFila(true); return; }
  if (acao === 'l-cancelar') {
    const x = fila().find((y) => y.uid === b.dataset.uid);
    if (!x) return;
    abrirJanela(`<h2>Cancelar este lançamento?</h2><p>${esc(x.resumo)}</p><p>Ele ainda não foi para o sistema. Se cancelar, ele sai da fila.</p>
      <button class="btn perigo" data-acao="l-cancelar-sim" data-uid="${esc(x.uid)}">Sim, cancelar</button>`);
    return;
  }
  if (acao === 'l-cancelar-sim') { guardarFila(fila().filter((y) => y.uid !== b.dataset.uid)); $('.fundo')?.remove(); desenhar(); return; }
  if (acao === 'l-desfazer') {
    const x = enviados().find((y) => y.uid === b.dataset.uid);
    if (!x) return;
    abrirJanela(`<h2>Desfazer este lançamento?</h2><p>${esc(x.texto || x.resumo)}</p><p>O sistema volta como estava antes dele. Precisa de internet.</p>
      <button class="btn perigo" data-acao="l-desfazer-sim" data-uid="${esc(x.uid)}">Sim, desfazer</button>`);
    return;
  }
  if (acao === 'l-desfazer-sim') { desfazerEnviado(b.dataset.uid); return; }
  if (acao === 'l-reabrir') {   // recusado: volta para a tela com o que tinha sido digitado
    const env = enviados(), x = env.find((y) => y.uid === b.dataset.uid);
    if (!x || !x.rasc) return;
    guardarRasc(x.tipo, x.rasc);
    delete x.rasc; guardarEnviados(env);
    location.hash = `#lancar/${x.tipo}`;
    return;
  }
  if (acao === 'l-dia') return mexer((r) => { r.data = v; });
  if (acao === 'l-lote') return mexer((r, t) => { r.lote = v ? Number(v) : null; if (t === 'pasto' || t === 'salga') r.pasto = null; });
  if (acao === 'l-faz') return mexer((r, t) => { r.f = v === 'ambas' ? 'ambas' : Number(v); if (t === 'pasto' || t === 'salga') { r.lote = null; r.pasto = null; } });
  if (acao === 'l-pasto') return mexer((r, t) => { r.pasto = Number(v); if (t === 'salga') r.lote = null; });
  if (acao === 'l-prod') return mexer((r, t) => {
    r.prod = v ? Number(v) : null;
    const p = r.prod ? prodPorId(r.prod) : null;
    if (t === 'remedio') { r.qtdTxt = p ? doseNum(p) : ''; r.carTxt = p && p.car ? String(p.car) : ''; }
  });
  if (acao === 'l-motivo') return mexer((r) => { r.motivo = r.motivo === v ? '' : v; });
  if (acao === 'l-alvo') return mexer((r) => { r.alvo = v; });
  if (acao === 'l-un') return mexer((r) => { r.un = v; });
  if (acao === 'l-rem-tirar') return mexer((r) => { r.itens = (r.itens || []).filter((x) => x !== Number(v)); });
  if (acao === 'l-rem-add') {
    let ok = false;
    mexer((r) => {
      const a = acharAnimal(r.num || '');
      if (!a) { avisar('Não achei esse número no rebanho.'); return; }
      r.itens = [...(r.itens || []).filter((x) => x !== a.id), a.id];
      r.num = ''; ok = true;
    });
    if (ok) setTimeout(() => $('#r-num')?.focus(), 30);
    return;
  }
  if (acao === 'l-sexo') return mexer((r) => { r.sexo = v; });
  if (acao === 'l-natimorto') return mexer((r) => { r.natimorto = !r.natimorto; });
  if (acao === 'l-causa') return mexer((r) => { r.causa = r.causa === v ? '' : v; });
  if (acao === 'l-tirar') return mexer((r) => { r.itens = (r.itens || []).filter((x) => x.a !== Number(v)); });
  if (acao === 'l-add') {
    let ok = false;
    mexer((r) => { ok = porNaLista(r); });
    if (ok) setTimeout(() => $('#l-num')?.focus(), 30);
    return;
  }
  if (acao === 'l-revisar') return mexer((r) => { r.revisar = true; window.scrollTo(0, 0); });
  if (acao === 'l-corrigir') return mexer((r) => { r.revisar = false; });
  if (acao === 'l-confirmar') {
    const tipo = tipoAtual();
    const r = rasc(tipo);
    const m = montar(tipo, r);
    if (m) confirmarLancamento(tipo, m.dados, m.resumo);
  }
});

// o que é digitado vai para o rascunho na hora (sem redesenhar a tela, para não fechar o teclado)
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.closest || !el.closest('.form-lancar')) return;
  const tipo = tipoAtual();
  mexer((r) => {
    if (el.id === 'l-data') r.data = el.value && el.value <= hojeISO() ? el.value : hojeISO();
    if (el.id === 'l-num') { r.num = el.value; if (tipo === 'nascimento') r.mae = null; if (tipo === 'morte') r.a = null; }
    if (el.id === 'l-kg') r.kgTxt = el.value;
    if (el.id === 'l-cab') r.cab = el.value;
    if (el.id === 'l-obs') r.obs = el.value;
    if (el.id === 'l-causa') r.causa = el.value;
    if (el.id === 'l-mm') r.mmTxt = el.value;
    if (el.id === 'r-nome') r.nome = el.value;
    if (el.id === 'r-qtd' || el.id === 's-qtd') r.qtdTxt = el.value;
    if (el.id === 'r-dose') r.dose = el.value;
    if (el.id === 'r-car') r.carTxt = el.value;
    if (el.id === 'r-num') r.num = el.value;
  }, false);
  // atualiza só o pedaço que depende do que foi digitado
  const r = rasc(tipo);
  if (el.id === 'l-num') {
    const filtro = tipo === 'nascimento' ? (a) => a.s !== 'M' : null;
    const a = acharAnimal(r.num, filtro);
    $('#l-achado').innerHTML = animalAchado(a, !r.num);
    if (tipo === 'nascimento') {
      $('#l-avisos').innerHTML = avisosParto(a, r.data);
      if (a) { r.mae = a.id; guardarRasc(tipo, r); }
    }
    if (tipo === 'morte' && a) { r.a = a.id; guardarRasc(tipo, r); }
  }
  if (el.id === 'r-num') $('#l-achado').innerHTML = animalAchado(acharAnimal(r.num), !r.num);
  const btn = $('[data-acao="l-revisar"]');
  if (btn && PRONTO[tipo]) btn.disabled = !PRONTO[tipo](r);
  if (el.id === 'l-data') { const y = window.scrollY; desenhar(); window.scrollTo(0, y); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.closest || !ev.target.closest('.form-lancar')) return;
  if (/^[cg]-/.test(ev.target.id || '')) return;   // modo Curral e DG cuidam do Enter deles (curral.js, dg.js)
  if (ev.target.id === 'r-num') { ev.preventDefault(); $('[data-acao="l-rem-add"]').click(); return; }
  if (ev.target.id === 'l-num' && $('#l-kg')) { ev.preventDefault(); $('#l-kg').focus(); return; }
  if (ev.target.id === 'l-kg') { ev.preventDefault(); $('[data-acao="l-add"]').click(); return; }
  ev.target.blur();
});

// pendentes da fila aparecem na ficha do animal como "esperando envio"
function pendentesDoAnimal(a) {
  const l = [];
  for (const x of fila()) {
    const d = x.dados || {};
    if (x.tipo === 'pesagem') for (const it of d.itens || []) { if (it.a === a.id) l.push({ d: d.data, t: `Pesagem · ${kg(it.kg)}` }); }
    if (x.tipo === 'morte' && d.a === a.id) l.push({ d: d.data, t: `Morte${d.causa ? ` · ${d.causa}` : ''}` });
    if (x.tipo === 'nascimento' && d.mae === a.id) l.push({ d: d.data, t: `Pariu ${d.sexo === 'M' ? 'um bezerro' : 'uma bezerra'}` });
    if (x.tipo === 'remedio' && ((d.itens || []).includes(a.id) || (d.alvo === 'lote' && (a.lotes || []).includes(d.lote)))) {
      l.push({ d: d.data, t: `Vacina/remédio · ${d.nome || (prodPorId(d.prod) || {}).nome || ''}` });
    }
    if (x.tipo === 'curral') for (const it of d.itens || []) {
      if (it.a === a.id) l.push({ d: d.data, t: `Curral · ${(it.m || []).length} etapa(s) feita(s)${it.ia ? ` · sêmen ${it.ia.sem}` : ''}${it.kg ? ` · ${kg(it.kg)}` : ''}` });
    }
    if (x.tipo === 'dg') for (const it of d.itens || []) {
      if (it.a === a.id) l.push({ d: d.data, t: `Diagnóstico de gestação · ${it.r === 'p' ? 'prenha' : 'vazia'}` });
    }
  }
  return l.map((x) => ({ ...x, tipo: 'fila', ic: 'atualizar', s: 'esperando envio (está guardado no celular)' }));
}

window.addEventListener('online', () => enviarFila());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enviarFila(); });
