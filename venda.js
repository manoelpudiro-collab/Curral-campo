// Curral Digital — venda de animais pelo app (app 2.13, migração 029). Só o dono; funciona sem internet como os outros
// lançamentos (vai para a fila e segue quando pegar sinal). Animais pelo número ou o lote inteiro, peso vivo total da
// carga, preço por @ (ou valor total), @ do romaneio se já tiver, descontos e comprador. @ = peso vivo ÷ 30 (regra do
// produtor). Animal em carência não deixa revisar; o banco também recusa (gatilho da 026). Usa mexer, rasc, cabForm,
// campoData, animalAchado, acharAnimal, animaisDoLote do lancar.js, lerReais do financeiro.js e carenciaDe do sanidade.js.
'use strict';

TIPOS_L.venda = { t: 'Venda de animais', ic: 'dinheiro' };
const FINALIDADES = [['abate', 'Frigorífico (abate)'], ['produtor', 'Outro produtor'], ['leilao', 'Leilão'], ['outro', 'Outro']];
const KG_ARROBA = 30;   // regra do produtor: 1 @ = 30 kg de peso vivo
const r2 = (v) => Math.round(v * 100) / 100;
const carVenda = (id) => (typeof carenciaDe === 'function' ? carenciaDe(id) : null);

// a conta, igual à do banco (app_lancar_venda): kg com 1 casa, @ com 2, valor com 2
function contaVenda(r) {
  const n = (r.itens || []).length;
  const kgv = lerReais(r.kgTxt);
  const kgT = kgv && kgv > 0 ? Math.round(kgv * 10) / 10 : null;
  const rom = lerReais(r.arrTxt);
  const arr = rom && rom > 0 ? r2(rom) : kgT ? r2(kgT / KG_ARROBA) : null;
  const modo = r.modo === 'total' ? 'total' : 'arroba';
  const rs = modo === 'arroba' ? lerReais(r.rsTxt) : null;
  const vt = modo === 'total' ? lerReais(r.valorTxt) : null;
  const bruto = arr && modo === 'arroba' && rs > 0 ? r2(arr * rs) : vt > 0 ? r2(vt) : null;
  const rsEf = modo === 'arroba' ? rs : bruto && arr ? r2(bruto / arr) : null;
  const desc = lerReais(r.descTxt) || 0;
  return { n, kg: kgT, media: kgT && n ? kgT / n : null, rom: !!(rom && rom > 0), arr, modo, rs: rsEf, bruto, desc, liq: bruto != null ? r2(bruto - desc) : null };
}
function emCarencia(r) { return (r.itens || []).map((id) => [id, carVenda(id)]).filter(([, c]) => c); }

// soma da última pesagem de quem está na lista (sugestão do peso total)
function pesoDaLista(ids) {
  let soma = 0, com = 0, velha = null;
  for (const id of ids) {
    const a = S.idx.porId.get(id); if (!a) continue;
    const ps = pesos(a), u = ps[ps.length - 1];
    if (u) { soma += u.p; com++; if (!velha || u.d < velha) velha = u.d; }
  }
  return { soma, com, velha };
}
function compradoresVistos(r) {
  const s = new Set();
  for (const evs of S.idx.eventos.values()) for (const e of evs) if (e.t === 'venda' && e.diag) s.add(String(e.diag).replace(/\s*\(.*\)\s*$/, ''));
  const l = r.lote ? S.idx.lotes.get(r.lote) : null;
  if (l && /\bJBS\b/i.test(l.nome)) s.add('JBS');
  return [...s].filter(Boolean).slice(0, 6);
}
function quemNaLista(ids) {
  const cats = {};
  for (const id of ids) { const a = S.idx.porId.get(id); if (a) cats[a.c] = (cats[a.c] || 0) + 1; }
  return Object.entries(cats).sort((x, y) => y[1] - x[1])
    .map(([c, k]) => `${k} ${(k === 1 ? NOME_CAT[c] || c : PLURAL_CAT[c] || c).toLowerCase()}`).join(', ');
}
function textoConta(r) {
  const c = contaVenda(r);
  if (!c.n) return 'Ponha os animais na lista.';
  if (!c.kg) return 'Falta o peso vivo total (kg).';
  const l = [`${numBR(c.arr, 2)} @ ${c.rom ? 'do romaneio' : `(${kg(c.kg)} ÷ ${KG_ARROBA})`} · média ${kg(Math.round(c.media))} por animal`];
  if (c.bruto != null) {
    l.push(`${c.modo === 'arroba' ? `${numBR(c.arr, 2)} @ × ${F.brl(c.rs)}` : `${F.brl(c.rs)} por @`} = ${F.brl(c.bruto)}`);
    if (c.desc > 0) l.push(`Descontos ${F.brl(c.desc)} · líquido ${F.brl(c.liq)}`);
  }
  if (c.media < 30 || c.media > 1200) l.push('⚠️ Peso médio fora do normal: confere o peso total.');
  return l.join('\n');
}

// lista grande (mais de 8) fica recolhida; quem está em carência aparece sempre
function listaVenda(ids) {
  return `<div class="lista">${ids.map((id) => { const a = S.idx.porId.get(id), c = carVenda(id);
    return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : '?')}</span>
      ${c ? `<span class="item-m aviso-t">⚠️ em carência de ${esc(c.prod || 'remédio')} até ${esc(dt(c.lib))}: não pode vender</span>` : `<span class="item-m">${esc(a ? resumo(a) : '')}</span>`}</span>
      <button class="link perigo-t" data-acao="l-rem-tirar" data-valor="${id}">tirar</button></div>`; }).join('')}</div>`;
}
FORMS.venda = function (r) {
  if (!r.modo) r.modo = 'arroba';
  if (!r.fin) r.fin = 'abate';
  const itens = r.itens || [];
  const lotes = S.dados.lotes.filter((l) => animaisDoLote(l.id).length);
  const achado = r.num ? acharAnimal(r.num) : null;
  const car = emCarencia(r);
  const pl = pesoDaLista(itens);
  const comps = compradoresVistos(r);
  return `${cabForm('venda')}${campoData(r)}
    <div class="campo"><span>Animais vendidos</span>
      <div class="pesar"><label class="campo"><span>Número</span><input id="r-num" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" value="${esc(r.num || '')}" placeholder="brinco"></label>
        <button class="btn sec" data-acao="l-rem-add">Pôr na lista</button></div>
      <div id="l-achado">${animalAchado(achado, !r.num)}</div>
      ${lotes.length ? `<p class="nota">ou o lote todo:</p><div class="chips quebra">${lotes.map((l) => `<button class="chip" data-acao="v-lote" data-valor="${l.id}">${esc(l.nome)} <small>${esc(faz(l.f).codigo)} · ${animaisDoLote(l.id).length}</small></button>`).join('')}</div>` : ''}</div>
    ${itens.length ? `<p class="nota"><b>${itens.length} ${itens.length === 1 ? 'animal' : 'animais'}</b> · ${esc(quemNaLista(itens))}
        <button class="link perigo-t" data-acao="v-limpar">tirar todos</button></p>
      ${itens.length <= 8 ? listaVenda(itens.slice().reverse())
        : `${car.length ? listaVenda(car.map(([id]) => id)) : ''}
          <button class="link" data-acao="v-ver">${r.verLista ? 'esconder a lista' : `ver a lista (${itens.length})`}</button>
          ${r.verLista ? listaVenda(itens.slice().reverse().filter((id) => !carVenda(id))) : ''}`}`
      : '<p class="vazio">Nenhum animal na lista ainda.</p>'}
    ${car.length ? `<p class="achado nao">⚠️ ${car.length === 1 ? 'Um animal está' : `${car.length} animais estão`} em carência. Tire da lista para poder vender.</p>` : ''}
    <label class="campo"><span>Peso vivo total (kg)</span><input id="v-kg" class="num-grande" inputmode="decimal" autocomplete="off" value="${esc(r.kgTxt || '')}" placeholder="kg da balança"></label>
    ${pl.com ? `<p class="nota">Última pesagem somada: ${esc(kg(pl.soma))} (${pl.com} de ${itens.length} com peso, ${esc(pl.com === 1 ? 'em' : 'a mais antiga em')} ${esc(dtc(pl.velha))})
      ${pl.com === itens.length ? '<button class="link" data-acao="v-usar-peso">usar</button>' : ''}</p>` : ''}
    <div class="campo"><span>Preço</span><div class="chips">
      <button class="chip" data-acao="v-modo" data-valor="arroba" aria-pressed="${r.modo === 'arroba'}">Por @</button>
      <button class="chip" data-acao="v-modo" data-valor="total" aria-pressed="${r.modo === 'total'}">Valor total</button></div></div>
    ${r.modo === 'arroba'
      ? `<label class="campo"><span>Preço da @ (R$)</span><input id="v-rs" inputmode="decimal" autocomplete="off" value="${esc(r.rsTxt || '')}" placeholder="0,00"></label>`
      : `<label class="campo"><span>Valor total da venda (R$)</span><input id="v-valor" inputmode="decimal" autocomplete="off" value="${esc(r.valorTxt || '')}" placeholder="0,00"></label>`}
    <label class="campo"><span>@ do romaneio (se já tiver; vazio = peso vivo ÷ ${KG_ARROBA})</span><input id="v-arr" inputmode="decimal" autocomplete="off" value="${esc(r.arrTxt || '')}" placeholder="—"></label>
    <label class="campo"><span>Descontos (R$: Funrural, frete, comissão; opcional)</span><input id="v-desc" inputmode="decimal" autocomplete="off" value="${esc(r.descTxt || '')}" placeholder="0,00"></label>
    <p class="nota conta-venda" id="v-conta">${esc(textoConta(r))}</p>
    <label class="campo"><span>Para quem vendeu</span><input id="v-comp" maxlength="60" autocomplete="off" value="${esc(r.comp || '')}" placeholder="comprador (ex.: frigorífico, vizinho)"></label>
    ${comps.length ? `<div class="chips">${comps.map((c) => `<button class="chip" data-acao="v-comp" data-valor="${esc(c)}" aria-pressed="${(r.comp || '').trim() === c}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="campo"><span>Para quê</span><div class="chips quebra">${FINALIDADES.map(([k, t]) => `<button class="chip" data-acao="v-fin" data-valor="${k}" aria-pressed="${r.fin === k}">${esc(t)}</button>`).join('')}</div></div>
    <label class="campo"><span>Observação</span><input id="l-obs" value="${esc(r.obs || '')}" placeholder="opcional (ex.: nota 123, caminhão do Zé)"></label>
    <button class="btn" data-acao="l-revisar" ${PRONTO.venda(r) ? '' : 'disabled'}>Revisar e confirmar</button>`;
};
PRONTO.venda = function (r) {
  const c = contaVenda(r);
  return !!(c.n && c.kg && c.media >= 30 && c.media <= 1200 && c.bruto > 0 && c.desc < c.bruto && (r.comp || '').trim().length >= 2 && !emCarencia(r).length);
};
MONTAR.venda = function (r) {
  const c = contaVenda(r);
  const ids = r.itens || [];
  const nums = ids.map((id) => (S.idx.porId.get(id) || {}).n).filter(Boolean);
  const fin = (FINALIDADES.find((x) => x[0] === r.fin) || FINALIDADES[0]);
  const comp = (r.comp || '').trim();
  const porF = {};
  for (const id of ids) { const a = S.idx.porId.get(id); if (a) porF[a.f] = (porF[a.f] || 0) + 1; }
  const fzs = Object.keys(porF);
  return {
    dados: { data: r.data, itens: ids, kg: c.kg, modo: c.modo, rs_arroba: c.modo === 'arroba' ? c.rs : null, valor: c.modo === 'total' ? c.bruto : null,
      arrobas: c.rom ? c.arr : null, descontos: c.desc || null, comprador: comp, finalidade: fin[0], obs: r.obs || null },
    resumo: `Venda ${dtc(r.data)}: ${c.n} ${c.n === 1 ? 'animal' : 'animais'} para ${comp}, ${F.brl(c.bruto)}`,
    linhas: [
      `${c.n} ${c.n === 1 ? 'animal' : 'animais'} (${quemNaLista(ids)}): ${nums.length <= 12 ? nums.join(', ') : `${nums.slice(0, 10).join(', ')} e mais ${nums.length - 10}`}`,
      `Peso vivo: ${kg(c.kg)} · média ${kg(Math.round(c.media))} por animal`,
      c.rom ? `@ do romaneio: ${numBR(c.arr, 2)}` : `@: ${numBR(c.arr, 2)} (peso vivo ÷ ${KG_ARROBA})`,
      `Preço: ${F.brl(c.rs)} por @${c.modo === 'total' ? ' (pelo valor total)' : ''}`,
      `Valor da venda: ${F.brl(c.bruto)}`,
      c.desc > 0 ? `Descontos: ${F.brl(c.desc)} · líquido ${F.brl(c.liq)}` : null,
      `Comprador: ${comp} · ${fin[1].toLowerCase()}`,
      fzs.length > 1 ? `Fazendas: ${fzs.map((f) => `${faz(Number(f)).codigo} ${porF[f]}`).join(' · ')} (o valor é dividido pelo peso de cada uma)` : `Fazenda: ${faz(Number(fzs[0])).codigo}`,
      `Data: ${dt(r.data)}`, r.obs ? `Obs.: ${r.obs}` : null,
      '⚠️ Os animais saem do rebanho como vendidos. A receita entra no Financeiro.'].filter(Boolean),
    total: `${c.n} ${c.n === 1 ? 'animal' : 'animais'} · ${kg(c.kg)} · ${numBR(c.arr, 2)} @ · ${F.brl(c.bruto)}`,
  };
};

// ------------------------------------------------------------------ toques e digitação (o resto é do lancar.js)
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="v-"]');
  if (!b || tipoAtual() !== 'venda') return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'v-lote') return mexer((r) => { r.lote = Number(v); r.itens = [...new Set([...(r.itens || []), ...animaisDoLote(Number(v)).map((a) => a.id)])]; });
  if (acao === 'v-limpar') return mexer((r) => { r.itens = []; r.lote = null; });
  if (acao === 'v-usar-peso') return mexer((r) => { r.kgTxt = numBR(pesoDaLista(r.itens || []).soma); });
  if (acao === 'v-ver') return mexer((r) => { r.verLista = !r.verLista; });
  if (acao === 'v-modo') return mexer((r) => { r.modo = v; });
  if (acao === 'v-fin') return mexer((r) => { r.fin = v; });
  if (acao === 'v-comp') return mexer((r) => { r.comp = v; });
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!/^v-/.test(el.id || '') || tipoAtual() !== 'venda') return;
  mexer((r) => {
    if (el.id === 'v-kg') r.kgTxt = el.value;
    if (el.id === 'v-rs') r.rsTxt = el.value;
    if (el.id === 'v-valor') r.valorTxt = el.value;
    if (el.id === 'v-arr') r.arrTxt = el.value;
    if (el.id === 'v-desc') r.descTxt = el.value;
    if (el.id === 'v-comp') r.comp = el.value;
  }, false);
  const r = rasc('venda');
  const c = $('#v-conta'); if (c) c.textContent = textoConta(r);
  const btn = $('[data-acao="l-revisar"]'); if (btn) btn.disabled = !PRONTO.venda(r);
});
