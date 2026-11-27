// Curral Digital — relatórios em PDF (do manejo e do mês). Só para o dono.
// Feitos no próprio celular com a cópia guardada: funcionam sem internet e saem pelo "Compartilhar"
// (WhatsApp, Telegram, Arquivos). O PDF é escrito aqui mesmo, sem biblioteca de fora, com as letras que
// todo leitor de PDF já tem (Helvetica); o "✔" é desenhado; acentos pelo WinAnsi.
// Sai na hora do toque: o iPhone só deixa compartilhar dentro do toque.

// larguras das letras (milésimos do tamanho), códigos 32 a 255 do WinAnsi
const PDF_LARG = {
  n: '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500'.split(',').map(Number),
  b: '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,611,278,556,500,1000,556,556,333,1000,667,333,1000,611,611,611,611,278,278,500,500,350,556,1000,333,1000,556,333,944,611,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556'.split(',').map(Number),
};

// ------------------------------------------------------------------ PDF simples (A4, texto, caixas, linhas)
const WINANSI = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140,
  'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
const codPdf = (ch) => { const c = ch.codePointAt(0); return (c >= 32 && c < 127) || (c >= 160 && c <= 255) ? c : WINANSI[ch] || 63; };
const limparPdf = (t) => String(t ?? '').normalize('NFC').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
const nPdf = (v) => String(Math.round(v * 100) / 100);
function strPdf(t) {
  let s = '';
  for (const ch of limparPdf(t)) { const c = codPdf(ch); s += (c === 40 || c === 41 || c === 92 ? '\\' : '') + String.fromCharCode(c); }
  return `(${s})`;
}
const COR = {
  verdeEsc: [27, 94, 61], verde: [46, 139, 87], texto: [33, 37, 41], apagado: [105, 113, 120], linha: [214, 220, 224],
  fundo: [241, 245, 242], cab: [226, 239, 231], zebra: [248, 250, 249], ruim: [192, 57, 43], atencao: [176, 122, 0], branco: [255, 255, 255],
};

class Pdf {
  constructor() { this.W = 595.28; this.H = 841.89; this.paginas = []; this.nova(); }
  nova() { this.ops = []; this.paginas.push(this.ops); }
  larg(t, tam, neg) {
    const L = neg ? PDF_LARG.b : PDF_LARG.n;
    let s = 0;
    for (const ch of limparPdf(t)) s += L[codPdf(ch) - 32] || 556;
    return (s * tam) / 1000;
  }
  rgb(c, op) { return `${c.map((v) => nPdf(v / 255)).join(' ')} ${op}`; }
  texto(x, y, t, { tam = 9, neg = false, cor = COR.texto, al = 'e' } = {}) {
    if (!limparPdf(t)) return;
    const w = this.larg(t, tam, neg);
    const xx = al === 'd' ? x - w : al === 'c' ? x - w / 2 : x;
    this.ops.push(`BT /${neg ? 'F2' : 'F1'} ${tam} Tf ${this.rgb(cor, 'rg')} ${nPdf(xx)} ${nPdf(this.H - y)} Td ${strPdf(t)} Tj ET`);
  }
  caixa(x, y, w, h, cor) { this.ops.push(`${this.rgb(cor, 'rg')} ${nPdf(x)} ${nPdf(this.H - y - h)} ${nPdf(w)} ${nPdf(h)} re f`); }
  linha(x1, y1, x2, y2, cor = COR.linha, esp = 0.6) {
    this.ops.push(`${this.rgb(cor, 'RG')} ${esp} w ${nPdf(x1)} ${nPdf(this.H - y1)} m ${nPdf(x2)} ${nPdf(this.H - y2)} l S`);
  }
  // ✔ desenhado com traço (sai igual em qualquer leitor, sem depender de fonte), centrado em x, apoiado na linha y
  certo(x, y, tam = 9, cor = COR.verde) {
    const pt = (dx, dy) => `${nPdf(x + dx * tam)} ${nPdf(this.H - y + dy * tam)}`;
    this.ops.push(`${this.rgb(cor, 'RG')} ${nPdf(tam * 0.16)} w 1 J 1 j ${pt(-0.36, 0.38)} m ${pt(-0.1, 0.1)} l ${pt(0.38, 0.72)} l S`);
  }
  bytes(titulo) {
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${this.paginas.map((_, i) => `${7 + i * 2} 0 R`).join(' ')}] /Count ${this.paginas.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    ];
    const a = new Date(), p2 = (v) => String(v).padStart(2, '0');
    objs.push(`<< /Title ${strPdf(titulo)} /Producer (Curral Digital) /CreationDate (D:${a.getFullYear()}${p2(a.getMonth() + 1)}${p2(a.getDate())}${p2(a.getHours())}${p2(a.getMinutes())}${p2(a.getSeconds())}) >>`);
    for (const ops of this.paginas) {
      const corpo = ops.join('\n');
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${objs.length + 2} 0 R >>`);
      objs.push(`<< /Length ${corpo.length} >>\nstream\n${corpo}\nendstream`);
    }
    let s = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const pos = [];
    objs.forEach((o, i) => { pos.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = s.length;
    s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
    s += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
    return b;
  }
}

function cortar(pdf, t, w, tam, neg) {
  t = limparPdf(t);
  if (pdf.larg(t, tam, neg) <= w) return t;
  while (t.length > 1 && pdf.larg(`${t}…`, tam, neg) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
function quebrar(pdf, t, w, tam, neg) {
  const linhas = [];
  let atual = '';
  for (const p of limparPdf(t).split(' ')) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (atual && pdf.larg(tenta, tam, neg) > w) { linhas.push(atual); atual = p; } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// folha do relatório: faixa verde no alto, seções, quadros de números, tabelas que continuam na outra página
class Folha {
  constructor(titulo, sub) {
    this.pdf = new Pdf(); this.M = 36; this.Lw = this.pdf.W - 72; this.titulo = titulo;
    const p = this.pdf;
    p.caixa(0, 0, p.W, 86, COR.verdeEsc);
    p.texto(this.M, 32, 'CURRAL DIGITAL', { tam: 8, neg: true, cor: [178, 224, 196] });
    p.texto(this.M, 56, titulo, { tam: 20, neg: true, cor: COR.branco });
    p.texto(this.M, 75, sub, { tam: 10, cor: [222, 241, 229] });
    this.y = 108;
  }
  cabe(h) {
    if (this.y + h <= this.pdf.H - 54) return true;
    this.pdf.nova();
    this.pdf.texto(this.M, 30, `Curral Digital · ${this.titulo}`, { tam: 8, cor: COR.apagado });
    this.pdf.linha(this.M, 37, this.M + this.Lw, 37);
    this.y = 54;
    return false;
  }
  secao(t, sub) {
    this.cabe(84); // título junto com o começo da tabela
    if (this.y > 110) this.y += 10;
    this.pdf.texto(this.M, this.y + 11, t, { tam: 12.5, neg: true, cor: COR.verdeEsc });
    if (sub) this.pdf.texto(this.M + this.Lw, this.y + 11, sub, { tam: 8, cor: COR.apagado, al: 'd' });
    this.pdf.linha(this.M, this.y + 17, this.M + this.Lw, this.y + 17, COR.verde, 1);
    this.y += 27;
  }
  texto(t, { tam = 9, neg = false, cor = COR.texto } = {}) {
    for (const l of quebrar(this.pdf, t, this.Lw, tam, neg)) {
      this.cabe(tam * 1.5);
      this.pdf.texto(this.M, this.y + tam, l, { tam, neg, cor });
      this.y += tam * 1.5;
    }
    this.y += 3;
  }
  // quadros com número grande: [rótulo, valor, explicação]
  quadros(lista) {
    const porLinha = lista.length <= 4 ? lista.length : Math.ceil(lista.length / 2);
    const gap = 8, w = (this.Lw - gap * (porLinha - 1)) / porLinha, h = 56;
    for (let i = 0; i < lista.length; i += porLinha) {
      this.cabe(h + 8);
      lista.slice(i, i + porLinha).forEach(([rot, val, sub], j) => {
        const x = this.M + j * (w + gap), p = this.pdf;
        p.caixa(x, this.y, w, h, COR.fundo);
        p.caixa(x, this.y, 3, h, COR.verde);
        p.texto(x + 10, this.y + 14, cortar(p, String(rot).toUpperCase(), w - 16, 7.2, true), { tam: 7.2, neg: true, cor: COR.apagado });
        p.texto(x + 10, this.y + 35, cortar(p, val, w - 16, 16, true), { tam: 16, neg: true });
        if (sub) p.texto(x + 10, this.y + 48, cortar(p, sub, w - 16, 7.5), { tam: 7.5, cor: COR.apagado });
      });
      this.y += h + 8;
    }
    this.y += 2;
  }
  // tabela: colunas [{t, w, al}] (sem w = divide o que sobra); célula = texto, {certo:true} ou {t, cor, neg}
  tabela(cols, linhas, { total } = {}) {
    const p = this.pdf, H = 15, tam = 8.3;
    const fixo = cols.reduce((s, c) => s + (c.w || 0), 0), soltas = cols.filter((c) => !c.w).length;
    const ws = cols.map((c) => c.w || (this.Lw - fixo) / soltas);
    const titulos = cols.map((c, i) => quebrar(p, c.t, ws[i] - 8, 7.6, true).slice(0, 2));
    const hCab = titulos.some((l) => l.length > 1) ? 25 : 17;
    const cab = () => {
      p.caixa(this.M, this.y, this.Lw, hCab, COR.cab);
      let x = this.M;
      cols.forEach((c, i) => {
        titulos[i].forEach((l, k) => {
          const yy = this.y + 11 + k * 9 + (titulos[i].length === 1 && hCab > 17 ? 4 : 0);
          const tt = cortar(p, l, ws[i] - 8, 7.6, true);
          p.texto(c.al === 'd' ? x + ws[i] - 4 : c.al === 'c' ? x + ws[i] / 2 : x + 4, yy, tt, { tam: 7.6, neg: true, cor: COR.verdeEsc, al: c.al || 'e' });
        });
        x += ws[i];
      });
      this.y += hCab;
    };
    const linha = (ln, fundo, neg) => {
      if (fundo) p.caixa(this.M, this.y, this.Lw, H, fundo);
      let x = this.M;
      ln.forEach((v, i) => {
        const c = cols[i], w = ws[i];
        const xx = c.al === 'd' ? x + w - 4 : c.al === 'c' ? x + w / 2 : x + 4;
        if (v && v.certo) p.certo(x + w / 2, this.y + 10.8, 8.5);
        else {
          const o = v && typeof v === 'object' ? v : { t: v };
          if (o.t !== null && o.t !== undefined && o.t !== '') p.texto(xx, this.y + 10.5, cortar(p, String(o.t), w - 8, tam, neg || o.neg), { tam, neg: neg || o.neg, cor: o.cor || COR.texto, al: c.al || 'e' });
        }
        x += w;
      });
      this.y += H;
    };
    this.cabe(hCab + H * Math.min(3, linhas.length + (total ? 1 : 0)));
    cab();
    linhas.forEach((ln, k) => {
      if (!this.cabe(H)) cab();
      linha(ln, k % 2 ? COR.zebra : null, false);
    });
    if (total) {
      if (!this.cabe(H + 2)) cab();
      p.linha(this.M, this.y, this.M + this.Lw, this.y, COR.verde, 0.8);
      linha(total, null, true);
    }
    p.linha(this.M, this.y, this.M + this.Lw, this.y);
    this.y += 10;
  }
  // rodapé em todas as páginas e o arquivo pronto
  fechar(quem) {
    const p = this.pdf, n = p.paginas.length, guarda = p.ops;
    const agora = new Date();
    const quando = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    p.paginas.forEach((ops, i) => {
      p.ops = ops;
      p.linha(this.M, p.H - 40, this.M + this.Lw, p.H - 40);
      p.texto(this.M, p.H - 28, `Curral Digital · gerado em ${quando}${quem ? ` por ${quem}` : ''} · cópia de ${horaDe(S.quando) || '—'}`, { tam: 7.5, cor: COR.apagado });
      p.texto(this.M + this.Lw, p.H - 28, `página ${i + 1} de ${n}`, { tam: 7.5, cor: COR.apagado, al: 'd' });
    });
    p.ops = guarda;
    return { bytes: p.bytes(this.titulo), paginas: n, titulo: this.titulo };
  }
}

// ------------------------------------------------------------------ dados dos relatórios (da cópia do celular)
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (ym) => `${MESES_LONGOS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
function ultimosMeses(n) {
  const h = hojeISO();
  let a = Number(h.slice(0, 4)), m = Number(h.slice(5, 7));
  const l = [];
  for (let i = 0; i < n; i++) { l.push(`${a}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; a--; } }
  return l;
}
const numRel = (v, casas = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const reais = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const plural = (n, um, varios) => `${numRel(n)} ${n === 1 ? um : varios}`;
const rotuloManejo = (m) => `${NOME_ETAPA[m.etapa] || m.etapa}${m.prod && m.prod !== 'IATF' ? ` · ${m.prod}` : ''}`;
const ORDEM_CAT = ['matriz', 'novilha', 'bezerra', 'bezerro', 'garrote', 'boi', 'touro', 'descarte'];
const nomeFazendaRel = (fz) => (fz === 'todas' ? 'Fazendas MD e 3C' : ((S.dados.fazendas.find((f) => f.codigo === fz) || {}).nome || fz));

function dadosMes(ym, fz) {
  const D = S.dados, X = S.idx;
  const ok = (fid) => fz === 'todas' || faz(fid).codigo === fz;
  const noMes = (d) => !!d && d.slice(0, 7) === ym;
  const bicho = (id) => X.porId.get(id);
  const evs = D.eventos.filter((e) => noMes(e.d) && bicho(e.a) && ok(bicho(e.a).f));
  const nasc = evs.filter((e) => e.t === 'nascimento').map((e) => {
    const c = bicho(e.a), m = e.mae ? bicho(e.mae) : null, sx = e.sc || c.s;
    const pn = (X.eventos.get(e.a) || []).find((x) => x.t === 'pesagem' && x.d === e.d && x.p);
    return { d: e.d, aprox: !!e.aprox, f: c.f, mae: m ? m.n : '', cria: c.n, sx, peso: pn ? pn.p : null };
  });
  const mortes = evs.filter((e) => e.t === 'morte').map((e) => { const a = bicho(e.a); return { d: e.d, f: a.f, n: a.n, c: a.c, causa: e.diag || e.causa || '' }; });
  // pesagens por dia, fazenda e categoria; ganho contra a pesagem anterior do mesmo animal (20 dias ou mais antes)
  const gp = new Map();
  for (const e of evs) {
    if (e.t !== 'pesagem' || !e.p) continue;
    const a = bicho(e.a), k = `${e.d}|${a.f}|${a.c}`;
    if (!gp.has(k)) gp.set(k, { d: e.d, f: a.f, c: a.c, ps: [], gmds: [] });
    const g = gp.get(k);
    g.ps.push(Number(e.p));
    const ant = (X.eventos.get(e.a) || []).filter((x) => x.t === 'pesagem' && x.p && x.d < e.d && diasEntre(x.d, e.d) >= 20).pop();
    if (ant) g.gmds.push(((e.p - ant.p) / diasEntre(ant.d, e.d)) * 1000);
  }
  const pesagens = [...gp.values()].sort((a, b) => a.d.localeCompare(b.d) || a.f - b.f);
  const gd = new Map();
  for (const e of evs) {
    if (e.t !== 'diagnostico_gestacao') continue;
    const a = bicho(e.a), k = `${e.d}|${a.f}`;
    if (!gd.has(k)) gd.set(k, { d: e.d, f: a.f, n: 0, p: 0 });
    const g = gd.get(k); g.n++; if (e.dg === 'positivo') g.p++;
  }
  const dgs = [...gd.values()].sort((a, b) => a.d.localeCompare(b.d) || a.f - b.f);
  const animaisManejo = new Set();
  const manejos = D.manejos.filter((m) => m.st === 'realizado' && noMes(m.real) && ok(m.f)).map((m) => {
    const rs = D.aplicacoes.filter((r) => r[0] === m.id);
    for (const r of rs) if (r[2] === 'aplicado') animaisManejo.add(r[1]);
    return { m, apl: rs.filter((r) => r[2] === 'aplicado').length, nao: rs.filter((r) => r[2] === 'nao_aplicado').length };
  }).sort((a, b) => a.m.real.localeCompare(b.m.real) || a.m.f - b.m.f || a.m.id - b.m.id);
  const P = D.painel || {};
  const chuva = (P.chuva || []).filter((c) => c.mes === ym && (fz === 'todas' || c.fazenda === fz));
  const supl = (P.suplementacao || []).filter((s) => (fz === 'todas' || s.fazenda === fz) && s.de <= `${ym}-31` && s.ate >= `${ym}-01`);
  const fin = (P.financeiro_mes || []).find((x) => x.mes === ym) || null;
  const centros = (P.custos_mes || []).filter((x) => x.mes === ym && Number(x.valor));
  const rebanho = D.animais.filter((a) => a.st === 'ativo' && ok(a.f));
  return { nasc, mortes, pesagens, dgs, manejos, animaisManejo: animaisManejo.size, chuva, supl, fin, centros, rebanho };
}

function pdfMes(ym, fz, valores) {
  const X = dadosMes(ym, fz), comFaz = fz === 'todas';
  const F = new Folha('Relatório do mês', `${nomeMes(ym)} · ${nomeFazendaRel(fz)}`);
  const fzc = (id) => faz(id).codigo;
  const col = (lista) => lista.filter((c) => c && (comFaz || c.t !== 'Fazenda'));
  const tira = (l) => (comFaz ? l : l.filter((_, i) => i !== 1)); // a 2ª coluna é a fazenda
  const machos = X.nasc.filter((n) => n.sx === 'M').length, femeas = X.nasc.filter((n) => n.sx === 'F').length;
  const pesados = X.pesagens.reduce((s, g) => s + g.ps.length, 0);
  const q = [
    ['Nascimentos', numRel(X.nasc.length), X.nasc.length ? `${plural(machos, 'macho', 'machos')} · ${plural(femeas, 'fêmea', 'fêmeas')}` : 'nenhum no mês'],
    ['Mortes', numRel(X.mortes.length), X.mortes.length ? [...new Set(X.mortes.map((m) => m.causa).filter(Boolean))].join(', ') || 'causa não informada' : 'nenhuma no mês'],
    ['Etapas de manejo', numRel(X.manejos.length), X.manejos.length ? plural(X.animaisManejo, 'animal trabalhado', 'animais trabalhados') : 'nenhuma no mês'],
    ['Animais pesados', numRel(pesados), pesados ? plural(X.pesagens.length, 'pesagem', 'pesagens') : 'nenhuma pesagem'],
  ];
  const dgN = X.dgs.reduce((s, g) => s + g.n, 0), dgP = X.dgs.reduce((s, g) => s + g.p, 0);
  if (dgN) q.push(['Diagnóstico de gestação', `${Math.round((100 * dgP) / dgN)}%`, `${plural(dgP, 'prenha', 'prenhas')} de ${numRel(dgN)}`]);
  for (const c of X.chuva) q.push([`Chuva ${c.fazenda}`, `${numRel(c.mm)} mm`, plural(Number(c.registros), 'lançamento', 'lançamentos')]);
  F.quadros(q);

  // rebanho de hoje por categoria (a cópia não guarda o rebanho de meses passados)
  F.secao('Rebanho hoje', `situação em ${dt(hojeISO())}`);
  const fzs = comFaz ? S.dados.fazendas.map((f) => f.id) : [S.dados.fazendas.find((f) => f.codigo === fz).id];
  const cats = ORDEM_CAT.filter((c) => X.rebanho.some((a) => a.c === c)).concat([...new Set(X.rebanho.map((a) => a.c))].filter((c) => !ORDEM_CAT.includes(c)));
  const contaR = (c, f) => X.rebanho.filter((a) => a.c === c && (f === null || a.f === f)).length;
  const colsR = [{ t: 'Categoria' }, ...(comFaz ? fzs.map((f) => ({ t: fzc(f), w: 80, al: 'd' })) : []), { t: 'Cabeças', w: 90, al: 'd' }];
  F.tabela(colsR, cats.map((c) => [NOME_CAT[c] || c, ...(comFaz ? fzs.map((f) => numRel(contaR(c, f))) : []), numRel(contaR(c, null))]),
    { total: ['Total', ...(comFaz ? fzs.map((f) => numRel(X.rebanho.filter((a) => a.f === f).length)) : []), numRel(X.rebanho.length)] });

  const vazias = [];
  if (X.nasc.length) {
    F.secao('Nascimentos', plural(X.nasc.length, 'cria', 'crias'));
    const cols = col([{ t: 'Data', w: 62 }, { t: 'Fazenda', w: 52 }, { t: 'Mãe', w: 70 }, { t: 'Cria' }, { t: 'Sexo', w: 70 }, { t: 'Peso ao nascer', w: 80, al: 'd' }]);
    F.tabela(cols, X.nasc.map((n) => tira([`${dt(n.d)}${n.aprox ? '*' : ''}`, fzc(n.f), n.mae || '—', n.cria,
      n.sx === 'F' ? 'fêmea' : n.sx === 'M' ? 'macho' : '—', n.peso ? `${numRel(n.peso)} kg` : '—'])));
    if (X.nasc.some((n) => n.aprox)) F.texto('* data aproximada (lançada pela lista de partos).', { tam: 7.5, cor: COR.apagado });
  } else vazias.push('nascimentos');

  if (X.mortes.length) {
    F.secao('Mortes', plural(X.mortes.length, 'animal', 'animais'));
    const cols = col([{ t: 'Data', w: 62 }, { t: 'Fazenda', w: 52 }, { t: 'Animal', w: 70 }, { t: 'Categoria', w: 80 }, { t: 'Causa' }]);
    F.tabela(cols, X.mortes.map((m) => tira([dt(m.d), fzc(m.f), m.n, NOME_CAT[m.c] || m.c || '—', m.causa || 'não informada'])));
  } else vazias.push('mortes');

  if (X.manejos.length) {
    F.secao('Manejos e sanidade', `${plural(X.manejos.length, 'etapa feita', 'etapas feitas')}`);
    const cols = col([{ t: 'Data', w: 52 }, { t: 'Fazenda', w: 46 }, { t: 'Lote / protocolo', w: 128 }, { t: 'Etapa e produto' }, { t: 'Dose', w: 64 }, { t: 'Animais', w: 48, al: 'd' }]);
    F.tabela(cols, X.manejos.map(({ m, apl, nao }) => {
      const p = m.prot ? S.idx.prot.get(m.prot) : null, l = m.lote ? S.idx.lotes.get(m.lote) : null;
      const dd = p ? diaProt(p, m.real) : null;
      const onde = [l ? l.nome : p ? p.nome : null, dd !== null ? rotuloDia(dd) : null].filter(Boolean).join(' · ') || '—';
      return tira([dtc(m.real), fzc(m.f), onde, rotuloManejo(m), m.dose || '—', `${numRel(apl)}${nao ? ` (+${nao} não)` : ''}`]);
    }));
  } else vazias.push('manejos');

  if (X.pesagens.length) {
    F.secao('Pesagens', plural(pesados, 'animal pesado', 'animais pesados'));
    const cols = col([{ t: 'Data', w: 52 }, { t: 'Fazenda', w: 46 }, { t: 'Categoria' }, { t: 'Animais', w: 52, al: 'd' }, { t: 'Peso médio', w: 70, al: 'd' }, { t: 'Menor e maior', w: 92, al: 'd' }, { t: 'Ganho médio (g/dia)', w: 82, al: 'd' }]);
    F.tabela(cols, X.pesagens.map((g) => {
      const med = g.ps.reduce((s, v) => s + v, 0) / g.ps.length;
      const gm = g.gmds.length ? g.gmds.reduce((s, v) => s + v, 0) / g.gmds.length : null;
      return tira([dtc(g.d), fzc(g.f), NOME_CAT[g.c] || g.c || '—', numRel(g.ps.length), `${numRel(med)} kg`,
        `${numRel(Math.min(...g.ps))} a ${numRel(Math.max(...g.ps))} kg`, gm === null ? '—' : `${numRel(gm)}${g.gmds.length < g.ps.length ? ` (${g.gmds.length})` : ''}`]);
    }));
    if (X.pesagens.some((g) => g.gmds.length && g.gmds.length < g.ps.length)) F.texto('Ganho médio contra a pesagem anterior do mesmo animal (20 dias ou mais antes); entre parênteses, quantos animais tinham pesagem anterior.', { tam: 7.5, cor: COR.apagado });
  } else vazias.push('pesagens');

  if (X.dgs.length) {
    F.secao('Diagnóstico de gestação');
    const cols = col([{ t: 'Data', w: 70 }, { t: 'Fazenda', w: 60 }, { t: 'Diagnosticadas', al: 'd' }, { t: 'Prenhas', al: 'd' }, { t: 'Vazias', al: 'd' }, { t: 'Prenhez', al: 'd' }]);
    F.tabela(cols, X.dgs.map((g) => tira([dt(g.d), fzc(g.f), numRel(g.n), numRel(g.p), numRel(g.n - g.p), `${Math.round((100 * g.p) / g.n)}%`])));
  }

  if (X.chuva.length) {
    F.secao('Chuva');
    F.tabela([{ t: 'Fazenda' }, { t: 'No mês', w: 100, al: 'd' }, { t: 'Lançamentos', w: 100, al: 'd' }, { t: 'Últimos 12 meses', w: 120, al: 'd' }],
      X.chuva.map((c) => [nomeFazendaRel(c.fazenda), `${numRel(c.mm)} mm`, numRel(Number(c.registros)), c.total_12m != null ? `${numRel(c.total_12m)} mm` : '—']));
  } else vazias.push('chuva');

  if (X.supl.length) {
    F.secao('Suplementação no cocho', 'consumo do período lançado');
    const cols = col([{ t: 'Fazenda', w: 46 }, { t: 'Lote' }, { t: 'Produto', w: 90 }, { t: 'Período', w: 82 }, { t: 'Cabeças', w: 46, al: 'd' }, { t: 'Consumo (g/cab/dia)', w: 70, al: 'd' },
      valores ? { t: 'R$ por cab/dia', w: 62, al: 'd' } : null]);
    F.tabela(cols, X.supl.map((s) => {
      const l = [s.fazenda, s.lote || '—', s.produto || '—', `${dtc(s.de)} a ${dtc(s.ate)}`, numRel(Number(s.cabecas) || 0), s.g_cab_dia != null ? numRel(s.g_cab_dia) : '—'];
      if (valores) l.push(s.custo_cab_dia != null ? reais(s.custo_cab_dia) : '—');
      return comFaz ? l : l.slice(1);
    }));
  }

  if (valores) {
    F.secao('Dinheiro do mês', comFaz ? 'MD e 3C juntas' : 'MD e 3C juntas (o sistema ainda não separa por fazenda)');
    if (X.fin && (Number(X.fin.receitas) || Number(X.fin.despesas))) {
      F.quadros([['Receitas', reais(X.fin.receitas), ''], ['Despesas', reais(X.fin.despesas), ''], ['Resultado', reais(X.fin.resultado), Number(X.fin.resultado) < 0 ? 'gastou mais do que entrou' : '']]);
    }
    if (X.centros.length) {
      F.tabela([{ t: 'Gasto por área' }, { t: 'Valor', w: 120, al: 'd' }],
        X.centros.map((c) => [String(c.centro_custo || '—').replace(/^./, (x) => x.toUpperCase()), reais(c.valor)]),
        { total: ['Total', reais(X.centros.reduce((s, c) => s + Number(c.valor), 0))] });
    }
    if (!X.centros.length && !(X.fin && (Number(X.fin.receitas) || Number(X.fin.despesas)))) F.texto('Nenhum valor lançado neste mês.', { cor: COR.apagado });
    F.texto('Os valores só ficam completos quando as vendas e todas as despesas forem lançadas.', { tam: 7.5, cor: COR.apagado });
  }

  if (vazias.length) { F.y += 4; F.texto(`Sem lançamento no mês: ${vazias.join(', ')}.`, { tam: 8.5, cor: COR.apagado }); }
  return F.fechar(S.usuario && S.usuario.nome);
}

// manejos feitos, juntados por dia, fazenda e protocolo (ou lote): é o "manejo do dia" no curral
function gruposManejo() {
  const D = S.dados, X = S.idx, g = new Map();
  for (const m of D.manejos) {
    if (m.st !== 'realizado' || !m.real) continue;
    const k = `${m.f}|${m.real}|${m.prot ? `p${m.prot}` : m.lote ? `l${m.lote}` : `m${m.id}`}`;
    if (!g.has(k)) g.set(k, { k, f: m.f, d: m.real, prot: m.prot ? X.prot.get(m.prot) : null, lote: m.lote ? X.lotes.get(m.lote) : null, ms: [] });
    g.get(k).ms.push(m);
  }
  const lista = [...g.values()];
  for (const x of lista) {
    const ids = new Set(x.ms.map((m) => m.id));
    x.ms.sort((a, b) => a.id - b.id);
    x.rs = D.aplicacoes.filter((r) => ids.has(r[0]));
    x.animais = new Set(x.rs.filter((r) => r[2] === 'aplicado').map((r) => r[1])).size;
  }
  return lista.sort((a, b) => b.d.localeCompare(a.d) || a.f - b.f || a.k.localeCompare(b.k));
}
function tituloManejoRel(x) {
  const dd = x.prot ? diaProt(x.prot, x.d) : null;
  if (x.prot) return `${dd !== null ? `${rotuloDia(dd)} · ` : ''}${x.prot.nome}`;
  if (x.lote) return x.lote.nome;
  return rotuloManejo(x.ms[0]);
}
// total usado: "2 ml" × 56 = 112 ml; implante conta por unidade
function totalUsado(dose, n) {
  if (!n) return '—';
  if (/implante/i.test(dose || '')) return plural(n, 'implante', 'implantes');
  const mt = /^\s*(\d+(?:[.,]\d+)?)\s*(ml|mg|g|kg|un|unid|doses?)\b/i.exec(dose || '');
  if (!mt) return '—';
  const v = Number(mt[1].replace(',', '.')) * n;
  const u = mt[2].toLowerCase();
  return `${numRel(v, v % 1 ? 1 : 0)} ${u === 'unid' ? 'un' : u}`;
}

function pdfManejo(x) {
  const X = S.idx, dd = x.prot ? diaProt(x.prot, x.d) : null;
  const F = new Folha('Relatório do manejo', `${faz(x.f).nome} · ${dt(x.d)}${dd !== null ? ` · ${rotuloDia(dd)}` : ''}`);
  const quem = [...new Set(x.rs.map((r) => r[1]))].map((id) => X.porId.get(id)).filter(Boolean)
    .sort((a, b) => a.n.localeCompare(b.n, 'pt-BR', { numeric: true }));
  const ecc = new Map();
  for (const a of quem) {
    const e = (X.eventos.get(a.id) || []).find((v) => v.t === 'observacao' && v.d === x.d && v.ecc != null);
    if (e) ecc.set(a.id, e);
  }
  const nNao = x.rs.filter((r) => r[2] === 'nao_aplicado').length;
  const nEst = [...ecc.values()].filter((e) => e.ecce).length;
  const linhaInfo = [x.prot ? `Protocolo: ${x.prot.nome}${x.prot.d0 ? ` (D0 em ${dt(x.prot.d0)})` : ''}` : null, x.lote ? `Lote: ${x.lote.nome}` : null].filter(Boolean).join('   ·   ');
  if (linhaInfo) F.texto(linhaInfo, { tam: 9.5 });
  const q = [['Animais trabalhados', numRel(x.animais), `${faz(x.f).codigo} · ${dt(x.d)}`],
    ['Etapas', numRel(x.ms.length), x.ms.map((m) => (m.prod && m.prod !== 'IATF' ? m.prod : NOME_ETAPA[m.etapa] || m.etapa)).join(', ')],
    ['Não aplicados', numRel(nNao), nNao ? 'ver na lista abaixo' : 'todos receberam o previsto']];
  if (ecc.size) {
    const med = [...ecc.values()].reduce((s, e) => s + Number(e.ecc), 0) / ecc.size;
    q.push(['Escore corporal médio', numRel(med, 1), `${plural(ecc.size, 'animal', 'animais')}${nEst ? ` · ${nEst} estimados` : ''}`]);
  }
  F.quadros(q);

  F.secao('Etapas e produtos');
  F.tabela([{ t: 'Etapa' }, { t: 'Produto', w: 110 }, { t: 'Dose', w: 86 }, { t: 'Aplicados', w: 58, al: 'd' }, { t: 'Não aplicados', w: 58, al: 'd' }, { t: 'Total usado', w: 78, al: 'd' }],
    x.ms.map((m) => {
      const rs = x.rs.filter((r) => r[0] === m.id), apl = rs.filter((r) => r[2] === 'aplicado').length, nao = rs.filter((r) => r[2] === 'nao_aplicado').length;
      return [NOME_ETAPA[m.etapa] || m.etapa, m.prod || '—', m.dose || '—', numRel(apl), nao ? { t: numRel(nao), cor: COR.ruim, neg: true } : '0', totalUsado(m.dose, apl)];
    }));

  F.secao('Animal por animal', plural(quem.length, 'animal', 'animais'));
  const k = x.ms.length, wEt = Math.max(40, Math.min(58, (F.Lw - 46 - 58 - (ecc.size ? 38 : 0) - 100) / k));
  const cols = [{ t: 'Nº', w: 46 }, { t: 'Categoria', w: 58 },
    ...x.ms.map((m) => ({ t: m.prod && m.prod !== 'IATF' ? m.prod : NOME_ETAPA[m.etapa] || m.etapa, w: wEt, al: 'c' })),
    ...(ecc.size ? [{ t: 'Escore', w: 38, al: 'c' }] : []), { t: 'Observação' }];
  const porAnimal = new Map();
  for (const r of x.rs) empurrar(porAnimal, r[1], r);
  F.tabela(cols, quem.map((a) => {
    const rs = porAnimal.get(a.id) || [];
    const marcas = x.ms.map((m) => {
      const r = rs.find((v) => v[0] === m.id);
      if (!r) return '';
      if (r[2] === 'aplicado') return { certo: true };
      if (r[2] === 'nao_aplicado') return { t: 'não', cor: COR.ruim, neg: true };
      return { t: 'falta', cor: COR.atencao };
    });
    const e = ecc.get(a.id);
    const obs = [...new Set(rs.map((r) => r[7]).filter(Boolean))].join(' · ');
    return [a.n, NOME_CAT[a.c] || a.c || '—', ...marcas, ...(ecc.size ? [e ? `${numRel(e.ecc, 1)}${e.ecce ? '*' : ''}` : '—'] : []), obs];
  }));
  // legenda: ✔ desenhado + texto
  F.cabe(14);
  F.pdf.certo(F.M + 4, F.y + 8, 8);
  F.pdf.texto(F.M + 11, F.y + 8, `aplicado   ·   não = não aplicado neste animal${ecc.size ? '   ·   * escore estimado' : ''}   ·   em branco = a etapa não era para este animal`, { tam: 7.5, cor: COR.apagado });
  F.y += 14;
  return F.fechar(S.usuario && S.usuario.nome);
}

// ------------------------------------------------------------------ entrega: Compartilhar (celular) ou baixar (computador)
function entregarPdf(bytes, nome, titulo) {
  const arq = new File([bytes], nome, { type: 'application/pdf' });
  const baixar = () => {
    const url = URL.createObjectURL(arq);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  try {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [arq] })) {
      navigator.share({ files: [arq], title: titulo }).catch((e) => { if (!e || e.name !== 'AbortError') baixar(); });
      return;
    }
  } catch { /* cai no baixar */ }
  baixar();
}
function gerarPdf(fazer, nome) {
  let r;
  try { r = fazer(); } catch (e) {
    console.error('relatório falhou', e);
    avisar('Não consegui montar o PDF. Atualize a cópia e tente de novo.');
    return;
  }
  entregarPdf(r.bytes, nome, r.titulo);
  avisar(`PDF pronto: ${plural(r.paginas, 'página', 'páginas')}.`);
}

// ------------------------------------------------------------------ tela
// (este arquivo carrega antes do app.js: o estado S só existe quando a tela abre)
function telaRelatorio() {
  if (!S.rel) S.rel = { mes: null, faz: 'todas', valores: false };
  const meses = ultimosMeses(6);
  if (!meses.includes(S.rel.mes)) S.rel.mes = meses[0];
  const X = dadosMes(S.rel.mes, S.rel.faz);
  const resumoMes = [plural(X.nasc.length, 'nascimento', 'nascimentos'), plural(X.mortes.length, 'morte', 'mortes'),
    plural(X.manejos.length, 'etapa de manejo', 'etapas de manejo'), plural(X.pesagens.reduce((s, g) => s + g.ps.length, 0), 'animal pesado', 'animais pesados')].join(' · ');
  const chip = (acao, v, rot, ligado) => `<button class="chip" data-acao="${acao}" data-valor="${esc(v)}" aria-pressed="${ligado}">${esc(rot)}</button>`;
  const gs = gruposManejo().slice(0, 15);
  const curto = (ym) => `${MESES_LONGOS[Number(ym.slice(5, 7)) - 1].slice(0, 3)}/${ym.slice(2, 4)}`;
  return `<section class="pagina">
    <button class="voltar" data-acao="voltar">${I.voltar}Voltar</button>
    <h1 class="h1">Relatórios em PDF</h1>
    <p class="nota">O PDF é feito neste celular com a cópia de ${esc(horaDe(S.quando) || '—')}: funciona sem internet. Depois de gerar, escolha WhatsApp, Telegram ou Arquivos.</p>
    <div class="bloco rel"><h2 class="h2">${I.agenda}Relatório do mês</h2>
      <div class="chips filtro" role="group" aria-label="Mês"><span class="chips-t">Mês</span>${meses.map((m) => chip('rel-mes', m, curto(m), m === S.rel.mes)).join('')}</div>
      <div class="chips filtro" role="group" aria-label="Fazenda"><span class="chips-t">Fazenda</span>${[['todas', 'MD e 3C'], ...S.dados.fazendas.map((f) => [f.codigo, f.codigo])].map(([v, r]) => chip('rel-faz', v, r, v === S.rel.faz)).join('')}</div>
      <div class="chips filtro" role="group" aria-label="Valores em R$"><span class="chips-t">Valores</span>${chip('rel-valores', 'nao', 'Sem R$', !S.rel.valores)}${chip('rel-valores', 'sim', 'Com R$', S.rel.valores)}</div>
      <p class="nota" id="rel-resumo"><b>${esc(nomeMes(S.rel.mes))}</b> · ${esc(resumoMes)}</p>
      <button class="btn" data-acao="rel-gerar-mes">${I.pdf}Gerar o PDF do mês</button>
    </div>
    <div class="bloco rel"><h2 class="h2">${I.curral}Relatório do manejo</h2>
      <p class="nota">Um dia de curral: etapas, produtos, doses e a lista animal por animal${S.dados.eventos.some((e) => e.ecc != null) ? ', com o escore' : ''}.</p>
      ${gs.length ? `<div class="lista">${gs.map((g) => `<button class="item" data-acao="rel-gerar-manejo" data-grupo="${esc(g.k)}">
        <span><span class="item-n">${esc(dtc(g.d))} · ${esc(faz(g.f).codigo)}</span><span class="item-m">${esc(tituloManejoRel(g))} · ${esc(plural(g.ms.length, 'etapa', 'etapas'))} · ${esc(plural(g.animais, 'animal', 'animais'))}</span></span>
        <span></span>${I.pdf}</button>`).join('')}</div>` : '<p class="vazio">Nenhum manejo feito ainda.</p>'}
    </div>
  </section>`;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-acao^="rel-"]');
  if (!el || !S.dados || !dono()) return;
  const a = el.dataset.acao;
  if (a === 'rel-mes') { S.rel.mes = el.dataset.valor; desenhar(); }
  else if (a === 'rel-faz') { S.rel.faz = el.dataset.valor; desenhar(); }
  else if (a === 'rel-valores') { S.rel.valores = el.dataset.valor === 'sim'; desenhar(); }
  else if (a === 'rel-gerar-mes') {
    const { mes, faz: fz, valores } = S.rel;
    gerarPdf(() => pdfMes(mes, fz, valores), `Curral-relatorio-${mes}-${fz === 'todas' ? 'MD-e-3C' : fz}.pdf`);
  } else if (a === 'rel-gerar-manejo') {
    const g = gruposManejo().find((x) => x.k === el.dataset.grupo);
    if (!g) { avisar('Esse manejo não está mais na cópia. Atualize.'); return; }
    gerarPdf(() => pdfManejo(g), `Curral-manejo-${faz(g.f).codigo}-${g.d}.pdf`);
  }
});
