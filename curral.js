// Curral Digital — modo Curral (etapa 2B do plano do app): a sessão do tronco.
// Escolhe o manejo do dia (ex.: D8 da IATF das novilhas), passa animal por animal pelo número, marca o que foi feito em
// cada um (e o peso, se pesar junto) e no fim mostra o resumo para o "Confirmar". Funciona sem internet: a sessão inteira
// fica guardada no celular (rascunho) e vai para o sistema como um lançamento só, quando pegar sinal.
// Animal fora do protocolo não entra (pôr no protocolo é pela conversa com o Claude). Diagnóstico de gestação fica de fora.
'use strict';

const ORDEM_ETAPA = ['inducao', 'implante', 'retirada_implante', 'cipionato', 'prostaglandina', 'eCG', 'aplicacao', 'inseminacao', 'repasse', 'outro'];
const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const nomeEtapaC = (m) => (m.etapa === 'aplicacao' && m.prod ? capital(m.prod) : NOME_ETAPA[m.etapa] || m.etapa);

// etapas previstas juntas: mesmo protocolo (ou lote), mesma fazenda, mesmo dia previsto
function gruposCurral() {
  const h = hojeISO();
  const grupos = new Map();
  for (const m of S.dados.manejos) {
    if (m.st !== 'previsto' || !m.prev || m.etapa === 'dg') continue;
    const k = `${m.prot ? `p${m.prot}` : m.lote ? `l${m.lote}` : `m${m.id}`}|${m.f}|${m.prev}`;
    if (!grupos.has(k)) grupos.set(k, { k, f: m.f, prot: m.prot || null, lote: m.lote || null, prev: m.prev, mjs: [] });
    grupos.get(k).mjs.push(m);
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.mjs.sort((x, y) => ORDEM_ETAPA.indexOf(x.etapa) - ORDEM_ETAPA.indexOf(y.etapa) || x.id - y.id);
    const ids = new Set(g.mjs.map((m) => m.id));
    const todos = new Set(), pend = new Set();
    for (const r of S.dados.aplicacoes) if (ids.has(r[0])) { todos.add(r[1]); if (r[2] === 'previsto') pend.add(r[1]); }
    g.n = todos.size; g.pend = pend.size;
    g.dist = Math.abs(diasEntre(h, g.prev));
  }
  return lista.sort((a, b) => a.dist - b.dist || a.prev.localeCompare(b.prev));
}
function tituloGrupo(g) {
  const p = g.prot ? S.idx.prot.get(g.prot) : null;
  const l = g.lote ? S.idx.lotes.get(g.lote) : null;
  const d = p ? diaProt(p, g.prev) : null;
  return `${d !== null ? `${rotuloDia(d)} · ` : ''}${p ? p.nome : l ? `lote ${l.nome}` : 'Manejo'}`;
}

// como cada etapa da sessão está para este animal: previsto / aplicado / nao_aplicado / (sem linha)
function linhasDo(a, r) {
  const st = new Map();
  for (const x of S.idx.aplic.get(a.id) || []) if (r.mjs.includes(x.m.id)) st.set(x.m.id, x.st);
  return st;
}
function noProtocolo(a, r) {
  return (S.idx.aplic.get(a.id) || []).some((x) => r.mjs.includes(x.m.id) || (r.prot && x.m.prot === r.prot));
}
const padraoDo = (a, r) => { const st = linhasDo(a, r); return r.on.filter((id) => st.get(id) === 'previsto'); };
function naFila(id, r) {
  return fila().some((x) => x.tipo === 'curral' && (x.dados.manejos || []).some((m) => r.on.includes(m)) && (x.dados.itens || []).some((it) => it.a === id));
}
// quem ainda tem etapa prevista nesta sessão e não passou
function faltamCurral(r) {
  const passou = new Set((r.itens || []).map((x) => x.a));
  const ids = new Set();
  for (const x of S.dados.aplicacoes) if (r.on.includes(x[0]) && x[2] === 'previsto') ids.add(x[1]);
  return [...ids].filter((id) => !passou.has(id) && !naFila(id, r)).map((id) => S.idx.porId.get(id))
    .filter((a) => a && a.st === 'ativo').sort((a, b) => a.n.localeCompare(b.n, 'pt-BR', { numeric: true }));
}

FORMS.curral = function (r) {
  if (!r.mjs) {
    const gs = gruposCurral();
    const perto = gs.filter((g) => g.dist <= 15), longe = gs.filter((g) => g.dist > 15);
    const item = (g) => `<button class="opcao" data-acao="c-grupo" data-valor="${esc(g.k)}" ${g.pend ? '' : 'disabled'}>
        <b>${esc(tituloGrupo(g))}</b>
        <small>${esc(faz(g.f).codigo)} · ${esc(dt(g.prev))} (${esc(relativo(g.prev))})</small>
        <small>${esc(g.mjs.map(nomeEtapaC).join(', '))}</small>
        <small>${g.pend ? `${g.pend} ${g.pend === 1 ? 'animal' : 'animais'} por fazer` : 'nenhum animal no protocolo ainda: o D0 é pela conversa com o Claude'}</small></button>`;
    return `${cabForm('curral')}
      <p class="nota">Escolha o manejo. Depois é só digitar o número de cada animal que passar no tronco. Funciona sem internet.</p>
      ${perto.length ? `<div class="opcoes">${perto.map(item).join('')}</div>` : '<p class="vazio">Nenhum manejo previsto para estes dias.</p>'}
      ${longe.length ? `<details class="tempo-mais"><summary>Outros manejos previstos (${longe.length})</summary><div class="opcoes">${longe.map(item).join('')}</div></details>` : ''}`;
  }
  const mjs = r.mjs.map((id) => S.idx.manejos.get(id)).filter(Boolean);
  const itens = r.itens || [];
  const faltam = faltamCurral(r);
  const g = { prot: r.prot, lote: r.lote, prev: r.prev, f: r.f };
  const longe = r.prev && Math.abs(diasEntre(r.prev, r.data)) > 2;
  const nomes = new Map(mjs.map((m) => [m.id, nomeEtapaC(m)]));
  return `${cabForm('curral')}
    <div class="bloco curral-cab"><div><p class="curral-t">${esc(tituloGrupo(g))}</p>
      <p class="curral-s">${esc(faz(r.f).codigo)} · previsto para ${esc(dt(r.prev))}</p></div>
      <button class="link" data-acao="c-trocar">trocar</button></div>
    ${campoData(r)}
    ${longe ? `<p class="achado aviso-t">⚠️ Previsto para ${esc(dtc(r.prev))}; você está lançando em ${esc(dtc(r.data))}. Confere a data.</p>` : ''}
    <div class="campo"><span>Etapas desta sessão${itens.length ? ' (travadas: já tem animal na lista)' : ''}</span><div class="chips quebra">
      ${mjs.map((m) => `<button class="chip" data-acao="c-sessao" data-valor="${m.id}" aria-pressed="${r.on.includes(m.id)}" ${itens.length ? 'disabled' : ''}>${esc(nomes.get(m.id))}</button>`).join('')}
      <button class="chip" data-acao="c-pesar" aria-pressed="${!!r.pesar}">${I.balanca}Pesar também</button></div></div>
    <div class="curral-conta"><span><b>${itens.length}</b> ${itens.length === 1 ? 'passou' : 'passaram'}</span>
      <span>faltam <b>${faltam.length}</b>${faltam.length ? ` <button class="link" data-acao="c-faltam">${r.verFaltam ? 'esconder' : 'ver'}</button>` : ''}</span></div>
    ${r.verFaltam && faltam.length ? `<p class="nota">${esc(faltam.map((a) => a.n).join(', '))}</p>` : ''}
    <label class="campo"><span>Número do animal</span><input id="c-num" class="num-grande" inputmode="numeric" autocomplete="off" autocapitalize="characters"
      spellcheck="false" enterkeyhint="${r.pesar ? 'next' : 'done'}" value="${esc(r.num || '')}" placeholder="brinco"></label>
    <div id="c-cartao">${cartaoCurral(r)}</div>
    ${itens.length ? `<div class="bloco"><h2 class="h2">${I.ok}Passaram (${itens.length})</h2><div class="lista">${itens.slice().reverse().map((x) => {
      const a = S.idx.porId.get(x.a);
      const nao = (x.n || []).map((id) => nomes.get(id)).filter(Boolean);
      return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : '?')} · ${x.m.length} de ${r.on.length} etapas${x.kg ? ` · ${esc(kg(x.kg))}` : ''}</span>
        <span class="item-m${nao.length || x.aviso ? ' aviso-t' : ''}">${esc([nao.length ? `⚠️ não fez: ${nao.join(', ')}` : null, x.aviso ? `⚠️ ${x.aviso}` : null, x.obs].filter(Boolean).join(' · ') || (a ? resumo(a) : ''))}</span></span>
        <span class="acoes-item"><button class="link" data-acao="c-corrigir" data-valor="${x.a}">corrigir</button>
        <button class="link perigo-t" data-acao="c-tirar" data-valor="${x.a}">tirar</button></span></div>`; }).join('')}</div></div>` : ''}
    <button class="btn" data-acao="l-revisar" ${itens.length ? '' : 'disabled'}>Terminar e revisar</button>`;
};

// o cartão do animal que acabou de ser digitado (redesenhado a cada número, sem fechar o teclado)
function cartaoCurral(r) {
  if (!r.num) return '<p class="achado">Digite o número e toque em <b>Pronto</b>. Os que já passaram ficam na lista abaixo.</p>';
  const a = acharAnimal(r.num);
  if (!a) return '<p class="achado nao">Não achei esse número no rebanho.</p>';
  if (a.f !== r.f) return `<p class="achado nao">A ${esc(a.n)} é da ${esc(faz(a.f).codigo)}. Este manejo é da ${esc(faz(r.f).codigo)}.</p>`;
  if ((r.itens || []).some((x) => x.a === a.id)) {
    return `<p class="achado aviso-t">A ${esc(a.n)} já passou nesta sessão. <button class="link" data-acao="c-corrigir" data-valor="${a.id}">corrigir</button></p>`;
  }
  if (naFila(a.id, r)) return `<p class="achado aviso-t">A ${esc(a.n)} já foi lançada numa sessão que está esperando envio.</p>`;
  if (!noProtocolo(a, r)) return `<p class="achado nao">A ${esc(a.n)} não está neste protocolo. Pôr no protocolo é pela conversa com o Claude.</p>`;
  const st = linhasDo(a, r);
  const abertas = r.on.filter((id) => st.get(id) !== 'aplicado');
  if (!abertas.length && !r.pesar) return `<p class="achado aviso-t">A ${esc(a.n)} já tem essas etapas lançadas.</p>`;
  const sel = r.sel && r.sel.a === a.id ? r.sel.m : padraoDo(a, r);
  const chips = r.on.map((id) => {
    const m = S.idx.manejos.get(id);
    const s = st.get(id);
    if (s === 'aplicado') return `<span class="chip feita">✓ ${esc(nomeEtapaC(m))} · já lançada</span>`;
    const extra = !s ? ' · não estava marcada' : s === 'nao_aplicado' ? ' · não feita antes' : '';
    return `<button class="chip cetapa" data-acao="c-etapa" data-valor="${id}" aria-pressed="${sel.includes(id)}">${esc(nomeEtapaC(m))}${esc(extra)}</button>`;
  }).join('');
  const nSel = sel.filter((id) => abertas.includes(id)).length;
  return `<div class="bloco curral-animal">
    <p class="achado sim"><b>${esc(a.n)}</b> · ${esc(resumo(a))}</p>
    <div class="chips quebra">${chips}</div>
    <p class="nota">${nSel === abertas.length ? 'Todas as etapas feitas. Se alguma não foi feita, toque nela para desmarcar.' : `⚠️ ${abertas.length - nSel} etapa(s) desmarcada(s): vai como não feita.`}</p>
    ${r.pesar ? `<label class="campo"><span>Peso (kg)</span><input id="c-kg" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(r.kgTxt || '')}" placeholder="kg"></label>` : ''}
    <label class="campo"><span>Observação</span><input id="c-obs" autocomplete="off" enterkeyhint="done" value="${esc(r.obsTxt || '')}" placeholder="opcional (ex.: perdeu o implante)"></label>
    <button class="btn" data-acao="c-add">${I.ok}Pronto · próximo</button></div>`;
}

MONTAR.curral = function (r) {
  const mjs = r.on.map((id) => S.idx.manejos.get(id)).filter(Boolean);
  const itens = (r.itens || []).map((x) => ({ ...x, m: x.m.filter((id) => r.on.includes(id)), n: (x.n || []).filter((id) => r.on.includes(id)) }));
  const titulo = tituloGrupo({ prot: r.prot, lote: r.lote, prev: r.prev });
  const num = (id) => (S.idx.porId.get(id) || {}).n || '?';
  const linhas = [`${titulo} · ${faz(r.f).codigo} · ${dt(r.data)}`];
  for (const m of mjs) {
    const c = itens.filter((x) => x.m.includes(m.id)).length;
    linhas.push(`${nomeEtapaC(m)}: ${c} ${c === 1 ? 'animal' : 'animais'}`);
  }
  for (const x of itens) {
    const nao = x.n.map((id) => nomeEtapaC(S.idx.manejos.get(id)));
    if (nao.length || x.obs) linhas.push(`${num(x.a)}: ${[nao.length ? `não fez ${nao.join(', ')}` : null, x.obs].filter(Boolean).join(' · ')}`);
  }
  const pes = itens.filter((x) => x.kg);
  if (pes.length) {
    const soma = pes.reduce((t, x) => t + x.kg, 0);
    linhas.push(`Pesados: ${pes.length} · média ${kg(Math.round(soma / pes.length))}`);
    for (const x of pes) if (x.aviso) linhas.push(`${num(x.a)}: ${kg(x.kg)} ⚠️ ${x.aviso}`);
  }
  const faltam = faltamCurral(r);
  if (faltam.length) linhas.push(`Não passaram (${faltam.length}): ${faltam.map((a) => a.n).join(', ')}. Ficam como previstas.`);
  if (r.prev && Math.abs(diasEntre(r.prev, r.data)) > 2) linhas.push(`⚠️ Previsto para ${dtc(r.prev)}, lançado em ${dtc(r.data)}.`);
  return {
    dados: { data: r.data, manejos: r.on, itens: itens.map((x) => ({ a: x.a, m: x.m, n: x.n, ...(x.kg ? { kg: x.kg } : {}), ...(x.obs ? { obs: x.obs } : {}) })) },
    resumo: `Curral ${dtc(r.data)}: ${titulo} · ${itens.length} ${itens.length === 1 ? 'animal' : 'animais'}`,
    linhas,
    total: `${itens.length} ${itens.length === 1 ? 'animal passou' : 'animais passaram'}${faltam.length ? ` · ${faltam.length} não passaram` : ''}`,
  };
};

// ------------------------------------------------------------------ toques, digitação e Enter do modo Curral
function curralPorNaLista(r) {
  const a = acharAnimal(r.num || '');
  if (!a || a.f !== r.f || (r.itens || []).some((x) => x.a === a.id) || naFila(a.id, r) || !noProtocolo(a, r)) {
    avisar(a ? 'Esse animal não pode entrar. Veja o aviso embaixo do número.' : 'Não achei esse número no rebanho.');
    return false;
  }
  const st = linhasDo(a, r);
  const sel = r.sel && r.sel.a === a.id ? r.sel.m : padraoDo(a, r);
  const m = sel.filter((id) => r.on.includes(id) && st.get(id) !== 'aplicado');
  const n = r.on.filter((id) => st.get(id) === 'previsto' && !sel.includes(id));
  let pkg = null;
  if (r.pesar && (r.kgTxt || '').trim()) {
    pkg = lerNum(r.kgTxt);
    if (pkg === null || pkg < 10 || pkg > 1500) { avisar('Peso fora do normal. Confere.'); return false; }
    pkg = Math.round(pkg * 10) / 10;
  }
  if (!m.length && !n.length && !pkg) { avisar('Nada para lançar nesse animal.'); return false; }
  r.itens = [...(r.itens || []), { a: a.id, m, n, ...(pkg ? { kg: pkg, aviso: avisoPeso(a, pkg, r.data) } : {}), ...((r.obsTxt || '').trim() ? { obs: r.obsTxt.trim() } : {}) }];
  r.num = ''; r.kgTxt = ''; r.obsTxt = ''; r.sel = null;
  return true;
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="c-"]');
  if (!b || tipoAtual() !== 'curral') return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'c-grupo') {
    const g = gruposCurral().find((x) => x.k === v);
    if (!g) return;
    return mexer((r) => {
      Object.assign(r, { g: g.k, f: g.f, prot: g.prot, lote: g.lote, prev: g.prev, mjs: g.mjs.map((m) => m.id), on: g.mjs.map((m) => m.id),
        itens: [], num: '', sel: null, kgTxt: '', obsTxt: '', verFaltam: false });
      if (Math.abs(diasEntre(g.prev, hojeISO())) <= 2 && g.prev <= hojeISO()) r.data = g.prev;
      window.scrollTo(0, 0);
    });
  }
  if (acao === 'c-trocar') {
    const r = rasc('curral');
    if ((r.itens || []).length) {
      abrirJanela(`<h2>Trocar de manejo?</h2><p>${r.itens.length} animal(is) já passaram nesta sessão. Se trocar, essa lista é apagada do celular (nada foi enviado ainda).</p>
        <button class="btn perigo" data-acao="c-trocar-sim">Sim, trocar</button>`);
      return;
    }
  }
  if (acao === 'c-trocar' || acao === 'c-trocar-sim') { $('.fundo')?.remove(); return mexer((r) => { r.mjs = null; r.itens = []; r.num = ''; r.sel = null; }); }
  if (acao === 'c-sessao') return mexer((r) => {
    if ((r.itens || []).length) return;
    const id = Number(v);
    r.on = r.on.includes(id) ? r.on.filter((x) => x !== id) : r.mjs.filter((x) => x === id || r.on.includes(x));
    if (!r.on.length) { r.on = [id]; avisar('A sessão precisa de pelo menos uma etapa.'); }
    r.sel = null;
  });
  if (acao === 'c-pesar') return mexer((r) => { r.pesar = !r.pesar; });
  if (acao === 'c-faltam') return mexer((r) => { r.verFaltam = !r.verFaltam; });
  if (acao === 'c-etapa') return mexer((r) => {
    const a = acharAnimal(r.num || '');
    if (!a) return;
    const id = Number(v);
    const sel = r.sel && r.sel.a === a.id ? r.sel.m : padraoDo(a, r);
    r.sel = { a: a.id, m: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] };
  });
  if (acao === 'c-add') {
    let ok = false;
    mexer((r) => { ok = curralPorNaLista(r); });
    if (ok) setTimeout(() => $('#c-num')?.focus(), 30);
    return;
  }
  if (acao === 'c-tirar') return mexer((r) => { r.itens = (r.itens || []).filter((x) => x.a !== Number(v)); });
  if (acao === 'c-corrigir') {
    mexer((r) => {
      const x = (r.itens || []).find((y) => y.a === Number(v));
      const a = S.idx.porId.get(Number(v));
      if (!x || !a) return;
      r.itens = r.itens.filter((y) => y !== x);
      // volta para o cartão com o que estava marcado (as não feitas ficam desmarcadas)
      r.num = a.n; r.sel = { a: a.id, m: x.m }; r.kgTxt = x.kg ? String(x.kg).replace('.', ',') : ''; r.obsTxt = x.obs || '';
      if (x.kg) r.pesar = true;
    });
    setTimeout(() => { $('#c-num')?.scrollIntoView({ block: 'center' }); }, 30);
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.id || !el.id.startsWith('c-') || tipoAtual() !== 'curral') return;
  mexer((r) => {
    if (el.id === 'c-num') { r.num = el.value; r.sel = null; }
    if (el.id === 'c-kg') r.kgTxt = el.value;
    if (el.id === 'c-obs') r.obsTxt = el.value;
  }, false);
  if (el.id === 'c-num') $('#c-cartao').innerHTML = cartaoCurral(rasc('curral'));
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.id || !ev.target.id.startsWith('c-') || tipoAtual() !== 'curral') return;
  ev.preventDefault();
  const r = rasc('curral');
  if (ev.target.id === 'c-num' && r.pesar && $('#c-kg')) { $('#c-kg').focus(); return; }
  const add = $('[data-acao="c-add"]');
  if (add) add.click(); else avisar(r.num ? 'Esse animal não pode entrar. Veja o aviso embaixo do número.' : 'Digite o número do animal.');
});
