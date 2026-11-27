// Curral Digital — etapa 5 (app 2.10): sanidade, nutrição e estoque. Só para o dono.
// O banco calcula tudo na hora da cópia (app_sanidade, migração 026) e o celular só desenha: funciona sem internet.
// Calendário sanitário (quem está para vacinar), animais em carência (não vender), consumo do suplemento por categoria
// dentro do lote (dividido pelo peso, 450 kg = 1 UA) e estoque pelos dias de uso. Usa esc, S, I, dt, dtc, relativo… do
// app.js e bloco, kpi, linhasLista, F, MESES do painel.js (na hora em que são chamadas).
'use strict';

const SAN = () => (S.dados && S.dados.sanidade) || { calendario: [], carencia: [], estoque: [], consumo: [] };
const carenciaDe = (id) => (SAN().carencia || []).find((c) => c.a === id) || null;
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const listaE = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs.join(''));

function publicoCal(c) {
  const cats = c.cats ? listaE(c.cats.map((k) => (PLURAL_CAT[k] || k).toLowerCase())) : 'rebanho todo';
  const idade = c.imin != null && c.imax != null ? `de ${c.imin} a ${c.imax} meses` : c.imin != null ? `acima de ${c.imin} meses` : c.imax != null ? `até ${c.imax} meses` : '';
  return [cats, idade].filter(Boolean).join(', ');
}
function quandoCal(c) {
  const rep = c.int == null ? 'dose única' : c.int >= 330 ? 'uma vez por ano' : `a cada ${c.int} dias`;
  return c.meses ? `${rep}, em ${listaE(c.meses.map((m) => MES_LONGO[m - 1]))}` : `${rep}, pela idade (o ano todo)`;
}
const ultimaCal = (c) => [c.ultima, c.ultima_m].filter(Boolean).sort().pop() || null;
// itens do calendário que estão para fazer agora (este mês ou o próximo) e têm animal na lista
const calAgora = () => (SAN().calendario || []).filter((c) => c.agora && (c.ids || []).length);

const ALERTA_EST = {
  vencido: ['Vencido', 's-vazia'], acabou: ['Acabou', 's-vazia'], falta_manejo: ['Não dá para o manejo', 's-vazia'],
  acabando: ['Acabando', 's-solteira'], vence: ['Vence logo', 's-solteira'], sem_compra: ['Sem compra lançada', 's-ativo'],
};
const unBR = (un, q) => (un === 'saco' ? (Number(q) === 1 ? 'saco' : 'sacos') : un === 'unidade' ? (Number(q) === 1 ? 'unidade' : 'unidades') : un || '');
const estAlertas = () => (SAN().estoque || []).filter((e) => e.alerta && e.alerta !== 'sem_compra');

// saldo em frascos (tamanho do frasco no cadastro do produto, ex.: "frasco de 50 ml")
function frascos(e) {
  if (!e.frasco || e.un !== 'ml' || e.saldo == null || e.saldo <= 0) return '';
  const n = e.saldo / e.frasco;
  if (n < 1) return ` (menos de 1 frasco de ${F.int(e.frasco)} ml)`;
  const r = Math.round(n * 10) / 10;
  return ` (${Number.isInteger(r) ? '' : '~'}${F.dec(r, 1)} ${r === 1 ? 'frasco' : 'frascos'} de ${F.int(e.frasco)} ml)`;
}
function textoEstoque(e) {
  const partes = [];
  if (e.saldo != null) partes.push(`tem ${F.dec(e.saldo, 2)} ${unBR(e.un, e.saldo)}${frascos(e)}`);
  if (e.usado_prot) partes.push(`${F.dec(e.usado_prot, 1)} ${unBR(e.un, e.usado_prot)} já usados nos protocolos`);
  if (e.dias != null) partes.push(e.dias > 0 ? `dá para ~${F.int(e.dias)} dias (uso de ${F.dec(e.uso30, 1)} ${unBR(e.un, e.uso30)} em 30 dias)` : 'não dá para mais um dia');
  if (e.manejo) partes.push(`manejo de ${dtc(e.manejo)} precisa de ${F.dec(e.precisa, 1)} ${unBR(e.un, e.precisa)}`);
  if (e.val) partes.push(`validade ${dt(e.val)}`);
  return partes.join(' · ');
}
function linhaEstoque(e) {
  const [rot, cls] = ALERTA_EST[e.alerta] || [];
  return { t: `${esc(e.nome)}${rot ? ` <span class="selo ${cls}">${esc(rot)}</span>` : ''}`, s: esc(textoEstoque(e)) };
}

function blocoConsumo() {
  const cs = SAN().consumo || [];
  if (!cs.length) return bloco('Consumo do suplemento por categoria', 'últimos 90 dias', '<p class="vazio">Nenhuma salga ou trato com baixa no estoque nos últimos 90 dias.</p>');
  const grupos = new Map();
  for (const c of cs) {
    const k = `${c.fazenda}|${c.lote}|${c.produto}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  const corpo = [...grupos.values()].map((g) => {
    const x = g[0];
    const kgT = g.reduce((s, c) => s + Number(c.kg || 0), 0);
    const cab = g.reduce((s, c) => s + Number(c.cab_trato || 0), 0);
    const linhas = linhasLista(g.map((c) => ({
      t: `${esc(PLURAL_CAT[c.cat] || c.cat)} <small>${esc(F.int(c.cab_trato))} cab. · ~${esc(F.int(c.peso_medio))} kg</small>`,
      s: esc([`${F.kg(c.kg)} (${F.int(c.pct)}% do total)`, c.gmd != null ? `GMD ${F.gmd(c.gmd)}` : null].filter(Boolean).join(' · ')),
      v: c.g_cab_dia != null ? `${esc(F.int(c.g_cab_dia))} g<small>${c.custo_cab_dia != null ? `${esc(F.brl(c.custo_cab_dia))}/cab./dia` : 'por cab./dia'}</small>` : '<small>uma salga só</small>',
    })), '');
    return `<p class="item-t">${esc(x.lote)} · ${esc(x.produto)} <small>${esc(x.fazenda)}</small></p>
      <p class="nota">${esc(`${dtc(x.de)} a ${dtc(x.ate)} · ${F.int(x.tratos)} ${Number(x.tratos) === 1 ? 'trato' : 'tratos'}${x.dias ? ` cobrindo ~${F.int(x.dias)} dias` : ''} · ${F.kg(kgT)} · ~${F.int(cab)} cabeças`)}</p>${linhas}`;
  }).join('');
  return bloco('Consumo do suplemento por categoria', 'dentro do lote, dividido pelo peso · últimos 90 dias',
    `${corpo}<p class="nota">Cada categoria fica com a parte do suplemento proporcional ao peso (450 kg = 1 UA). Sem pesagem recente, o peso é estimado: vaca 450 kg, novilha 330 kg, bezerro pela idade. Os dias contam do primeiro ao último trato, mais o intervalo médio entre eles.</p>`);
}

function secSanidade() {
  if (!dono()) return '<p class="vazio">Só o dono vê a sanidade e o estoque.</p>';
  if (!S.dados.sanidade) return '<p class="vazio">Atualize com internet para baixar o calendário sanitário e o estoque.</p>';
  const cal = SAN().calendario || [];
  const car = SAN().carencia || [];
  const agora = calAgora();
  const nAgora = new Set(agora.flatMap((c) => c.ids)).size;
  const alertas = estAlertas();
  const kpis = [
    kpi('Para vacinar agora', F.int(nAgora), agora.length ? esc(agora.map((c) => c.nome).join(' · ')) : 'nada do calendário neste mês'),
    kpi('Em carência', F.int(car.length), car.length ? 'não vender antes de liberar' : 'nenhum animal em carência'),
    kpi('Estoque com aviso', F.int(alertas.length), alertas.length ? esc(alertas.map((e) => e.nome).join(' · ')) : 'nada acabando'),
  ];
  const calL = cal.map((c) => {
    const ids = c.ids || [];
    const nums = ids.map((id) => S.idx.porId.get(id)).filter(Boolean);
    const mostrar = c.agora && nums.length;
    const quando = c.agora ? (c.meses ? 'agora' : 'pela idade') : c.prox ? `em ${MES_LONGO[Number(c.prox.slice(5, 7)) - 1]}` : '';
    return `<div class="item item-fixo cal-item"><span><span class="item-t">${esc(c.nome)}</span>
        <span class="item-m">${esc(`${publicoCal(c)} · ${quandoCal(c)}`)}</span>
        ${c.obs ? `<span class="item-m">${esc(c.obs)}</span>` : ''}
        ${ultimaCal(c) ? `<span class="item-m">última aplicação lançada: ${esc(dt(ultimaCal(c)))}</span>` : ''}</span>
        <span class="item-v">${mostrar ? `${esc(F.int(nums.length))}<small>a fazer</small>` : `<small>${esc(quando)}</small>`}</span></div>
      ${mostrar ? `<details class="tempo-mais"><summary>Ver os ${esc(F.int(nums.length))} animais</summary>
        <div class="chips quebra">${nums.map((a) => `<button class="chip" data-ir="#animal/${a.id}">${esc(a.n)} <small>${esc(faz(a.f).codigo)}</small></button>`).join('')}</div></details>` : ''}`;
  }).join('');
  const carL = linhasLista(car.map((c) => {
    const a = S.idx.porId.get(c.a);
    return { t: `${esc(a ? a.n : '?')} <small>${esc(a ? faz(a.f).codigo : '')}</small>`, s: esc(c.prod || ''), v: `${esc(dtc(c.lib))}<small>${esc(relativo(c.lib))}</small>`, ir: a ? `#animal/${a.id}` : null };
  }), 'Nenhum animal em carência.');
  const est = SAN().estoque || [];
  const estL = linhasLista(est.map(linhaEstoque), 'Nenhum produto com compra lançada.');
  return `<div class="kpis">${kpis.join('')}</div>
    ${bloco('Calendário sanitário', 'MD e 3C', `${cal.length ? `<div class="lista">${calL}</div>` : '<p class="vazio">Calendário ainda não cadastrado.</p>'}
      <p class="nota">Sai da lista quem já tem a vacina lançada (pelo app, pelo bot ou pela conversa com o Claude). Para mudar o calendário, peça ao Claude.</p>
      <button class="btn sec" data-ir="#lancar/remedio">${I.saude}Lançar vacina ou remédio</button>`)}
    ${bloco('Em carência', 'não vender antes da data', `${carL}<p class="nota">O sistema não deixa lançar a venda de animal em carência.</p>`)}
    ${blocoConsumo()}
    ${bloco('Estoque', 'pelos dias de uso e pelos manejos dos próximos 45 dias', `${estL}<p class="nota">Avisa quando o que sobrou dá para menos de 15 dias (pelo uso dos últimos 30) ou não dá para o próximo manejo. “Sem compra lançada”: o sistema não sabe quanto tem; mande a compra para lançar.</p>`)}`;
}

// avisos do sino (dono): vacina do calendário, carência e estoque
function avisosSanidade() {
  if (!dono() || !S.dados || !S.dados.sanidade) return [];
  const l = [];
  for (const c of calAgora()) l.push({ t: `${c.nome}: ${c.ids.length} ${c.ids.length === 1 ? 'animal' : 'animais'} para fazer`, s: publicoCal(c), ir: '#painel/sanidade' });
  const car = SAN().carencia || [];
  if (car.length) l.push({ t: `${car.length} ${car.length === 1 ? 'animal' : 'animais'} em carência`, s: 'Não vender antes de liberar.', ir: '#painel/sanidade' });
  for (const e of estAlertas()) l.push({ t: `${e.nome}: ${(ALERTA_EST[e.alerta] || [e.alerta])[0].toLowerCase()}`, s: textoEstoque(e), ir: '#painel/sanidade' });
  return l;
}

// faixa na ficha do animal em carência
function avisoCarencia(a) {
  const c = carenciaDe(a.id);
  return c ? `<p class="achado nao">⚠️ Em carência de ${esc(c.prod || 'remédio')} até ${esc(dt(c.lib))}. Não vender antes disso.</p>` : '';
}
