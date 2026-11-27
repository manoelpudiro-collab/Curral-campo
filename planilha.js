// Curral Digital — ler a planilha da balança (app 2.14; pedido do produtor em 27/11/2026). Só o dono, sem internet.
// Manejo › Pesagem › "Ler planilha da balança": o produtor escolhe no celular o Excel (.xlsx) que o app da balança
// (Coimma Pec) exporta ou um .csv. O app abre o arquivo aqui mesmo (o .xlsx é um zip: lê com o DecompressionStream do
// navegador, sem programa de fora), acha a tabela "Id. Animal · Peso (kg) · Data", acha cada animal pelo número e põe
// na lista da pesagem. Quem não acha fica em "Não achei o animal" para digitar o número ou deixar de fora; quem já tem
// a mesma pesagem no sistema é pulado. Confere a quantidade e o peso total com o resumo da própria planilha.
// O "Id. Animal" da Coimma é digitado na balança: "vaca 18", "271 descarte", "AB2-05" o app acha; quando o texto tem
// "ficar", "viajar", "matar"… o número pode ser só a contagem ("novilha ficar 2") e o app não chuta: pergunta.
// Usa S, esc, kg, dt, dtc, acharAnimal, avisoPeso, pesos, resumo, mexer, rasc, guardarRasc, tipoAtual, avisar, lerReais.
'use strict';

const PALAVRAS_CONTAGEM = /\b(fic|fica|ficar|viaj\w*|matar|mata|abate|lote|apart\w*|sessao)\b/;
const tiraAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ------------------------------------------------------------------ abrir o arquivo
async function zipEntradas(buf) {
  const dv = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('nao_xlsx');
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const ents = {};
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const met = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    ents[new TextDecoder().decode(new Uint8Array(buf, p + 46, nl))] = { met, csz, lho };
    p += 46 + nl + xl + cl;
  }
  return ents;
}
async function zipTexto(buf, ent) {
  const dv = new DataView(buf);
  const ini = ent.lho + 30 + dv.getUint16(ent.lho + 26, true) + dv.getUint16(ent.lho + 28, true);
  const dados = new Uint8Array(buf, ini, ent.csz);
  if (ent.met === 0) return new TextDecoder().decode(dados);
  if (ent.met !== 8) throw new Error('compressao');
  if (typeof DecompressionStream !== 'function') throw new Error('sem_descompactar');
  const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(s).text();
}
const colNum = (ref) => { let n = 0; for (const ch of String(ref).replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
// número de série do Excel (dias desde 30/12/1899) → AAAA-MM-DD
const serieData = (v) => new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 864e5).toISOString().slice(0, 10);

async function lerXlsx(buf) {
  const ents = await zipEntradas(buf);
  const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
  const ss = [];
  if (ents['xl/sharedStrings.xml']) {
    const d = xml(await zipTexto(buf, ents['xl/sharedStrings.xml']));
    for (const si of d.getElementsByTagName('si')) ss.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  }
  const folhas = Object.keys(ents).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!folhas.length) throw new Error('nao_xlsx');
  const d = xml(await zipTexto(buf, ents[folhas[0]]));
  const linhas = [];
  for (const row of d.getElementsByTagName('row')) {
    const l = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = v ? ss[Number(v.textContent)] ?? '' : '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
      else val = v ? v.textContent : '';
      l[colNum(c.getAttribute('r'))] = val;
    }
    linhas.push([...l].map((x) => (x == null ? '' : String(x))));
  }
  return linhas;
}
function lerCsv(txt) {
  const ls = txt.replace(/^﻿/, '').split(/\r?\n/);
  const sep = (ls.find((l) => l.trim()) || '').split(';').length > (ls.find((l) => l.trim()) || '').split(',').length ? ';' : ',';
  return ls.map((l) => l.split(sep).map((x) => x.replace(/^"|"$/g, '').trim()));
}
async function abrirPlanilha(arquivo) {
  const nome = (arquivo.name || '').toLowerCase();
  if (/\.pdf$/.test(nome)) throw new Error('pdf');
  if (/\.xls$/.test(nome)) throw new Error('xls');
  const buf = await arquivo.arrayBuffer();
  const zip = buf.byteLength > 4 && new DataView(buf).getUint32(0, true) === 0x04034b50;
  if (zip) return lerXlsx(buf);
  if (/\.(csv|txt)$/.test(nome)) return lerCsv(new TextDecoder().decode(buf));
  throw new Error('nao_xlsx');
}

// ------------------------------------------------------------------ entender a tabela
const pesoTxt = (v) => lerReais(String(v ?? '').replace(/kg/ig, '').trim());
function dataTxt(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  if (/^\d{5}(\.\d+)?$/.test(s) && Number(s) > 30000 && Number(s) < 60000) return serieData(s);
  return null;
}
function interpretar(linhas) {
  const n = (x) => tiraAcento(x).replace(/[^a-z0-9]/g, '');
  const h = linhas.findIndex((l) => l.some((x) => /^(idanimal|animal|brinco|identificacao|id|numero)$/.test(n(x))) && l.some((x) => /^peso/.test(n(x))));
  if (h < 0) throw new Error('sem_tabela');
  const cab = linhas[h].map(n);
  const ci = cab.findIndex((x) => /^(idanimal|animal|brinco|identificacao|id|numero)$/.test(x));
  const cp = cab.findIndex((x) => /^peso/.test(x));
  const cd = cab.findIndex((x) => x === 'data');
  const ch = cab.findIndex((x) => x === 'hora');
  const co = cab.findIndex((x) => /^obs/.test(x));
  const info = {};
  for (const l of linhas.slice(0, h)) {
    const k = n(l[0]);
    if (k === 'sessao') info.sessao = (l[1] || '').trim();
    if (k === 'quantidade') info.qtd = Math.round(pesoTxt(l[1]) || 0) || null;
  }
  const itens = [];
  let i = h + 1;
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^aparta/.test(n(l[0])) || /^resumo|^total/.test(n(l[0]))) break;
    const kgv = pesoTxt(l[cp]);
    const txt = String(l[ci] ?? '').trim();
    if (!txt && kgv == null) { if (itens.length) break; continue; }
    if (kgv == null) continue;
    itens.push({ txt, kg: Math.round(kgv * 10) / 10, d: cd >= 0 ? dataTxt(l[cd]) : null, h: ch >= 0 ? String(l[ch] || '') : '', obs: co >= 0 ? String(l[co] || '').trim() : '' });
  }
  // resumo da própria planilha (Coimma: "Apartação · Peso Total (kg) · Peso Médio · Animais")
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (n(l[0]) === 'apartacao' && /pesototal/.test(n(l[1]))) {
      let kgT = 0, nT = 0;
      for (const x of linhas.slice(i + 1)) { if (!String(x[0] || '').trim()) break; kgT += pesoTxt(x[1]) || 0; nT += Math.round(pesoTxt(x[3]) || 0); }
      info.kgTotal = kgT || null; if (!info.qtd && nT) info.qtd = nT;
      break;
    }
  }
  return { info, itens };
}

// "vaca 18" → 0018; "271 descarte" → 0271; "AB2-05" → AB2-05; "novilha ficar 2" → não chuta (o 2 pode ser contagem)
function acharDaLinha(txt) {
  const t = tiraAcento(txt).trim();
  if (!t) return { a: null, porque: 'sem número' };
  const inteiro = acharAnimal(txt);
  if (inteiro && /\d/.test(txt) && !/\s/.test(txt.trim())) return { a: inteiro };
  for (const tok of txt.split(/[\s,;:/]+/)) if (/[a-z]/i.test(tok) && /\d/.test(tok)) { const a = acharAnimal(tok); if (a) return { a }; }
  const nums = t.match(/\d+/g) || [];
  if (!nums.length) return { a: null, porque: 'sem número' };
  if (PALAVRAS_CONTAGEM.test(t)) return { a: null, porque: 'o número pode ser só contagem' };
  if (nums.length > 1) return { a: null, porque: 'mais de um número' };
  const a = acharAnimal(nums[0]);
  return a ? { a } : { a: null, porque: `não tem ${nums[0].padStart(4, '0')} no rebanho` };
}

// monta o resultado e já põe na lista da pesagem quem foi achado
function aplicarPlanilha(r, nome, tab) {
  const datas = {};
  for (const x of tab.itens) if (x.d) datas[x.d] = (datas[x.d] || 0) + 1;
  const dataPl = Object.entries(datas).sort((p, q) => q[1] - p[1])[0];
  if (dataPl && dataPl[0] <= hojeISO()) r.data = dataPl[0];
  const ja = new Set((r.itens || []).map((x) => x.a));
  const linhas = [];
  for (const x of tab.itens) {
    const ach = acharDaLinha(x.txt);
    const L = { txt: x.txt, kg: x.kg, d: x.d, h: x.h, obs: x.obs, a: ach.a ? ach.a.id : null, porque: ach.porque || '' };
    if (ach.a) {
      const a = ach.a;
      if (pesos(a).some((p) => p.d === r.data && Math.abs(p.p - x.kg) < 0.05)) { L.ja = true; }
      else if (ja.has(a.id)) { L.dupla = true; }
      else {
        r.itens = (r.itens || []).filter((y) => y.a !== a.id);
        r.itens.push({ a: a.id, kg: x.kg, aviso: avisoPeso(a, x.kg, r.data), orig: x.txt });
        ja.add(a.id);
      }
    }
    linhas.push(L);
  }
  r.planilha = { nome, sessao: tab.info.sessao || '', qtd: tab.info.qtd || null, kgTotal: tab.info.kgTotal || null, linhas,
    datas: Object.keys(datas).length };
}

// ------------------------------------------------------------------ na tela da pesagem
function blocoPlanilha(r) {
  const P = r.planilha;
  const botao = `<label class="btn sec arquivo"><input type="file" id="p-arquivo" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv">
    ${I.atualizar}Ler planilha da balança</label>`;
  if (!P) return `${botao}<p class="nota">Excel (.xlsx) do app da balança (Coimma Pec): exporte, salve em Arquivos e escolha aqui.</p>`;
  const L = P.linhas;
  const achados = L.filter((x) => x.a && !x.ja && !x.dupla), ja = L.filter((x) => x.ja), dup = L.filter((x) => x.dupla);
  const faltam = L.filter((x) => !x.a && !x.fora), fora = L.filter((x) => !x.a && x.fora);
  const kgL = L.reduce((s, x) => s + x.kg, 0);
  const confere = [];
  if (P.qtd && P.qtd !== L.length) confere.push(`a planilha diz ${P.qtd} animais e eu li ${L.length}`);
  if (P.kgTotal && Math.abs(P.kgTotal - kgL) > 0.5) confere.push(`a planilha diz ${kg(P.kgTotal)} e as linhas somam ${kg(kgL)}`);
  if (P.datas > 1) confere.push('tem pesagem de mais de um dia: vale a data de cima para todas');
  return `<div class="bloco planilha" id="p-bloco"><div class="bloco-h"><h2 class="h2">${I.balanca}Planilha da balança</h2>
      <button class="link perigo-t" data-acao="p-limpar">tirar</button></div>
    <p class="nota"><b>${esc(P.sessao ? `Sessão ${P.sessao}` : P.nome)}</b> · ${L.length} pesagens · ${esc(kg(kgL))}${P.qtd === L.length && (!P.kgTotal || Math.abs(P.kgTotal - kgL) <= 0.5) ? ' · ✅ bate com o resumo da planilha' : ''}</p>
    ${confere.map((t) => `<p class="achado aviso-t">⚠️ Confere: ${esc(t)}.</p>`).join('')}
    <p class="nota">✅ ${achados.length} ${achados.length === 1 ? 'animal achado' : 'animais achados'} (na lista abaixo)${ja.length ? ` · ${ja.length} já ${ja.length === 1 ? 'estava' : 'estavam'} no sistema com esse peso (pulei)` : ''}${dup.length ? ` · ${dup.length} repetido(s) na planilha (ficou o primeiro)` : ''}${fora.length ? ` · ${fora.length} deixado(s) de fora` : ''}</p>
    ${!achados.length && !faltam.length && ja.length ? '<p class="achado sim">Tudo dessa planilha já está no sistema com o mesmo peso: nada para lançar.</p>' : ''}
    ${faltam.length ? `<p class="nota pl-falta"><b>Não achei o animal (${faltam.length})</b> · digite o número do brinco e toque em pôr, ou deixe de fora.</p>
      <div class="lista">${L.map((x, i) => (x.a || x.fora ? '' : `<div class="item item-fixo pl-linha"><span><span class="item-t">“${esc(x.txt || 'sem identificação')}” · ${esc(kg(x.kg))}</span>
          <span class="item-m">${esc(x.porque)}${x.obs ? ` · ${esc(x.obs)}` : ''}</span>
          <span class="pl-por"><input id="p-num-${i}" data-i="${i}" inputmode="numeric" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="brinco">
          <button class="link" data-acao="p-por" data-valor="${i}">pôr</button>
          <button class="link perigo-t" data-acao="p-fora" data-valor="${i}">deixar de fora</button></span></span></div>`)).join('')}</div>
      <button class="link" data-acao="p-fora-todos">deixar de fora todos os ${faltam.length} sem número</button>` : ''}
  </div>`;
}
function mensagemErroPlanilha(e) {
  const m = String((e && e.message) || e);
  if (m === 'pdf') return 'O app lê o Excel (.xlsx), não o PDF. No app da balança, exporte em Excel.';
  if (m === 'xls') return 'Esse é o Excel antigo (.xls). Exporte em .xlsx ou salve como .xlsx e tente de novo.';
  if (m === 'sem_descompactar') return 'Este celular não consegue abrir o Excel. Atualize o sistema do celular ou mande a planilha para o Claude.';
  if (m === 'sem_tabela') return 'Não achei a tabela com o número do animal e o peso nessa planilha.';
  return 'Não consegui ler essa planilha. Confira se é o Excel (.xlsx) da balança.';
}

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.id !== 'p-arquivo' || tipoAtual() !== 'pesagem') return;
  const f = el.files && el.files[0];
  if (!f) return;
  try {
    const tab = interpretar(await abrirPlanilha(f));
    if (!tab.itens.length) throw new Error('sem_tabela');
    mexer((r) => aplicarPlanilha(r, f.name || 'planilha', tab));
    const P = rasc('pesagem').planilha;
    const ach = P.linhas.filter((x) => x.a && !x.ja && !x.dupla).length;
    avisar(`Li ${P.linhas.length} pesagens: ${ach} na lista${P.linhas.length - ach ? `, ${P.linhas.length - ach} para conferir` : ''}.`);
  } catch (e) {
    avisar(mensagemErroPlanilha(e));
  }
});
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao^="p-"]');
  if (!b || tipoAtual() !== 'pesagem') return;
  const acao = b.dataset.acao, i = Number(b.dataset.valor);
  if (acao === 'p-limpar') return mexer((r) => { delete r.planilha; r.itens = (r.itens || []).filter((x) => !x.orig); });
  if (acao === 'p-fora') return mexer((r) => { r.planilha.linhas[i].fora = true; });
  if (acao === 'p-fora-todos') return mexer((r) => { for (const x of r.planilha.linhas) if (!x.a) x.fora = true; });
  if (acao === 'p-por') {
    const v = ($(`#p-num-${i}`) || {}).value || '';
    const a = acharAnimal(v);
    if (!a) { avisar('Não achei esse número no rebanho.'); return; }
    if (rasc('pesagem').itens?.some((x) => x.a === a.id)) { avisar(`A ${a.n} já está na lista.`); return; }
    mexer((r) => {
      const x = r.planilha.linhas[i];
      x.a = a.id;
      r.itens = [...(r.itens || []), { a: a.id, kg: x.kg, aviso: avisoPeso(a, x.kg, r.data), orig: x.txt }];
    });
  }
});
document.addEventListener('keydown', (ev) => {
  const el = ev.target;
  if (ev.key !== 'Enter' || !/^p-num-/.test(el.id || '')) return;
  ev.preventDefault();
  $(`[data-acao="p-por"][data-valor="${el.dataset.i}"]`)?.click();
});
