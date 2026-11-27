// Curral Digital — financeiro e comparação com a referência (etapa 6 do plano do app, app 2.11).
// 1) No painel Financeiro (só o dono): tabela 3C × MD × as duas juntas × referência das fazendas top, montada com a cópia
//    do celular (app_financeiro, migração 027): funciona sem internet. O que ainda não dá para calcular aparece como "—"
//    e a lista "Para a conta ficar certa" diz o que falta lançar. Nada de número inventado.
// 2) Lançar "Despesa da fazenda" (mão de obra, combustível, energia, manutenção…): vai para a fila como os outros
//    lançamentos; "Nas duas" o sistema divide pelas cabeças de cada fazenda. Compra de produto continua pelo Claude (estoque).
// Carregado depois do lancar.js, do dg.js e do desempenho.js e antes do app.js.
'use strict';

const ITENS_DESP = [
  ['mao_de_obra', 'Mão de obra', 'salário, diária, encargos'],
  ['combustivel', 'Combustível', 'diesel, gasolina'],
  ['energia', 'Energia', 'luz, bomba d’água'],
  ['manutencao', 'Manutenção', 'cerca, curral, máquina'],
  ['pastagem', 'Pastagem', 'adubo, calcário, semente'],
  ['administrativo', 'Impostos e administrativo', 'ITR, contador, telefone'],
  ['outra', 'Outra despesa', 'escreva o que foi'],
];
// referência das fazendas top (docs/referencia-fazenda-top.md: Inttegra "top rentáveis" e Embrapa).
// Valor em R$ não tem referência: muda com o preço da arroba; ali a comparação é 3C × MD.
const TOP = {
  margem: { alvo: 36.4, tipo: 'min', txt: '36,4%' },
  prenhez: { alvo: 83, tipo: 'min', txt: '83%' },
  natalidade: { alvo: 80, tipo: 'min', txt: '80%' },
  mortalidade: { alvo: 2, tipo: 'max', txt: 'até 2%' },
  desmama: { alvo: 75, tipo: 'min', txt: '75%' },
  p205: { alvo: 200, tipo: 'min', txt: '200 kg' },
  kgvaca: { alvo: 150, tipo: 'min', txt: '150 kg' },
  desfrute: { alvo: 37.6, tipo: 'min', txt: '37,6%' },
};
const FIN = () => (S.dados && S.dados.financeiro) || null;
// "1.250,50", "1250,5", "1250.50", "R$ 3.000" → número
function lerReais(t) {
  let s = String(t ?? '').replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

// ------------------------------------------------------------------ números de cada fazenda
const SOMAR = ['ha', 'cab', 'vacas', 'ua', 'gasto', 'fixas', 'n_fixas', 'receita', 'vendidos', 'kg_vend', 'desm', 'kg_desm',
  'nasc', 'mortes', 'expostas', 'com_dg', 'prenhas'];
function juntas(fs, semFazenda) {
  const o = { cod: 'Juntas', id: null };
  for (const k of SOMAR) o[k] = fs.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  o.gasto += Number(semFazenda) || 0;
  return o;
}
// desmama da safra mais nova com bezerro pesado (as mesmas contas da aba Desempenho)
function desmamaDe(fid) {
  if (typeof dadosDesmama !== 'function') return null;
  const dd = dadosDesmama().filter((x) => fid === null || x.a.f === fid);
  if (!dd.length) return null;
  const ano = Math.max(...dd.map((x) => x.safra));
  const xs = dd.filter((x) => x.safra === ano);
  const fids = fid === null ? S.dados.fazendas.map((f) => f.id) : [fid];
  const exp = fids.reduce((s, id) => s + (expostasDaSafra(id, ano) || 0), 0) || null;
  const soma = xs.reduce((s, x) => s + x.r.peso, 0);
  return { ano, n: xs.length, exp, p205: Math.round(xs.reduce((s, x) => s + x.r.v, 0) / xs.length),
    pct: exp ? (100 * xs.length) / exp : null, kgv: exp ? soma / exp : null };
}
function indicadores(x, F0) {
  const dias = Number(F0.dias) || 1, meses = dias / 30.44, ano = dias >= 360;
  const div = (a, b) => (Number(b) > 0 && a != null ? Number(a) / Number(b) : null);
  const dm = desmamaDe(x.id);
  return {
    gasto: Number(x.gasto),
    cabMes: div(x.gasto, x.cab * meses),
    ha: div(x.gasto, x.ha),
    cabAno: ano ? div(x.gasto, x.cab) : null,
    bezerro: ano && x.desm ? x.gasto / x.desm : null,
    arroba: ano && x.kg_desm ? x.gasto / (x.kg_desm / 30) : null,
    receita: Number(x.receita) > 0 ? Number(x.receita) : null,
    margem: Number(x.receita) > 0 ? (100 * (x.receita - x.gasto)) / x.receita : null,
    lotacao: div(x.ua, x.ha),
    prenhez: x.com_dg ? (100 * x.prenhas) / x.expostas : null,
    natalidade: div(100 * x.nasc, x.vacas),
    mortalidade: div(100 * x.mortes, Number(x.cab) + Number(x.mortes)),
    desmama: dm && dm.pct,
    p205: dm && dm.p205,
    kgvaca: dm && dm.kgv,
    kgha: ano && x.kg_desm ? div(x.kg_desm, x.ha) : null,
    desfrute: x.vendidos ? div(100 * x.vendidos, x.cab) : null,
  };
}
const brl2 = (v) => F.brl(v);
function linhasFin(F0) {
  const ano = Number(F0.dias) >= 360;
  const ate = ano ? 'no ano' : 'até agora';
  return [
    ['g', ano ? 'Dinheiro · últimos 12 meses' : `Dinheiro · desde ${dtc(F0.ini)} (${F.dec(Number(F0.dias) / 30.44, 1)} meses)`],
    ['gasto', `Gasto ${ate}`, F.brl0],
    ['cabMes', 'Gasto por cabeça por mês', brl2],
    ['ha', `Gasto por hectare ${ate}`, F.brl0],
    ['cabAno', 'Custo por cabeça no ano', F.brl0],
    ['bezerro', 'Custo por bezerro desmamado', F.brl0],
    ['arroba', 'Custo por @ produzida', F.brl0],
    ['receita', `Receitas ${ate}`, F.brl0],
    ['margem', 'Margem sobre a venda', F.pct, 'margem'],
    ['g', 'Produção · últimos 12 meses'],
    ['lotacao', 'Lotação (UA por hectare)', (v) => F.dec(v, 2)],
    ['prenhez', 'Prenhez da estação', F.pct, 'prenhez'],
    ['natalidade', 'Natalidade', F.pct, 'natalidade'],
    ['mortalidade', 'Mortalidade', F.pct, 'mortalidade'],
    ['desmama', 'Taxa de desmama', F.pct, 'desmama'],
    ['p205', 'Peso aos 205 dias', F.kg, 'p205'],
    ['kgvaca', 'Kg desmamado por vaca exposta', F.kg, 'kgvaca'],
    ['kgha', 'Kg desmamado por hectare', F.kg],
    ['desfrute', 'Desfrute', F.pct, 'desfrute'],
  ];
}
function corTop(chave, v) {
  const m = TOP[chave];
  if (!m || v == null) return '';
  if (chave === 'natalidade' && v > 100) return 'neutro';
  return (m.tipo === 'min' ? v >= m.alvo : v <= m.alvo) ? 'ok' : 'atencao';
}
const arred = (v) => (v == null ? null : Math.round(v * 10) / 10);

function faltasFin(F0, tot) {
  const l = [];
  if (!tot.n_fixas) l.push(['Despesas da fazenda', 'nenhuma lançada (salário, diesel, energia, manutenção). Sem elas o gasto fica só com remédio, sal e protocolo.', '#lancar/despesa', 'Lançar despesa']);
  if (!(Number(tot.receita) > 0)) l.push(['Vendas', 'nenhuma lançada. Venda de animais (peso, R$/@, comprador) é pela conversa com o Claude.']);
  if (!tot.desm) l.push(['Desmama', 'nenhum bezerro pesado na desmama nos últimos 12 meses. Na pesagem, escolha “Desmama (apartação)”.']);
  if (Number(F0.dias) < 360) {
    l.push(['12 meses de gasto', `custo por cabeça no ano, por bezerro e por @ fecham com um ano inteiro de gasto anotado: a partir de ${dt(somarDias(F0.ini, 365))}.`]);
  }
  if (tot.expostas && !tot.com_dg) l.push(['DG da estação', `a prenhez sai no diagnóstico das ${F.int(tot.expostas)} expostas (Manejo › Diagnóstico de gestação).`]);
  if (Number(F0.sem_fazenda) > 0) l.push(['Gasto sem fazenda', `${F.brl(F0.sem_fazenda)} entram só na coluna das duas juntas.`]);
  return l;
}

function blocoComparacao() {
  const F0 = FIN();
  if (!F0 || !(F0.fazendas || []).length) return '';
  const cols = F0.fazendas.map((x) => ({ x, i: indicadores(x, F0) }));
  const tot = juntas(F0.fazendas, F0.sem_fazenda);
  cols.push({ x: tot, i: indicadores(tot, F0) });
  const cab = `<div class="cmp-cab"><span>${cols.map((c) => esc(c.x.cod === 'Juntas' ? 'As duas' : c.x.cod)).join('</span><span>')}</span><span>Top</span></div>`;
  const linhas = linhasFin(F0).map(([k, rot, fmt, top]) => {
    if (k === 'g') return `<p class="cmp-g">${esc(rot)}</p>${cab}`;   // cabeçalho repetido em cada grupo (a tabela é comprida)
    const cel = cols.map((c) => {
      const v = c.i[k];
      const cl = v == null ? 'sem' : corTop(top, arred(v));
      return `<span class="cmp-v ${cl}">${esc(v == null ? '—' : fmt(v))}</span>`;
    }).join('');
    return `<div class="cmp-l" data-k="${k}"><span class="cmp-n">${esc(rot)}</span>${cel}<span class="cmp-t">${esc(top ? TOP[top].txt : '—')}</span></div>`;
  }).join('');
  const faltas = faltasFin(F0, tot);
  const natAlta = cols.some((c) => c.i.natalidade > 100);
  return `${bloco('3C × MD × fazenda top', 'verde: na meta das fazendas top · amarelo: fora da meta', `<div class="cmp">${linhas}</div>
      ${natAlta ? '<p class="nota">Natalidade acima de 100%: faltam vacas no cadastro dessa fazenda.</p>' : ''}
      <p class="nota">Gasto = remédio, sal e hormônio usados (saída do estoque), etapas dos protocolos e despesas lançadas. Custo por @ = gasto ÷ (kg de bezerro desmamado ÷ 30). Lotação: 450 kg = 1 UA, pelo último peso ou o peso padrão da categoria. Prenhez = prenhas no DG ÷ fêmeas que estavam na IATF. Desfrute = vendidos em 12 meses ÷ rebanho de hoje. Valor em R$ não tem meta: muda com o preço da arroba.</p>`)}
    ${faltas.length ? bloco('Para a conta ficar certa', 'o que ainda falta lançar', `<ul class="faltas">${faltas.map(([t, s, ir, b]) => `<li><b>${esc(t)}:</b> ${esc(s)}${ir ? ` <button class="link" data-ir="${esc(ir)}">${esc(b)}</button>` : ''}</li>`).join('')}</ul>`) : ''}`;
}
// gasto por cabeça por mês das duas fazendas (cartão de cima do Financeiro)
function kpiGastoCabMes() {
  const F0 = FIN();
  if (!F0) return null;
  const tot = juntas(F0.fazendas || [], F0.sem_fazenda);
  const i = indicadores(tot, F0);
  return kpi('Gasto por cabeça por mês', F.brl(i.cabMes), esc(`desde ${dtc(F0.ini)} (${F.dec(Number(F0.dias) / 30.44, 1)} meses) · ${F.int(tot.cab)} cabeças nas duas fazendas`));
}

// ------------------------------------------------------------------ lançar: despesa da fazenda
TIPOS_L.despesa = { t: 'Despesa da fazenda', ic: 'dinheiro' };
function cabecasPorFazenda() {
  return S.dados.fazendas.map((f) => ({ f, n: S.dados.animais.filter((a) => a.st === 'ativo' && a.f === f.id).length }));
}
const fDesp = (r) => r.f || 'ambas';   // sem escolher, vale "Nas duas"
function textoDivisao(r) {
  if (fDesp(r) !== 'ambas') return '';
  const cs = cabecasPorFazenda(), tot = cs.reduce((s, c) => s + c.n, 0) || 1;
  const v = lerReais(r.valorTxt);
  return `Divide pelas cabeças: ${cs.map((c) => `${c.f.codigo} ${c.n} (${Math.round((100 * c.n) / tot)}%)${v ? ` ${F.brl((v * c.n) / tot)}` : ''}`).join(' · ')}`;
}
FORMS.despesa = function (r) {
  const it = ITENS_DESP.find((x) => x[0] === r.item);
  return `${cabForm('despesa')}${campoData(r)}
    <div class="campo"><span>O que foi</span><div class="chips quebra">${ITENS_DESP.map(([k, t]) => `<button class="chip" data-acao="l-item" data-valor="${k}" aria-pressed="${r.item === k}">${esc(t)}</button>`).join('')}</div>
      ${it ? `<p class="nota">${esc(it[2])}</p>` : ''}</div>
    <label class="campo"><span>Valor (R$)</span><input id="l-valor" class="num-grande" inputmode="decimal" autocomplete="off" value="${esc(r.valorTxt || '')}" placeholder="0,00"></label>
    <label class="campo"><span>${r.item === 'outra' ? 'O que foi a despesa' : 'Detalhe'}</span><input id="l-desc" maxlength="120" autocomplete="off" value="${esc(r.desc || '')}"
      placeholder="${r.item === 'outra' ? 'obrigatório' : 'opcional (ex.: salário de novembro)'}"></label>
    <div class="campo"><span>De qual fazenda</span><div class="chips">${S.dados.fazendas.map((x) => `<button class="chip" data-acao="l-faz" data-valor="${x.id}" aria-pressed="${fDesp(r) === x.id}">${esc(x.codigo)}</button>`).join('')}
      <button class="chip" data-acao="l-faz" data-valor="ambas" aria-pressed="${fDesp(r) === 'ambas'}">Nas duas</button></div>
      <p class="nota" id="l-divide">${esc(textoDivisao(r))}</p></div>
    <p class="nota">Compra de sal, vacina ou hormônio é pela conversa com o Claude, para entrar no estoque.</p>
    <button class="btn" data-acao="l-revisar" ${PRONTO.despesa(r) ? '' : 'disabled'}>Revisar e confirmar</button>`;
};
PRONTO.despesa = (r) => !!(r.item && (lerReais(r.valorTxt) || 0) > 0 && (r.item !== 'outra' || (r.desc || '').trim()));
MONTAR.despesa = function (r) {
  const it = ITENS_DESP.find((x) => x[0] === r.item);
  const v = lerReais(r.valorTxt), desc = (r.desc || '').trim();
  const f = fDesp(r), onde = f === 'ambas' ? 'nas duas' : faz(f).codigo;
  return {
    dados: { data: r.data, item: r.item, f, valor: v, ...(desc ? { desc } : {}) },
    resumo: `Despesa ${dtc(r.data)}: ${it[1]} ${F.brl(v)} (${onde})`,
    linhas: [`${it[1]}${desc ? `: ${desc}` : ''}`, `Valor: ${F.brl(v)}`,
      f === 'ambas' ? textoDivisao(r) : `Fazenda: ${faz(f).codigo}`, `Data: ${dt(r.data)}`],
  };
};
