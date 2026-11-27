// Curral Digital — desmama no Modo Curral (app 2.15, migração 030; pedido do produtor em 27/11/2026, depois do plano v2).
// Começo: escolhe a fazenda e para onde vão os bezerros (um lote que já existe, um lote novo ou ficam onde estão).
// No tronco: digita o número da mãe (ou do bezerro), o app acha a cria; pesa e, se o bezerro ganhou brinco no dia,
// digita o brinco novo. Bezerro sem mãe no sistema (os da 3C): escolhe qual é a cria da vaca e ela fica ligada.
// No fim: resumo (machos × fêmeas, vacas que passam a solteira, brincos novos, quem não passou) e "Confirmar".
// Funciona sem internet como os outros lançamentos (rascunho no celular, fila, Desfazer). Usa mexer, rasc, cabForm,
// campoData, acharAnimal, avisoPeso, lerNum, fila do lancar.js e pesos, resumo, idade, faz do app.js.
'use strict';

TIPOS_L.desmama = { t: 'Desmama', ic: 'bezerro' };
const DESM_MIN = 180;    // "faltam" = bezerros de 6 meses para cima ainda não desmamados
const DESM_CEDO = 150;   // menos que isso: avisa "desmama cedo?"
const ehBezerro = (a) => !!a && (a.c === 'bezerro' || a.c === 'bezerra');
const ehVaca = (a) => !!a && a.s === 'F' && ['matriz', 'novilha', 'descarte'].includes(a.c);
const desmamadoEm = (a) => { const p = pesos(a).find((x) => x.dm); return p ? p.d : null; };
const idadeDias = (a, data) => (a && a.nasc ? diasEntre(a.nasc, data) : null);
const naFilaDesm = (id) => fila().some((x) => x.tipo === 'desmama' && ((x.dados || {}).itens || []).some((it) => it.a === id));
const itemDe = (r, id) => (r.itens || []).find((x) => x.a === id) || null;
const numDe = (id) => (S.idx.porId.get(id) || {}).n || '?';
const normBrinco = (t) => { const s = String(t || '').toUpperCase().replace(/\s/g, ''); return /^\d{1,4}$/.test(s) ? s.padStart(4, '0') : s; };
const lotesDaFaz = (f) => (S.dados.lotes || []).filter((l) => l.f === f).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
const loteComNome = (f, nome) => lotesDaFaz(f).find((l) => l.nome.trim().toLowerCase() === String(nome || '').trim().toLowerCase()) || null;
function destinoTxt(r) {
  if (typeof r.destino === 'number') { const l = S.idx.lotes.get(r.destino); return l ? `lote ${l.nome}` : 'lote ?'; }
  if (r.destino === 'novo') { const l = loteComNome(r.f, r.lnome); return l ? `lote ${l.nome}` : `lote novo ${String(r.lnome || '').trim()}`; }
  return 'ficam no lote de hoje';
}

// crias da vaca que ainda podem ser desmamadas (tira as que já passaram nesta sessão, menos a que está sendo corrigida)
function criasDe(v, r) {
  return (S.idx.filhos.get(v.id) || []).filter((b) => b.st === 'ativo' && ehBezerro(b) && !desmamadoEm(b) && (!itemDe(r, b.id) || r.editando === b.id));
}
// bezerros sem mãe no sistema (os da 3C): para escolher qual é a cria da vaca que está no tronco
function semMae(r) {
  return S.dados.animais.filter((b) => b.st === 'ativo' && ehBezerro(b) && b.f === r.f && !b.mae && !desmamadoEm(b) && !naFilaDesm(b.id)
    && (!itemDe(r, b.id) || r.editando === b.id) && (!r.sx || b.s === r.sx))
    .sort((x, y) => (x.nasc || '').localeCompare(y.nasc || '') || x.n.localeCompare(y.n, 'pt-BR', { numeric: true }));
}
// quem ainda não passou: bezerros de 6 meses para cima (ou sem data de nascimento) ainda não desmamados
function faltamDesm(r) {
  return S.dados.animais.filter((b) => b.st === 'ativo' && ehBezerro(b) && b.f === r.f && !desmamadoEm(b) && !itemDe(r, b.id) && !naFilaDesm(b.id)
    && (idadeDias(b, r.data) === null || idadeDias(b, r.data) >= DESM_MIN))
    .sort((x, y) => (x.nasc || '').localeCompare(y.nasc || '') || x.n.localeCompare(y.n, 'pt-BR', { numeric: true }));
}
const nomeFalta = (b) => { const m = b.mae ? S.idx.porId.get(b.mae) : null; return m ? `${b.n} (mãe ${m.n})` : b.n; };

// o que o número digitado quer dizer: o bezerro (com a mãe), uma lista para escolher, ou um aviso
function resolverDesm(r) {
  if (!(r.num || '').trim()) return {};
  const a = acharAnimal(r.num);
  if (!a) return { erro: 'Não achei esse número no rebanho. Se o bezerro ganhou brinco hoje, digite o número da mãe.' };
  if (a.f !== r.f) return { erro: `A ${a.n} é da ${faz(a.f).codigo}. Esta desmama é da ${faz(r.f).codigo}.` };
  let b = null, v = null, ligar = false;
  if (ehBezerro(a)) {
    b = a; v = a.mae ? S.idx.porId.get(a.mae) : null;
    const it = itemDe(r, b.id);
    if (!v && it && it.mae) { v = S.idx.porId.get(it.mae); ligar = true; }
  } else if (ehVaca(a)) {
    v = a;
    const ja = (r.itens || []).find((x) => x.m === a.id && r.editando !== x.a);
    const crias = criasDe(a, r);
    if (r.esc && r.esc.v === a.id) b = S.idx.porId.get(r.esc.b) || null;
    else if (crias.length === 1) b = crias[0];
    else if (crias.length > 1) return { v, escolher: crias };
    if (!b && ja) return { jaPassou: ja.a };
    if (!b) {
      const velha = (S.idx.filhos.get(a.id) || []).filter((x) => ehBezerro(x) && desmamadoEm(x))[0];
      const l = semMae(r);
      if (!l.length && !r.sx) return { erro: velha ? `A cria da ${a.n} (${velha.n}) já foi desmamada em ${dtc(desmamadoEm(velha))}.` : `A ${a.n} não tem cria para desmamar no sistema.` };
      return { v, semMae: l, velha };
    }
    ligar = !b.mae;
  } else {
    return { erro: `A ${a.n} não é vaca nem bezerro (${NOME_CAT[a.c] || a.c}).` };
  }
  const dm = desmamadoEm(b);
  if (dm) return { erro: `O ${b.n} já foi desmamado em ${dtc(dm)}.` };
  if (itemDe(r, b.id) && r.editando !== b.id) return { jaPassou: b.id };
  if (naFilaDesm(b.id)) return { erro: `O ${b.n} já foi lançado numa desmama que está esperando envio.` };
  return { b, v, ligar };
}
function brincoTomado(br, bId, r) {
  const k = semZeros(chaveNum(br));
  if (!k) return null;
  const outro = S.dados.animais.find((a) => a.id !== bId && a._kz === k);
  if (outro) return `O brinco ${br} já é de outro animal: ${outro.n} (${(NOME_CAT[outro.c] || outro.c || '').toLowerCase()}${outro.st !== 'ativo' ? `, ${outro.st}` : ''}).`;
  const x = (r.itens || []).find((y) => y.a !== bId && y.br && semZeros(chaveNum(y.br)) === k);
  return x ? `O brinco ${br} já foi posto no ${numDe(x.a)} nesta desmama.` : null;
}
const avisoCedo = (b, data) => { const d = idadeDias(b, data); return d !== null && d < DESM_CEDO ? `só ${idade(b.nasc)} de idade: desmama cedo? Confere` : ''; };

FORMS.desmama = function (r) {
  if (!r.ok) {
    const fz = S.dados.fazendas || [];
    const lts = r.f ? lotesDaFaz(r.f) : [];
    const todos = r.f ? S.dados.animais.filter((b) => b.st === 'ativo' && ehBezerro(b) && b.f === r.f && !desmamadoEm(b)) : [];
    const prontos = r.f ? faltamDesm(r).length : 0;
    const existe = r.destino === 'novo' ? loteComNome(r.f, r.lnome) : null;
    const pronto = r.f && (typeof r.destino === 'number' || r.destino === 'nenhum' || (r.destino === 'novo' && (r.lnome || '').trim()));
    return `${cabForm('desmama')}
      <p class="nota">Desmama (apartação) no tronco: digite o número da <b>mãe</b> (ou do bezerro), pese e, se o bezerro ganhou brinco hoje, digite o brinco novo. A vaca parida passa a solteira. Funciona sem internet.</p>
      <div class="campo"><span>Fazenda</span><div class="chips">${fz.map((f) => `<button class="chip" data-acao="d-faz" data-valor="${f.id}" aria-pressed="${r.f === f.id}">${esc(f.codigo)}</button>`).join('')}</div></div>
      ${r.f ? `<p class="nota">${todos.length} ${todos.length === 1 ? 'bezerro' : 'bezerros'} na ${esc(faz(r.f).codigo)} ainda com a mãe · <b>${prontos}</b> com 6 meses ou mais.</p>
      <div class="campo"><span>Para onde vão os bezerros desmamados</span><div class="opcoes">
        ${lts.map((l) => `<button class="opcao" data-acao="d-destino" data-valor="${l.id}" aria-pressed="${r.destino === l.id}"><b>Lote ${esc(l.nome)}</b><small>${animaisDoLote(l.id).length} cabeças hoje</small></button>`).join('')}
        <button class="opcao" data-acao="d-destino" data-valor="novo" aria-pressed="${r.destino === 'novo'}"><b>Lote novo</b><small>o sistema cria o lote na hora de gravar</small></button>
        <button class="opcao" data-acao="d-destino" data-valor="nenhum" aria-pressed="${r.destino === 'nenhum'}"><b>Ficam no lote de hoje</b><small>só pesa, não muda de lote</small></button></div></div>
      ${r.destino === 'novo' ? `<label class="campo"><span>Nome do lote novo</span><input id="d-lnome" autocomplete="off" enterkeyhint="done" value="${esc(r.lnome || '')}" placeholder="ex.: desmama ${esc(r.data.slice(0, 4))}"></label>
        ${existe ? `<p class="nota">Já existe o lote ${esc(existe.nome)}: os bezerros vão para ele.</p>` : ''}` : ''}` : ''}
      <button class="btn" data-acao="d-comecar" ${pronto ? '' : 'disabled'}>${I.curral}Começar a desmama</button>`;
  }
  const itens = r.itens || [];
  const faltam = faltamDesm(r);
  const soma = itens.reduce((t, x) => t + x.kg, 0);
  return `${cabForm('desmama')}
    <div class="bloco curral-cab"><div><p class="curral-t">Desmama · ${esc(faz(r.f).codigo)}</p>
      <p class="curral-s">${esc(destinoTxt(r))}</p></div>
      <button class="link" data-acao="d-trocar">trocar</button></div>
    ${avisoCopiaVelha()}
    ${campoData(r)}
    <div class="curral-conta"><span><b>${itens.length}</b> ${itens.length === 1 ? 'passou' : 'passaram'}${itens.length ? ` · média ${esc(kg(Math.round(soma / itens.length)))}` : ''}</span>
      <span>faltam <b>${faltam.length}</b>${faltam.length ? ` <button class="link" data-acao="d-faltam">${r.verFaltam ? 'esconder' : 'ver'}</button>` : ''}</span></div>
    ${r.verFaltam && faltam.length ? `<p class="nota">De 6 meses para cima: ${esc(faltam.map(nomeFalta).join(', '))}</p>` : ''}
    <label class="campo"><span>Número da mãe (ou do bezerro)</span><input id="d-num" class="num-grande" inputmode="numeric" autocomplete="off" autocapitalize="characters"
      spellcheck="false" enterkeyhint="next" value="${esc(r.num || '')}" placeholder="brinco"></label>
    <div id="d-cartao">${cartaoDesm(r)}</div>
    ${itens.length ? `<div class="bloco"><h2 class="h2">${I.ok}Passaram (${itens.length})</h2><div class="lista">${itens.slice().reverse().map((x) => {
      const b = S.idx.porId.get(x.a);
      const m = x.m ? S.idx.porId.get(x.m) : null;
      return `<div class="item item-fixo"><span><span class="item-t">${esc(b ? b.n : '?')}${x.br ? ` → ${esc(x.br)}` : ''} · ${esc(kg(x.kg))}</span>
        <span class="item-m${x.aviso ? ' aviso-t' : ''}">${esc([b ? (NOME_CAT[b.c] || b.c) : null, m ? `${x.mae ? 'fica cria da' : 'mãe'} ${m.n}` : 'sem mãe', x.aviso ? `⚠️ ${x.aviso}` : null].filter(Boolean).join(' · '))}</span></span>
        ${r.editando === x.a ? '<span class="acoes-item"><b class="aviso-t">✏️ corrigindo</b></span>'
          : `<span class="acoes-item"><button class="link" data-acao="d-corrigir" data-valor="${x.a}">corrigir</button>
        <button class="link perigo-t" data-acao="d-tirar" data-valor="${x.a}">tirar</button></span>`}</div>`; }).join('')}</div></div>` : ''}
    <button class="btn" data-acao="l-revisar" ${itens.length ? '' : 'disabled'}>Terminar e revisar</button>`;
};

// o cartão do bezerro (redesenhado a cada número, sem fechar o teclado)
function cartaoDesm(r) {
  if (!(r.num || '').trim()) return '<p class="achado">Digite o número da mãe e toque em <b>Pronto</b>. Os que já passaram ficam na lista abaixo.</p>';
  const x = resolverDesm(r);
  if (x.erro) return `<p class="achado nao">${esc(x.erro)}</p>`;
  if (x.jaPassou) return `<p class="achado aviso-t">O ${esc(numDe(x.jaPassou))} já passou nesta desmama. <button class="link" data-acao="d-corrigir" data-valor="${x.jaPassou}">corrigir</button></p>`;
  if (x.escolher) {
    return `<div class="bloco curral-animal"><p class="achado sim"><b>${esc(x.v.n)}</b> · ${esc(resumo(x.v))} · ${x.escolher.length} crias para desmamar. Qual passou?</p>
      <div class="chips quebra">${x.escolher.map((b) => `<button class="chip" data-acao="d-esc" data-valor="${b.id}">${esc(b.n)} · ${esc(NOME_CAT[b.c] || b.c)}${b.nasc ? ` · ${esc(idade(b.nasc))}` : ''}</button>`).join('')}</div></div>`;
  }
  if (x.semMae) {
    return `<div class="bloco curral-animal"><p class="achado aviso-t"><b>${esc(x.v.n)}</b> · ${esc(resumo(x.v))}<br>${x.velha ? `A cria dela no sistema (${esc(x.velha.n)}) já foi desmamada. ` : 'Ela não tem cria ligada no sistema. '}Qual destes bezerros é a cria dela? Ele fica ligado a ela.</p>
      <div class="chips"><button class="chip" data-acao="d-sx" data-valor="M" aria-pressed="${r.sx === 'M'}">Macho</button><button class="chip" data-acao="d-sx" data-valor="F" aria-pressed="${r.sx === 'F'}">Fêmea</button></div>
      ${x.semMae.length ? `<div class="chips quebra">${x.semMae.map((b) => `<button class="chip" data-acao="d-esc" data-valor="${b.id}">${esc(b.n)} · ${b.s === 'M' ? 'M' : 'F'}${b.nasc ? ` · ${esc(idade(b.nasc))}` : ''}</button>`).join('')}</div>`
        : '<p class="nota">Nenhum bezerro sem mãe desse sexo.</p>'}</div>`;
  }
  const { b, v, ligar } = x;
  const corrigindo = r.editando === b.id && itemDe(r, b.id);
  const ps = pesos(b), u = ps[ps.length - 1];
  const cedo = avisoCedo(b, r.data);
  const br = normBrinco(r.brTxt);
  const tomado = br ? brincoTomado(br, b.id, r) : null;
  return `<div class="bloco curral-animal">
    ${corrigindo ? `<p class="achado aviso-t">✏️ Corrigindo o ${esc(b.n)}. Mude o que precisar e toque em <b>Pronto</b>. Se desistir, ele continua na lista como estava.</p>` : ''}
    <p class="achado sim"><b>${esc(b.n)}</b> · ${esc(resumo(b))}${v ? ` · mãe ${esc(v.n)}` : ' · sem mãe no sistema'}${u ? ` · último peso ${esc(kg(u.p))} em ${esc(dtc(u.d))}` : ''}</p>
    ${ligar ? `<p class="nota">Vai ficar como cria da ${esc(v.n)}.</p>` : ''}
    ${v && v.sr === 'parida' ? `<p class="nota">A ${esc(v.n)} passa a solteira (sem bezerro ao pé).</p>` : ''}
    ${cedo ? `<p class="achado aviso-t">⚠️ ${esc(capital(cedo))}.</p>` : ''}
    <label class="campo"><span>Peso (kg)</span><input id="d-kg" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${esc(r.kgTxt || '')}" placeholder="kg"></label>
    <label class="campo"><span>Brinco novo (se pôs hoje)</span><input id="d-br" inputmode="numeric" autocomplete="off" autocapitalize="characters" enterkeyhint="done" value="${esc(r.brTxt || '')}" placeholder="deixe vazio se não pôs"></label>
    <p id="d-br-aviso" class="nota${tomado ? ' perigo-t' : ''}">${tomado ? `⚠️ ${esc(tomado)}` : br ? `O ${esc(b.n)} passa a ser o ${esc(br)}.` : ''}</p>
    <button class="btn" data-acao="d-add">${I.ok}${corrigindo ? 'Pronto · guardar a correção' : 'Pronto · próximo'}</button></div>`;
}

function desmPorNaLista(r) {
  const x = resolverDesm(r);
  if (!x.b) { avisar(x.erro || (x.escolher || x.semMae ? 'Escolha qual é o bezerro.' : 'Digite o número da mãe ou do bezerro.')); return false; }
  const v = lerNum(r.kgTxt);
  if (v === null || v <= 0) { avisar('Digite o peso em kg.'); return false; }
  if (v < 30 || v > 500) { avisar('Peso fora do normal para bezerro. Confere.'); return false; }
  const br = normBrinco(r.brTxt);
  if (br && !/^[0-9A-Z-]{1,12}$/.test(br)) { avisar('Brinco novo com letra estranha. Confere.'); return false; }
  const tomado = br ? brincoTomado(br, x.b.id, r) : null;
  if (tomado) { avisar(tomado); return false; }
  const kgv = Math.round(v * 10) / 10;
  const aviso = [avisoCedo(x.b, r.data), avisoPeso(x.b, kgv, r.data)].filter(Boolean).join(' · ');
  const novo = { a: x.b.id, kg: kgv, ...(br && br !== x.b.n ? { br } : {}), ...(x.v ? { m: x.v.id } : {}), ...(x.ligar ? { mae: x.v.id } : {}), ...(aviso ? { aviso } : {}) };
  const corrigindo = r.editando === x.b.id && itemDe(r, x.b.id);
  r.itens = corrigindo ? r.itens.map((y) => (y.a === x.b.id ? novo : y)) : [...(r.itens || []), novo];
  r.num = ''; r.kgTxt = ''; r.brTxt = ''; r.esc = null; r.sx = ''; r.editando = null;
  return true;
}

MONTAR.desmama = function (r) {
  const itens = r.itens || [];
  const n = itens.length;
  const media = (l) => kg(Math.round(l.reduce((t, x) => t + x.kg, 0) / l.length));
  const sexo = (s) => itens.filter((x) => (S.idx.porId.get(x.a) || {}).s === s);
  const maes = [...new Set(itens.map((x) => x.m).filter(Boolean))].map((id) => S.idx.porId.get(id)).filter(Boolean);
  const solteiras = maes.filter((v) => v.sr === 'parida').map((v) => v.n).sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true }));
  const brs = itens.filter((x) => x.br), lig = itens.filter((x) => x.mae);
  const faltam = faltamDesm(r);
  const soma = itens.reduce((t, x) => t + x.kg, 0);
  const machos = sexo('M'), femeas = sexo('F');
  const novoNome = r.destino === 'novo' && !loteComNome(r.f, r.lnome) ? String(r.lnome || '').trim() : null;
  const destino = typeof r.destino === 'number' ? { lote: r.destino } : r.destino === 'novo'
    ? (loteComNome(r.f, r.lnome) ? { lote: loteComNome(r.f, r.lnome).id } : { lote_novo: novoNome }) : {};
  const linhas = [
    `Desmama · ${faz(r.f).codigo} · ${dt(r.data)}`,
    `${n} ${n === 1 ? 'bezerro' : 'bezerros'} · média ${media(itens)}`,
    machos.length ? `Machos: ${machos.length} · média ${media(machos)}` : null,
    femeas.length ? `Fêmeas: ${femeas.length} · média ${media(femeas)}` : null,
    r.destino === 'nenhum' ? 'Lote: ficam no lote de hoje' : `Vão para o ${destinoTxt(r)}${novoNome ? ' (o sistema cria o lote)' : ''}`,
    solteiras.length ? `Passam a solteira (${solteiras.length}): ${solteiras.join(', ')}` : null,
    brs.length ? `Brinco novo (${brs.length}): ${brs.map((x) => `${numDe(x.a)} → ${x.br}`).join(', ')}` : null,
    lig.length ? `Cria ligada à mãe (${lig.length}): ${lig.map((x) => `${numDe(x.a)} → cria da ${numDe(x.mae)}`).join(', ')}` : null,
    ...itens.filter((x) => x.aviso).map((x) => `${numDe(x.a)}: ${kg(x.kg)} ⚠️ ${x.aviso}`),
    faltam.length ? `Não passaram (${faltam.length} de 6 meses para cima): ${faltam.map(nomeFalta).join(', ')}. Continuam com a mãe.` : null,
  ].filter(Boolean);
  return {
    dados: { data: r.data, f: r.f, ...destino, itens: itens.map((x) => ({ a: x.a, kg: x.kg, ...(x.br ? { brinco: x.br } : {}), ...(x.mae ? { mae: x.mae } : {}) })) },
    resumo: `Desmama ${dtc(r.data)} (${faz(r.f).codigo}): ${n} ${n === 1 ? 'bezerro' : 'bezerros'}, média ${media(itens)}`,
    linhas,
    total: `${n} ${n === 1 ? 'bezerro' : 'bezerros'} · ${kg(Math.round(soma * 10) / 10)} no total · média ${media(itens)}`,
  };
};

// ------------------------------------------------------------------ toques, digitação e Enter da desmama
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="d-"]');
  if (!b || tipoAtual() !== 'desmama') return;
  const acao = b.dataset.acao, v = b.dataset.valor;
  if (acao === 'd-faz') return mexer((r) => { r.f = Number(v); r.destino = null; });
  if (acao === 'd-destino') return mexer((r) => {
    r.destino = /^\d+$/.test(v) ? Number(v) : v;
    if (v === 'novo' && !(r.lnome || '').trim()) r.lnome = `desmama ${r.data.slice(0, 4)}`;
  });
  if (acao === 'd-comecar') return mexer((r) => { r.ok = true; r.itens = r.itens || []; r.num = ''; window.scrollTo(0, 0); });
  if (acao === 'd-trocar') {
    const r = rasc('desmama');
    if ((r.itens || []).length) {
      abrirJanela(`<h2>Trocar a fazenda ou o lote?</h2><p>${r.itens.length} bezerro(s) já passaram nesta desmama. Se trocar, essa lista é apagada do celular (nada foi enviado ainda).</p>
        <button class="btn perigo" data-acao="d-trocar-sim">Sim, trocar</button>`, 'Não, continuar');
      return;
    }
  }
  if (acao === 'd-trocar' || acao === 'd-trocar-sim') { $('.fundo')?.remove(); return mexer((r) => { r.ok = false; r.itens = []; r.num = ''; r.esc = null; r.editando = null; }); }
  if (acao === 'd-faltam') return mexer((r) => { r.verFaltam = !r.verFaltam; });
  if (acao === 'd-sx') return mexer((r) => { r.sx = r.sx === v ? '' : v; });
  if (acao === 'd-esc') {
    mexer((r) => { const a = acharAnimal(r.num || ''); if (a && ehVaca(a)) r.esc = { v: a.id, b: Number(v) }; });
    setTimeout(() => $('#d-kg')?.focus(), 30);
    return;
  }
  if (acao === 'd-add') {
    let ok = false;
    mexer((r) => { ok = desmPorNaLista(r); });
    if (ok) setTimeout(() => $('#d-num')?.focus(), 30);
    return;
  }
  // trava igual à do modo Curral: "tirar" e "corrigir" só depois de confirmar
  if (acao === 'd-tirar' || acao === 'd-corrigir') {
    const a = S.idx.porId.get(Number(v));
    if (!a) return;
    abrirJanela(acao === 'd-tirar'
      ? `<h2>Tirar o ${esc(a.n)} da lista?</h2><p>Ele ainda não foi enviado. Se tirar, o peso dele sai do celular e ele volta para "faltam".</p>
        <button class="btn perigo" data-acao="d-tirar-sim" data-valor="${a.id}">Sim, tirar o ${esc(a.n)}</button>`
      : `<h2>Corrigir o ${esc(a.n)}?</h2><p>Ele continua na lista como está. Lá em cima você muda o que precisar e toca em <b>Pronto</b>: só então a correção vale.</p>
        <button class="btn" data-acao="d-corrigir-sim" data-valor="${a.id}">Sim, corrigir o ${esc(a.n)}</button>`, 'Não, manter como está');
    return;
  }
  if (acao === 'd-tirar-sim') {
    $('.fundo')?.remove();
    return mexer((r) => {
      r.itens = (r.itens || []).filter((x) => x.a !== Number(v));
      if (r.editando === Number(v)) { r.editando = null; r.num = ''; r.kgTxt = ''; r.brTxt = ''; r.esc = null; }
    });
  }
  if (acao === 'd-corrigir-sim') {
    $('.fundo')?.remove();
    mexer((r) => {
      const x = itemDe(r, Number(v)), a = S.idx.porId.get(Number(v));
      if (!x || !a) return;
      r.editando = a.id;
      const m = x.m ? S.idx.porId.get(x.m) : null;
      if (x.mae && m) { r.num = m.n; r.esc = { v: m.id, b: a.id }; } else { r.num = a.n; r.esc = null; }
      r.kgTxt = String(x.kg).replace('.', ','); r.brTxt = x.br || '';
    });
    setTimeout(() => { $('#d-num')?.scrollIntoView({ block: 'center' }); }, 30);
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.id || !el.id.startsWith('d-') || tipoAtual() !== 'desmama') return;
  mexer((r) => {
    if (el.id === 'd-num') { r.num = el.value; r.esc = null; r.sx = ''; }
    if (el.id === 'd-kg') r.kgTxt = el.value;
    if (el.id === 'd-br') r.brTxt = el.value;
    if (el.id === 'd-lnome') r.lnome = el.value;
  }, false);
  const r = rasc('desmama');
  if (el.id === 'd-num') $('#d-cartao').innerHTML = cartaoDesm(r);
  if (el.id === 'd-br' && $('#d-br-aviso')) {
    const x = resolverDesm(r), br = normBrinco(r.brTxt), t = br && x.b ? brincoTomado(br, x.b.id, r) : null;
    const p = $('#d-br-aviso');
    p.className = `nota${t ? ' perigo-t' : ''}`;
    p.textContent = t ? `⚠️ ${t}` : br && x.b ? `O ${x.b.n} passa a ser o ${br}.` : '';
  }
  if (el.id === 'd-lnome') { const btn = $('[data-acao="d-comecar"]'); if (btn) btn.disabled = !(r.lnome || '').trim(); }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.id || !ev.target.id.startsWith('d-') || tipoAtual() !== 'desmama') return;
  ev.preventDefault();
  if (ev.target.id === 'd-lnome') { ev.target.blur(); return; }
  if (ev.target.id === 'd-num' && $('#d-kg')) { $('#d-kg').focus(); return; }
  if (ev.target.id === 'd-kg' && $('#d-br')) { $('#d-br').focus(); return; }
  const add = $('[data-acao="d-add"]');
  if (add) add.click(); else avisar((rasc('desmama').num || '') ? 'Veja o aviso embaixo do número.' : 'Digite o número da mãe ou do bezerro.');
});
