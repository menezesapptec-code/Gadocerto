// Gado Certo — cotação regional da arroba (função da Vercel)
// GET /api/cotacao?cidade=Barra do Garças&uf=MT            -> praça mais próxima
// GET /api/cotacao?cidade=...&uf=MT&praca=imea:Cuiabá       -> praça escolhida
// GET /api/cotacao?debug=1                                   -> mostra as tabelas lidas
// Fontes (republicadas pelo Notícias Agrícolas):
//   Boi à Vista – IMEA (municípios de MT), Mercado Físico – Scot Consultoria (praças do Brasil, boi e vaca),
//   Indicador da Vaca – Datagro (por estado)

const URLS = {
  imea: 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-a-vista-imea',
  scot: 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-gordo-scot-consultoria',
  vaca: 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/indicador-da-vaca'
};

// coordenadas aproximadas de cada praça
const PRACAS = {
  imea: {
    'Araputanga': [-15.47, -58.35, 'MT'], 'Barra do Garças': [-15.89, -52.26, 'MT'], 'Cuiabá': [-15.60, -56.10, 'MT'], 'Juara': [-11.26, -57.52, 'MT'],
    'Matupá': [-10.18, -54.94, 'MT'], 'Rondonópolis': [-16.47, -54.64, 'MT'], 'Sinop': [-11.86, -55.51, 'MT'], 'Vila Rica': [-9.91, -51.20, 'MT']
  },
  scot: {
    'SP Barretos': [-20.56, -48.57, 'SP'], 'SP Araçatuba': [-21.21, -50.43, 'SP'], 'MG Triângulo': [-18.92, -48.28, 'MG'], 'MG B.Horizonte': [-19.92, -43.94, 'MG'],
    'MG Norte': [-16.73, -43.86, 'MG'], 'MG Sul': [-21.55, -45.43, 'MG'], 'GO Goiânia': [-16.68, -49.25, 'GO'], 'GO Reg. Sul': [-17.80, -50.93, 'GO'],
    'MS Dourados': [-22.22, -54.81, 'MS'], 'MS C. Grande': [-20.47, -54.62, 'MS'], 'MS Três Lagoas': [-20.75, -51.68, 'MS'], 'BA Sul': [-15.25, -40.25, 'BA'],
    'BA Oeste': [-12.15, -45.00, 'BA'], 'MT Norte': [-11.86, -55.51, 'MT'], 'MT Sudoeste': [-16.07, -57.68, 'MT'], 'MT Cuiabá': [-15.60, -56.10, 'MT'],
    'MT Sudeste': [-16.47, -54.64, 'MT'], 'PR Noroeste': [-23.77, -53.32, 'PR'], 'SC': [-27.20, -50.50, 'SC'], 'MA Oeste': [-5.52, -47.47, 'MA'],
    'Alagoas': [-9.60, -36.60, 'AL'], 'PA Marabá': [-5.37, -49.12, 'PA'], 'PA Redenção': [-8.03, -50.03, 'PA'], 'PA Paragominas': [-2.99, -47.35, 'PA'],
    'RO Sudeste': [-11.44, -61.45, 'RO'], 'TO Sul': [-11.73, -49.07, 'TO'], 'TO Norte': [-7.19, -48.21, 'TO'], 'Acre': [-9.97, -67.81, 'AC'],
    'ES': [-20.30, -40.30, 'ES'], 'RJ': [-22.00, -42.50, 'RJ'], 'Roraima': [2.82, -60.67, 'RR']
  }
};
const ESTADOS = { AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins' };

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = (s) => { const t = String(s || '').replace(/[^\d,.\-]/g, ''); if (!t) return null; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return isFinite(n) ? n : null; };
const km = (a, b) => { const R = 6371, r = Math.PI / 180; const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(x))); };
const texto = (html) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)).replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// lê a primeira tabela (a mais recente) e a data de fechamento
function lerTabela(html) {
  const data = (html.match(/Fechamento:\s*(?:<[^>]*>\s*)*(\d{2}\/\d{2}\/\d{4})/i) || html.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || null;
  const tab = (html.match(/<table[\s\S]*?<\/table>/i) || [])[0] || '';
  const linhas = [];
  for (const tr of tab.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cels = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(texto);
    if (cels.length >= 2 && !/<th/i.test(tr.slice(0, 200)) && num(cels[1]) !== null) linhas.push(cels);
  }
  return { data, linhas };
}

let CACHE = { em: 0, tabelas: null };
async function baixar(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (GadoCerto; cotacao)', 'Accept-Language': 'pt-BR' } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
async function tabelas() {
  if (CACHE.tabelas && Date.now() - CACHE.em < 3 * 3600 * 1000) return CACHE.tabelas;
  const [imea, scot, vaca] = await Promise.allSettled([baixar(URLS.imea), baixar(URLS.scot), baixar(URLS.vaca)]);
  const t = { erros: [] };
  if (imea.status === 'fulfilled') { const r = lerTabela(imea.value); t.imea = { data: r.data, valores: Object.fromEntries(r.linhas.map(l => [l[0], num(l[1])])) }; } else t.erros.push('IMEA: ' + imea.reason.message);
  if (scot.status === 'fulfilled') { const r = lerTabela(scot.value); t.scot = { data: r.data, valores: Object.fromEntries(r.linhas.filter(l => !/kg/i.test(l.join(' '))).map(l => [l[0], { boi: num(l[1]), boi30: num(l[2]), vaca: num(l[3]) }])) }; } else t.erros.push('Scot: ' + scot.reason.message);
  if (vaca.status === 'fulfilled') { const r = lerTabela(vaca.value); t.vaca = { data: r.data, valores: Object.fromEntries(r.linhas.map(l => [l[0], num(l[1])])) }; } else t.erros.push('Datagro: ' + vaca.reason.message);
  if (t.imea || t.scot) CACHE = { em: Date.now(), tabelas: t };
  return t;
}

let GEO = {};
async function geocodificar(cidade, uf) {
  const k = sem(cidade) + '|' + uf; if (GEO[k] !== undefined) return GEO[k];
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&countryCode=BR`);
    const j = await r.json(); const est = sem(ESTADOS[uf] || '');
    const hit = (j.results || []).find(x => sem(x.admin1) === est) || null;
    GEO[k] = hit ? { nome: hit.name, lat: hit.latitude, lon: hit.longitude } : null;
  } catch (e) { GEO[k] = null; }
  return GEO[k];
}
// acha a chave da tabela que corresponde ao nome da praça (ignora acento/pontuação)
const acharChave = (valores, nome) => Object.keys(valores || {}).find(k => sem(k).replace(/[^a-z0-9]/g, '') === sem(nome).replace(/[^a-z0-9]/g, ''));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10800, stale-while-revalidate=86400');
  try {
    const q = req.query || {};
    const uf = String(q.uf || '').toUpperCase(); const cidade = String(q.cidade || '').trim();
    const t = await tabelas();
    if (q.debug) return res.status(200).json({ fontes: URLS, tabelas: t });
    const geo = cidade && uf ? await geocodificar(cidade, uf) : null;
    const ponto = geo ? [geo.lat, geo.lon] : null;

    // todas as praças disponíveis com valor
    const opcoes = [];
    for (const [nome, c] of Object.entries(PRACAS.imea)) { const k = acharChave(t.imea && t.imea.valores, nome); if (k && t.imea.valores[k]) opcoes.push({ id: 'imea:' + nome, fonte: 'IMEA', nome, uf: c[2], valor: t.imea.valores[k], data: t.imea.data, km: ponto ? km(ponto, c) : null }); }
    for (const [nome, c] of Object.entries(PRACAS.scot)) { const k = acharChave(t.scot && t.scot.valores, nome); if (k && t.scot.valores[k] && t.scot.valores[k].boi) opcoes.push({ id: 'scot:' + nome, fonte: 'Scot Consultoria', nome, uf: c[2], valor: t.scot.valores[k].boi, vaca: t.scot.valores[k].vaca, data: t.scot.data, km: ponto ? km(ponto, c) : null }); }

    // praça do boi: escolhida, ou IMEA mais próxima (MT), ou Scot mais próxima no estado
    let boi = null;
    if (q.praca) boi = opcoes.find(o => o.id === q.praca) || null;
    if (!boi) {
      const ordem = (lista) => lista.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
      const doUf = opcoes.filter(o => o.uf === uf);
      if (ponto) boi = ordem(doUf.filter(o => o.id.startsWith('imea:')))[0] || ordem(doUf.filter(o => o.id.startsWith('scot:')))[0] || ordem(opcoes.filter(o => o.id.startsWith('scot:')))[0] || null;
      else { // cidade não localizada: média das praças do estado
        const base = doUf.filter(o => o.id.startsWith('imea:')).length ? doUf.filter(o => o.id.startsWith('imea:')) : doUf;
        if (base.length) boi = { id: 'media:' + uf, fonte: base[0].fonte, nome: 'média do estado ' + uf, uf, valor: Math.round(base.reduce((a, o) => a + o.valor, 0) / base.length * 100) / 100, data: base[0].data, km: null };
      }
    }
    // vaca: Scot da mesma região (mais próxima no estado); senão indicador Datagro do estado
    let vaca = null;
    const scotUf = opcoes.filter(o => o.id.startsWith('scot:') && o.uf === (boi ? boi.uf : uf) && o.vaca).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    if (boi && boi.id.startsWith('scot:') && boi.vaca) vaca = { valor: boi.vaca, fonte: 'Scot Consultoria', praca: boi.nome, data: boi.data };
    else if (scotUf[0]) vaca = { valor: scotUf[0].vaca, fonte: 'Scot Consultoria', praca: scotUf[0].nome, data: scotUf[0].data };
    else if (t.vaca) { const k = acharChave(t.vaca.valores, ESTADOS[uf]); if (k) vaca = { valor: t.vaca.valores[k], fonte: 'Datagro', praca: ESTADOS[uf], data: t.vaca.data }; }

    res.status(200).json({
      ok: !!boi, cidade: geo, uf, aviso: cidade && !geo ? 'Cidade não localizada; usando média do estado' : null,
      boi: boi ? { valor: boi.valor, fonte: boi.fonte, praca: boi.nome, uf: boi.uf, data: boi.data, km: boi.km, id: boi.id } : null,
      vaca, opcoes: opcoes.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)).map(({ id, fonte, nome, uf, valor, km }) => ({ id, fonte, nome, uf, valor, km })),
      erros: t.erros, atualizadoEm: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
};
