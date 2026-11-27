// Curral Digital — etapa 4 (app 2.9): pesagem e desempenho, tudo calculado no celular com a cópia guardada (sem internet).
// Gráfico de peso (animal e lote), peso aos 205 dias ajustado, crias da vaca com intervalo entre partos,
// desmama por safra com kg desmamado por vaca exposta. Usa esc, S, I, kg, dt, dtc, diasEntre, pesos… do app.js e
// bloco, kpi, barraMeta, linhasLista, F, corP do painel.js (na hora em que são chamadas).
'use strict';

const PN_PADRAO = 30;            // peso ao nascer quando o bezerro não foi pesado ao nascer (kg)
const DESM_IDADE = [120, 300];   // sem pesagem marcada "desmama": vale a pesagem dessa idade mais perto dos 205 dias

const idadeEm = (a, d) => (a.nasc ? diasEntre(a.nasc, d) : null);
function pesoAoNascer(a, ps) {
  const p = ps.find((e) => e.pn || (a.nasc && e.d === a.nasc));
  return p ? { kg: Number(p.p), est: false } : { kg: PN_PADRAO, est: true };
}
// pesagem da desmama: a marcada "desmama"; se nenhuma foi marcada, a de 4 a 10 meses de idade mais perto dos 205 dias
function pesagemDesmama(a, ps) {
  if (!a.nasc) return null;
  const marcada = ps.find((e) => e.dm && idadeEm(a, e.d) > 30);
  if (marcada) return { e: marcada, marcada: true };
  const c = ps.filter((e) => { const i = idadeEm(a, e.d); return i >= DESM_IDADE[0] && i <= DESM_IDADE[1]; })
    .sort((x, y) => Math.abs(idadeEm(a, x.d) - 205) - Math.abs(idadeEm(a, y.d) - 205));
  return c.length ? { e: c[0], marcada: false } : null;
}
// peso aos 205 dias ajustado: nascer + (peso − nascer) ÷ idade × 205
function p205(a, ps = pesos(a)) {
  const dm = pesagemDesmama(a, ps);
  if (!dm) return null;
  const idade = idadeEm(a, dm.e.d);
  if (!idade || idade <= 0) return null;
  const pn = pesoAoNascer(a, ps);
  const v = pn.kg + ((Number(dm.e.p) - pn.kg) / idade) * 205;
  return { v: Math.round(v), peso: Number(dm.e.p), idade, d: dm.e.d, marcada: dm.marcada, pnEst: pn.est, pn: pn.kg };
}

// gráfico de linha: séries [{nome, c, pts: [{d, v, tip, ir}]}], datas no eixo de baixo
function graficoLinha(series, { fy = (v) => F.kg(v), alt = 170 } = {}) {
  const pts = series.flatMap((s) => s.pts);
  if (!pts.length) return '';
  const W = 320, esq = 50, dir = W - 6, topo = 16, base = alt - 22;
  const ts = pts.map((p) => Date.parse(p.d + 'T12:00:00Z'));
  let t0 = Math.min(...ts), t1 = Math.max(...ts);
  if (t1 === t0) { t0 -= 15 * 864e5; t1 += 15 * 864e5; }
  const vs = pts.map((p) => Number(p.v));
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 20) { lo -= 10; hi += 10; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (d) => esq + ((Date.parse(d + 'T12:00:00Z') - t0) / (t1 - t0)) * (dir - esq);
  const y = (v) => base - ((Number(v) - lo) / (hi - lo)) * (base - topo);
  let o = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="eixo"/>
    <text x="0" y="10" class="rot">${esc(fy(hi - pad))}</text><text x="0" y="${base - 4}" class="rot">${esc(fy(lo + pad))}</text>`;
  for (const s of series) {
    const ord = s.pts.slice().sort((p, q) => p.d.localeCompare(q.d));
    if (ord.length > 1) o += `<polyline points="${ord.map((p) => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" class="linha-g s${s.c}"/>`;
    for (const p of ord) {
      o += `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5" class="f${s.c} ponto-p" data-tip="${esc(p.tip || `${s.nome}: ${fy(p.v)} em ${dtc(p.d)}`)}"${p.ir ? ` data-ir="${esc(p.ir)}"` : ''}/>`;
    }
  }
  const datas = [...new Set(pts.map((p) => p.d))].sort();
  const marcas = datas.length <= 4 ? datas : [datas[0], datas[Math.floor(datas.length / 2)], datas[datas.length - 1]];
  for (const d of marcas) {
    const xx = x(d), anc = xx > W - 30 ? 'end' : 'middle';
    o += `<text x="${xx.toFixed(1)}" y="${alt - 6}" class="rot" text-anchor="${anc}">${esc(dtc(d))}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${alt}" class="grafico">${o}</svg>`;
}

// ---------------------------------------------------------------- ficha do animal
function graficoPesoAnimal(a, ps) {
  if (ps.length < 2) return '';
  const pts = ps.map((e, i) => {
    const g = i ? gmd(ps[i - 1], e) : null;
    return { d: e.d, v: Number(e.p), tip: `${kg(e.p)} em ${dtc(e.d)}${g !== null ? ` · ${g > 0 ? '+' : ''}${g.toLocaleString('pt-BR')} g/dia` : ''}${e.dm ? ' · desmama' : ''}` };
  });
  return graficoLinha([{ nome: a.n, c: corP('categ', a.c), pts }]);
}
function linhaP205(a, ps) {
  const r = p205(a, ps);
  if (!r) return null;
  const como = `pesou ${kg(r.peso)} com ${r.idade} dias em ${dtc(r.d)}${r.marcada ? ' (desmama)' : ''}`;
  return ['Peso aos 205 dias', `${kg(r.v)} ajustado · ${como}${r.pnEst ? ` · nascer ${PN_PADRAO} kg (não pesado)` : ` · nasceu com ${kg(r.pn)}`}`];
}
// crias da vaca: peso aos 205 dias de cada uma e intervalo entre partos
function blocoCrias(a) {
  if (a.s !== 'F') return '';
  const crias = (S.idx.filhos.get(a.id) || []).filter((x) => x.nasc).sort((x, y) => x.nasc.localeCompare(y.nasc));
  if (!crias.length) return '';
  const linhas = crias.map((c) => {
    const r = p205(c);
    return { t: `${esc(c.n)} <small>${esc(c.s === 'M' ? 'macho' : c.s === 'F' ? 'fêmea' : '')}</small>`,
      s: esc(`nasceu ${dt(c.nasc)}${r ? ` · pesou ${kg(r.peso)} com ${r.idade} dias` : ' · sem peso de desmama'}`),
      v: r ? `${esc(kg(r.v))}<small>aos 205 dias</small>` : '', ir: `#animal/${c.id}` };
  });
  const ieps = crias.slice(1).map((c, i) => diasEntre(crias[i].nasc, c.nasc)).filter((d) => d > 200);
  const comP = crias.map((c) => p205(c)).filter(Boolean);
  const info = [];
  if (ieps.length) {
    const m = Math.round(ieps.reduce((s, d) => s + d, 0) / ieps.length);
    info.push(`Intervalo entre partos: <b>${esc(F.int(m))} dias</b> (${esc(F.dec(m / 30.4, 1))} meses)${ieps.length > 1 ? `, média de ${ieps.length}; último ${esc(F.int(ieps[ieps.length - 1]))} dias` : ''}. O ideal é perto de 1 bezerro por ano (≈ 365 dias).`);
  }
  if (comP.length > 1) info.push(`Média das crias aos 205 dias: <b>${esc(kg(Math.round(comP.reduce((s, r) => s + r.v, 0) / comP.length)))}</b>.`);
  return `<div class="bloco"><h2 class="h2">${I.familia}Crias e desmama</h2>
    ${info.map((t) => `<p class="nota">${t}</p>`).join('')}${linhasLista(linhas, '')}</div>`;
}

// ---------------------------------------------------------------- painel Desempenho
function membrosDoLote(l) { return S.dados.animais.filter((a) => a.st === 'ativo' && (a.lotes || []).includes(l.id)); }
function evolucaoLotes() {
  const series = [];
  const lista = [];
  S.dados.lotes.forEach((l) => {
    const porData = new Map();
    for (const a of membrosDoLote(l)) for (const e of pesos(a)) empurrar(porData, e.d, Number(e.p));
    if (!porData.size) return;
    const c = [1, 5, 4, 2, 6, 3, 8, 7][series.length % 8];
    const pts = [...porData.entries()].map(([d, v]) => ({ d, v: v.reduce((s, x) => s + x, 0) / v.length, n: v.length }))
      .sort((p, q) => p.d.localeCompare(q.d));
    series.push({ nome: l.nome, c, pts: pts.map((p) => ({ ...p, tip: `${l.nome}: média ${F.kg(Math.round(p.v))} em ${dtc(p.d)} (${p.n} pesados)` })) });
    const ult = pts[pts.length - 1], pri = pts[0];
    const d = diasEntre(pri.d, ult.d);
    lista.push({ t: `<span class="bola b${c}"></span> ${esc(l.nome)} <small>${esc(faz(l.f).codigo)}</small>`,
      s: esc(`${pts.length} ${pts.length === 1 ? 'pesagem' : 'pesagens'} · última ${dtc(ult.d)} · ${ult.n} pesados${pts.length > 1 && d > 0 ? ` · ${F.kg(Math.round(ult.v - pri.v))} em ${d} dias` : ''}`),
      v: `${esc(F.kg(Math.round(ult.v)))}<small>média</small>` });
  });
  if (!series.length) return '<p class="vazio">Nenhuma pesagem nos lotes ativos.</p>';
  return `${graficoLinha(series)}${linhasLista(lista, '')}`;
}
// fêmeas expostas na estação que gerou a safra Y: em protocolo com D0 de 1º/07 de Y−1 a 30/06 de Y
function expostasDaSafra(f, ano) {
  const ini = `${ano - 1}-07-01`, fim = `${ano}-06-30`;
  const prots = new Set(S.dados.protocolos.filter((p) => p.f === f && p.d0 && p.d0 >= ini && p.d0 <= fim).map((p) => p.id));
  if (!prots.size) return null;
  const ids = new Set();
  for (const r of S.dados.aplicacoes) { const m = S.idx.manejos.get(r[0]); if (m && prots.has(m.prot)) ids.add(r[1]); }
  return ids.size || null;
}
function dadosDesmama() {
  const bez = S.dados.animais.filter((a) => a.nasc && ['bezerro', 'bezerra', 'garrote', 'novilha', 'boi', 'touro'].includes(a.c)
    && (a.st === 'ativo' || a.st === 'vendido'));
  const linhas = [];
  for (const a of bez) { const r = p205(a); if (r) linhas.push({ a, r, safra: Number(a.nasc.slice(0, 4)) }); }
  return linhas;
}
function blocosDesmama() {
  const dd = dadosDesmama();
  const media = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const safras = [...new Set(dd.map((x) => x.safra))].sort((a, b) => b - a);
  const resumo = [];
  let kpiP = null, kpiKg = null;
  for (const ano of safras) {
    for (const f of S.dados.fazendas) {
      const xs = dd.filter((x) => x.safra === ano && x.a.f === f.id);
      if (!xs.length) continue;
      const m = media(xs.filter((x) => x.a.s === 'M').map((x) => x.r.v)), fe = media(xs.filter((x) => x.a.s === 'F').map((x) => x.r.v));
      const soma = xs.reduce((s, x) => s + x.r.peso, 0);
      const exp = expostasDaSafra(f.id, ano);
      const kgv = exp ? Math.round(soma / exp) : null;
      resumo.push({ t: `Safra ${ano} <small>${esc(f.codigo)}</small>`,
        s: esc([`${xs.length} bezerros com peso`, m != null ? `machos ${F.kg(m)}` : null, fe != null ? `fêmeas ${F.kg(fe)}` : null,
          exp ? `${exp} vacas expostas · desmama ${F.pct(Math.round((1000 * xs.length) / exp) / 10)}` : 'estação dessa safra não está no sistema',
          `idade média ${F.int(media(xs.map((x) => x.r.idade)))} dias`].filter(Boolean).join(' · ')),
        v: kgv != null ? `${esc(F.kg(kgv))}<small>por vaca exposta</small>` : `${esc(F.kg(media(xs.map((x) => x.r.v))))}<small>aos 205 dias</small>` });
      if (kpiP == null) kpiP = { v: media(xs.map((x) => x.r.v)), n: xs.length, ano, f: f.codigo };
      if (kpiKg == null && kgv != null) kpiKg = { v: kgv, ano, f: f.codigo, exp };
    }
  }
  const cada = dd.slice().sort((x, y) => y.r.v - x.r.v).slice(0, 40).map((x) => {
    const mae = x.a.mae ? S.idx.porId.get(x.a.mae) : null;
    return { t: `${esc(x.a.n)} <small>${esc(x.a.s === 'M' ? 'macho' : 'fêmea')} · ${esc(faz(x.a.f).codigo)}</small>`,
      s: esc(`${mae ? `mãe ${mae.n} · ` : ''}pesou ${F.kg(x.r.peso)} com ${x.r.idade} dias${x.r.marcada ? ' (desmama)' : ''}`),
      v: `${esc(F.kg(x.r.v))}<small>aos 205 dias</small>`, ir: `#animal/${x.a.id}` };
  });
  return {
    kpis: [
      kpi('Peso aos 205 dias', kpiP ? F.kg(kpiP.v) : '—', kpiP ? esc(`média de ${kpiP.n} bezerros · safra ${kpiP.ano} ${kpiP.f}`) : 'precisa da pesagem da desmama', barraMeta(kpiP && kpiP.v, 'p205')),
      kpi('Kg desmamado por vaca exposta', kpiKg ? F.kg(kpiKg.v) : '—', kpiKg ? esc(`safra ${kpiKg.ano} ${kpiKg.f} · ${kpiKg.exp} vacas expostas`) : 'precisa da desmama e da estação (IATF) da safra', barraMeta(kpiKg && kpiKg.v, 'kgvaca')),
    ],
    html: `${bloco('Desmama por safra', 'safra = ano em que o bezerro nasceu', `${linhasLista(resumo, 'Ainda não há bezerro pesado na desmama. Na pesagem, escolha “Desmama (apartação)”.')}
      <p class="nota">Peso aos 205 dias = peso ao nascer + (peso da desmama − peso ao nascer) ÷ idade × 205. Sem peso ao nascer, conta ${PN_PADRAO} kg. Sem pesagem marcada como desmama, vale a pesagem de 4 a 10 meses de idade mais perto dos 205 dias. Vacas expostas = fêmeas em protocolo de IATF na estação que gerou a safra (D0 de julho a junho). Referência das fazendas top: 200 kg aos 205 dias e mais de 150 kg desmamados por vaca exposta.</p>`)}
      ${cada.length ? bloco('Cada bezerro aos 205 dias', 'do mais pesado para o mais leve · ajuda a escolher novilhas e a ver as vacas que desmamam pouco', linhasLista(cada, '')) : ''}`,
  };
}
