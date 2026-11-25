// Curral Digital — painel dentro do app (as 6 abas do painel antigo), desenhado a partir da cópia guardada no celular.
// Carregado antes do app.js: as funções daqui usam esc, S, I, dt, dtc, relativo… do app.js na hora em que são chamadas.
'use strict';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (ym) => MESES[Number(String(ym).slice(5, 7)) - 1] || '';
const META = {
  prenhez: { alvo: 83, tipo: 'min', escala: 100, texto: 'meta 83%' },
  natalidade: { alvo: 80, tipo: 'min', escala: 100, texto: 'meta 80%' },
  mortalidade: { alvo: 2, tipo: 'max', escala: 10, texto: 'até 2%' },
  gmd: { alvo: 0.481, tipo: 'min', escala: 1, texto: 'meta 0,481 kg/dia' },
};
// cor fixa de cada coisa (a mesma em todos os gráficos e nos selos da ficha)
const CORP = {
  centro: { reprodutivo: 1, nutricional: 5, sanitario: 6, administrativo: 4, mao_de_obra: 3, infraestrutura: 8 },
  categ: { matriz: 1, novilha: 2, bezerra: 5, bezerro: 4, descarte: 8, touro: 6, boi: 3, garrote: 7 },
  situacao: { prenha: 1, parida: 6, vazia: 5, solteira: 7, 'sem registro': 8 },
  sexo: { machos: 1, femeas: 5 },
  fazenda: { '3C': 1, MD: 5 },
  fin: { receitas: 1, despesas: 4 },
};
const corP = (g, k) => (CORP[g] && CORP[g][k]) || 7;
const NOME_CENTRO = { reprodutivo: 'Reprodutivo', nutricional: 'Nutricional', sanitario: 'Sanitário', administrativo: 'Administrativo',
  mao_de_obra: 'Mão de obra', infraestrutura: 'Infraestrutura' };
const NOME_SIT = { prenha: 'Prenhas', parida: 'Paridas', vazia: 'Vazias', solteira: 'Solteiras', 'sem registro': 'Sem registro' };
const NOME_MSG = { processado: 'anotado', ambigua: 'perguntou', ignorada: 'só guardado', erro: 'erro', cancelada: 'desfeito', novo: 'chegando' };

const F = {
  int: (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })),
  dec: (v, c = 1) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: c })),
  pct: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`),
  brl: (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
  brl0: (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })),
  kg: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`),
  gmd: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`),
  mm: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`),
};
const P = (id) => ((S.dados && S.dados.painel && S.dados.painel[id]) || []);
const P1 = (id) => P(id)[0] || {};
const temP = (id) => !!(S.dados && S.dados.painel && S.dados.painel[id]);
function idDoNumero(n) {
  if (!S.idx._porNum) S.idx._porNum = new Map(S.dados.animais.map((a) => [a.n, a.id]));
  return S.idx._porNum.get(n);
}
const dataHora = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '—');

// ------------------------------------------------------------------ peças
function kpi(rotulo, valor, sub, extra = '') {
  const est = extra.includes('pilula ok') ? ' k-ok' : extra.includes('pilula atencao') ? ' k-atencao' : '';
  const longo = String(valor).length > 7 ? ' longo' : '';
  return `<div class="kpi${est}"><p class="kpi-l">${esc(rotulo)}</p><p class="kpi-v${longo}">${esc(valor)}</p>${sub ? `<p class="kpi-s">${sub}</p>` : ''}${extra}</div>`;
}
function barraMeta(v, chave, neutro) {
  const m = META[chave];
  if (v == null || !m) return '';
  const W = 300;
  const x = (val) => Math.max(0, Math.min(W, (val / m.escala) * W));
  const bom = m.tipo === 'min' ? v >= m.alvo : v <= m.alvo;
  const est = neutro ? 'neutro' : bom ? 'ok' : 'atencao';
  const txt = neutro ? 'antes da IATF' : bom ? 'na meta' : m.tipo === 'min' ? 'abaixo da meta' : 'acima do limite';
  return `<div class="meta"><svg viewBox="0 0 ${W} 14" class="meta-svg" aria-hidden="true">
    <rect x="0" y="4" width="${W}" height="6" rx="3" class="trilho"/>
    <rect x="0" y="4" width="${x(v).toFixed(1)}" height="6" rx="3" class="f${est === 'ok' ? 1 : est === 'neutro' ? 7 : 5}"/>
    <rect x="${(x(m.alvo) - 1).toFixed(1)}" y="0" width="2" height="14" rx="1" class="marco"/></svg>
    <div class="meta-l"><span>${esc(m.texto)}</span><span class="pilula ${est}">${esc(txt)}</span></div></div>`;
}
function legenda(itens) {
  return `<ul class="legenda">${itens.map((i) => `<li><i class="bola b${i.c}"></i>${esc(i.rot)}</li>`).join('')}</ul>`;
}
function pilha(partes, alt = 20) {
  const vivas = partes.filter((p) => Number(p.v) > 0);
  const tot = vivas.reduce((s, p) => s + Number(p.v), 0);
  if (!tot) return '<p class="nota">Sem animais.</p>';
  const W = 300;
  let x = 0;
  const r = vivas.map((p, i) => {
    const w = (W * Number(p.v)) / tot;
    const larg = Math.max(1, w - (i < vivas.length - 1 ? 2 : 0));
    const s = `<rect x="${x.toFixed(1)}" y="0" width="${larg.toFixed(1)}" height="${alt}" rx="4" class="f${p.c}" data-tip="${esc(`${p.rot}: ${F.int(p.v)}`)}"/>`;
    x += w;
    return s;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${alt}" class="grafico" role="img" aria-label="${esc(vivas.map((p) => `${p.rot} ${p.v}`).join(', '))}">${r}</svg>`;
}
function colunas(rotulos, series, { empilhar = false, fv = F.int, alt = 150 } = {}) {
  const W = 320, base = alt - 18, topo = 14, n = rotulos.length;
  const somas = rotulos.map((_, i) => series.reduce((s, se) => s + (Number(se.v[i]) || 0), 0));
  const max = empilhar ? Math.max(0, ...somas) : Math.max(0, ...series.flatMap((se) => se.v.map((v) => Number(v) || 0)));
  if (!max) return '<p class="nota">Nada lançado nos últimos 12 meses.</p>';
  const bw = W / n;
  const y = (v) => base - (v / max) * (base - topo);
  let o = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="eixo"/><text x="0" y="10" class="rot">${esc(fv(max))}</text>`;
  rotulos.forEach((r, i) => {
    const cx = i * bw;
    if (empilhar) {
      let acc = 0;
      series.forEach((se) => {
        const v = Number(se.v[i]) || 0;
        if (!v) return;
        const y0 = y(acc), y1 = y(acc + v);
        o += `<rect x="${(cx + bw * 0.18).toFixed(1)}" y="${y1.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(1, y0 - y1 - 1.5).toFixed(1)}" rx="2" class="f${se.c}" data-tip="${esc(`${r}: ${se.nome} ${fv(v)}`)}"/>`;
        acc += v;
      });
    } else {
      const gw = (bw * 0.74) / series.length;
      series.forEach((se, j) => {
        const v = Number(se.v[i]) || 0;
        if (!v) return;
        o += `<rect x="${(cx + bw * 0.13 + j * gw).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, gw - 1.5).toFixed(1)}" height="${Math.max(1, base - y(v)).toFixed(1)}" rx="2" class="f${se.c}" data-tip="${esc(`${r}: ${se.nome} ${fv(v)}`)}"/>`;
      });
    }
    o += `<text x="${(cx + bw / 2).toFixed(1)}" y="${alt - 4}" class="rot" text-anchor="middle">${esc(r)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${alt}" class="grafico">${o}</svg>`;
}
function barrasH(itens, fv = F.brl0) {
  const W = 320, lin = 28, rotW = 104, valW = 74;
  const max = Math.max(0, ...itens.map((i) => Number(i.v) || 0));
  if (!max) return '<p class="nota">Nada lançado ainda.</p>';
  const o = itens.map((it, k) => {
    const y = k * lin;
    const w = ((W - rotW - valW) * (Number(it.v) || 0)) / max;
    return `<text x="0" y="${y + 17}" class="rot2">${esc(it.rot)}</text>
      <rect x="${rotW}" y="${y + 6}" width="${Math.max(1, w).toFixed(1)}" height="15" rx="3" class="f${it.c}" data-tip="${esc(`${it.rot}: ${fv(it.v)}`)}"/>
      <text x="${(rotW + w + 6).toFixed(1)}" y="${y + 17}" class="rot2 forte">${esc(fv(it.v))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${itens.length * lin}" class="grafico">${o}</svg>`;
}
function pontosPorLote(linhas) {
  const lotes = [...new Set(linhas.map((r) => r.lote))];
  if (!lotes.length) return '<p class="nota">Nenhuma pesagem nos lotes ativos.</p>';
  const pesos = linhas.map((r) => Number(r.peso_kg));
  let lo = Math.min(...pesos), hi = Math.max(...pesos);
  if (hi - lo < 20) { lo -= 10; hi += 10; }
  const W = 320, rotW = 0, lin = 46, ini = 8, fim = W - 8;
  const x = (p) => ini + ((p - lo) / (hi - lo)) * (fim - ini);
  let o = '';
  lotes.forEach((l, k) => {
    const y = k * lin;
    const rs = linhas.filter((r) => r.lote === l);
    const media = rs.reduce((s, r) => s + Number(r.peso_kg), 0) / rs.length;
    o += `<text x="${rotW}" y="${y + 12}" class="rot2 forte">${esc(l)} · ${rs.length} animais · média ${esc(F.kg(media))}</text>`;
    o += `<line x1="${ini}" x2="${fim}" y1="${y + 30}" y2="${y + 30}" class="eixo"/>`;
    rs.forEach((r) => {
      o += `<circle cx="${x(Number(r.peso_kg)).toFixed(1)}" cy="${y + 30}" r="5" class="f${corP('categ', r.categoria)} ponto-p" data-tip="${esc(`${r.numero}: ${F.kg(r.peso_kg)} em ${dtc(r.data)}`)}"/>`;
    });
    o += `<rect x="${(x(media) - 1).toFixed(1)}" y="${y + 21}" width="2" height="18" rx="1" class="marco"/>`;
  });
  const h = lotes.length * lin + 14;
  o += `<text x="${ini}" y="${h - 2}" class="rot">${esc(F.kg(lo))}</text><text x="${fim}" y="${h - 2}" class="rot" text-anchor="end">${esc(F.kg(hi))}</text>`;
  return `<svg viewBox="0 0 ${W} ${h}" class="grafico">${o}</svg>`;
}
function linhasLista(rows, vazio) {
  if (!rows.length) return `<p class="vazio">${esc(vazio)}</p>`;
  return `<div class="lista">${rows.map((r) => {
    const conteudo = `<span><span class="item-t">${r.t}</span>${r.s ? `<span class="item-m">${r.s}</span>` : ''}</span><span class="item-v">${r.v || ''}</span>`;
    return r.ir ? `<button class="item" data-ir="${esc(r.ir)}">${conteudo}${I.seta}</button>` : `<div class="item item-fixo">${conteudo}<span></span></div>`;
  }).join('')}</div>`;
}
const bloco = (titulo, sub, corpo) => `<div class="bloco"><div class="bloco-h"><h2 class="h2">${esc(titulo)}</h2>${sub ? `<span class="nota">${esc(sub)}</span>` : ''}</div>${corpo}</div>`;
const meses12 = () => (P('nascimentos_mes').length ? P('nascimentos_mes').map((r) => r.mes) : P('financeiro_mes').map((r) => r.mes));

// ------------------------------------------------------------------ abas
const SECOES = [['geral', 'Geral'], ['rebanho', 'Rebanho'], ['reproducao', 'Reprodução'], ['desempenho', 'Desempenho'], ['financeiro', 'Financeiro'], ['campo', 'Campo']];

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const pct = (a, b) => (Number(b) > 0 ? Math.round((100 * Number(a)) / Number(b)) : 0);
function pintarBarras(raiz = document) {
  for (const b of raiz.querySelectorAll('.heroi-faz .barra')) { b.style.setProperty('--p', `${b.dataset.p}%`); b.style.setProperty('--cor', b.dataset.c); }
}
function anel(rotulo, v, chave, neutro) {
  const m = META[chave], C = 2 * Math.PI * 40;
  const bom = v != null && (m.tipo === 'min' ? v >= m.alvo : v <= m.alvo);
  const est = v == null || neutro ? 'neutro' : bom ? 'ok' : 'atencao';
  const fr = v == null ? 0 : Math.max(0.02, Math.min(1, v / m.escala));
  return `<div class="anel ${est}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" class="an-fundo"/>
    <circle cx="50" cy="50" r="40" class="an-arco" stroke-dasharray="${(fr * C).toFixed(1)} ${C.toFixed(1)}"/>
    <text x="50" y="57" text-anchor="middle" class="an-v">${esc(v == null ? '—' : F.pct(v))}</text></svg>
    <p>${esc(rotulo)}</p><small>${esc(m.texto)} · <b>${esc(neutro ? 'antes da IATF' : bom ? 'na meta' : 'fora')}</b></small></div>`;
}
const ATALHOS = [['rebanho', 'Rebanho', '#painel/rebanho'], ['repro', 'Reprodução', '#painel/reproducao'], ['peso', 'Desempenho', '#painel/desempenho'],
  ['pasto', 'Mapa e pastos', '#painel/campo'], ['agenda', 'Agenda', '#agenda'], ['listas', 'Listas', '#listas'],
  ['dinheiro', 'Finanças', '#painel/financeiro'], ['busca', 'Buscar animal', '#buscar'], ['hist', 'Lançamentos', '#painel/geral-lanc']];
function telaInicio() {
  const r = P1('resumo');
  const neutroP = Number(r.prenhas_ultimo_dg) > 0 && Number(r.prenhas_touro) >= Number(r.prenhas_ultimo_dg);
  const fz = P('fazendas');
  const fazC = (cod, nome) => { const f = fz.find((x) => x.fazenda === cod) || {};
    return `<div class="faz-c"><small>${esc(nome)}</small><b>${esc(F.int(f.cabecas))}</b><span>${esc(F.int(f.nascimentos_12m))} nasc. · ${esc(F.int(f.mortes_12m))} mortes (12 m)</span></div>`; };
  const at = ATALHOS.filter(([, , h]) => h !== '#painel/financeiro' || dono());
  return `<section class="pagina">
    <div class="faixa"><h1>Fazendas MD e 3C</h1><p>${esc((S.usuario && S.usuario.nome) || '')} · ${esc(F.int(r.cabecas))} cabeças</p>
      <button class="busca-faixa" data-ir="#buscar">${I.busca}<span>Buscar animal pelo número</span></button></div>
    ${Number(r.pendencias) > 0 ? `<div class="dica"><b>${esc(F.int(r.pendencias))} recado(s) do bot esperando conferência</b><span>Peça ao Claude: “confere as pendências do bot”.</span></div>` : ''}
    <h2 class="titulo-secao">Sua gestão</h2>
    <div class="bloco"><div class="aneis">${anel('Prenhez', r.taxa_prenhez_pct == null ? null : Number(r.taxa_prenhez_pct), 'prenhez', neutroP)}${anel('Natalidade', r.natalidade_pct == null ? null : Number(r.natalidade_pct), 'natalidade')}${anel('Mortalidade', r.mortalidade_pct == null ? null : Number(r.mortalidade_pct), 'mortalidade')}</div>
      <p class="nota">Prenhez do último diagnóstico (${esc(F.int(r.prenhas_ultimo_dg))} de ${esc(F.int(r.diagnosticadas))}); natalidade e mortalidade dos últimos 12 meses.</p></div>
    <div class="duas">${fazC('3C', 'Três Corações · 3C')}${fazC('MD', 'Fazenda MD')}</div>
    <div class="kpis">${kpi('Cabeças', F.int(r.cabecas), `${esc(F.int(r.matrizes))} matrizes · ${esc(F.int(r.novilhas))} novilhas · ${esc(F.int(r.bezerros))} bezerros`)}
      ${dono() ? kpi('Resultado do ano', F.brl(r.resultado_ano), `gastos ${esc(F.brl(r.gasto_ano))}`) : kpi('Nascimentos · 12 meses', F.int(r.nascimentos_12m), '')}</div>
    <h2 class="titulo-secao">Painéis</h2>
    <div class="botoes">${at.map(([ic, t, h]) => `<button class="botao" data-ir="${h}">${I[ic]}<span>${esc(t)}</span></button>`).join('')}</div>
    ${bloco('Próximos manejos', 'programados', `${linhasLista(P('agenda').slice(0, 4).map((a) => ({
      t: `${esc(NOME_ETAPA[a.etapa] || a.etapa)}${a.produto && a.produto !== 'IATF' ? ` · ${esc(a.produto)}` : ''}`,
      s: esc([a.fazenda, a.lote, a.n_animais ? `${a.n_animais} animais` : null].filter(Boolean).join(' · ')),
      v: `${esc(dtc(a.data))}<small>${esc(relativo(a.data))}</small>` })), 'Nenhum manejo programado.')}<button class="link" data-ir="#agenda">Ver a agenda completa</button>`)}
  </section>`;
}
function telaPainel(secao) {
  if (!S.dados.painel) return '<section class="pagina"><p class="vazio">Atualize com internet para baixar o painel.</p></section>';
  if (!secao) return telaInicio();
  const secoes = SECOES.filter(([id]) => id !== 'financeiro' || dono());
  const atual = secao === 'geral-lanc' ? 'geral' : secoes.some(([id]) => id === secao) ? secao : 'geral';
  const corpo = { geral: secGeral, rebanho: secRebanho, reproducao: secReproducao, desempenho: secDesempenho, financeiro: secFinanceiro, campo: secCampo }[atual]();
  return `<section class="pagina">
    <button class="voltar" data-ir="#painel">${I.voltar}Início</button>
    <div class="chips secoes" role="tablist">${secoes.map(([id, nome]) => `<button class="chip" role="tab" data-ir="#painel/${id}" aria-pressed="${id === atual}">${esc(nome)}</button>`).join('')}</div>
    ${corpo}
    ${definicoes()}
  </section>`;
}

function kpiPrenhez(r, comTouro) {
  const neutro = Number(r.prenhas_ultimo_dg) > 0 && Number(r.prenhas_touro) >= Number(r.prenhas_ultimo_dg);
  const sub = `<b>${esc(F.int(r.prenhas_ultimo_dg))}</b> prenhas de ${esc(F.int(r.diagnosticadas))}${r.data_ultimo_dg ? ` · DG de ${esc(dtc(r.data_ultimo_dg))}` : ''}`
    + (comTouro && Number(r.prenhas_touro) ? `<br>${esc(F.int(r.prenhas_touro))} delas de touro, fora da IATF, sem custo de inseminação.` : '');
  return kpi('Prenhez no último diagnóstico', F.pct(r.taxa_prenhez_pct), sub, barraMeta(r.taxa_prenhez_pct, 'prenhez', neutro));
}

function secGeral() {
  const r = P1('resumo');
  const kpis = [
    kpi('Cabeças', F.int(r.cabecas), `${esc(F.int(r.matrizes))} matrizes · ${esc(F.int(r.novilhas))} novilhas · ${esc(F.int(r.bezerros))} bezerros`),
    kpiPrenhez(r, false),
    kpi('Natalidade · 12 meses', F.pct(r.natalidade_pct), `${esc(F.int(r.nascimentos_12m))} nascimentos para ${esc(F.int(r.matrizes))} matrizes`, barraMeta(r.natalidade_pct, 'natalidade')),
    kpi('Mortalidade · 12 meses', F.pct(r.mortalidade_pct), `${esc(F.int(r.mortes_12m))} mortes registradas`, barraMeta(r.mortalidade_pct, 'mortalidade')),
  ];
  if (dono()) {
    kpis.push(kpi('Gasto lançado no ano', F.brl(r.gasto_ano), `${esc(F.brl(r.desembolso_cab_mes))} por cabeça por mês`));
    kpis.push(kpi('Resultado do ano', F.brl(r.resultado_ano), `receitas ${esc(F.brl(r.receita_ano))} menos gastos`));
  }
  const faz = P('fazendas').map((f) => {
    const partes = [{ rot: 'Matrizes', v: f.matrizes, c: corP('categ', 'matriz') }, { rot: 'Novilhas', v: f.novilhas, c: corP('categ', 'novilha') },
      { rot: 'Bezerros', v: f.bezerros, c: corP('categ', 'bezerro') }, { rot: 'Outros', v: f.outros, c: 7 }];
    return `<div class="bloco faz"><div class="bloco-h"><h2 class="h2"><i class="bola b${corP('fazenda', f.fazenda)}"></i>${esc(f.nome)}</h2><span class="nota"><b>${esc(F.int(f.cabecas))}</b> cabeças</span></div>
      ${pilha(partes)}${legenda(partes.filter((p) => Number(p.v) > 0).map((p) => ({ rot: `${p.rot} ${F.int(p.v)}`, c: p.c })))}
      <dl class="linhas"><dt>Nascimentos · 12 m</dt><dd>${esc(F.int(f.nascimentos_12m))}</dd><dt>Mortes · 12 m</dt><dd>${esc(F.int(f.mortes_12m))}</dd>
      ${dono() ? `<dt>Gasto no ano</dt><dd>${esc(F.brl(f.gasto_ano))}</dd>` : ''}</dl></div>`;
  }).join('');
  const agenda = linhasLista(P('agenda').slice(0, 6).map((a) => ({
    t: `${esc(NOME_ETAPA[a.etapa] || a.etapa)}${a.produto && a.produto !== 'IATF' ? ` · ${esc(a.produto)}` : ''}`,
    s: esc([a.fazenda, a.lote, a.n_animais ? `${a.n_animais} animais` : null].filter(Boolean).join(' · ')),
    v: `${esc(dtc(a.data))}<small>${esc(relativo(a.data))}</small>`,
  })), 'Nenhum manejo programado.');
  const lanc = temP('lancamentos') ? bloco('Últimos lançamentos', 'bot e Claude', linhasLista(P('lancamentos').slice(0, 8).map((l) => ({
    t: `${esc(l.tipo)}${Number(l.registros) > 1 ? ` · ${esc(F.int(l.registros))} registros` : ''}${l.animal ? ` · ${esc(l.animal)}` : ''}`,
    s: esc([l.fazenda, l.origem, dataHora(l.registrado)].filter(Boolean).join(' · ')),
    v: esc(l.detalhe || (l.de && l.ate && l.de !== l.ate ? `${dtc(l.de)}–${dtc(l.ate)}` : dtc(l.de))),
  })), 'Nada lançado ainda.')) : '';
  return `<div class="kpis">${kpis.join('')}</div>
    <p class="nota">Natalidade e mortalidade contam os últimos 12 meses. Na MD, as vacas foram cadastradas pela lista de partos, então a natalidade fica acima do real até todas as vacas estarem no sistema.${dono() ? ' O resultado só fica completo quando as vendas e todas as despesas forem lançadas.' : ''}</p>
    ${faz}
    ${bloco('Próximos manejos', 'programados', `${agenda}<button class="link" data-ir="#agenda">Ver a agenda completa</button>`)}
    ${lanc}`;
}

function secRebanho() {
  const r = P1('resumo');
  const kpis = [
    kpi('Matrizes', F.int(r.matrizes), 'vacas que já pariram'),
    kpi('Novilhas', F.int(r.novilhas), 'fêmeas que ainda não pariram'),
    kpi('Bezerros', F.int(r.bezerros), 'machos e fêmeas, com número provisório até brincar'),
    kpi('Nascimentos · 12 meses', F.int(r.nascimentos_12m), `${esc(F.int(r.mortes_12m))} mortes no mesmo período`),
  ];
  const cats = [...new Set(P('rebanho').map((x) => x.categoria))].sort((a, b) => corP('categ', a) - corP('categ', b));
  const porFaz = S.dados.fazendas.map((f) => {
    const linhas = P('rebanho').filter((x) => x.fazenda === f.codigo);
    const tot = linhas.reduce((s, x) => s + Number(x.cabecas), 0);
    return `<p class="rot-linha"><b>${esc(f.codigo)}</b> · ${esc(F.int(tot))} cabeças</p>${pilha(cats.map((c) => ({ rot: NOME_CAT[c] || c, v: (linhas.find((x) => x.categoria === c) || {}).cabecas || 0, c: corP('categ', c) })))}`;
  }).join('');
  const nm = P('nascimentos_mes');
  const nasc = colunas(nm.map((x) => mesCurto(x.mes)), [{ nome: 'machos', c: corP('sexo', 'machos'), v: nm.map((x) => x.machos) }, { nome: 'fêmeas', c: corP('sexo', 'femeas'), v: nm.map((x) => x.femeas) }], { empilhar: true });
  const lotes = linhasLista(P('lotes').map((l) => ({
    t: `${esc(l.lote)} <small>${esc(l.fazenda)}</small>`,
    s: esc([`${F.int(l.cabecas)} cab.`, l.pesados ? `${F.int(l.pesados)} pesados` : 'sem pesagem', l.ultima_pesagem ? `pesagem ${dtc(l.ultima_pesagem)}` : null].filter(Boolean).join(' · ')),
    v: l.peso_medio_kg ? `${esc(F.kg(l.peso_medio_kg))}<small>${esc(F.dec(l.peso_medio_arroba, 2))} @</small>` : '—',
  })), 'Nenhum lote ativo.');
  const mortes = linhasLista(P('mortes').map((m) => ({
    t: `${esc(m.animal || 'sem número')} <small>${esc(m.fazenda)}</small>`, s: esc([NOME_CAT[m.categoria] || m.categoria, m.causa].filter(Boolean).join(' · ')),
    v: esc(dt(m.data)), ir: m.animal && idDoNumero(m.animal) ? `#animal/${idDoNumero(m.animal)}` : null,
  })), 'Nenhuma morte nos últimos 12 meses.');
  return `<div class="kpis">${kpis.join('')}</div>
    ${bloco('Rebanho por categoria', 'animais ativos', `${porFaz}${legenda(cats.map((c) => ({ rot: NOME_CAT[c] || c, c: corP('categ', c) })))}`)}
    ${bloco('Nascimentos por mês', 'últimos 12 meses, as duas fazendas', `${legenda([{ rot: 'Machos', c: corP('sexo', 'machos') }, { rot: 'Fêmeas', c: corP('sexo', 'femeas') }])}${nasc}<p class="nota">Os partos informados só pelo mês entram no dia 15.</p>`)}
    ${bloco('Lotes', 'peso da última pesagem de cada animal', lotes)}
    ${bloco('Mortes', 'últimos 12 meses', mortes)}`;
}

function secReproducao() {
  const r = P1('resumo');
  const emProt = S.dados.animais.filter((a) => a.st === 'ativo' && proximaEtapa(a)).length;
  const insem = P('protocolos').reduce((s, p) => s + (Number(p.inseminadas) || 0), 0);
  const kpis = [
    kpiPrenhez(r, true),
    kpi('Fêmeas em protocolo de IATF', F.int(emProt), 'somando todos os protocolos'),
    kpi('Inseminadas', F.int(insem), 'nos protocolos em andamento'),
    kpi('Partos previstos', F.int(P('partos_previstos').length), 'com data de concepção conhecida'),
  ];
  const sits = ['prenha', 'parida', 'vazia', 'solteira', 'sem registro'].filter((s) => P('reprod_status').some((x) => x.situacao === s));
  const porFaz = S.dados.fazendas.map((f) => {
    const linhas = P('reprod_status').filter((x) => x.fazenda === f.codigo);
    const tot = linhas.reduce((s, x) => s + Number(x.femeas), 0);
    return `<p class="rot-linha"><b>${esc(f.codigo)}</b> · ${esc(F.int(tot))} fêmeas</p>${pilha(sits.map((s) => ({ rot: NOME_SIT[s] || s, v: (linhas.find((x) => x.situacao === s) || {}).femeas || 0, c: corP('situacao', s) })))}`;
  }).join('');
  const prots = linhasLista(P('protocolos').map((p) => ({
    t: esc(p.protocolo),
    s: esc([p.fazenda, p.lote ? `lote ${p.lote}` : null, `D0 ${dtc(p.d0)}`, `etapas ${F.int(p.etapas_feitas)}/${F.int(Number(p.etapas_feitas) + Number(p.etapas_previstas))}`,
      Number(p.inseminadas) ? `${F.int(p.inseminadas)} inseminadas · ${F.int(p.prenhas)} prenhas` : null].filter(Boolean).join(' · ')),
    v: p.taxa_concepcao_pct != null ? `${esc(F.pct(p.taxa_concepcao_pct))}<small>concepção</small>` : p.proxima_etapa ? `${esc(dtc(p.proxima_etapa))}<small>próxima</small>` : '',
  })), 'Nenhum protocolo.');
  const custo = temP('custo_protocolo') ? bloco('Custo previsto por protocolo', 'todas as etapas', `${linhasLista(P('custo_protocolo').map((c) => ({
    t: esc(c.protocolo), s: esc(`${F.int(c.animais)} animais · ${F.brl(c.custo_animal)} por animal · por prenhez* ${F.brl(c.custo_prenhez_60)}`),
    v: `${esc(F.brl0(c.custo_lote))}<small>lote inteiro</small>`,
  })), 'Nenhum protocolo.')}<p class="nota">* Custo reprodutivo dividido por 60% de prenhez. Cada etapa só entra no gasto do ano quando é feita.</p>`) : '';
  const partos = linhasLista(P('partos_previstos').map((p) => ({
    t: `${esc(p.numero)} <small>${esc(p.fazenda)}</small>`, s: esc([NOME_CAT[p.categoria] || p.categoria, p.referencia].filter(Boolean).join(' · ')),
    v: `${esc(dt(p.parto_previsto))}<small>${esc(relativo(p.parto_previsto))}</small>`, ir: idDoNumero(p.numero) ? `#animal/${idDoNumero(p.numero)}` : null,
  })), 'Ainda não há parto previsto: a previsão aparece depois da inseminação ou do diagnóstico com idade da gestação.');
  return `<div class="kpis">${kpis.join('')}</div>
    ${bloco('Situação das fêmeas', 'matrizes e novilhas, fora do lote de abate', `${porFaz}${legenda(sits.map((s) => ({ rot: NOME_SIT[s] || s, c: corP('situacao', s) })))}`)}
    ${bloco('Protocolos de IATF', 'andamento e resultado', `${prots}<p class="nota">A concepção aparece depois do diagnóstico de gestação das inseminadas. Referência das fazendas top: cerca de 83% de prenhez na estação.</p>`)}
    ${custo}
    ${bloco('Partos previstos', '290 dias depois da concepção', `${partos}<p class="nota">Parto antes de 270 dias da concepção é avisado como antes do tempo; depois de 305 dias, como depois do previsto.</p>`)}`;
}

function secDesempenho() {
  const g = P('gmd_lote');
  const nG = g.reduce((s, x) => s + Number(x.animais), 0);
  const gmd = nG ? g.reduce((s, x) => s + Number(x.gmd_kg_dia) * Number(x.animais), 0) / nG : null;
  const sp = P('suplementacao')[0];
  const kpis = [
    kpi('Animais com pesagem', F.int(P('pesos').length), 'nos lotes ativos'),
    kpi('Ganho médio diário (GMD)', gmd == null ? '—' : F.gmd(gmd), nG ? `média de ${esc(F.int(nG))} animais com duas pesagens` : 'precisa de duas pesagens do mesmo animal', barraMeta(gmd, 'gmd')),
    kpi('Suplemento por cabeça por dia', sp ? `${F.int(sp.g_cab_dia)} g` : '—', sp ? `${esc(sp.produto)} · lote ${esc(sp.lote)}` : 'nenhum trato nos últimos 90 dias'),
  ];
  if (dono()) kpis.push(kpi('Custo do suplemento por cabeça por dia', sp ? F.brl(sp.custo_cab_dia) : '—', sp ? `${esc(F.brl(sp.custo))} em ${esc(F.int(sp.dias))} dias` : ''));
  const gmdL = linhasLista(g.map((x) => ({
    t: `${esc(x.lote)} <small>${esc(x.fazenda)}</small>`, s: esc(`${F.int(x.animais)} animais · ${dtc(x.de)} a ${dtc(x.ate)}`), v: esc(F.gmd(x.gmd_kg_dia)),
  })), 'Ainda não há animais com duas pesagens nos lotes ativos.');
  const supl = linhasLista(P('suplementacao').map((x) => ({
    t: `${esc(x.lote)} · ${esc(x.produto)}`, s: esc([`${dtc(x.de)} a ${dtc(x.ate)}`, `${F.int(x.dias)} dias`, F.kg(x.kg), `${F.int(x.cabecas)} cab.`].join(' · ')),
    v: `${esc(F.int(x.g_cab_dia))} g<small>${dono() && x.custo_cab_dia != null ? `${esc(F.brl(x.custo_cab_dia))}/cab./dia` : 'por cab./dia'}</small>`,
  })), 'Nenhum trato nos últimos 90 dias.');
  return `<div class="kpis">${kpis.join('')}</div>
    ${bloco('Peso de cada animal', 'última pesagem, por lote · cada ponto é um animal', `${pontosPorLote(P('pesos'))}<p class="nota">O traço mostra a média do lote. Toque num ponto para ver o animal.</p>`)}
    ${bloco('Ganho de peso por lote', 'entre as duas últimas pesagens', `${gmdL}<p class="nota">Referência das fazendas top (Inttegra): 0,481 kg por dia no ano.</p>`)}
    ${bloco('Suplementação por lote', 'últimos 90 dias', supl)}`;
}

function secFinanceiro() {
  if (!dono()) return '<p class="vazio">Só o dono vê o financeiro.</p>';
  const r = P1('resumo');
  const kpis = [
    kpi('Gastos do ano', F.brl(r.gasto_ano), 'protocolos, produtos usados e despesas'),
    kpi('Receitas do ano', F.brl(r.receita_ano), 'vendas de animais e outras receitas'),
    kpi('Resultado do ano', F.brl(r.resultado_ano), 'receitas menos gastos'),
    kpi('Gasto por cabeça por mês', F.brl(r.desembolso_cab_mes), `média de ${esc(F.brl(r.custo_medio_cabeca))} no ano por cabeça com custo`),
  ];
  const fm = P('financeiro_mes');
  const fluxo = colunas(fm.map((x) => mesCurto(x.mes)), [{ nome: 'receitas', c: corP('fin', 'receitas'), v: fm.map((x) => x.receitas) }, { nome: 'despesas', c: corP('fin', 'despesas'), v: fm.map((x) => x.despesas) }], { fv: F.brl0 });
  const centro = barrasH(P('custos_centro').map((c) => ({ rot: NOME_CENTRO[c.centro_custo] || c.centro_custo, v: c.valor, c: corP('centro', c.centro_custo) })));
  const ms = meses12();
  const centros = [...new Set(P('custos_mes').map((x) => x.centro_custo))].sort((a, b) => corP('centro', a) - corP('centro', b));
  const porMes = colunas(ms.map(mesCurto), centros.map((c) => ({ nome: NOME_CENTRO[c] || c, c: corP('centro', c),
    v: ms.map((m) => (P('custos_mes').find((x) => x.mes === m && x.centro_custo === c) || {}).valor || 0) })), { empilhar: true, fv: F.brl0 });
  const cat = linhasLista(P('custo_categoria').map((c) => ({
    t: `${esc(NOME_CAT[c.categoria] || c.categoria)} <small>${esc(c.fazenda)}</small>`, s: esc(`${F.int(c.cabecas)} cab. · ${F.brl(c.por_cabeca)} por cabeça`), v: esc(F.brl(c.total)),
  })), 'Nenhum custo por animal no ano.');
  const est = linhasLista(P('estoque').map((e) => ({
    t: `${esc(e.nome)}${e.alerta ? ` <span class="selo s-vazia">${esc(e.alerta)}</span>` : ''}`,
    s: esc([`saldo ${F.dec(e.saldo, 2)} ${e.unidade || ''}`, e.validade ? `validade ${dt(e.validade)}` : null].filter(Boolean).join(' · ')),
    v: esc(F.brl(e.valor_em_estoque)),
  })), 'Nenhum produto com movimento.');
  return `<div class="kpis">${kpis.join('')}</div>
    ${bloco('Receitas e despesas por mês', 'últimos 12 meses', `${legenda([{ rot: 'Receitas', c: corP('fin', 'receitas') }, { rot: 'Despesas', c: corP('fin', 'despesas') }])}${fluxo}`)}
    ${bloco('Gasto do ano por centro de custo', '', centro)}
    ${bloco('Gasto por mês', 'por centro de custo', `${legenda(centros.map((c) => ({ rot: NOME_CENTRO[c] || c, c: corP('centro', c) })))}${porMes}`)}
    ${bloco('Custo por categoria', 'ano, só animais com custo', cat)}
    ${bloco('Estoque de produtos', 'compras menos o que foi usado', est)}
    <p class="nota">Para saber o lucro de verdade: receitas menos todas as despesas (inclusive salários, diesel e energia), mais o quanto o rebanho valorizou no período.</p>`;
}

function secCampo() {
  const ch = P('chuva');
  const total = (cod) => { const x = ch.find((c) => c.fazenda === cod); return x ? x.total_12m : 0; };
  const ms = meses12();
  const graf = colunas(ms.map(mesCurto), S.dados.fazendas.map((f) => ({ nome: f.codigo, c: corP('fazenda', f.codigo),
    v: ms.map((m) => (ch.find((c) => c.mes === m && c.fazenda === f.codigo) || {}).mm || 0) })), { fv: F.mm });
  const msgs = linhasLista(P('mensagens').map((m) => ({
    t: esc(m.texto), s: esc(`${m.autor || 'sem nome'} · ${dataHora(m.recebido)}`),
    v: `<span class="selo ${m.status === 'processado' ? 's-ativo' : m.status === 'erro' || m.status === 'ambigua' ? 's-vazia' : 's-solteira'}">${esc(NOME_MSG[m.status] || m.status)}</span>`,
  })), 'Nenhuma mensagem ainda.');
  const comPasto = S.dados.fazendas.filter((f) => [...S.idx.pastos.values()].some((p) => p.f === f.id));
  const pastos = comPasto.map((f) => {
    const lista = [...S.idx.pastos.values()].filter((p) => p.f === f.id).sort((a, b) => a.id - b.id);
    const mapa = mapaFazenda(f.id);
    return bloco(`Pastos · ${f.codigo}`, 'onde cada lote está agora', `${mapa}${linhasLista(lista.map((p) => {
      const st = situacaoPasto(p);
      return {
        t: `${esc(nomeP(p))}${p.modulo ? ` <small>${esc(p.modulo)}</small>` : ''}`,
        s: esc([p.ha ? `${F.dec(p.ha, 2)} ha` : null, p.capim, st.ocupado ? `${st.lotes.join(', ')}${st.junto ? ' (usa junto com outro pasto)' : ''}` : 'sem gado'].filter(Boolean).join(' · ')),
        v: st.ocupado ? `${esc(F.int(st.dias))} dias<small>ocupado desde ${esc(dtc(st.desde))}</small>` : st.descanso != null ? `${esc(F.int(st.descanso))} dias<small>de descanso</small>` : '<small>sem registro</small>',
      };
    }), '')}`);
  }).join('');
  return `<div class="kpis">${S.dados.fazendas.map((f) => kpi(`Chuva · ${f.codigo} · 12 meses`, F.mm(total(f.codigo)), 'somando os registros do pluviômetro')).join('')}</div>
    ${pastos}
    ${bloco('Chuva por mês', 'milímetros, últimos 12 meses', `${legenda(S.dados.fazendas.map((f) => ({ rot: f.codigo, c: corP('fazenda', f.codigo) })))}${graf}`)}
    ${bloco('Mensagens do bot', 'o que chegou por último', msgs)}`;
}

// ------------------------------------------------------------------ mapa dos pastos
function situacaoPasto(p) {
  const todas = (S.dados.mapa && S.dados.mapa.ocupacoes) || S.dados.ocupacoes || [];
  const deste = (o) => o.pasto === p.id || (o.tambem || []).includes(p.id);
  const ab = todas.filter((o) => !o.sai && deste(o));
  if (ab.length) {
    const desde = ab.map((o) => o.ent).sort()[0];
    return { ocupado: true, desde, dias: diasEntre(desde, hojeISO()), junto: ab.some((o) => o.tambem && o.tambem.length),
      lotes: ab.map((o) => (S.idx.lotes.get(o.lote) || {}).nome).filter(Boolean) };
  }
  const saidas = todas.filter((o) => o.sai && deste(o)).map((o) => o.sai).sort();
  return { ocupado: false, descanso: saidas.length ? diasEntre(saidas[saidas.length - 1], hojeISO()) : null };
}
const nomeP = (p) => (p.apelido ? `${p.nome} · ${p.apelido}` : p.nome);
// rótulo que cabe no pasto: nome completo, só o apelido ou só o número (o mapa grande, com zoom, mostra tudo)
function rotuloPasto(p, larg) {
  const cabe = (t) => t.length * 5.6 <= larg;
  if (cabe(nomeP(p))) return { t: nomeP(p), cheio: true };
  if (cabe(p.nome)) return { t: p.nome, cheio: true };
  if (p.apelido && cabe(p.apelido)) return { t: p.apelido, cheio: false };
  return { t: (p.nome.match(/\d+/) || [p.nome])[0], cheio: false };
}
const merc = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function tipoLote(l) {
  const n = semAcento(l && l.nome);
  if (/abate/.test(n)) return 'abate';
  if (/parid/.test(n)) return 'paridas';
  if (/prenh/.test(n)) return 'prenhas';
  if (/bezerr/.test(n)) return 'bezerros';
  if (/novilh/.test(n) || (l && l.cat === 'novilha')) return 'novilhas';
  return 'gado';
}
// vaca de lado (desenho próprio), com bezerro quando o lote é de paridas
const vacaSvg = (x, y, bezerro) => `<g class="vaca" transform="translate(${(x + 0.6).toFixed(2)},${(y - 0.6).toFixed(2)}) scale(0.19)">
  <rect x="-22" y="-8" width="36" height="18" rx="8"/><polygon points="10,-6 24,-12 28,-2 16,4"/><polygon points="22,-12 26,-18 25,-10"/>
  <rect x="-18" y="8" width="4" height="12"/><rect x="-10" y="8" width="4" height="12"/><rect x="4" y="8" width="4" height="12"/><rect x="10" y="8" width="4" height="12"/>
  <polygon points="-23,-7 -21,-5 -26,9 -28,8"/>
  ${bezerro ? '<rect x="-31" y="2" width="16" height="10" rx="4" class="bez"/><rect x="-29" y="11" width="3" height="8"/><rect x="-19" y="11" width="3" height="8"/>' : ''}</g>`;
const cochoSvg = (x, y) => `<g class="traco" transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(0.2)"><rect x="-30" y="-9" width="60" height="24" rx="4"/><line x1="-27" y1="15" x2="-33" y2="27"/><line x1="27" y1="15" x2="33" y2="27"/></g>`;
const curralSvg = (x, y) => `<g class="traco" transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(0.2)"><line x1="-30" y1="-9" x2="30" y2="-9"/><line x1="-30" y1="9" x2="30" y2="9"/><line x1="-24" y1="-21" x2="-24" y2="21"/><line x1="0" y1="-21" x2="0" y2="21"/><line x1="24" y1="-21" x2="24" y2="21"/></g>`;
function pinoSvg(x, y, cls, miolo, rotulo, tip, ocup) {
  const R = 9, cy = y - R - 5, lb = rotulo ? Math.max(9, 4.2 * String(rotulo).length + 4) : 0;
  return `<g class="pino pc-${cls}" ${ocup != null ? `data-ocup="${ocup}"` : `data-tip="${esc(tip)}"`}>
    <path d="M${(x - 4.6).toFixed(2)},${(cy + R - 1.6).toFixed(2)}L${x.toFixed(2)},${y.toFixed(2)}L${(x + 4.6).toFixed(2)},${(cy + R - 1.6).toFixed(2)}Z" class="pino-cor"/>
    <circle cx="${x.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R}" class="pino-cor"/>
    <circle cx="${x.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R - 1.8}" class="pino-miolo"/>
    ${miolo(x, cy)}
    ${rotulo ? `<rect x="${(x + R - 3).toFixed(2)}" y="${(cy - R - 1).toFixed(2)}" width="${lb.toFixed(2)}" height="9" rx="4.5" class="pino-cor selo"/>
      <text x="${(x + R - 3 + lb / 2).toFixed(2)}" y="${(cy - R + 5.6).toFixed(2)}" class="pino-n" text-anchor="middle">${esc(rotulo)}</text>` : ''}</g>`;
}
function mapaFazenda(fid, grande, zoom) {
  const z = zoom || 1;
  const pastos = [...S.idx.pastos.values()].filter((p) => p.f === fid && p.contorno && p.contorno.coordinates);
  if (!pastos.length) return '';
  const elems = ((S.dados.mapa && S.dados.mapa.elementos) || []).filter((e) => e.f === fid && e.geo && e.geo.coordinates);
  const fundo = ((S.dados.mapa && S.dados.mapa.fundos) || []).find((x) => x.f === fid);
  const W = 320 * z;
  let P, H;
  if (fundo) {
    const ya = merc(fundo.lat1), yb = merc(fundo.lat0);
    H = Math.round((W * (ya - yb)) / (fundo.lon1 - fundo.lon0));
    P = (c) => [((c[0] - fundo.lon0) / (fundo.lon1 - fundo.lon0)) * W, ((ya - merc(c[1])) / (ya - yb)) * H];
  } else {
    const pts = [...pastos.map((p) => p.contorno.coordinates[0]), ...elems.filter((e) => e.geo.type === 'Polygon').map((e) => e.geo.coordinates[0])].flat();
    const xs = pts.map((c) => c[0]), ys = pts.map((c) => merc(c[1]));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = 6;
    const k = (W - 2 * pad) / (x1 - x0);
    H = Math.round((y1 - y0) * k + 2 * pad);
    P = (c) => [pad + (c[0] - x0) * k, pad + (y1 - merc(c[1])) * k];
  }
  const caminho = (anel) => `M${anel.map((c) => P(c).map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
  const centro = (anel) => {
    const q = anel.map(P);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < q.length - 1; i++) {
      const f = q[i][0] * q[i + 1][1] - q[i + 1][0] * q[i][1];
      a += f; cx += (q[i][0] + q[i + 1][0]) * f; cy += (q[i][1] + q[i + 1][1]) * f;
    }
    return a ? [cx / (3 * a), cy / (3 * a)] : q[0];
  };
  const todas = (S.dados.mapa && S.dados.mapa.ocupacoes) || S.dados.ocupacoes || [];
  let formas = '', textos = '', pinos = '';
  for (const p of pastos) {
    const st = situacaoPasto(p);
    const tip = `${nomeP(p)} · ${F.dec(p.ha, 2)} ha${p.capim ? ` · ${p.capim}` : ''} · ` + (st.ocupado ? `${st.lotes.join(', ')} há ${st.dias} dias` : st.descanso != null ? `descanso há ${st.descanso} dias` : 'sem gado');
    const ocs = todas.filter((o) => !o.sai && (o.pasto === p.id || (o.tambem || []).includes(p.id)));
    const tipoP = ocs.length ? tipoLote(S.idx.lotes.get(ocs[0].lote)) : null;
    formas += `<path d="${caminho(p.contorno.coordinates[0])}" class="${fundo ? `pasto-foto${tipoP ? ` oc oc-${tipoP}` : ''}` : st.ocupado ? 'pasto-oc' : 'pasto-livre'}" data-tip="${esc(tip)}"/>`;
    const [x, y] = centro(p.contorno.coordinates[0]);
    const qx = p.contorno.coordinates[0].map((c) => P(c)[0]);
    const rot = rotuloPasto(p, Math.max(...qx) - Math.min(...qx));
    if (ocs.length) {
      ocs.forEach((o, i) => {
        const lote = S.idx.lotes.get(o.lote);
        const tipo = tipoLote(lote);
        const cab = o.cab != null ? `${o.cab}${/junto com/i.test(o.obs || '') ? '+' : ''}` : '?';
        const dx = (i - (ocs.length - 1) / 2) * 26;
        pinos += pinoSvg(x + dx, y - 3, tipo, (a, b) => vacaSvg(a, b, tipo === 'paridas'), cab,
          null, todas.indexOf(o));
      });
      textos += `<text x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" class="mapa-n" text-anchor="middle">${esc(rot.t)}</text>`;
    } else {
      textos += `<text x="${x.toFixed(1)}" y="${(y + (rot.cheio ? 2 : 4)).toFixed(1)}" class="mapa-n" text-anchor="middle">${esc(rot.t)}</text>`
        + (rot.cheio ? `<text x="${x.toFixed(1)}" y="${(y + 10).toFixed(1)}" class="mapa-s" text-anchor="middle">${esc(st.descanso != null ? `descanso ${st.descanso} d` : 'sem gado')}</text>` : '');
    }
  }
  for (const e of elems) {
    const tip = e.nome + (e.obs ? `: ${e.obs}` : '');
    let x, y;
    if (e.geo.type === 'Polygon') {
      formas += `<path d="${caminho(e.geo.coordinates[0])}" class="elem" data-tip="${esc(tip)}"/>`;
      [x, y] = centro(e.geo.coordinates[0]);
    } else [x, y] = P(e.geo.coordinates);
    pinos += e.tipo === 'curral' ? pinoSvg(x, y, 'curral', curralSvg, '', tip) : pinoSvg(x, y, 'cocho', cochoSvg, '', tip);
  }
  const img = fundo ? `<image href="${esc(fundo.arquivo)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` : '';
  const credito = fundo && fundo.credito ? `<text x="${W - 3}" y="${H - 3}" class="credito" text-anchor="end">${esc(fundo.credito)}</text>` : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="grafico mapa${fundo ? ' com-foto' : ''}${grande ? ' grande' : ''}${z > 1 ? ` z${z}` : ''}" data-zoom="${z}" role="img" aria-label="Mapa dos pastos">${img}${formas}${textos}${pinos}${credito}</svg>`;
  if (grande) return svg;
  return `${svg}<p class="nota">Toque num pasto ou num ícone para ver os detalhes.</p>
    <button class="btn sec" data-ir="#mapa/${fid}">Abrir o mapa grande</button>`;
}

function telaMapa(fid) {
  const f = S.idx.faz.get(Number(fid));
  if (!f) return '<section class="pagina"><p class="vazio">Fazenda não encontrada.</p></section>';
  return `<section class="pagina mapa-tela">
    <div class="mapa-topo"><button class="voltar" data-acao="voltar">${I.voltar}Voltar</button>
      <div class="zoom"><button class="btn-ic" data-acao="zoom" data-valor="-1" aria-label="Diminuir">−</button><button class="btn-ic" data-acao="zoom" data-valor="1" aria-label="Aumentar">+</button></div></div>
    <h1 class="h1">Pastos · ${esc(f.codigo)}</h1>
    <div class="mapa-caixa" id="mapa-caixa" data-f="${f.id}">${mapaFazenda(f.id, true)}</div>
    <p class="nota">Use + e − para aproximar e arraste para andar pelo mapa. Toque num pasto ou num ícone para ver os detalhes.</p>
  </section>`;
}

function definicoes() {
  const itens = [
    ['Prenhez no último diagnóstico', 'Fêmeas cujo último diagnóstico de gestação deu positivo, sobre todas as diagnosticadas. Antes de uma IATF, mostra só as que já estavam prenhas.'],
    ['Natalidade', 'Nascimentos dos últimos 12 meses divididos pelas matrizes ativas.'],
    ['Mortalidade', 'Mortes dos últimos 12 meses divididas pelo rebanho (ativos mais os que morreram).'],
    ['Metas', 'Prenhez de 83% (fazendas top do benchmarking Inttegra), natalidade de 80%, mortalidade de até 2% ao ano e ganho de 0,481 kg por dia. Peça ao Claude para trocar qualquer meta.'],
    ...(dono() ? [['Gasto lançado no ano', 'Etapas de protocolo feitas (produto, sêmen e veterinário), produtos usados do estoque e despesas lançadas, de janeiro até hoje. Produto usado no lote é dividido pelas cabeças do lote no dia; bonificado entra com custo zero.'],
      ['Gasto por cabeça por mês', 'Gasto do ano dividido pelas cabeças ativas e pelos meses que já passaram.']] : []),
    ['Arroba', '30 kg de peso vivo, regra da fazenda.'],
    ['Ganho médio diário', 'Diferença de peso entre as duas últimas pesagens dividida pelos dias entre elas.'],
  ];
  return `<details class="bloco definicoes"><summary class="h2">Como cada número é calculado</summary>
    <dl class="defs">${itens.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;
}

// toque num gráfico: mostra o valor numa bolha
(function () {
  let bolha = null, tempo = null;
  document.addEventListener('click', (ev) => {
    const alvo = ev.target.closest && ev.target.closest('[data-tip]');
    if (!bolha) { bolha = document.createElement('div'); bolha.className = 'bolha'; bolha.hidden = true; document.body.appendChild(bolha); }
    if (!alvo) { bolha.hidden = true; return; }
    bolha.textContent = alvo.getAttribute('data-tip');
    bolha.hidden = false;
    const larg = Math.min(260, window.innerWidth - 24);
    bolha.style.maxWidth = `${larg}px`;
    const x = Math.max(12, Math.min(window.innerWidth - larg - 12, ev.clientX - larg / 2));
    bolha.style.left = `${x}px`;
    bolha.style.top = `${Math.max(12, ev.clientY - 52)}px`;
    clearTimeout(tempo);
    tempo = setTimeout(() => { bolha.hidden = true; }, 2600);
  });
})();

// ------------------------------------------------------------------ tela do lote (toque no gado do mapa)
function janelaLote(i) {
  const todas = (S.dados.mapa && S.dados.mapa.ocupacoes) || S.dados.ocupacoes || [];
  const o = todas[i];
  if (!o) return;
  const lote = S.idx.lotes.get(o.lote), pasto = S.idx.pastos.get(o.pasto);
  const pastos = [pasto, ...(o.tambem || []).map((id) => S.idx.pastos.get(id))].filter(Boolean);
  const ha = pastos.reduce((t, p) => t + (Number(p.ha) || 0), 0);
  const bichos = S.dados.animais.filter((a) => a.st === 'ativo' && (a.lotes || []).includes(o.lote));
  const cab = o.cab != null ? Number(o.cab) : bichos.length;
  const ult = bichos.map((a) => { const ps = pesos(a); return ps.length ? Number(ps[ps.length - 1].p) : null; }).filter((v) => v);
  const pm = ult.length ? ult.reduce((t, v) => t + v, 0) / ult.length : null;
  const linha = (r, v) => `<div><dt>${esc(r)}:</dt><dd>${esc(v)}</dd></div>`;
  const porCat = new Map();
  for (const a of bichos) { const k = NOME_CAT[a.c] || a.c; porCat.set(k, (porCat.get(k) || 0) + 1); }
  const cats = [...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div>${n} cb · ${esc(k)}</div>`).join('')
    || '<p class="vazio">Os animais deste lote ainda não estão cadastrados um a um.</p>';
  abrirJanela(`<h2>${esc(lote ? lote.nome : 'Lote')} · ${esc(pastos.map(nomeP).join(' + '))}</h2>
    <div class="abas-lote"><button data-acao="lote-aba" data-valor="resumo" aria-pressed="true">Resumo do lote</button><button data-acao="lote-aba" data-valor="cats" aria-pressed="false">Categorias</button></div>
    <div id="lote-resumo" class="lote-res"><p class="grande">${esc(F.int(cab))}</p><p>Cabeças${/junto com/i.test(o.obs || '') ? ' (e mais gado junto)' : ''}</p><dl>
      ${linha('Peso médio', pm ? `${F.kg(Math.round(pm))} (${ult.length} pesados)` : 'sem pesagem')}
      ${ha ? linha('Área', `${F.dec(ha, 1)} ha`) : ''}
      ${ha && pm ? linha('Lotação', `${F.int(Math.round((cab * pm) / ha))} kg/ha · ${F.dec((cab * pm) / 450 / ha, 1)} UA/ha`) : ha ? linha('Lotação', `${F.dec(cab / ha, 1)} cab/ha`) : ''}
      ${pasto && pasto.capim ? linha('Capim', pasto.capim) : ''}
      ${linha('Entrou no pasto', o.ent ? `${dtc(o.ent)} · há ${diasEntre(o.ent, hojeISO())} dias` : '—')}
    </dl></div>
    <div id="lote-cats" class="cats" hidden>${cats}</div>
    ${botoesBreve([['balanca', 'Pesagem'], ['pasto', 'Mudar de pasto'], ['nasc', 'Nascimento'], ['morte', 'Morte'], ['saude', 'Vacina ou remédio'], ['curral', 'Sessão no curral']])}`);
}
