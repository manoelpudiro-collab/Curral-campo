// Curral Digital — D0 da IATF pelo app (app 2.16, migração 031; pedido do produtor em 27/11/2026, depois do plano v2).
// Pôr vaca ou novilha no protocolo pelo tronco, animal por animal, também sem internet:
//  • protocolo novo copiado de um que já existe (ex.: 2ª IATF das vazias do DG): mesmas etapas, produtos e dias (D0, D8, D10);
//  • ou pôr mais animais num protocolo que já começou (ex.: a vaca que ficou de fora no D0), até a véspera do D8.
// No tronco: número (animal novo é cadastrado na hora), o que tomou no D0, ECC, ultrassom (cheia fica fora da IATF),
// parida/solteira. No fim: resumo e "Confirmar". Usa mexer, rasc, cabForm, campoData, acharAnimal, lerNum e a fila do lancar.js,
// nomeEtapaC, ORDEM_ETAPA e avisoCopiaVelha do curral.js, normBrinco e lotesDaFaz do desmama.js.
'use strict';

TIPOS_L.d0 = { t: 'D0 da IATF', ic: 'repro' };
const D0_DG_DIAS = 60;          // "faltam" no protocolo novo = vazias no DG dos últimos 60 dias que não estão em protocolo
const ehMosca = (m) => /mosca/i.test(m.prod || '');
const ehVit = (m) => /vitamina/i.test(m.prod || '');
const chaveD0 = (x) => (x.a ? `a${x.a}` : `n${x.n}`);

// etapas com data de um protocolo, com o dia contado do D0 (pré-indução sem data fica de fora)
function etapasDatadas(p) {
  return S.dados.manejos.filter((m) => m.prot === p.id && m.prev && m.etapa !== 'dg' && m.st !== 'cancelado' && diasEntre(p.d0, m.prev) >= 0)
    .map((m) => ({ m, dia: diasEntre(p.d0, m.prev) }))
    .sort((x, y) => x.dia - y.dia || ORDEM_ETAPA.indexOf(x.m.etapa) - ORDEM_ETAPA.indexOf(y.m.etapa) || x.m.id - y.m.id);
}
const temD0eDepois = (et) => et.some((e) => e.dia === 0) && et.some((e) => e.dia > 0);
// protocolos que servem de modelo (os da fazenda primeiro, o mais novo antes)
function modelosD0(f) {
  return S.dados.protocolos.filter((p) => p.d0).map((p) => ({ p, et: etapasDatadas(p) })).filter((x) => temD0eDepois(x.et))
    .sort((x, y) => (y.p.f === f) - (x.p.f === f) || y.p.d0.localeCompare(x.p.d0) || y.p.id - x.p.id);
}
// protocolos da fazenda que ainda aceitam animal: D0 já chegou e a etapa seguinte (D8) ainda não
function abertosD0(f, data) {
  return S.dados.protocolos.filter((p) => p.f === f && p.d0 && data >= p.d0).map((p) => ({ p, et: etapasDatadas(p) }))
    .filter((x) => temD0eDepois(x.et) && x.et.filter((e) => e.dia > 0).every((e) => e.m.prev > data));
}
function nomeSugerido(p, data) {
  if (/^IATF\b/i.test(p.nome)) return `2ª ${p.nome}`;
  return `${p.nome} ${dtc(data)}`;
}
// a sessão: protocolo, etapas do D0 e as seguintes com a data de cada uma
function sessaoD0(r) {
  if (r.modo === 'aberto') {
    const p = S.idx.prot.get(r.prot);
    if (!p) return null;
    const et = etapasDatadas(p);
    return { novo: false, p, nome: p.nome, d0: p.d0,
      zero: et.filter((e) => e.dia === 0).map((e) => ({ id: e.m.id, m: e.m, dia: 0, prev: e.m.prev })),
      depois: et.filter((e) => e.dia > 0).map((e) => ({ id: e.m.id, m: e.m, dia: e.dia, prev: e.m.prev })) };
  }
  if (r.modo === 'novo') {
    const p = S.idx.prot.get(r.modelo);
    if (!p) return null;
    const et = etapasDatadas(p).filter((e) => (r.etapas || []).includes(e.m.id));
    const linha = (e) => ({ id: e.m.id, m: e.m, dia: e.dia, prev: somarDias(r.data, e.dia) });
    return { novo: true, modelo: p, nome: String(r.nome || '').trim(), d0: r.data,
      zero: et.filter((e) => e.dia === 0).map(linha), depois: et.filter((e) => e.dia > 0).map(linha) };
  }
  return null;
}
function proxTxt(s) {
  const dias = new Map();
  for (const e of s.depois) { if (!dias.has(e.prev)) dias.set(e.prev, []); dias.get(e.prev).push(e); }
  return [...dias.entries()].sort((x, y) => x[0].localeCompare(y[0]))
    .map(([d, l]) => `${l.some((e) => e.m.etapa === 'inseminacao') ? 'IATF' : `D${l[0].dia}`} em ${dtc(d)}`).join(' · ');
}
const naFilaD0 = (id) => fila().some((x) => x.tipo === 'd0' && ((x.dados || {}).itens || []).some((it) => it.a === id));
const numNaFilaD0 = (n) => fila().some((x) => x.tipo === 'd0' && ((x.dados || {}).itens || []).some((it) => it.n && it.n === n));
// onde o animal já está: neste protocolo, ou em outro com etapa prevista
function protDoAnimal(a, protId, data = hojeISO()) {
  const l = S.idx.aplic.get(a.id) || [];
  const ordem = (x) => `${(x.prev || '') >= data ? 0 : 1}${x.prev || ''}`;   // a próxima etapa prevista primeiro
  const neste = protId ? l.find((x) => x.m.prot === protId) || null : null;
  const outro = l.filter((x) => x.st === 'previsto' && x.m.prot && x.m.prot !== protId && x.m.st !== 'cancelado')
    .sort((x, y) => ordem(x).localeCompare(ordem(y)))[0] || null;
  return { neste, outro };
}
function ultimoEcc(a) {
  const l = (S.idx.eventos.get(a.id) || []).filter((e) => typeof e.ecc === 'number').sort((x, y) => x.d.localeCompare(y.d));
  return l[l.length - 1] || null;
}
function ultimoDG(a, data) {
  const l = (S.idx.eventos.get(a.id) || []).filter((e) => e.t === 'diagnostico_gestacao' && e.dg && e.d <= data).sort((x, y) => x.d.localeCompare(y.d));
  return l[l.length - 1] || null;
}
// "faltam" do protocolo novo: vazias no último DG (até 60 dias) que não estão em protocolo nenhum
function vaziasDoDG(r) {
  const passou = new Set((r.itens || []).filter((x) => x.a).map((x) => x.a));
  return S.dados.animais.filter((a) => a.st === 'ativo' && a.f === r.f && a.s === 'F' && ['matriz', 'novilha'].includes(a.c)
    && !passou.has(a.id) && !naFilaD0(a.id)).filter((a) => {
    const u = ultimoDG(a, r.data);
    return u && u.dg === 'negativo' && diasEntre(u.d, r.data) <= D0_DG_DIAS && !protDoAnimal(a, null, r.data).outro;
  }).sort((x, y) => x.n.localeCompare(y.n, 'pt-BR', { numeric: true }));
}
const itemD0 = (r, k) => (r.itens || []).find((x) => chaveD0(x) === k) || null;
const padraoD0 = (s, us) => (us === 'cheia' ? s.zero.filter((e) => ehMosca(e.m)).map((e) => e.id) : s.zero.map((e) => e.id));
const nomeLoteD0 = (r) => (typeof r.lote === 'number' ? `lote ${(S.idx.lotes.get(r.lote) || {}).nome || '?'}` : 'ficam no lote de hoje');

// o que o número digitado quer dizer
function resolverD0(r, s) {
  const t = String(r.num || '').trim();
  if (!t) return {};
  const a = acharAnimal(t);
  if (!a) {
    const nb = normBrinco(t);
    if (!/^[0-9A-Z-]{1,14}$/.test(nb)) return { erro: 'Número com letra estranha. Confere.' };
    const outro = S.dados.animais.find((x) => x._kz === semZeros(chaveNum(nb)));
    if (outro) return { erro: `O número ${nb} é de um animal que não está mais no rebanho (${(NOME_CAT[outro.c] || outro.c || '').toLowerCase()}, ${(NOME_ST[outro.st] || outro.st || '').toLowerCase()}). Confere o brinco.` };
    const k = `n${nb}`;
    if (itemD0(r, k) && r.editando !== k) return { jaPassou: k, nome: nb };
    if (numNaFilaD0(nb)) return { erro: `A ${nb} já foi lançada num D0 que está esperando envio.` };
    return { novo: nb, k };
  }
  if (a.f !== r.f) return { erro: `A ${a.n} é da ${faz(a.f).codigo}. Este D0 é da ${faz(r.f).codigo}.` };
  if (a.s !== 'F' || !['matriz', 'novilha', 'descarte'].includes(a.c)) return { erro: `O ${a.n} não é vaca nem novilha (${(NOME_CAT[a.c] || a.c || '').toLowerCase()}).` };
  const k = `a${a.id}`;
  if (itemD0(r, k) && r.editando !== k) return { jaPassou: k, nome: a.n };
  if (naFilaD0(a.id)) return { erro: `A ${a.n} já foi lançada num D0 que está esperando envio.` };
  const pr = protDoAnimal(a, s.novo ? null : s.p.id, r.data);
  if (pr.neste) return { erro: `A ${a.n} já está neste protocolo. Para marcar o que ela tomou, use o Modo Curral.` };
  if (pr.outro) {
    const p = S.idx.prot.get(pr.outro.m.prot);
    return { erro: `A ${a.n} já está no protocolo ${p ? p.nome : '?'} (etapa prevista em ${dtc(pr.outro.prev)}). Para tirar de lá, fale com o Claude.` };
  }
  return { a, k };
}
function avisosD0(a, it, s) {
  const l = [];
  if (a && a.sr === 'prenha' && it.us !== 'cheia') l.push('está prenha no sistema');
  if (a && a.c === 'descarte') l.push('está como descarte');
  const impl = s.zero.filter((e) => e.m.etapa === 'implante').map((e) => e.id);
  if (it.us !== 'cheia' && impl.length && !impl.some((id) => it.m.includes(id))) l.push('sem implante');
  if (typeof it.ecc === 'number' && it.ecc < 2) l.push(`ECC ${numBR(it.ecc, 2)} (baixo)`);
  return l.join(' · ');
}

FORMS.d0 = function (r) {
  if (!r.ok) return comecoD0(r);
  const s = sessaoD0(r);
  if (!s) return `${cabForm('d0')}<p class="achado nao">O protocolo desta sessão não está mais na cópia do celular.</p>
    <button class="btn sec" data-acao="z-trocar">Escolher de novo</button>`;
  const itens = r.itens || [];
  const faltam = s.novo ? vaziasDoDG(r) : [];
  const nomes = new Map(s.zero.map((e) => [e.id, nomeEtapaC(e.m)]));
  return `${cabForm('d0')}
    <div class="bloco curral-cab"><div><p class="curral-t">D0 · ${esc(s.nome)}</p>
      <p class="curral-s">${esc(faz(r.f).codigo)} · ${s.novo ? 'protocolo novo · ' : ''}D0 ${esc(dtc(s.d0))}${s.novo ? '' : ` · lançando em ${esc(dtc(r.data))}`} · ${esc(proxTxt(s))}</p>
      <p class="curral-s">${esc(nomeLoteD0(r))}</p></div>
      <button class="link" data-acao="z-trocar">trocar</button></div>
    ${avisoCopiaVelha()}
    <div class="curral-conta"><span><b>${itens.length}</b> ${itens.length === 1 ? 'passou' : 'passaram'}</span>
      ${s.novo ? `<span>vazias do DG faltando <b>${faltam.length}</b>${faltam.length ? ` <button class="link" data-acao="z-faltam">${r.verFaltam ? 'esconder' : 'ver'}</button>` : ''}</span>` : ''}</div>
    ${r.verFaltam && faltam.length ? `<p class="nota">${esc(faltam.map((a) => a.n).join(', '))}</p>` : ''}
    <label class="campo"><span>Número do animal</span><input id="z-num" class="num-grande" inputmode="numeric" autocomplete="off" autocapitalize="characters"
      spellcheck="false" enterkeyhint="next" value="${esc(r.num || '')}" placeholder="brinco"></label>
    <div id="z-cartao">${cartaoD0(r, s)}</div>
    ${itens.length ? `<div class="bloco"><h2 class="h2">${I.ok}Passaram (${itens.length})</h2><div class="lista">${itens.slice().reverse().map((x) => {
      const a = x.a ? S.idx.porId.get(x.a) : null, k = chaveD0(x);
      const fora = s.zero.filter((e) => !x.m.includes(e.id) && !ehVit(e.m) && !(x.us === 'cheia')).map((e) => nomes.get(e.id));
      return `<div class="item item-fixo"><span><span class="item-t">${esc(a ? a.n : x.n)}${a ? '' : ` · nova (${x.cat === 'novilha' ? 'novilha' : `vaca ${x.sr || ''}`.trim()})`} · ${x.m.length} de ${s.zero.length} etapas${typeof x.ecc === 'number' ? ` · ECC ${esc(numBR(x.ecc, 2))}` : ''}</span>
        <span class="item-m${x.aviso || fora.length ? ' aviso-t' : ''}">${esc([x.us === 'cheia' ? 'cheia · fora da IATF' : x.us === 'vazia' ? 'vazia no ultrassom' : null,
          x.sr && a ? `passa a ${x.sr}` : null, fora.length ? `⚠️ não tomou: ${fora.join(', ')}` : null, x.aviso ? `⚠️ ${x.aviso}` : null, x.obs].filter(Boolean).join(' · ') || (a ? resumo(a) : ''))}</span></span>
        ${r.editando === k ? '<span class="acoes-item"><b class="aviso-t">✏️ corrigindo</b></span>'
          : `<span class="acoes-item"><button class="link" data-acao="z-corrigir" data-valor="${esc(k)}">corrigir</button>
        <button class="link perigo-t" data-acao="z-tirar" data-valor="${esc(k)}">tirar</button></span>`}</div>`; }).join('')}</div></div>` : ''}
    <button class="btn" data-acao="l-revisar" ${itens.length ? '' : 'disabled'}>Terminar e revisar</button>`;
};

function comecoD0(r) {
  const fz = S.dados.fazendas || [];
  let corpo = '';
  if (r.f) {
    const ab = abertosD0(r.f, r.data);
    const mods = modelosD0(r.f);
    const lts = lotesDaFaz(r.f);
    corpo += `<div class="campo"><span>Protocolo</span><div class="opcoes">
      ${ab.map((x) => {
        const s = sessaoD0({ modo: 'aberto', prot: x.p.id });
        const n = new Set(S.dados.aplicacoes.filter((y) => s.zero.some((e) => e.id === y[0])).map((y) => y[1])).size;
        return `<button class="opcao" data-acao="z-prot" data-valor="${x.p.id}" aria-pressed="${r.modo === 'aberto' && r.prot === x.p.id}">
          <b>Pôr mais animais: ${esc(x.p.nome)}</b><small>D0 ${esc(dtc(x.p.d0))} · ${esc(proxTxt(s))} · ${n} ${n === 1 ? 'animal' : 'animais'}</small></button>`; }).join('')}
      <button class="opcao" data-acao="z-novo" aria-pressed="${r.modo === 'novo'}"><b>Protocolo novo</b>
        <small>copia as etapas, produtos e dias de um protocolo que já existe (ex.: 2ª IATF das vazias); o D0 é a data acima</small></button></div></div>`;
    if (r.modo === 'novo') {
      const mod = mods.find((x) => x.p.id === r.modelo);
      corpo += `<div class="campo"><span>Copiar de</span><div class="opcoes">${mods.map((x) => `<button class="opcao" data-acao="z-modelo" data-valor="${x.p.id}" aria-pressed="${r.modelo === x.p.id}">
          <b>${esc(x.p.nome)}</b><small>${esc(faz(x.p.f).codigo)} · D0 ${esc(dt(x.p.d0))} · ${x.et.length} etapas</small></button>`).join('') || '<p class="vazio">Nenhum protocolo com D0 e D8 para copiar.</p>'}</div></div>`;
      if (mod) {
        const s = sessaoD0(r);
        corpo += `<label class="campo"><span>Nome do protocolo novo</span><input id="z-nome" autocomplete="off" enterkeyhint="done" value="${esc(r.nome || '')}"></label>
          <div class="campo"><span>Etapas (toque para tirar a que não vai fazer)</span><div class="chips quebra">
          ${mod.et.map((e) => `<button class="chip" data-acao="z-netapa" data-valor="${e.m.id}" aria-pressed="${(r.etapas || []).includes(e.m.id)}">D${e.dia} · ${esc(nomeEtapaC(e.m))}${e.m.dose ? ` ${esc(e.m.dose)}` : ''}</button>`).join('')}</div>
          <p class="nota">${s.zero.length ? `D0 em ${esc(dtc(r.data))}` : '⚠️ Sem etapa no D0'} · ${s.depois.length ? esc(proxTxt(s)) : '⚠️ sem etapa depois do D0'}</p></div>`;
      }
    }
    corpo += `<div class="campo"><span>Lote dos animais</span><div class="opcoes">
      ${lts.map((l) => `<button class="opcao" data-acao="z-lote" data-valor="${l.id}" aria-pressed="${r.lote === l.id}"><b>Lote ${esc(l.nome)}</b><small>${animaisDoLote(l.id).length} cabeças hoje</small></button>`).join('')}
      <button class="opcao" data-acao="z-lote" data-valor="nenhum" aria-pressed="${r.lote === 'nenhum'}"><b>Não mudar de lote</b><small>cada animal fica onde está</small></button></div></div>`;
  }
  return `${cabForm('d0')}
    <p class="nota">D0 no tronco: digite o número de cada vaca ou novilha, marque o que ela tomou, o ECC e o ultrassom. Animal que não está no cadastro é cadastrado na hora. Funciona sem internet.</p>
    ${campoData(r)}
    <div class="campo"><span>Fazenda</span><div class="chips">${fz.map((f) => `<button class="chip" data-acao="z-faz" data-valor="${f.id}" aria-pressed="${r.f === f.id}">${esc(f.codigo)}</button>`).join('')}</div></div>
    ${corpo}
    <button class="btn" data-acao="z-comecar" ${prontoComecoD0(r) ? '' : 'disabled'}>${I.curral}Começar o D0</button>`;
}
function prontoComecoD0(r) {
  if (!r.f || !(typeof r.lote === 'number' || r.lote === 'nenhum')) return false;
  if (r.modo === 'aberto') return abertosD0(r.f, r.data).some((x) => x.p.id === r.prot);
  if (r.modo !== 'novo') return false;
  const s = sessaoD0(r);
  return !!(s && s.nome && s.zero.length && s.depois.length);
}

// o cartão do animal digitado (redesenhado a cada número, sem fechar o teclado)
function cartaoD0(r, s) {
  if (!String(r.num || '').trim()) return '<p class="achado">Digite o número e toque em <b>Pronto</b>. Os que já passaram ficam na lista abaixo.</p>';
  const x = resolverD0(r, s);
  if (x.erro) return `<p class="achado nao">${esc(x.erro)}</p>`;
  if (x.jaPassou) return `<p class="achado aviso-t">A ${esc(x.nome)} já passou neste D0. <button class="link" data-acao="z-corrigir" data-valor="${esc(x.jaPassou)}">corrigir</button></p>`;
  const a = x.a || null;
  const corrigindo = r.editando === x.k && itemD0(r, x.k);
  const sel = r.sel || padraoD0(s, r.us);
  const cat = a ? a.c : r.cat;
  const ecc = a ? ultimoEcc(a) : null;
  const dg = a ? ultimoDG(a, r.data) : null;
  const srAtual = a ? a.sr : null;
  const srSel = r.srSel || (srAtual === 'parida' || srAtual === 'solteira' ? srAtual : '');
  const fora = s.zero.filter((e) => !sel.includes(e.id));
  return `<div class="bloco curral-animal">
    ${corrigindo ? `<p class="achado aviso-t">✏️ Corrigindo a ${esc(a ? a.n : x.novo)}. Mude o que precisar e toque em <b>Pronto</b>. Se desistir, ela continua na lista como estava.</p>` : ''}
    ${a ? `<p class="achado sim"><b>${esc(a.n)}</b> · ${esc(resumo(a))}${ecc ? ` · último ECC ${esc(numBR(ecc.ecc, 2))} em ${esc(dtc(ecc.d))}` : ''}${dg ? ` · DG ${dg.dg === 'positivo' ? 'prenha' : 'vazia'} em ${esc(dtc(dg.d))}` : ''}</p>`
      : `<p class="achado aviso-t">A <b>${esc(x.novo)}</b> não está no cadastro. Ela é cadastrada agora na ${esc(faz(r.f).codigo)}.</p>
        <div class="chips"><button class="chip" data-acao="z-cat" data-valor="matriz" aria-pressed="${r.cat === 'matriz'}">Vaca</button>
        <button class="chip" data-acao="z-cat" data-valor="novilha" aria-pressed="${r.cat === 'novilha'}">Novilha</button></div>`}
    ${a && a.sr === 'prenha' ? '<p class="nota aviso-t">⚠️ Está prenha no sistema. Se o ultrassom deu cheia, marque Cheia: ela fica fora da IATF.</p>' : ''}
    ${a && a.c === 'descarte' ? '<p class="nota aviso-t">⚠️ Está como descarte no cadastro.</p>' : ''}
    <div class="campo"><span>Tomou no D0</span><div class="chips quebra">${s.zero.map((e) => `<button class="chip cetapa" data-acao="z-etapa" data-valor="${e.id}" aria-pressed="${sel.includes(e.id)}">${esc(nomeEtapaC(e.m))}</button>`).join('')}</div>
      <p class="nota">${fora.length ? `Não tomou: ${esc(fora.map((e) => nomeEtapaC(e.m)).join(', '))}.` : 'Tomou tudo. Toque no que ela não tomou (ex.: vitamina).'}</p></div>
    <div class="campo"><span>Ultrassom</span><div class="chips">
      <button class="chip" data-acao="z-us" data-valor="" aria-pressed="${!r.us}">Não fez</button>
      <button class="chip" data-acao="z-us" data-valor="vazia" aria-pressed="${r.us === 'vazia'}">Vazia</button>
      <button class="chip" data-acao="z-us" data-valor="cheia" aria-pressed="${r.us === 'cheia'}">Cheia (prenhe)</button></div>
      ${r.us === 'cheia' ? '<p class="nota aviso-t">Cheia fica fora da IATF: não entra no D8 nem na inseminação. Só vale o que está marcado acima (ex.: brinco de mosca).</p>' : ''}</div>
    ${cat === 'matriz' && r.us !== 'cheia' ? `<div class="campo"><span>Situação${a ? '' : ' (obrigatório)'}</span><div class="chips">
      <button class="chip" data-acao="z-sr" data-valor="parida" aria-pressed="${srSel === 'parida'}">Parida (bezerro ao pé)</button>
      <button class="chip" data-acao="z-sr" data-valor="solteira" aria-pressed="${srSel === 'solteira'}">Solteira</button></div></div>` : ''}
    <label class="campo"><span>ECC (1 a 5)</span><input id="z-ecc" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(r.eccTxt || '')}" placeholder="ex.: 3 ou 2,5 (opcional)"></label>
    <label class="campo"><span>Observação</span><input id="z-obs" autocomplete="off" enterkeyhint="done" value="${esc(r.obsTxt || '')}" placeholder="opcional"></label>
    <button class="btn" data-acao="z-add">${I.ok}${corrigindo ? 'Pronto · guardar a correção' : 'Pronto · próximo'}</button></div>`;
}

function d0PorNaLista(r) {
  const s = sessaoD0(r);
  if (!s) return false;
  const x = resolverD0(r, s);
  if (x.erro || x.jaPassou || (!x.a && !x.novo)) { avisar(x.erro || (x.jaPassou ? 'Esse já passou. Toque em corrigir.' : 'Digite o número.')); return false; }
  const zero = new Set(s.zero.map((e) => e.id));
  const sel = (r.sel || padraoD0(s, r.us)).filter((id) => zero.has(id));
  if (!sel.length && r.us !== 'cheia') { avisar('Marque o que ela tomou no D0.'); return false; }
  let ecc = null;
  if (String(r.eccTxt || '').trim()) {
    ecc = lerNum(r.eccTxt);
    if (ecc === null || ecc < 1 || ecc > 5) { avisar('ECC vai de 1 a 5 (ex.: 3 ou 2,5).'); return false; }
    ecc = Math.round(ecc * 4) / 4;
  }
  const cat = x.a ? x.a.c : r.cat;
  if (x.novo && !['matriz', 'novilha'].includes(r.cat)) { avisar('Animal novo: toque em Vaca ou Novilha.'); return false; }
  const srAtual = x.a ? x.a.sr : null;
  const srSel = r.srSel || '';
  if (x.novo && cat === 'matriz' && r.us !== 'cheia' && !srSel) { avisar('Vaca nova: toque em Parida ou Solteira.'); return false; }
  const sr = cat === 'matriz' && r.us !== 'cheia' && srSel && srSel !== srAtual ? srSel : null;
  const obs = String(r.obsTxt || '').trim().slice(0, 200);
  const novo = { ...(x.a ? { a: x.a.id } : { n: x.novo, cat: r.cat }), m: sel, ...(sr ? { sr } : {}), ...(ecc !== null ? { ecc } : {}),
    ...(r.us ? { us: r.us } : {}), ...(obs ? { obs } : {}) };
  const aviso = avisosD0(x.a, novo, s);
  if (aviso) novo.aviso = aviso;
  const k = chaveD0(novo);
  const corrigindo = r.editando === k && itemD0(r, k);
  r.itens = corrigindo ? r.itens.map((y) => (chaveD0(y) === k ? novo : y)) : [...(r.itens || []), novo];
  limparCartaoD0(r);
  return true;
}
function limparCartaoD0(r) { r.num = ''; r.sel = null; r.us = ''; r.eccTxt = ''; r.obsTxt = ''; r.srSel = ''; r.cat = ''; r.editando = null; }

MONTAR.d0 = function (r) {
  const s = sessaoD0(r);
  const itens = r.itens || [];
  const n = itens.length;
  const numD0 = (x) => (x.a ? (S.idx.porId.get(x.a) || {}).n || '?' : x.n);
  const catD0 = (x) => (x.a ? (S.idx.porId.get(x.a) || {}).c : x.cat);
  const nov = itens.filter((x) => catD0(x) === 'novilha').length, vac = n - nov;
  const novos = itens.filter((x) => !x.a), cheias = itens.filter((x) => x.us === 'cheia'), vazias = itens.filter((x) => x.us === 'vazia');
  const eccs = itens.filter((x) => typeof x.ecc === 'number');
  const srs = itens.filter((x) => x.a && x.sr);
  const faltam = s.novo ? vaziasDoDG(r) : [];
  const lista = (l) => l.map(numD0).sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true })).join(', ');
  const linhas = [
    `D0 · ${faz(r.f).codigo} · ${dt(r.data)}`,
    s.novo ? `Protocolo novo: ${s.nome} (copiado de ${s.modelo.nome})` : `Protocolo: ${s.nome} (D0 ${dtc(s.d0)})`,
    `Próximas etapas: ${proxTxt(s)}${cheias.length ? ' (menos as cheias)' : ''}`,
    `${n} ${n === 1 ? 'animal' : 'animais'}${vac && nov ? ` (${vac} ${vac === 1 ? 'vaca' : 'vacas'}, ${nov} ${nov === 1 ? 'novilha' : 'novilhas'})` : ''}`,
    ...s.zero.map((e) => { const c = itens.filter((x) => x.m.includes(e.id)).length; return `${nomeEtapaC(e.m)}: ${c} de ${n}`; }),
    novos.length ? `Cadastradas agora (${novos.length}): ${novos.map((x) => `${x.n} (${x.cat === 'novilha' ? 'novilha' : `vaca${x.us === 'cheia' ? ' prenha' : x.sr ? ` ${x.sr}` : ''}`})`).join(', ')}` : null,
    cheias.length ? `Cheias, fora da IATF (${cheias.length}): ${lista(cheias)}` : null,
    vazias.length ? `Vazias no ultrassom: ${vazias.length}` : null,
    eccs.length ? `ECC: ${eccs.length} ${eccs.length === 1 ? 'animal' : 'animais'}, média ${numBR(eccs.reduce((t, x) => t + x.ecc, 0) / eccs.length, 2)}` : null,
    srs.length ? `Situação muda: ${srs.map((x) => `${numD0(x)} → ${x.sr}`).join(', ')}` : null,
    `Lote: ${typeof r.lote === 'number' ? `vão para o ${nomeLoteD0(r)}` : 'cada animal fica onde está'}`,
    ...itens.filter((x) => x.aviso).map((x) => `${numD0(x)}: ⚠️ ${x.aviso}`),
    faltam.length ? `Vazias do DG que não passaram (${faltam.length}): ${faltam.map((a) => a.n).join(', ')}` : null,
  ].filter(Boolean);
  const impl = s.zero.find((e) => e.m.etapa === 'implante');
  const cImpl = impl ? itens.filter((x) => x.m.includes(impl.id)).length : null;
  return {
    dados: { data: r.data, f: r.f, ...(s.novo ? { novo: { nome: s.nome, modelo: s.modelo.id, etapas: [...s.zero, ...s.depois].map((e) => e.id) } } : { prot: s.p.id }),
      ...(typeof r.lote === 'number' ? { lote: r.lote } : {}),
      itens: itens.map((x) => { const y = { ...x }; delete y.aviso; return y; }) },
    resumo: `D0 ${dtc(r.data)} (${faz(r.f).codigo}) · ${s.nome}: ${n} ${n === 1 ? 'animal' : 'animais'}`,
    linhas,
    total: `${n} ${n === 1 ? 'animal' : 'animais'}${cImpl !== null ? ` · ${cImpl} com implante` : ''}${novos.length ? ` · ${novos.length} ${novos.length === 1 ? 'nova' : 'novas'} no cadastro` : ''}`,
  };
};

// ------------------------------------------------------------------ toques, digitação e Enter do D0
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="z-"]');
  if (!b || tipoAtual() !== 'd0') return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'z-faz') return mexer((r) => { r.f = Number(v); r.modo = null; r.prot = null; r.modelo = null; r.etapas = []; r.nome = ''; r.lote = null; });
  if (acao === 'z-prot') return mexer((r) => {
    r.modo = 'aberto'; r.prot = Number(v);
    const s = sessaoD0(r);
    const ls = [...new Set(s.zero.map((e) => e.m.lote).filter(Boolean))];
    r.lote = ls.length === 1 && S.idx.lotes.get(ls[0]) ? ls[0] : 'nenhum';
  });
  if (acao === 'z-novo') return mexer((r) => {
    r.modo = 'novo';
    if (!r.modelo) { const m = modelosD0(r.f)[0]; if (m) { r.modelo = m.p.id; r.etapas = m.et.map((e) => e.m.id); r.nome = nomeSugerido(m.p, r.data); } }
    if (typeof r.lote !== 'number') r.lote = 'nenhum';
  });
  if (acao === 'z-modelo') return mexer((r) => {
    const m = modelosD0(r.f).find((x) => x.p.id === Number(v));
    if (!m) return;
    r.modelo = m.p.id; r.etapas = m.et.map((e) => e.m.id); r.nome = nomeSugerido(m.p, r.data);
  });
  if (acao === 'z-netapa') return mexer((r) => { const id = Number(v); r.etapas = (r.etapas || []).includes(id) ? r.etapas.filter((x) => x !== id) : [...(r.etapas || []), id]; });
  if (acao === 'z-lote') return mexer((r) => { r.lote = v === 'nenhum' ? 'nenhum' : Number(v); });
  if (acao === 'z-comecar') {
    const r0 = rasc('d0');
    if (r0.modo === 'novo' && S.dados.protocolos.some((p) => p.f === r0.f && p.nome.trim().toLowerCase() === String(r0.nome || '').trim().toLowerCase())) {
      avisar('Já existe um protocolo com esse nome nesta fazenda. Mude o nome (ex.: com o mês).');
      return;
    }
    return mexer((r) => { r.ok = true; r.itens = r.itens || []; limparCartaoD0(r); window.scrollTo(0, 0); });
  }
  if (acao === 'z-trocar') {
    const r = rasc('d0');
    if ((r.itens || []).length) {
      abrirJanela(`<h2>Trocar o protocolo?</h2><p>${r.itens.length} animal(is) já passaram neste D0. Se trocar, essa lista é apagada do celular (nada foi enviado ainda).</p>
        <button class="btn perigo" data-acao="z-trocar-sim">Sim, trocar</button>`, 'Não, continuar');
      return;
    }
  }
  if (acao === 'z-trocar' || acao === 'z-trocar-sim') { $('.fundo')?.remove(); return mexer((r) => { r.ok = false; r.itens = []; limparCartaoD0(r); }); }
  if (acao === 'z-faltam') return mexer((r) => { r.verFaltam = !r.verFaltam; });
  if (acao === 'z-cat') return mexer((r) => { r.cat = v; if (v === 'novilha') r.srSel = ''; });
  if (acao === 'z-sr') return mexer((r) => { r.srSel = r.srSel === v ? '' : v; });
  if (acao === 'z-us') return mexer((r) => {   // marcas das etapas só mudam quando entra ou sai de "cheia"
    if (v === 'cheia' || r.us === 'cheia') r.sel = null;
    r.us = v;
  });
  if (acao === 'z-etapa') return mexer((r) => {
    const s = sessaoD0(r);
    const id = Number(v), sel = r.sel || padraoD0(s, r.us);
    r.sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  });
  if (acao === 'z-add') {
    let ok = false;
    mexer((r) => { ok = d0PorNaLista(r); });
    if (ok) setTimeout(() => $('#z-num')?.focus(), 30);
    return;
  }
  // trava igual à do modo Curral: "tirar" e "corrigir" só depois de confirmar
  if (acao === 'z-tirar' || acao === 'z-corrigir') {
    const x = itemD0(rasc('d0'), v);
    if (!x) return;
    const nm = x.a ? (S.idx.porId.get(x.a) || {}).n || '?' : x.n;
    abrirJanela(acao === 'z-tirar'
      ? `<h2>Tirar a ${esc(nm)} da lista?</h2><p>Ela ainda não foi enviada. Se tirar, o que foi marcado para ela sai do celular.</p>
        <button class="btn perigo" data-acao="z-tirar-sim" data-valor="${esc(v)}">Sim, tirar a ${esc(nm)}</button>`
      : `<h2>Corrigir a ${esc(nm)}?</h2><p>Ela continua na lista como está. Lá em cima você muda o que precisar e toca em <b>Pronto</b>: só então a correção vale.</p>
        <button class="btn" data-acao="z-corrigir-sim" data-valor="${esc(v)}">Sim, corrigir a ${esc(nm)}</button>`, 'Não, manter como está');
    return;
  }
  if (acao === 'z-tirar-sim') {
    $('.fundo')?.remove();
    return mexer((r) => { r.itens = (r.itens || []).filter((x) => chaveD0(x) !== v); if (r.editando === v) limparCartaoD0(r); });
  }
  if (acao === 'z-corrigir-sim') {
    $('.fundo')?.remove();
    mexer((r) => {
      const x = itemD0(r, v);
      if (!x) return;
      limparCartaoD0(r);
      r.editando = v;
      r.num = x.a ? (S.idx.porId.get(x.a) || {}).n || '' : x.n;
      r.sel = x.m.slice(); r.us = x.us || ''; r.eccTxt = typeof x.ecc === 'number' ? String(x.ecc).replace('.', ',') : '';
      r.obsTxt = x.obs || ''; r.srSel = x.sr || ''; r.cat = x.cat || '';
    });
    setTimeout(() => { $('#z-num')?.scrollIntoView({ block: 'center' }); }, 30);
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.id || !el.id.startsWith('z-') || tipoAtual() !== 'd0') return;
  mexer((r) => {
    if (el.id === 'z-num') { r.num = el.value; r.sel = null; r.us = ''; r.srSel = ''; r.cat = ''; r.eccTxt = ''; r.obsTxt = ''; }
    if (el.id === 'z-ecc') r.eccTxt = el.value;
    if (el.id === 'z-obs') r.obsTxt = el.value;
    if (el.id === 'z-nome') r.nome = el.value;
  }, false);
  const r = rasc('d0');
  if (el.id === 'z-num') { const s = sessaoD0(r); if (s) $('#z-cartao').innerHTML = cartaoD0(r, s); }
  if (el.id === 'z-nome') { const btn = $('[data-acao="z-comecar"]'); if (btn) btn.disabled = !prontoComecoD0(r); }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.id || !ev.target.id.startsWith('z-') || tipoAtual() !== 'd0') return;
  ev.preventDefault();
  if (ev.target.id === 'z-nome') { ev.target.blur(); return; }
  if (ev.target.id === 'z-num' && $('#z-ecc')) { $('#z-ecc').focus(); return; }
  const add = $('[data-acao="z-add"]');
  if (add) add.click(); else avisar((rasc('d0').num || '') ? 'Veja o aviso embaixo do número.' : 'Digite o número do animal.');
});
