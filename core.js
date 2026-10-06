/* =====================================================================
   REBANHO 360 — núcleo compartilhado (core.js)
   Usado por: index.html, admin.html, manejo.html, vaqueiro.html, proprietario.html
   ===================================================================== */

/* ---------- 1. CONFIGURAÇÃO (edite aqui) ---------- */
const APP = {
  nome: 'Rebanho 360',
  // e-mails com acesso total (superadmin)
  superadmins: ['agrosafra7@gmail.com', 'menezesapptec@gmail.com'],
  // Cole aqui a configuração do seu projeto Firebase (Console > Configurações do projeto > Seus apps > Web)
  firebaseConfig: {
    apiKey: 'COLE_AQUI',
    authDomain: 'COLE_AQUI.firebaseapp.com',
    projectId: 'COLE_AQUI',
    storageBucket: 'COLE_AQUI.appspot.com',
    messagingSenderId: 'COLE_AQUI',
    appId: 'COLE_AQUI'
  }
};

/* ---------- 2. CONSTANTES DO NEGÓCIO ---------- */
const CATEGORIAS = [
  { id: 'bezerro', nome: 'Bezerro', sexo: 'M' },
  { id: 'bezerra', nome: 'Bezerra', sexo: 'F' },
  { id: 'garrote', nome: 'Garrote', sexo: 'M' },
  { id: 'novilha', nome: 'Novilha', sexo: 'F' },
  { id: 'boi', nome: 'Boi', sexo: 'M' },
  { id: 'touro', nome: 'Touro', sexo: 'M' },
  { id: 'vaca', nome: 'Vaca', sexo: 'F' }
];
const CAT_NOME = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.nome]));
const RACAS = ['Nelore', 'Cruzado', 'Angus', 'Brahman', 'Tabapuã', 'Guzerá', 'Gir', 'Senepol', 'Girolando', 'Outra'];
const REPRO = { '': '—', vazia: 'Vazia', inseminada: 'Inseminada', prenha: 'Prenha' };
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const FONTES_SUGERIDAS = { MT: 'IMEA', TO: 'a definir', GO: 'a definir', MS: 'a definir', PA: 'a definir' };
const TIPOS_MED = ['Vacina', 'Vermífugo', 'Antibiótico', 'Carrapaticida', 'Anti-inflamatório', 'Hormônio (IATF)', 'Vitamina/Mineral', 'Outro'];
const TIPOS_CUSTO = ['Sal mineral', 'Ração/Suplemento', 'Mão de obra', 'Arrendamento', 'Combustível', 'Manutenção', 'Outros'];

const CONFIG_PADRAO = {
  // rendimento de carcaça (%) por categoria
  rendimento: { bezerro: 55, bezerra: 54, garrote: 52, novilha: 50, boi: 53, touro: 52, vaca: 48 },
  // como cada categoria é avaliada: arroba_boi | arroba_vaca | cabeca
  metodo: { bezerro: 'cabeca', bezerra: 'cabeca', garrote: 'cabeca', novilha: 'cabeca', boi: 'arroba_boi', touro: 'arroba_boi', vaca: 'arroba_vaca' },
  // peso estimado (kg) para animal sem pesagem
  pesoPadrao: { bezerro: 200, bezerra: 190, garrote: 300, novilha: 300, boi: 480, touro: 700, vaca: 430 },
  regras: { maxIatfFalhas: 2, idadeMaxVacaAnos: 12, diasGestacao: 285 }
};

/* ---------- 3. UTILITÁRIOS PUROS (testáveis) ---------- */
const U = {
  num(v) { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; const s = String(v).trim().replace(/\s/g, ''); const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); return isFinite(n) ? n : null; },
  hoje() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
  mes(iso) { return (iso || U.hoje()).slice(0, 7); },
  addDias(iso, dias) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + Math.round(dias)); return d.toISOString().slice(0, 10); },
  diffDias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); },
  idadeMeses(nasc, ref) { if (!nasc) return null; return Math.max(0, Math.floor(U.diffDias(nasc, ref || U.hoje()) / 30.44)); },
  // aceita: Date, número serial do Excel, "dd/mm/aaaa", "aaaa-mm-dd"
  data(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) { let y = +m[3]; if (y < 100) y += y > 50 ? 1900 : 2000; return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/); // mm/aaaa
    if (m) return `${m[2]}-${String(+m[1]).padStart(2, '0')}-01`;
    return null;
  },
  sexo(v) { const s = String(v || '').trim().toUpperCase(); if (!s) return null; if (s[0] === 'M' || s === 'MACHO') return 'M'; if (s[0] === 'F' || s === 'FEMEA' || s === 'FÊMEA') return 'F'; return null; },
  sim(v) { const s = String(v ?? '').trim().toLowerCase(); return ['s', 'sim', 'x', '1', 'true', 'yes', 'y', 'ok'].includes(s); },
  sem(v) { return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
  raca(v) {
    const s = U.sem(v); if (!s) return null;
    if (s.includes('nel')) return 'Nelore';
    if (s.includes('cruz') || s.includes('f1') || s.includes('meio') || s.includes('1/2') || s === 'ms' || s.includes('mestic') || s.includes('anelorad')) return 'Cruzado';
    for (const r of RACAS) if (U.sem(r) === s || s.includes(U.sem(r))) return r;
    return 'Outra';
  },
  grupoRaca(r) { return r === 'Nelore' ? 'Nelore' : r === 'Cruzado' ? 'Cruzado' : 'Outras'; },
  categoria(v) {
    const s = U.sem(v); if (!s) return null;
    const mapa = [['bezerra', 'bezerra'], ['bezerro', 'bezerro'], ['garrot', 'garrote'], ['novilh', 'novilha'], ['touro', 'touro'], ['vaca', 'vaca'], ['matriz', 'vaca'], ['boi', 'boi'], ['bzra', 'bezerra'], ['bzro', 'bezerro']];
    for (const [k, c] of mapa) if (s.includes(k)) return c;
    return null;
  },
  repro(v) { const s = U.sem(v); if (!s) return null; if (s.includes('pren') || s === 'p' || s.includes('gest')) return 'prenha'; if (s.includes('insem') || s.includes('iatf')) return 'inseminada'; if (s.includes('vaz') || s === 'v') return 'vazia'; return null; },
  sugerirCategoria(sexo, idadeM, comCria) {
    if (!sexo) return null;
    if (sexo === 'F') { if (comCria || (idadeM !== null && idadeM >= 36)) return 'vaca'; if (idadeM !== null && idadeM < 12) return 'bezerra'; return idadeM === null ? 'vaca' : 'novilha'; }
    if (idadeM !== null && idadeM < 12) return 'bezerro'; if (idadeM !== null && idadeM < 24) return 'garrote'; return 'boi';
  },
  sexoDaCategoria(cat) { const c = CATEGORIAS.find(x => x.id === cat); return c ? c.sexo : null; },
  brl(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); },
  brl2(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  n(v, d = 0) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); },
  dataBR(iso) { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; },
  mesBR(ym) { const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; const [y, m] = ym.split('-'); return `${nomes[+m - 1]}/${y.slice(2)}`; },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  normBrinco(v) { return String(v ?? '').trim().replace(/\s+/g, '').toUpperCase(); }
};

/* ---------- 4. REGRAS DE CÁLCULO (testáveis) ---------- */
const CALC = {
  cfg(fazenda) {
    const c = (fazenda && fazenda.config) || {};
    return {
      rendimento: { ...CONFIG_PADRAO.rendimento, ...(c.rendimento || {}) },
      metodo: { ...CONFIG_PADRAO.metodo, ...(c.metodo || {}) },
      pesoPadrao: { ...CONFIG_PADRAO.pesoPadrao, ...(c.pesoPadrao || {}) },
      regras: { ...CONFIG_PADRAO.regras, ...(c.regras || {}) }
    };
  },
  // arrobas de carcaça a partir do peso vivo
  arrobas(pesoVivo, rendPct) { return (pesoVivo || 0) * (rendPct || 50) / 100 / 15; },
  avaliar(animal, cot, cfg) {
    const cat = animal.categoria || 'boi';
    const pesoReal = U.num(animal.pesoAtual);
    const peso = pesoReal || cfg.pesoPadrao[cat] || 0;
    const arrobas = CALC.arrobas(peso, cfg.rendimento[cat]);
    const metodo = cfg.metodo[cat] || 'arroba_boi';
    let valor = 0;
    cot = cot || {};
    if (metodo === 'cabeca') valor = U.num(cot.cabeca && cot.cabeca[cat]) || 0;
    else if (metodo === 'arroba_vaca') valor = arrobas * (U.num(cot.arrobaVaca) || U.num(cot.arrobaBoi) || 0);
    else valor = arrobas * (U.num(cot.arrobaBoi) || 0);
    return { peso, pesoReal: !!pesoReal, arrobas, valor, metodo };
  },
  avaliarDescarte(animal, cfg, ref) {
    const motivos = [];
    const r = cfg.regras;
    if (animal.sexo === 'F' && r.maxIatfFalhas && (animal.iatfFalhas || 0) >= r.maxIatfFalhas) motivos.push(`${animal.iatfFalhas} IATF sem prenhez`);
    if (animal.categoria === 'vaca' && r.idadeMaxVacaAnos && animal.nascimento) { const anos = U.idadeMeses(animal.nascimento, ref) / 12; if (anos >= r.idadeMaxVacaAnos) motivos.push(`idade ${Math.floor(anos)} anos`); }
    return { descarte: motivos.length > 0, motivoDescarte: motivos.join(' · ') };
  },
  blocoVazio() {
    return { cabecas: 0, machos: 0, femeas: 0, pesoTotal: 0, pesados: 0, pesoPesados: 0, arrobas: 0, valor: 0, porCategoria: {}, porRaca: { Nelore: 0, Cruzado: 0, Outras: 0 }, racaDetalhe: {}, repro: { aptas: 0, prenhas: 0, inseminadas: 0, vazias: 0, semDiagnostico: 0, comCria: 0 }, partosPrevistos: {}, descarte: 0, emCarencia: 0, custoCompra: 0, custoSanitario: 0, gmdSoma: 0, gmdN: 0, semPeso: 0 };
  },
  acumular(b, a, av, ref) {
    b.cabecas++;
    if (a.sexo === 'M') b.machos++; else if (a.sexo === 'F') b.femeas++;
    const cat = a.categoria || 'sem';
    const pc = b.porCategoria[cat] || (b.porCategoria[cat] = { n: 0, peso: 0, arrobas: 0, valor: 0 });
    pc.n++; pc.peso += av.peso; pc.arrobas += av.arrobas; pc.valor += av.valor;
    b.pesoTotal += av.peso; b.arrobas += av.arrobas; b.valor += av.valor;
    if (av.pesoReal) { b.pesados++; b.pesoPesados += av.peso; } else b.semPeso++;
    const g = U.grupoRaca(a.raca); b.porRaca[g]++;
    const rd = a.raca || 'Não informada'; b.racaDetalhe[rd] = (b.racaDetalhe[rd] || 0) + 1;
    if (a.sexo === 'F' && (a.categoria === 'vaca' || a.categoria === 'novilha')) {
      b.repro.aptas++;
      if (a.repro === 'prenha') { b.repro.prenhas++; if (a.dataPrevParto) { const m = a.dataPrevParto.slice(0, 7); b.partosPrevistos[m] = (b.partosPrevistos[m] || 0) + 1; } }
      else if (a.repro === 'inseminada') b.repro.inseminadas++;
      else if (a.repro === 'vazia') b.repro.vazias++;
      else b.repro.semDiagnostico++;
      if (a.comCria) b.repro.comCria++;
    }
    if (a.descarte) b.descarte++;
    if (a.carenciaAte && a.carenciaAte >= ref) b.emCarencia++;
    b.custoCompra += U.num(a.custoCompra) || 0;
    b.custoSanitario += U.num(a.custoSanitario) || 0;
    if (U.num(a.gmd) !== null && a.gmd > -2 && a.gmd < 4) { b.gmdSoma += a.gmd; b.gmdN++; }
  },
  finalizar(b) {
    b.pesoMedio = b.pesados ? b.pesoPesados / b.pesados : 0;
    b.gmdMedio = b.gmdN ? b.gmdSoma / b.gmdN : null;
    const diag = b.repro.prenhas + b.repro.vazias;
    b.repro.taxaPrenhez = diag ? b.repro.prenhas / diag : null;
    return b;
  },
  // animais: array de docs ativos
  resumo(animais, cot, fazenda, retiros) {
    const cfg = CALC.cfg(fazenda); const ref = U.hoje();
    const geral = CALC.blocoVazio(); const porRetiro = {};
    (retiros || []).forEach(r => porRetiro[r.id] = CALC.blocoVazio());
    for (const a of animais) {
      if (a.status && a.status !== 'ativo') continue;
      const av = CALC.avaliar(a, cot, cfg);
      CALC.acumular(geral, a, av, ref);
      const rid = a.retiroId || '_sem';
      if (!porRetiro[rid]) porRetiro[rid] = CALC.blocoVazio();
      CALC.acumular(porRetiro[rid], a, av, ref);
    }
    CALC.finalizar(geral); Object.values(porRetiro).forEach(CALC.finalizar);
    return { geral, porRetiro };
  },
  // aplica um registro de pesagem no animal; retorna campos a atualizar
  pesagem(animal, peso, data) {
    const upd = { pesoAtual: peso, dataPeso: data };
    if (U.num(animal.pesoAtual) && animal.dataPeso && animal.dataPeso < data) {
      upd.pesoAnterior = animal.pesoAtual; upd.dataPesoAnterior = animal.dataPeso;
      const dias = U.diffDias(animal.dataPeso, data);
      upd.gmd = dias > 0 ? Math.round(((peso - animal.pesoAtual) / dias) * 1000) / 1000 : null;
    }
    return upd;
  },
  diagnostico(animal, resultado, diasGestacao, data, cfg) {
    const upd = { repro: resultado, dataUltimoDG: data };
    if (resultado === 'prenha') {
      upd.iatfFalhas = 0;
      const dg = U.num(diasGestacao);
      // se não informar dias de gestação, estima pela data da última IA
      let concepcao = null;
      if (dg) concepcao = U.addDias(data, -dg);
      else if (animal.ultimaIatf && animal.ultimaIatf.data) concepcao = animal.ultimaIatf.data;
      upd.dataPrevParto = concepcao ? U.addDias(concepcao, cfg.regras.diasGestacao || 285) : null;
    } else if (resultado === 'vazia') {
      upd.dataPrevParto = null;
      if (animal.repro === 'inseminada' || (animal.ultimaIatf && animal.ultimaIatf.data && (!animal.dataUltimoDG || animal.ultimaIatf.data > animal.dataUltimoDG))) {
        upd.iatfFalhas = (animal.iatfFalhas || 0) + 1;
      }
    }
    const desc = CALC.avaliarDescarte({ ...animal, ...upd }, cfg);
    upd.descarte = desc.descarte; upd.motivoDescarte = desc.motivoDescarte;
    return upd;
  },
  custoDose(med, dose) {
    const vol = U.num(med.volume) || 1; const preco = U.num(med.precoFrasco) || 0;
    return Math.round((preco / vol) * (U.num(dose) || 0) * 100) / 100;
  }
};

/* ---------- 5. FIREBASE ---------- */
let db = null, auth = null;
function iniciarFirebase(opts = {}) {
  if (typeof firebase === 'undefined') { alert('Falha ao carregar Firebase. Verifique a internet.'); return; }
  if (!firebase.apps.length) firebase.initializeApp(APP.firebaseConfig);
  auth = firebase.auth(); db = firebase.firestore();
  if (opts.emulador) { db.useEmulator('127.0.0.1', 8080); auth.useEmulator('http://127.0.0.1:9099'); }
  if (opts.offline !== false) {
    db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('Persistência offline indisponível:', e.code));
  }
}
const FV = () => firebase.firestore.FieldValue;
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const inc = (n) => firebase.firestore.FieldValue.increment(n);
const fz = (fid) => db.collection('fazendas').doc(fid);
const sub = (fid, nome) => fz(fid).collection(nome);
const docs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

const SESSAO = { user: null, perfil: null, fazendas: [], fazenda: null };

function ehSuper(user) { return !!user && APP.superadmins.includes((user.email || '').toLowerCase()); }

// Aguarda login e carrega o perfil. papeis = lista de papéis permitidos na página.
function exigirLogin(papeis) {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) { location.href = 'index.html'; return; }
      SESSAO.user = user;
      let perfil;
      if (ehSuper(user)) perfil = { papel: 'superadmin', nome: user.email, fazendas: '*' };
      else {
        const s = await db.collection('usuarios').doc(user.uid).get().catch(() => null);
        if (!s || !s.exists || s.data().ativo === false) { alert('Usuário sem acesso liberado. Fale com o administrador.'); await auth.signOut(); location.href = 'index.html'; return; }
        perfil = s.data();
      }
      SESSAO.perfil = perfil;
      if (papeis && !papeis.includes(perfil.papel)) { location.href = paginaDoPapel(perfil.papel); return; }
      SESSAO.fazendas = await carregarFazendas(perfil);
      resolve(SESSAO);
    });
  });
}
function paginaDoPapel(p) { return { superadmin: 'admin.html', gerente: 'admin.html', operador: 'manejo.html', vaqueiro: 'vaqueiro.html', proprietario: 'proprietario.html' }[p] || 'index.html'; }

async function carregarFazendas(perfil) {
  if (perfil.fazendas === '*') return docs(await db.collection('fazendas').get()).sort((a, b) => a.nome.localeCompare(b.nome));
  const ids = perfil.fazendas || [];
  const lista = await Promise.all(ids.map(id => fz(id).get().then(d => d.exists ? { id: d.id, ...d.data() } : null).catch(() => null)));
  return lista.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
}
function fazendaSalva() { try { return localStorage.getItem('r360_fazenda'); } catch (e) { return null; } }
function salvarFazenda(id) { try { localStorage.setItem('r360_fazenda', id); } catch (e) { } }
function escolherFazendaInicial() {
  const salva = fazendaSalva();
  SESSAO.fazenda = SESSAO.fazendas.find(f => f.id === salva) || SESSAO.fazendas[0] || null;
  return SESSAO.fazenda;
}
function retirosPermitidos(retiros) {
  const p = SESSAO.perfil; if (!p || !p.retiros || !p.retiros.length) return retiros;
  return retiros.filter(r => p.retiros.includes(r.id));
}

async function carregarCotacao(uf) {
  if (!uf) return null;
  const s = await db.collection('cotacoes').doc(uf).get().catch(() => null);
  return s && s.exists ? s.data() : null;
}

// grava muitos documentos em lotes de 400 operações
async function gravarEmLotes(ops, aoProgresso) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach(op => { if (op.tipo === 'set') batch.set(op.ref, op.dados, op.opts || {}); else if (op.tipo === 'update') batch.update(op.ref, op.dados); else if (op.tipo === 'delete') batch.delete(op.ref); });
    await batch.commit();
    if (aoProgresso) aoProgresso(Math.min(i + 400, ops.length), ops.length);
  }
}

// lê todos os animais ativos da fazenda e grava o resumo (lido pelo painel do proprietário)
async function recalcularResumo(fid) {
  const fsnap = await fz(fid).get(); const fazenda = { id: fid, ...fsnap.data() };
  const [animais, retiros, cot] = await Promise.all([
    sub(fid, 'animais').where('status', '==', 'ativo').get().then(docs),
    sub(fid, 'retiros').get().then(docs),
    carregarCotacao(fazenda.uf)
  ]);
  const r = CALC.resumo(animais, cot, fazenda, retiros);
  const retirosNomes = Object.fromEntries(retiros.map(x => [x.id, x.nome]));
  const dados = { tipo: 'atual', geral: r.geral, porRetiro: r.porRetiro, retirosNomes, cotacao: cot ? { arrobaBoi: cot.arrobaBoi || null, arrobaVaca: cot.arrobaVaca || null, data: cot.data || null, fonte: cot.fonte || null, uf: fazenda.uf } : null, calculadoEm: U.hoje(), atualizadoEm: ts() };
  const mes = U.mes();
  const enxuto = (b) => ({ cabecas: b.cabecas, valor: b.valor, arrobas: b.arrobas, pesoTotal: b.pesoTotal, pesoMedio: b.pesoMedio, taxaPrenhez: b.repro.taxaPrenhez, gmdMedio: b.gmdMedio });
  const hist = { tipo: 'hist', mes, geral: enxuto(r.geral), porRetiro: Object.fromEntries(Object.entries(r.porRetiro).map(([k, v]) => [k, enxuto(v)])), atualizadoEm: ts() };
  const batch = db.batch();
  batch.set(sub(fid, 'resumo').doc('atual'), dados);
  batch.set(sub(fid, 'resumo').doc('h-' + mes), hist);
  await batch.commit();
  return dados;
}

// contadores financeiros mensais (incremento, funciona offline)
function lancarFinanceiro(batch, fid, campo, mes, valor, retiroId) {
  const m = { total: inc(valor) }; if (retiroId) m['r_' + retiroId] = inc(valor);
  batch.set(sub(fid, 'resumo').doc('financeiro'), { tipo: 'financeiro', [campo]: { [mes]: m } }, { merge: true });
}
function contarMovimento(batch, fid, campo, mes, qtd, retiroId) {
  const m = { total: inc(qtd) }; if (retiroId) m['r_' + retiroId] = inc(qtd);
  batch.set(sub(fid, 'resumo').doc('financeiro'), { tipo: 'financeiro', mov: { [campo]: { [mes]: m } } }, { merge: true });
}

/* ---------- 5b. EVENTOS DO ANIMAL ---------- */
function novoEvento(fid, animal, tipo, data, dados, extra = {}) {
  return {
    ref: sub(fid, 'eventos').doc(),
    dados: { animalId: animal.id, brinco: animal.brinco || '', tipo, data, mes: U.mes(data), retiroId: animal.retiroId || null, dados: dados || {}, usuario: (SESSAO.user && SESSAO.user.email) || '', criadoEm: ts(), ...extra }
  };
}
function descreverEvento(e) {
  const d = e.dados || {};
  switch (e.tipo) {
    case 'pesagem': return `Pesagem: <b>${U.n(d.peso)} kg</b>${d.gmd != null ? ` · GMD ${U.n(d.gmd, 3)} kg/dia` : ''}`;
    case 'dg': return `Diagnóstico: <b>${REPRO[d.resultado] || d.resultado}</b>${d.diasGestacao ? ` (${d.diasGestacao} dias)` : ''}${d.dataPrevParto ? ` · parto previsto ${U.dataBR(d.dataPrevParto)}` : ''}`;
    case 'iatf': return `IATF ${U.esc(d.protocolo || '')} – etapa <b>${U.esc(d.etapa || '')}</b>${d.touro ? ` · ${U.esc(d.touro)}` : ''}`;
    case 'desmame': return `Desmame${d.peso ? ` – ${U.n(d.peso)} kg` : ''}`;
    case 'sanidade': return `Medicamento: <b>${U.esc(d.medicamento)}</b> ${U.n(d.dose, 1)} ${U.esc(d.unidade || 'ml')} · ${U.brl2(d.custo)}${d.carenciaAte ? ` · carência até ${U.dataBR(d.carenciaAte)}` : ''}${d.lote ? ' (aplicação em lote)' : ''}`;
    case 'transferencia': return `Transferência: ${U.esc(d.de || '—')} → <b>${U.esc(d.para || '—')}</b>`;
    case 'compra': return `Compra de ${U.esc(d.fornecedor || '—')} · ${U.brl2(d.custo)}`;
    case 'venda': return `Venda para ${U.esc(d.comprador || '—')} · ${U.brl2(d.valor)}`;
    case 'saida': return `Saída: <b>${U.esc(d.motivo || '')}</b> ${U.esc(d.causa || '')}`;
    case 'parto': return `Pariu ${d.sexo === 'F' ? 'fêmea' : 'macho'}${d.bezerro ? ` (brinco ${U.esc(d.bezerro)})` : ''}`;
    case 'nascimento': return `Nascimento${d.mae ? ` – mãe ${U.esc(d.mae)}` : ''}`;
    case 'cadastro': return `Cadastro (${U.esc(d.origem || '')})`;
    case 'edicao': return `Dados editados`;
    case 'obs': return `Observação: ${U.esc(d.texto)}`;
    default: return U.esc(e.tipo);
  }
}

/* ---------- 6. UI ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function toast(msg, tipo = 'ok', ms = 3000) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + tipo; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function modal(titulo, html, { ok = 'Salvar', cancelar = 'Cancelar', larga = false, aoAbrir, aoSalvar } = {}) {
  const fundo = document.createElement('div'); fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal ${larga ? 'larga' : ''}"><div class="modal-topo"><h3>${U.esc(titulo)}</h3><button class="x" data-fechar>✕</button></div><div class="modal-corpo">${html}</div>${aoSalvar ? `<div class="modal-rodape"><button class="btn sec" data-fechar>${cancelar}</button><button class="btn" data-ok>${ok}</button></div>` : ''}</div>`;
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  $$('[data-fechar]', fundo).forEach(b => b.onclick = fechar);
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
  if (aoSalvar) {
    const b = $('[data-ok]', fundo);
    b.onclick = async () => { b.disabled = true; try { const r = await aoSalvar(fundo); if (r !== false) fechar(); } catch (e) { console.error(e); toast(e.message || 'Erro', 'erro', 5000); } finally { b.disabled = false; } };
  }
  if (aoAbrir) aoAbrir(fundo);
  return { el: fundo, fechar };
}
function confirmar(msg) { return new Promise(res => { modal('Confirmar', `<p>${U.esc(msg)}</p>`, { ok: 'Confirmar', aoSalvar: () => { res(true); } }); }); }
function opcoes(lista, sel, vazio) { return (vazio !== undefined ? `<option value="">${U.esc(vazio)}</option>` : '') + lista.map(o => { const v = typeof o === 'object' ? o.id : o; const t = typeof o === 'object' ? (o.nome || o.id) : o; return `<option value="${U.esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${U.esc(t)}</option>`; }).join(''); }
function lerForm(el) { const o = {}; $$('[name]', el).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; }
function exportarExcel(linhas, nomeArquivo, aba = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(linhas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, aba); XLSX.writeFile(wb, nomeArquivo);
}
function indicadorConexao(el) {
  const atualizar = () => { el.className = 'conexao ' + (navigator.onLine ? 'on' : 'off'); el.textContent = navigator.onLine ? 'Online' : 'Offline – salvando no aparelho'; };
  window.addEventListener('online', atualizar); window.addEventListener('offline', atualizar); atualizar();
}
async function sair() { await auth.signOut(); location.href = 'index.html'; }

if (typeof module !== 'undefined') module.exports = { U, CALC, CATEGORIAS, CONFIG_PADRAO };
