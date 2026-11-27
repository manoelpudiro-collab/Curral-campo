// Curral Digital — diagnóstico de gestação (DG) pelo app (etapa 3 do plano do app).
// Escolhe o protocolo (ou só a fazenda), passa animal por animal pelo número: Prenha ou Vazia, dias de gestação se o
// ultrassom disser, observação. No fim, o resumo (prenhez, por sêmen) e o "Confirmar". Funciona sem internet, como o modo Curral.
// O sistema grava o DG, põe o resultado na inseminação da vaca e muda a situação dela (prenha / vazia). Desfazer volta tudo.
'use strict';

// fêmeas que passaram pelo protocolo (qualquer etapa) e ainda estão no rebanho
function expostasDo(protId) {
  const mjs = new Set(S.dados.manejos.filter((m) => m.prot === protId).map((m) => m.id));
  const ids = new Set();
  for (const x of S.dados.aplicacoes) if (mjs.has(x[0])) ids.add(x[1]);
  return [...ids].map((id) => S.idx.porId.get(id)).filter((a) => a && a.st === 'ativo' && a.s === 'F');
}
// a inseminação desta vaca que o DG vai conferir (a última sem resultado, de 20 a 150 dias antes)
function iaParaDG(a, data) {
  const l = (S.idx.insem.get(a.id) || []).filter((i) => !i.dg && i.d && diasEntre(i.d, data) >= 20 && diasEntre(i.d, data) <= 150);
  return l.length ? l[l.length - 1] : null;
}
function naFilaDG(id) {
  return fila().some((x) => x.tipo === 'dg' && (x.dados.itens || []).some((it) => it.a === id));
}
function faltamDG(r) {
  if (!r.prot) return [];
  const passou = new Set((r.itens || []).map((x) => x.a));
  return expostasDo(r.prot).filter((a) => !passou.has(a.id) && !naFilaDG(a.id))
    .sort((a, b) => a.n.localeCompare(b.n, 'pt-BR', { numeric: true }));
}
const pctDG = (p, t) => (t ? `${Math.round((100 * p) / t)}%` : '—');

FORMS.dg = function (r) {
  if (!r.f) {
    const prots = S.dados.protocolos.slice().sort((x, y) => (y.d0 || '').localeCompare(x.d0 || ''));
    const item = (p) => {
      const ex = expostasDo(p.id).length;
      const ins = new Set((S.dados.ins || []).filter((i) => i.prot === p.id).map((i) => i.a)).size;
      return `<button class="opcao" data-acao="g-prot" data-valor="${p.id}"><b>${esc(p.nome)}</b>
        <small>${esc(faz(p.f).codigo)} · D0 ${esc(dt(p.d0))}${p.d0 ? ` · hoje é D${diasEntre(p.d0, hojeISO())}` : ''}</small>
        <small>${ex} ${ex === 1 ? 'fêmea' : 'fêmeas'} no protocolo${ins ? ` · ${ins} inseminadas` : ''}</small></button>`;
    };
    return `${cabForm('dg')}
      <p class="nota">Escolha o protocolo da IATF (ou só a fazenda, para um DG fora do protocolo). Depois é só digitar o número de cada vaca e tocar em Prenha ou Vazia. Funciona sem internet.</p>
      ${prots.length ? `<div class="opcoes">${prots.map(item).join('')}</div>` : ''}
      <p class="rot-linha">Sem protocolo</p>
      <div class="chips">${S.dados.fazendas.map((f) => `<button class="chip" data-acao="g-faz" data-valor="${f.id}">${esc(f.codigo)}</button>`).join('')}</div>`;
  }
  const p = r.prot ? S.idx.prot.get(r.prot) : null;
  const itens = r.itens || [];
  const np = itens.filter((x) => x.r === 'p').length;
  const faltam = faltamDG(r);
  return `${cabForm('dg')}
    <div class="bloco curral-cab"><div><p class="curral-t">${esc(p ? p.nome : `DG fora do protocolo`)}</p>
      <p class="curral-s">${esc(faz(r.f).codigo)}${p && p.d0 ? ` · D0 ${esc(dt(p.d0))} · D${diasEntre(p.d0, r.data)} no dia do DG` : ''}</p></div>
      <button class="link" data-acao="g-trocar">trocar</button></div>
    ${typeof avisoCopiaVelha === 'function' ? avisoCopiaVelha() : ''}
    ${campoData(r)}
    <div class="curral-conta"><span><b>${np}</b> ${np === 1 ? 'prenha' : 'prenhas'} · <b>${itens.length - np}</b> ${itens.length - np === 1 ? 'vazia' : 'vazias'}${itens.length ? ` · ${pctDG(np, itens.length)}` : ''}</span>
      ${r.prot ? `<span>faltam <b>${faltam.length}</b>${faltam.length ? ` <button class="link" data-acao="g-faltam">${r.verFaltam ? 'esconder' : 'ver'}</button>` : ''}</span>` : ''}</div>
    ${r.verFaltam && faltam.length ? `<p class="nota">${esc(faltam.map((a) => a.n).join(', '))}</p>` : ''}
    <label class="campo"><span>Número da vaca</span><input id="g-num" class="num-grande" inputmode="numeric" autocomplete="off" autocapitalize="characters"
      spellcheck="false" enterkeyhint="done" value="${esc(r.num || '')}" placeholder="brinco"></label>
    <div id="g-cartao">${cartaoDG(r)}</div>
    ${itens.length ? `<div class="bloco"><h2 class="h2">${I.ok}Diagnosticadas (${itens.length})</h2><div class="lista">${itens.slice().reverse().map((x) => {
      const a = S.idx.porId.get(x.a);
      return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : '?')} · ${x.r === 'p' ? '🟢 prenha' : '⚪ vazia'}${x.dias ? ` · ${x.dias} dias` : ''}</span>
        <span class="item-m">${esc([x.sem ? `sêmen ${x.sem}` : null, x.obs].filter(Boolean).join(' · ') || (a ? resumo(a) : ''))}</span></span>
        ${r.editando === x.a ? '<span class="acoes-item"><b class="aviso-t">✏️ corrigindo</b></span>'
          : `<span class="acoes-item"><button class="link" data-acao="g-corrigir" data-valor="${x.a}">corrigir</button>
        <button class="link perigo-t" data-acao="g-tirar" data-valor="${x.a}">tirar</button></span>`}</div>`; }).join('')}</div></div>` : ''}
    <button class="btn" data-acao="l-revisar" ${itens.length ? '' : 'disabled'}>Terminar e revisar</button>`;
};

function cartaoDG(r) {
  if (!r.num) return '<p class="achado">Digite o número, toque em <b>Prenha</b> ou <b>Vazia</b> e depois em <b>Pronto</b>.</p>';
  const a = acharAnimal(r.num);
  if (!a) return '<p class="achado nao">Não achei esse número no rebanho.</p>';
  if (a.s !== 'F') return `<p class="achado nao">O ${esc(a.n)} é macho.</p>`;
  if (a.f !== r.f) return `<p class="achado nao">A ${esc(a.n)} é da ${esc(faz(a.f).codigo)}. Este DG é da ${esc(faz(r.f).codigo)}.</p>`;
  const corrigindo = r.editando === a.id && (r.itens || []).some((x) => x.a === a.id);
  if (!corrigindo && (r.itens || []).some((x) => x.a === a.id)) {
    return `<p class="achado aviso-t">A ${esc(a.n)} já passou neste DG. <button class="link" data-acao="g-corrigir" data-valor="${a.id}">corrigir</button></p>`;
  }
  if (naFilaDG(a.id)) return `<p class="achado aviso-t">A ${esc(a.n)} já está num DG esperando envio.</p>`;
  const ia = iaParaDG(a, r.data);
  const fora = r.prot && !expostasDo(r.prot).some((x) => x.id === a.id);
  const u = ultimoDG(a);
  const info = [ia ? `inseminada em ${dtc(ia.d)} (${diasEntre(ia.d, r.data)} dias) · sêmen ${ia.sem}` : null,
    u ? `último DG ${dtc(u.d)}: ${u.dg === 'positivo' ? 'prenha' : u.dg === 'negativo' ? 'vazia' : u.dg}` : null].filter(Boolean);
  return `<div class="bloco curral-animal">
    ${corrigindo ? `<p class="achado aviso-t">✏️ Corrigindo a ${esc(a.n)}. Mude o que precisar e toque em <b>Pronto</b>.</p>` : ''}
    <p class="achado sim"><b>${esc(a.n)}</b> · ${esc(resumo(a))}</p>
    ${info.length ? `<p class="nota">${esc(info.join(' · '))}</p>` : ''}
    ${fora ? '<p class="nota aviso-t">⚠️ Ela não está neste protocolo. Entra no DG mesmo assim.</p>' : ''}
    <div class="chips dg-res"><button class="chip" data-acao="g-res" data-valor="p" aria-pressed="${r.res === 'p'}">🟢 Prenha</button>
      <button class="chip" data-acao="g-res" data-valor="v" aria-pressed="${r.res === 'v'}">⚪ Vazia</button></div>
    ${r.res === 'p' ? `<label class="campo"><span>Dias de gestação (se o ultrassom disser)</span><input id="g-dias" inputmode="numeric" autocomplete="off"
      enterkeyhint="done" value="${esc(r.diasTxt || '')}" placeholder="${ia ? 'não precisa: a data da IATF já conta' : 'ex.: 45'}"></label>` : ''}
    <label class="campo"><span>Observação</span><input id="g-obs" autocomplete="off" enterkeyhint="done" value="${esc(r.obsTxt || '')}" placeholder="opcional (ex.: cisto, útero pequeno)"></label>
    <button class="btn" data-acao="g-add" ${r.res ? '' : 'disabled'}>${I.ok}${corrigindo ? 'Pronto · guardar a correção' : 'Pronto · próxima'}</button></div>`;
}

function dgPorNaLista(r) {
  const a = acharAnimal(r.num || '');
  const corrigindo = a && r.editando === a.id;
  if (!a || a.s !== 'F' || a.f !== r.f || (!corrigindo && (r.itens || []).some((x) => x.a === a.id)) || naFilaDG(a.id)) {
    avisar(a ? 'Essa vaca não pode entrar. Veja o aviso embaixo do número.' : 'Não achei esse número no rebanho.');
    return false;
  }
  if (r.res !== 'p' && r.res !== 'v') { avisar('Toque em Prenha ou Vazia.'); return false; }
  let dias = null;
  if (r.res === 'p' && (r.diasTxt || '').trim()) {
    dias = Math.round(lerNum(r.diasTxt));
    if (!dias || dias < 25 || dias > 290) { avisar('Dias de gestação fora do normal (de 25 a 290). Confere.'); return false; }
  }
  const ia = iaParaDG(a, r.data);
  const novo = { a: a.id, r: r.res, ...(dias ? { dias } : {}), ...((r.obsTxt || '').trim() ? { obs: r.obsTxt.trim() } : {}), ...(ia ? { sem: ia.sem } : {}) };
  r.itens = corrigindo ? r.itens.map((x) => (x.a === a.id ? novo : x)) : [...(r.itens || []), novo];
  r.num = ''; r.res = null; r.diasTxt = ''; r.obsTxt = ''; r.editando = null;
  return true;
}

MONTAR.dg = function (r) {
  const p = r.prot ? S.idx.prot.get(r.prot) : null;
  const itens = r.itens || [];
  const num = (id) => (S.idx.porId.get(id) || {}).n || '?';
  const pr = itens.filter((x) => x.r === 'p'), vz = itens.filter((x) => x.r === 'v');
  const titulo = p ? p.nome : 'fora do protocolo';
  const linhas = [`DG ${dt(r.data)} · ${titulo} · ${faz(r.f).codigo}`,
    `Prenhas: ${pr.length} de ${itens.length} (${pctDG(pr.length, itens.length)})`,
    pr.length ? `Prenhas: ${pr.map((x) => `${num(x.a)}${x.dias ? ` (${x.dias} dias)` : ''}`).join(', ')}` : null,
    vz.length ? `Vazias (${vz.length}): ${vz.map((x) => num(x.a)).join(', ')}` : null];
  const porSem = new Map();
  for (const x of itens) if (x.sem) { const s = porSem.get(x.sem) || { p: 0, t: 0 }; s.t++; if (x.r === 'p') s.p++; porSem.set(x.sem, s); }
  for (const [k, s] of porSem) linhas.push(`Sêmen ${k}: ${s.p} de ${s.t} prenhas (${pctDG(s.p, s.t)})`);
  for (const x of itens) if (x.obs) linhas.push(`${num(x.a)}: ${x.obs}`);
  const faltam = faltamDG(r);
  if (faltam.length) linhas.push(`Não passaram (${faltam.length}): ${faltam.map((a) => a.n).join(', ')}. Ficam sem DG.`);
  linhas.push('A situação de cada uma muda para prenha ou vazia.');
  return {
    dados: { data: r.data, prot: r.prot || null, itens: itens.map((x) => ({ a: x.a, r: x.r, ...(x.dias ? { dias: x.dias } : {}), ...(x.obs ? { obs: x.obs } : {}) })) },
    resumo: `DG ${dtc(r.data)}: ${titulo} · ${pr.length} prenhas de ${itens.length}`,
    linhas: linhas.filter(Boolean),
    total: `${itens.length} ${itens.length === 1 ? 'vaca' : 'vacas'} · ${pctDG(pr.length, itens.length)} de prenhez`,
  };
};

// ------------------------------------------------------------------ toques, digitação e Enter do DG
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="g-"]');
  if (!b || tipoAtual() !== 'dg') return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'g-prot') {
    const p = S.idx.prot.get(Number(v));
    if (!p) return;
    return mexer((r) => { Object.assign(r, { prot: p.id, f: p.f, itens: [], num: '', res: null, verFaltam: false }); window.scrollTo(0, 0); });
  }
  if (acao === 'g-faz') return mexer((r) => { Object.assign(r, { prot: null, f: Number(v), itens: [], num: '', res: null }); });
  if (acao === 'g-trocar') {
    const r = rasc('dg');
    if ((r.itens || []).length) {
      abrirJanela(`<h2>Trocar de protocolo?</h2><p>${r.itens.length} vaca(s) já passaram neste DG. Se trocar, essa lista é apagada do celular (nada foi enviado ainda).</p>
        <button class="btn perigo" data-acao="g-trocar-sim">Sim, trocar</button>`);
      return;
    }
  }
  if (acao === 'g-trocar' || acao === 'g-trocar-sim') { $('.fundo')?.remove(); return mexer((r) => { r.f = null; r.prot = null; r.itens = []; r.num = ''; r.res = null; r.editando = null; }); }
  if (acao === 'g-faltam') return mexer((r) => { r.verFaltam = !r.verFaltam; });
  if (acao === 'g-res') {
    mexer((r) => { r.res = v; if (v === 'v') r.diasTxt = ''; });
    return;
  }
  if (acao === 'g-add') {
    let ok = false;
    mexer((r) => { ok = dgPorNaLista(r); });
    if (ok) setTimeout(() => $('#g-num')?.focus(), 30);
    return;
  }
  if (acao === 'g-tirar' || acao === 'g-corrigir') {
    const a = S.idx.porId.get(Number(v));
    if (!a) return;
    abrirJanela(acao === 'g-tirar'
      ? `<h2>Tirar a ${esc(a.n)} da lista?</h2><p>Ela ainda não foi enviada. Se tirar, o diagnóstico dela sai do celular.</p>
        <button class="btn perigo" data-acao="g-tirar-sim" data-valor="${a.id}">Sim, tirar a ${esc(a.n)}</button>`
      : `<h2>Corrigir a ${esc(a.n)}?</h2><p>Ela continua na lista como está. Lá em cima você muda o que precisar e toca em <b>Pronto</b>: só então a correção vale.</p>
        <button class="btn" data-acao="g-corrigir-sim" data-valor="${a.id}">Sim, corrigir a ${esc(a.n)}</button>`, 'Não, manter como está');
    return;
  }
  if (acao === 'g-tirar-sim') {
    $('.fundo')?.remove();
    return mexer((r) => {
      r.itens = (r.itens || []).filter((x) => x.a !== Number(v));
      if (r.editando === Number(v)) { r.editando = null; r.num = ''; r.res = null; r.diasTxt = ''; r.obsTxt = ''; }
    });
  }
  if (acao === 'g-corrigir-sim') {
    $('.fundo')?.remove();
    mexer((r) => {
      const x = (r.itens || []).find((y) => y.a === Number(v));
      const a = S.idx.porId.get(Number(v));
      if (!x || !a) return;
      r.editando = a.id; r.num = a.n; r.res = x.r; r.diasTxt = x.dias ? String(x.dias) : ''; r.obsTxt = x.obs || '';
    });
    setTimeout(() => { $('#g-num')?.scrollIntoView({ block: 'center' }); }, 30);
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.id || !el.id.startsWith('g-') || tipoAtual() !== 'dg') return;
  mexer((r) => {
    if (el.id === 'g-num') { r.num = el.value; r.res = null; r.diasTxt = ''; }
    if (el.id === 'g-dias') r.diasTxt = el.value;
    if (el.id === 'g-obs') r.obsTxt = el.value;
  }, false);
  if (el.id === 'g-num') $('#g-cartao').innerHTML = cartaoDG(rasc('dg'));
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.id || !ev.target.id.startsWith('g-') || tipoAtual() !== 'dg') return;
  ev.preventDefault();
  if (ev.target.id === 'g-num') { ev.target.blur(); return; }   // depois do número, toca em Prenha ou Vazia
  const add = $('[data-acao="g-add"]');
  if (add && !add.disabled) add.click(); else ev.target.blur();
});
