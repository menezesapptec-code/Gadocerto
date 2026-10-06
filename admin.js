/* =====================================================================
   REBANHO 360 — Painel Administrativo (admin.js)
   ===================================================================== */
iniciarFirebase({ emulador: location.search.includes('emu=1') });
const QS = location.search;
const C = { retiros: [], lotes: [], meds: [], protocolos: [], touros: [], cot: null };
let FID = null, FAZ = null, TELA = 'geral';
const ehS = () => SESSAO.perfil && SESSAO.perfil.papel === 'superadmin';
const nomeRetiro = (id) => (C.retiros.find(r => r.id === id) || {}).nome || '—';
const nomeLote = (id) => (C.lotes.find(r => r.id === id) || {}).nome || '';

const MENU = [
  ['Painel', [['geral', 'Visão geral']]],
  ['Rebanho', [['animais', 'Animais'], ['importar', 'Importar Excel'], ['nascimentos', 'Nascimentos']]],
  ['Movimentações', [['compras', 'Compras'], ['vendas', 'Vendas'], ['saidas', 'Mortes e saídas'], ['custos', 'Custos gerais']]],
  ['Sanidade', [['medicamentos', 'Medicamentos'], ['aplicacoes', 'Aplicações']]],
  ['Reprodução', [['protocolos', 'Protocolos IATF'], ['touros', 'Touros e sêmen'], ['descarte', 'Descarte'], ['partos', 'Previsão de partos']]],
  ['Manejo', [['manejos', 'Manejos realizados']]],
  ['Relatórios', [['relatorios', 'Relatórios']]],
  ['Configuração', [['retiros', 'Retiros e lotes'], ['regras', 'Preços e regras'], ['usuarios', 'Usuários e acessos'], ['fazendas', 'Fazendas', 1], ['cotacoes', 'Cotações da arroba', 1]]]
];

/* ---------- inicialização ---------- */
(async () => {
  await exigirLogin(['superadmin', 'gerente']);
  document.title = APP.nome + ' — Administração'; $('#nomeApp').textContent = APP.nome;
  $('#usuario').textContent = SESSAO.user.email;
  indicadorConexao($('#conexao'));
  $('#btnMenu').onclick = () => $('#menu').classList.toggle('aberto');
  montarMenu();
  escolherFazendaInicial();
  montarSeletor();
  if (!SESSAO.fazenda) { if (ehS()) abrir('fazendas'); else $('#tela').innerHTML = '<div class="vazio">Nenhuma fazenda liberada para você.</div>'; return; }
  await trocarFazenda(SESSAO.fazenda.id);
})();

function montarSeletor() {
  const s = $('#selFazenda');
  s.innerHTML = SESSAO.fazendas.length ? opcoes(SESSAO.fazendas, FID || (SESSAO.fazenda && SESSAO.fazenda.id)) : '<option>Sem fazendas</option>';
  s.onchange = () => trocarFazenda(s.value);
}
function montarMenu() {
  let h = '';
  for (const [grupo, itens] of MENU) {
    const vis = itens.filter(i => !i[2] || ehS());
    if (!vis.length) continue;
    h += `<div class="grupo">${grupo}</div>` + vis.map(([id, nome]) => `<button data-t="${id}">${nome}</button>`).join('');
  }
  h += `<div class="grupo">Outros painéis</div>
    <button onclick="window.open('manejo.html${QS}','_blank')">Manejo no curral ↗</button>
    <button onclick="window.open('vaqueiro.html${QS}','_blank')">App do vaqueiro ↗</button>
    <button onclick="window.open('proprietario.html${QS}','_blank')">Painel do proprietário ↗</button>`;
  $('#menu').innerHTML = h;
  $$('#menu [data-t]').forEach(b => b.onclick = () => { abrir(b.dataset.t); $('#menu').classList.remove('aberto'); });
}
async function trocarFazenda(id) {
  FID = id; FAZ = SESSAO.fazendas.find(f => f.id === id); SESSAO.fazenda = FAZ; salvarFazenda(id);
  $('#selFazenda').value = id;
  await carregarCadastros();
  abrir(TELA);
}
async function carregarCadastros() {
  if (!FID) return;
  const [r, l, m, p, t, cot] = await Promise.all(['retiros', 'lotes', 'medicamentos', 'protocolos', 'touros'].map(n => sub(FID, n).get().then(docs)).concat([carregarCotacao(FAZ.uf, FID)]));
  const ord = (a, b) => (a.nome || '').localeCompare(b.nome || '');
  C.retiros = r.sort(ord); C.lotes = l.sort(ord); C.meds = m.sort(ord); C.protocolos = p.sort(ord); C.touros = t.sort(ord); C.cot = cot;
}
async function abrir(tela) {
  TELA = tela;
  $$('#menu [data-t]').forEach(b => b.classList.toggle('ativo', b.dataset.t === tela));
  const el = $('#tela'); el.innerHTML = '<div class="vazio">Carregando…</div>';
  if (!FID && !['fazendas', 'cotacoes', 'usuarios'].includes(tela)) { el.innerHTML = '<div class="vazio">Cadastre uma fazenda primeiro.</div>'; return; }
  try { await TELAS[tela](el); } catch (e) { console.error(e); el.innerHTML = `<div class="alerta verm">Erro ao carregar: ${U.esc(e.message)}</div>`; }
}
function tabela(cols, linhas, { clique, vazio = 'Nada encontrado.' } = {}) {
  if (!linhas.length) return `<div class="vazio">${vazio}</div>`;
  return `<div class="tabela-box"><table><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${linhas.map((l, i) => `<tr class="${clique ? 'click' : ''}" data-i="${i}">${cols.map(c => `<td class="${c.n ? 'n' : ''}">${c.f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function ligarCliques(el, linhas, fn) { $$('tr[data-i]', el).forEach(tr => tr.onclick = () => fn(linhas[+tr.dataset.i])); }
function marcarPendente(batch) { batch.set(sub(FID, 'resumo').doc('atual'), { pendente: true }, { merge: true }); }
async function recalcular(msg = true) {
  const t = msg ? toast('Recalculando resumo…', 'aviso', 2000) : null;
  await recalcularResumo(FID); if (msg) toast('Resumo atualizado');
}
const mesSel = (id, val) => `<input type="month" id="${id}" value="${val || U.mes()}" style="max-width:180px">`;

/* ---------- busca de animais ---------- */
async function buscarPorBrinco(brinco) {
  const b = U.normBrinco(brinco); if (!b) return null;
  let s = await sub(FID, 'animais').where('brinco', '==', b).get();
  if (s.empty) s = await sub(FID, 'animais').where('eletronico', '==', b).get();
  if (s.empty) return null;
  const lista = docs(s); return lista.find(a => a.status === 'ativo') || lista[0];
}
async function buscarVarios(brincos) {
  const out = []; const lista = [...new Set(brincos.map(U.normBrinco).filter(Boolean))];
  for (let i = 0; i < lista.length; i += 30) {
    const s = await sub(FID, 'animais').where('brinco', 'in', lista.slice(i, i + 30)).get();
    out.push(...docs(s));
  }
  return out;
}
const linhasTexto = (t) => String(t || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);

/* =====================================================================
   TELAS
   ===================================================================== */
const TELAS = {};

/* ---------- Visão geral ---------- */
TELAS.geral = async (el) => {
  let s = await sub(FID, 'resumo').doc('atual').get();
  if (!s.exists || s.data().pendente || !s.data().geral) { await recalcular(false); s = await sub(FID, 'resumo').doc('atual').get(); }
  const r = s.data(); const g = r.geral;
  const fin = (await sub(FID, 'resumo').doc('financeiro').get()).data() || {};
  const mes = U.mes(); const san = ((fin.sanitario || {})[mes] || {}).total || 0; const ger = ((fin.gerais || {})[mes] || {}).total || 0;
  const cot = r.cotacao;
  el.innerHTML = `
  <div class="linha"><h2>${U.esc(FAZ.nome)}</h2><span class="tag">${U.esc(FAZ.uf || 'UF?')}</span><span class="esp"></span>
    <span class="muted">Calculado em ${U.dataBR(r.calculadoEm)}</span><button class="btn sec peq" id="btnRecalc">Recalcular agora</button></div>
  ${!cot || !cot.arrobaBoi ? `<div class="alerta lar">Sem cotação automática da arroba para esta fazenda. Confira a cidade em Configuração › Preços e regras, ou informe os valores manualmente lá. <button class="btn sec peq" id="btnCot">Buscar cotação</button></div>` : `<div class="alerta azul linha"><span>Boi <b>${U.brl2(cot.arrobaBoi)}/@</b> <span class="muted">(${U.esc(cot.fonteBoi || cot.fonte || '')}${cot.data ? ', ' + U.esc(cot.data) : ''})</span> · Vaca <b>${cot.arrobaVaca ? U.brl2(cot.arrobaVaca) + '/@' : '—'}</b> <span class="muted">(${U.esc(cot.fonteVaca || '')}${cot.dataVaca ? ', ' + U.esc(cot.dataVaca) : ''})</span></span><span class="esp"></span><button class="btn sec peq" id="btnCot">Atualizar cotação</button></div>`}
  ${r.semPreco && Object.keys(r.semPreco).length ? `<div class="alerta verm">⚠ Sem preço para: <b>${Object.entries(r.semPreco).map(([k, n]) => `${CAT_NOME[k] || k} (${n})`).join(', ')}</b> – esses animais estão valendo zero. <button class="btn peq" onclick="abrir('regras')">Informar preço</button></div>` : ''}
  <div class="grid g4">
    <div class="kpi dest"><div class="rot">Valor estimado do rebanho</div><div class="val">${U.brl(g.valor)}</div><div class="det">${U.n(g.arrobas)} @ ${r.base === 'carcaca' ? 'de carcaça' : 'em pé'}</div></div>
    <div class="kpi"><div class="rot">Cabeças</div><div class="val">${U.n(g.cabecas)}</div><div class="det">${U.n(g.machos)} machos · ${U.n(g.femeas)} fêmeas</div></div>
    <div class="kpi"><div class="rot">Peso médio (pesados)</div><div class="val">${U.n(g.pesoMedio)} kg</div><div class="det">${U.n(g.semPeso)} sem pesagem (peso estimado)</div></div>
    <div class="kpi"><div class="rot">Taxa de prenhez</div><div class="val">${g.repro.taxaPrenhez == null ? '—' : U.n(g.repro.taxaPrenhez * 100, 1) + '%'}</div><div class="det">${U.n(g.repro.prenhas)} prenhas · ${U.n(g.repro.vazias)} vazias</div></div>
    <div class="kpi"><div class="rot">Descarte sugerido</div><div class="val">${U.n(g.descarte)}</div></div>
    <div class="kpi"><div class="rot">Em carência</div><div class="val">${U.n(g.emCarencia)}</div></div>
    <div class="kpi"><div class="rot">Gasto sanitário (${U.mesBR(mes)})</div><div class="val">${U.brl(san)}</div></div>
    <div class="kpi"><div class="rot">Custos gerais (${U.mesBR(mes)})</div><div class="val">${U.brl(ger)}</div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Por categoria</h3>${tabela([{ t: 'Categoria', f: x => CAT_NOME[x[0]] || x[0] }, { t: 'Cab.', n: 1, f: x => U.n(x[1].n) }, { t: 'Arrobas', n: 1, f: x => U.n(x[1].arrobas) }, { t: 'Valor', n: 1, f: x => U.brl(x[1].valor) }], Object.entries(g.porCategoria).sort((a, b) => b[1].n - a[1].n))}</div>
    <div class="card"><h3>Por retiro</h3>${tabela([{ t: 'Retiro', f: x => U.esc((r.retirosNomes || {})[x[0]] || 'Sem retiro') }, { t: 'Cab.', n: 1, f: x => U.n(x[1].cabecas) }, { t: 'Valor', n: 1, f: x => U.brl(x[1].valor) }, { t: 'Prenhez', n: 1, f: x => x[1].repro.taxaPrenhez == null ? '—' : U.n(x[1].repro.taxaPrenhez * 100, 0) + '%' }], Object.entries(r.porRetiro || {}).filter(x => x[1].cabecas))}</div>
  </div>
  <div class="card"><h3>Raças</h3><div>${Object.entries(g.racaDetalhe).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="tag verde">${U.esc(k)}: ${U.n(v)}</span>`).join(' ') || '—'}</div></div>`;
  $('#btnRecalc').onclick = async () => { await recalcular(); abrir('geral'); };
  $('#btnCot').onclick = async () => { toast('Buscando cotação…', 'aviso', 2000); const r = await atualizarCotacaoAuto(FID, FAZ, true); if (!r.doc || !r.doc.boi) return toast('Não consegui buscar a cotação agora: ' + (r.erro || ''), 'erro', 6000); C.cot = await carregarCotacao(FAZ.uf, FID); await recalcular(); abrir('geral'); };
};

/* ---------- Animais ---------- */
let LISTA_ANIMAIS = [];
TELAS.animais = async (el) => {
  el.innerHTML = `
  <div class="linha"><h2>Animais</h2><span class="esp"></span><button class="btn" id="novo">+ Novo animal</button></div>
  <div class="card"><div class="grid g4">
    <label>Buscar brinco<input id="fBrinco" placeholder="Nº do brinco"></label>
    <label>Retiro<select id="fRetiro">${opcoes(C.retiros, '', 'Todos os retiros')}</select></label>
    <label>Categoria<select id="fCat">${opcoes(CATEGORIAS, '', 'Todas')}</select></label>
    <label>Situação<select id="fStatus"><option value="ativo">Ativos</option><option value="vendido">Vendidos</option><option value="morto">Mortos/baixados</option><option value="todos">Todos</option></select></label>
  </div><div class="linha"><button class="btn" id="carregar">Carregar lista</button><button class="btn sec" id="exp">Exportar Excel</button><span class="muted" id="info"></span></div></div>
  <div id="lista"></div>`;
  $('#novo').onclick = () => formAnimal(null);
  $('#fBrinco').onkeydown = async (e) => { if (e.key === 'Enter') { const a = await buscarPorBrinco(e.target.value); if (a) fichaAnimal(a.id); else toast('Brinco não encontrado', 'aviso'); } };
  $('#carregar').onclick = carregarLista;
  $('#exp').onclick = () => exportarExcel(LISTA_ANIMAIS.map(linhaExport), `animais_${FAZ.nome}_${U.hoje()}.xlsx`, 'Animais');
  if (LISTA_ANIMAIS.length && LISTA_ANIMAIS._fid === FID) renderLista(); else if (C.retiros.length) { $('#fRetiro').value = C.retiros[0].id; carregarLista(); }
};
async function carregarLista() {
  const r = $('#fRetiro').value, st = $('#fStatus').value;
  let q = sub(FID, 'animais'); if (r) q = q.where('retiroId', '==', r); if (st !== 'todos') q = q.where('status', '==', st);
  $('#info').textContent = 'carregando…';
  LISTA_ANIMAIS = docs(await q.get()); LISTA_ANIMAIS._fid = FID;
  LISTA_ANIMAIS.sort((a, b) => String(a.brinco).localeCompare(String(b.brinco), 'pt', { numeric: true }));
  renderLista();
}
function renderLista(limite = 300) {
  const cat = $('#fCat').value; const lista = LISTA_ANIMAIS.filter(a => !cat || a.categoria === cat);
  $('#info').textContent = `${U.n(lista.length)} animais`;
  const hoje = U.hoje();
  const cols = [
    { t: 'Brinco', f: a => `<b>${U.esc(a.brinco)}</b>${a.nome ? `<div class="muted">${U.esc(a.nome)}</div>` : ''}` },
    { t: 'Categoria', f: a => CAT_NOME[a.categoria] || '—' }, { t: 'Raça', f: a => U.esc(a.raca || '—') },
    { t: 'Retiro / lote', f: a => U.esc(nomeRetiro(a.retiroId)) + (a.loteId ? ` <span class="muted">· ${U.esc(nomeLote(a.loteId))}</span>` : '') },
    { t: 'Peso', n: 1, f: a => a.pesoAtual ? U.n(a.pesoAtual) + ' kg' : '—' },
    { t: 'Idade', n: 1, f: a => a.nascimento ? U.idadeMeses(a.nascimento) + ' m' : '—' },
    { t: 'Reprodução', f: a => a.sexo === 'F' && a.categoria !== 'bezerra' ? `${REPRO[a.repro || '']}${a.comCria ? ' · parida' : ''}` : '' },
    { t: '', f: a => `${a.descarte ? '<span class="tag verm">descarte</span>' : ''}${a.carenciaAte && a.carenciaAte >= hoje ? '<span class="tag lar">carência</span>' : ''}${a.status !== 'ativo' ? `<span class="tag">${a.status}</span>` : ''}` }
  ];
  const mostrar = lista.slice(0, limite);
  $('#lista').innerHTML = tabela(cols, mostrar, { clique: 1 }) + (lista.length > limite ? `<p style="text-align:center"><button class="btn sec" id="mais">Mostrar mais (${lista.length - limite} restantes)</button></p>` : '');
  ligarCliques($('#lista'), mostrar, a => fichaAnimal(a.id));
  if ($('#mais')) $('#mais').onclick = () => renderLista(limite + 500);
}
function linhaExport(a) {
  const av = CALC.avaliar(a, C.cot, CALC.cfg(FAZ));
  return { Brinco: a.brinco, Eletronico: a.eletronico || '', Nome: a.nome || '', Sexo: a.sexo, Categoria: CAT_NOME[a.categoria] || '', Raca: a.raca || '', Nascimento: U.dataBR(a.nascimento), IdadeMeses: a.nascimento ? U.idadeMeses(a.nascimento) : '', Retiro: nomeRetiro(a.retiroId), Lote: nomeLote(a.loteId), Peso: a.pesoAtual || '', DataPeso: U.dataBR(a.dataPeso), GMD: a.gmd ?? '', Reproducao: REPRO[a.repro || ''], Parida: a.comCria ? 'Sim' : 'Não', PrevParto: U.dataBR(a.dataPrevParto), IATFsemSucesso: a.iatfFalhas || 0, Descarte: a.descarte ? (a.motivoDescarte || 'Sim') : '', Carencia: a.carenciaAte ? U.dataBR(a.carenciaAte) : '', Mae: a.maeBrinco || '', CustoCompra: a.custoCompra || 0, GastoDireto: a.custoSanitario || 0, Arrobas: Math.round(av.arrobas * 100) / 100, ValorEstimado: Math.round(av.valor), Situacao: a.status };
}

async function fichaAnimal(id) {
  const s = await sub(FID, 'animais').doc(id).get(); if (!s.exists) return toast('Animal não encontrado', 'erro');
  const a = { id, ...s.data() };
  const evs = docs(await sub(FID, 'eventos').where('animalId', '==', id).get()).sort((x, y) => (y.data || '').localeCompare(x.data || '') || ((y.criadoEm && y.criadoEm.seconds) || 0) - ((x.criadoEm && x.criadoEm.seconds) || 0));
  const av = CALC.avaliar(a, C.cot, CALC.cfg(FAZ)); const hoje = U.hoje();
  const margem = av.valor - (a.custoCompra || 0) - (a.custoSanitario || 0);
  const campo = (t, v) => `<div><dt>${t}</dt><dd>${v === undefined || v === null || v === '' ? '—' : v}</dd></div>`;
  const m = modal(`Animal ${a.brinco}`, `<div class="ficha">
    ${a.descarte ? `<div class="alerta verm">Candidato a descarte: ${U.esc(a.motivoDescarte || '')}</div>` : ''}
    ${a.carenciaAte && a.carenciaAte >= hoje ? `<div class="alerta lar">Em carência até ${U.dataBR(a.carenciaAte)} – não vender para abate.</div>` : ''}
    ${a.status !== 'ativo' ? `<div class="alerta azul">Situação: ${U.esc(a.status)} em ${U.dataBR(a.dataSaida)}</div>` : ''}
    <dl>
      ${campo('Brinco', U.esc(a.brinco))}${campo('Eletrônico', U.esc(a.eletronico))}${campo('Nome', U.esc(a.nome))}
      ${campo('Categoria', CAT_NOME[a.categoria])}${campo('Sexo', a.sexo === 'M' ? 'Macho' : a.sexo === 'F' ? 'Fêmea' : '')}${campo('Raça', U.esc(a.raca))}
      ${campo('Nascimento', a.nascimento ? `${U.dataBR(a.nascimento)} (${U.idadeMeses(a.nascimento)} m)` : '')}${campo('Mãe', U.esc(a.maeBrinco))}${campo('Pai/touro', U.esc(a.pai))}
      ${campo('Retiro', U.esc(nomeRetiro(a.retiroId)))}${campo('Lote', U.esc(nomeLote(a.loteId)))}${campo('Origem', U.esc(a.origem))}
      ${campo('Peso atual', a.pesoAtual ? `${U.n(a.pesoAtual)} kg (${U.dataBR(a.dataPeso)})` : '')}${campo('Peso anterior', a.pesoAnterior ? `${U.n(a.pesoAnterior)} kg` : '')}${campo('GMD', a.gmd != null ? U.n(a.gmd, 3) + ' kg/dia' : '')}
      ${a.sexo === 'F' ? campo('Reprodução', REPRO[a.repro || ''] + (a.comCria ? ' · parida' : ' · solteira')) + campo('Parto previsto', U.dataBR(a.dataPrevParto)) + campo('IATF sem sucesso', a.iatfFalhas || 0) + campo('Partos', a.partos || 0) : ''}
      ${campo('Desmamado', a.desmamado ? `Sim ${a.dataDesmame ? U.dataBR(a.dataDesmame) : ''}` : 'Não')}
      ${campo('Custo de compra', U.brl2(a.custoCompra))}${campo('Gasto direto', U.brl2(a.custoSanitario))}
      ${campo('Valor estimado hoje', `${U.brl(av.valor)}${av.pesoReal ? '' : ' <span class="muted">(peso estimado)</span>'}`)}${campo('Margem estimada', U.brl(margem))}
    </dl>
    ${a.obs ? `<p class="muted">Obs: ${U.esc(a.obs)}</p>` : ''}
    <div class="linha" style="margin:12px 0"><button class="btn peq" id="fEdit">Editar</button><button class="btn sec peq" id="fObs">+ Observação</button>${ehS() ? '<span class="esp"></span><button class="btn perigo peq" id="fDel">Excluir</button>' : ''}</div>
    <h3>Histórico</h3>
    <div class="timeline">${evs.map(e => `<div class="ev"><div class="muted">${U.dataBR(e.data)} · ${U.esc(e.usuario || '')}</div><div>${descreverEvento(e)}</div></div>`).join('') || '<p class="muted">Sem eventos.</p>'}</div>
  </div>`, { larga: true });
  $('#fEdit', m.el).onclick = () => { m.fechar(); formAnimal(a); };
  $('#fObs', m.el).onclick = () => modal('Observação', '<label>Texto<textarea name="t" rows="3"></textarea></label>', {
    aoSalvar: async (f) => { const t = $('[name=t]', f).value.trim(); if (!t) return false; const ev = novoEvento(FID, a, 'obs', U.hoje(), { texto: t }); await ev.ref.set(ev.dados); m.fechar(); fichaAnimal(id); }
  });
  if ($('#fDel', m.el)) $('#fDel', m.el).onclick = async () => { if (!(await confirmar('Excluir este animal definitivamente? (Prefira registrar morte/venda)'))) return; const b = db.batch(); b.delete(sub(FID, 'animais').doc(id)); marcarPendente(b); await b.commit(); m.fechar(); toast('Excluído'); LISTA_ANIMAIS = LISTA_ANIMAIS.filter(x => x.id !== id); if (TELA === 'animais') renderLista(); };
}

function camposAnimal(a) {
  a = a || {};
  return `<div class="grid g3">
    <label>Brinco *<input name="brinco" value="${U.esc(a.brinco || '')}" required></label>
    <label>Brinco eletrônico (chip)<input name="eletronico" value="${U.esc(a.eletronico || '')}"></label>
    <label>Nome/apelido<input name="nome" value="${U.esc(a.nome || '')}"></label>
    <label>Categoria *<select name="categoria">${opcoes(CATEGORIAS, a.categoria, 'Selecione')}</select></label>
    <label>Raça<select name="raca">${opcoes(RACAS, a.raca, '—')}</select></label>
    <label>Nascimento<input type="date" name="nascimento" value="${a.nascimento || ''}"></label>
    <label>Retiro<select name="retiroId">${opcoes(C.retiros, a.retiroId, '—')}</select></label>
    <label>Lote<select name="loteId">${opcoes(C.lotes.map(l => ({ id: l.id, nome: `${l.nome} (${nomeRetiro(l.retiroId)})` })), a.loteId, '—')}</select></label>
    <label>Peso atual (kg)<input type="number" step="0.1" name="pesoAtual" value="${a.pesoAtual || ''}"></label>
    <label>Data do peso<input type="date" name="dataPeso" value="${a.dataPeso || ''}"></label>
    <label>Mãe (brinco)<input name="maeBrinco" value="${U.esc(a.maeBrinco || '')}"></label>
    <label>Pai / touro<input name="pai" value="${U.esc(a.pai || '')}"></label>
    <label>Reprodução (fêmeas)<select name="repro">${opcoes(Object.entries(REPRO).map(([id, nome]) => ({ id, nome })), a.repro || '')}</select></label>
    <label>Parto previsto<input type="date" name="dataPrevParto" value="${a.dataPrevParto || ''}"></label>
    <label>IATF sem sucesso (seguidas)<input type="number" name="iatfFalhas" value="${a.iatfFalhas || 0}"></label>
    <label class="chk"><input type="checkbox" name="comCria" ${a.comCria ? 'checked' : ''}>Parida (com cria ao pé)</label>
    <label class="chk"><input type="checkbox" name="desmamado" ${a.desmamado ? 'checked' : ''}>Desmamado</label>
    <label>Data do desmame<input type="date" name="dataDesmame" value="${a.dataDesmame || ''}"></label>
    <label>Custo de compra (R$)<input type="number" step="0.01" name="custoCompra" value="${a.custoCompra || ''}"></label>
  </div><label>Observações<textarea name="obs" rows="2">${U.esc(a.obs || '')}</textarea></label>`;
}
function dadosAnimalDoForm(f) {
  const d = lerForm(f);
  const o = {
    brinco: U.normBrinco(d.brinco), eletronico: U.normBrinco(d.eletronico) || null, nome: d.nome || null, categoria: d.categoria, sexo: U.sexoDaCategoria(d.categoria), raca: d.raca || null,
    nascimento: d.nascimento || null, retiroId: d.retiroId || null, loteId: d.loteId || null, pesoAtual: U.num(d.pesoAtual), dataPeso: d.dataPeso || (U.num(d.pesoAtual) ? U.hoje() : null),
    maeBrinco: U.normBrinco(d.maeBrinco) || null, pai: d.pai || null, repro: d.repro || '', dataPrevParto: d.dataPrevParto || null, iatfFalhas: U.num(d.iatfFalhas) || 0,
    comCria: d.comCria, desmamado: d.desmamado, dataDesmame: d.dataDesmame || null, custoCompra: U.num(d.custoCompra) || 0, obs: d.obs || null
  };
  if (!o.brinco) throw new Error('Informe o brinco');
  if (!o.categoria) throw new Error('Informe a categoria');
  Object.assign(o, CALC.avaliarDescarte(o, CALC.cfg(FAZ)));
  return o;
}
function formAnimal(a) {
  modal(a ? `Editar ${a.brinco}` : 'Novo animal', camposAnimal(a), {
    larga: true, aoSalvar: async (f) => {
      const o = dadosAnimalDoForm(f);
      if (!a || a.brinco !== o.brinco) { const ex = await buscarPorBrinco(o.brinco); if (ex && ex.status === 'ativo') throw new Error('Já existe animal ativo com esse brinco'); }
      const b = db.batch();
      if (a) {
        b.update(sub(FID, 'animais').doc(a.id), { ...o, atualizadoEm: ts() });
        const ev = novoEvento(FID, { ...a, ...o }, 'edicao', U.hoje(), {}); b.set(ev.ref, ev.dados);
      } else {
        const ref = sub(FID, 'animais').doc();
        b.set(ref, { ...o, status: 'ativo', origem: 'manual', dataEntrada: U.hoje(), custoSanitario: 0, iatfTotal: 0, partos: 0, criadoEm: ts(), atualizadoEm: ts() });
        const ev = novoEvento(FID, { id: ref.id, ...o }, 'cadastro', U.hoje(), { origem: 'manual' }); b.set(ev.ref, ev.dados);
      }
      marcarPendente(b); await b.commit(); toast('Salvo');
      if (TELA === 'animais' && LISTA_ANIMAIS.length) carregarLista();
    }
  });
}

/* ---------- Importar Excel ---------- */
const CAMPOS_IMPORT = [
  ['brinco', 'Brinco *', ['brinco', 'brinco visual', 'n brinco', 'nº brinco', 'n° brinco', 'numero brinco', 'numero do brinco', 'numero', 'identificacao', 'id animal', 'animal', 'manejo', 'nº', 'n°', 'no', 'id', 'rgn', 'rgd', 'tag']],
  ['eletronico', 'Brinco eletrônico/chip', ['eletronico', 'brinco eletronico', 'chip', 'rfid', 'sisbov', 'bot', 'bastao', 'transponder']],
  ['nome', 'Nome', ['nome', 'apelido']],
  ['sexo', 'Sexo', ['sexo', 'sx', 'genero']],
  ['categoria', 'Categoria', ['categoria', 'categoria animal', 'cat', 'classe', 'tipo', 'era', 'evolucao']],
  ['raca', 'Raça', ['raca', 'grau de sangue', 'gs', 'composicao racial', 'sangue', 'pelagem']],
  ['nascimento', 'Data de nascimento', ['nascimento', 'data nascimento', 'data de nascimento', 'dt nasc', 'dt nascimento', 'data nasc', 'nasc', 'dn']],
  ['idade', 'Idade (meses)', ['idade', 'idade (meses)', 'idade meses', 'idade em meses', 'meses', 'idade atual']],
  ['idadeAnos', 'Idade (anos)', ['idade (anos)', 'idade anos', 'idade em anos', 'anos']],
  ['peso', 'Peso (kg)', ['peso', 'peso atual', 'peso (kg)', 'peso vivo', 'peso medio', 'ultimo peso', 'kg']],
  ['dataPeso', 'Data do peso', ['data peso', 'data do peso', 'data da pesagem', 'data pesagem', 'dt pesagem', 'pesagem']],
  ['repro', 'Situação reprodutiva', ['situacao', 'situacao reprodutiva', 'status reprodutivo', 'prenhez', 'diagnostico', 'diagnostico de gestacao', 'resultado dg', 'dg', 'reprodutivo', 'reproducao', 'prenha', 'gestante', 'toque', 'status']],
  ['comCria', 'Parida / com cria', ['parida', 'cria', 'com cria', 'solteira', 'bezerro ao pe', 'cria ao pe', 'amamentando']],
  ['dataPrevParto', 'Previsão de parto', ['previsao', 'previsao de parto', 'parto previsto', 'prev parto', 'data prevista parto', 'data provavel parto', 'dpp']],
  ['diasGestacao', 'Idade gestacional', ['idade gestacional', 'idade gest', 'ig', 'dias gestacao', 'dias de gestacao', 'tempo de gestacao', 'gestacao', 'dias prenhez', 'meses gestacao', 'meses de gestacao', 'tempo prenhez']],
  ['desmamado', 'Desmamado (sim/não)', ['desmamado', 'desmama']],
  ['dataDesmame', 'Data do desmame', ['data desmame', 'data do desmame', 'data da desmama', 'dt desmame', 'desmame']],
  ['pesoDesmame', 'Peso no desmame', ['peso desmame', 'peso a desmama', 'peso na desmama', 'peso desm']],
  ['maeBrinco', 'Mãe (brinco)', ['mae', 'brinco mae', 'brinco da mae', 'matriz']],
  ['pai', 'Pai / touro', ['pai', 'touro', 'reprodutor', 'semen', 'sire']],
  ['retiro', 'Retiro', ['retiro', 'fazenda', 'local', 'unidade', 'propriedade']],
  ['lote', 'Lote / pasto', ['lote', 'pasto', 'invernada', 'piquete', 'manga']],
  ['iatfFalhas', 'IATF sem sucesso', ['iatf sem sucesso', 'falhas iatf', 'iatf', 'falha', 'repasse']],
  ['custoCompra', 'Custo de compra', ['custo', 'custo compra', 'valor compra', 'preco']],
  ['obs', 'Observações', ['obs', 'observacao', 'observacoes', 'observ', 'anotacao', 'comentario']]
];
let IMP = null;
TELAS.importar = async (el) => {
  el.innerHTML = `<h2>Importar rebanho (Excel)</h2>
  <div class="card">
    <p class="muted">Suba a planilha do jeito que ela está. O sistema reconhece as colunas sozinho e mostra a conferência antes de gravar. Brincos que já existem serão <b>atualizados</b>; os novos serão <b>cadastrados</b>.</p>
    <div class="grid g3">
      <label>Arquivo (.xlsx, .xls, .csv)<input type="file" id="arq" accept=".xlsx,.xls,.csv"></label>
      <label>Retiro padrão (se a planilha não tiver)<select id="retPad">${opcoes(C.retiros, C.retiros.length === 1 ? C.retiros[0].id : '', '—')}</select></label>
      <label>Data de referência dos dados<input type="date" id="dataRef" value="${U.hoje()}"></label>
    </div>
    <button class="btn sec peq" id="modelo">Baixar planilha modelo</button>
  </div><div id="passo2"></div><div id="passo3"></div>`;
  $('#modelo').onclick = () => exportarExcel([{ Brinco: '1001', Chip: '', Sexo: 'F', Categoria: 'Vaca', Raca: 'Nelore', Nascimento: '15/03/2020', Peso: 420, DataPeso: '01/10/2026', Situacao: 'Prenha', IdadeGestacional: 120, Parida: 'Sim', Desmamado: '', DataDesmame: '', Mae: '', Pai: '', Retiro: 'Sede', Lote: 'Matrizes 1', IATFsemSucesso: 0, Obs: '' }], 'modelo_importacao.xlsx', 'Rebanho');
  $('#arq').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    $('#passo2').innerHTML = '<div class="vazio">Lendo planilha…</div>'; $('#passo3').innerHTML = '';
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    IMP = { wb, aba: null };
    // escolhe a aba que tiver mais colunas reconhecidas
    let melhor = null;
    for (const nome of wb.SheetNames) { const r = analisarAba(wb.Sheets[nome]); if (r && (!melhor || r.pontos > melhor.pontos)) melhor = { ...r, nome }; }
    if (!melhor) { $('#passo2').innerHTML = '<div class="alerta verm">Não encontrei dados na planilha.</div>'; return; }
    aplicarAnalise(melhor);
    renderMapeamento();
    if (IMP.mapa.brinco !== undefined) prepararImportacao();
  };
  $('#retPad').onchange = () => { if (IMP && IMP.mapa.brinco !== undefined) prepararImportacao(); };
};

// pontua o casamento de um cabeçalho com um sinônimo
function casaCab(h, s) {
  const a = U.sem(h).replace(/[()\[\]:._\-\/]/g, ' ').replace(/\s+/g, ' ').trim(); const b = U.sem(s).replace(/[()\[\]:._\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!a || !b) return 0;
  if (a === b) return 100 + b.length;
  if (b.length > 3 && (` ${a} `).includes(` ${b} `)) return 50 + b.length;   // palavra inteira
  if (b.length > 4 && a.includes(b)) return 20 + b.length;
  return 0;
}
// liga colunas aos campos (o casamento mais específico vence)
function mapearCabecalho(cab) {
  const cand = [];
  CAMPOS_IMPORT.forEach(([campo, , sinon]) => cab.forEach((h, i) => { let m = 0; sinon.forEach(s => m = Math.max(m, casaCab(h, s))); if (m) cand.push([m, campo, i]); }));
  cand.sort((x, y) => y[0] - x[0]);
  const mapa = {}, usadas = new Set();
  for (const [, campo, i] of cand) if (mapa[campo] === undefined && !usadas.has(i)) { mapa[campo] = i; usadas.add(i); }
  return mapa;
}
function analisarAba(ws) {
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (!matriz.length) return null;
  const txt = (c) => (c instanceof Date ? '' : String(c ?? '').trim());
  let melhor = null;
  const limite = Math.min(matriz.length, 40);
  for (let r = 0; r < limite; r++) {
    const linha = matriz[r].map(txt);
    if (linha.filter(Boolean).length < 2) continue;
    const opcoesCab = [linha];
    if (r > 0) { // cabeçalho em duas linhas (linha de cima mesclada)
      let ult = ''; const cima = (matriz[r - 1] || []).map(txt).map(v => (v ? (ult = v) : ult));
      opcoesCab.push(linha.map((v, i) => `${cima[i] || ''} ${v}`.trim()));
    }
    for (const cab of opcoesCab) {
      const mapa = mapearCabecalho(cab); const pontos = Object.keys(mapa).length + (mapa.brinco !== undefined ? 3 : 0);
      if (!melhor || pontos > melhor.pontos) melhor = { pontos, r, cab, mapa };
    }
  }
  if (!melhor) { melhor = { pontos: 0, r: 0, cab: matriz[0].map(txt), mapa: {} }; }
  const cab = melhor.cab.map((h, i) => h || `Coluna ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`);
  let linhas = matriz.slice(melhor.r + 1).filter(l => l.some(c => c !== '' && c !== null));
  // descarta linhas de total e cabeçalhos repetidos
  linhas = linhas.filter(l => { const t = U.sem(l.map(txt).join(' ')); return !/^(total|soma|media)\b/.test(t) && mapearCabecalho(l.map(txt)).brinco === undefined; });
  const mapa = { ...melhor.mapa };
  // sem coluna de brinco pelo nome: procura pela cara dos dados (valores curtos e únicos)
  if (mapa.brinco === undefined) {
    const usadas = new Set(Object.values(mapa));
    for (let i = 0; i < cab.length; i++) {
      if (usadas.has(i)) continue;
      const vals = linhas.map(l => txt(l[i])).filter(Boolean);
      if (vals.length < linhas.length * 0.8 || !vals.length) continue;
      const unicos = new Set(vals).size / vals.length;
      const forma = vals.filter(v => /^[A-Za-z0-9\-\/.]{1,15}$/.test(v) && !/^\d+[.,]\d+$/.test(v)).length / vals.length;
      if (unicos > 0.95 && forma > 0.9) { mapa.brinco = i; break; }
    }
  }
  return { pontos: melhor.pontos, cab, linhas, mapa };
}
function aplicarAnalise(r) { IMP.aba = r.nome; IMP.cab = r.cab; IMP.linhas = r.linhas; IMP.mapa = r.mapa; }
function lerAba() { const r = analisarAba(IMP.wb.Sheets[IMP.aba]); if (r) aplicarAnalise({ ...r, nome: IMP.aba }); }
function renderMapeamento() {
  const cabOps = [{ id: '', nome: '— não usar —' }].concat(IMP.cab.map((h, i) => ({ id: String(i), nome: h })));
  const achou = IMP.mapa.brinco !== undefined;
  const reconhecidas = CAMPOS_IMPORT.filter(([c]) => IMP.mapa[c] !== undefined);
  $('#passo2').innerHTML = `<div class="card">
    ${achou ? `<div class="alerta verde">Planilha reconhecida: <b>${U.n(IMP.linhas.length)} animais</b>${IMP.wb.SheetNames.length > 1 ? ` (aba “${U.esc(IMP.aba)}”)` : ''}.</div>` : '<div class="alerta verm">Não consegui identificar a coluna do <b>brinco</b>. Escolha abaixo qual coluna é o brinco.</div>'}
    <div>${reconhecidas.map(([c, nome]) => `<span class="tag verde">${nome.replace(' *', '')} ← ${U.esc(IMP.cab[IMP.mapa[c]])}</span>`).join(' ')}</div>
    <details ${achou ? '' : 'open'} style="margin-top:10px"><summary class="muted" style="cursor:pointer">Ajustar colunas (opcional)</summary>
      ${IMP.wb.SheetNames.length > 1 ? `<label style="margin-top:10px">Aba da planilha<select id="aba">${opcoes(IMP.wb.SheetNames, IMP.aba)}</select></label>` : ''}
      <div class="grid g4" style="margin-top:10px">${CAMPOS_IMPORT.map(([c, nome]) => `<label>${nome}<select data-c="${c}">${opcoes(cabOps, IMP.mapa[c] ?? '')}</select></label>`).join('')}</div>
      <button class="btn" id="prev">Conferir de novo</button></details></div>`;
  if ($('#aba')) $('#aba').onchange = (e) => { IMP.aba = e.target.value; lerAba(); renderMapeamento(); if (IMP.mapa.brinco !== undefined) prepararImportacao(); };
  $$('#passo2 [data-c]').forEach(s => s.onchange = () => { if (s.value === '') delete IMP.mapa[s.dataset.c]; else IMP.mapa[s.dataset.c] = +s.value; });
  $('#prev').onclick = prepararImportacao;
}
// idade em meses a partir de textos como "18", "13-24", "+36", "2 anos", "18 m"
function idadeMesesDe(v, emAnos) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return emAnos ? v * 12 : v;
  const s = U.sem(v);
  let m = s.match(/(\d+[.,]?\d*)\s*(?:a|-|ate)\s*(\d+[.,]?\d*)/); if (m) { const x = (U.num(m[1]) + U.num(m[2])) / 2; return /ano/.test(s) || emAnos ? x * 12 : x; }
  m = s.match(/(\d+[.,]?\d*)/); if (!m) return null; let n = U.num(m[1]);
  if (/[+>]|acima|mais/.test(s)) n += 4;
  if (/ano/.test(s) || (emAnos && !/mes|m\b/.test(s))) n *= 12;
  return n;
}
// dias de gestação a partir de "120", "4 meses", "4" (meses quando pequeno ou cabeçalho em meses)
function diasGestDe(v, cabMeses) {
  if (v === '' || v === null || v === undefined) return null;
  const s = U.sem(v); const n = U.num(typeof v === 'number' ? v : ((s.match(/(\d+[.,]?\d*)/) || [])[1]));
  if (n === null || n <= 0) return null;
  if (/mes/.test(s) || cabMeses || n <= 10) return Math.round(n * 30.4);
  return Math.round(n);
}
async function prepararImportacao() {
  if (IMP.mapa.brinco === undefined) return toast('Ligue a coluna do brinco', 'erro');
  $('#passo3').innerHTML = '<div class="vazio">Conferindo com o rebanho atual…</div>';
  const existentes = docs(await sub(FID, 'animais').get());
  const porBrinco = new Map(existentes.map(a => [a.brinco, a]));
  const retPorNome = new Map(C.retiros.map(r => [U.sem(r.nome), r.id]));
  const lotePorNome = new Map(C.lotes.map(l => [U.sem(l.nome), l]));
  const ref = $('#dataRef').value || U.hoje(); const retPad = $('#retPad').value || null; const cfg = CALC.cfg(FAZ);
  const v = (l, c) => IMP.mapa[c] === undefined ? '' : l[IMP.mapa[c]];
  const erros = [], avisos = [], registros = []; const vistos = new Set(); const novosRetiros = new Set(), novosLotes = new Set();
  // coluna "Fazenda" com um único valor é o nome da fazenda, não retiro
  const ignorarRetiro = IMP.mapa.retiro !== undefined && new Set(IMP.linhas.map(l => U.sem(l[IMP.mapa.retiro])).filter(Boolean)).size <= 1 && /fazenda|propriedade/.test(U.sem(IMP.cab[IMP.mapa.retiro]));
  IMP.linhas.forEach((l, i) => {
    const n = i + 2; const brinco = U.normBrinco(v(l, 'brinco'));
    if (!brinco) { erros.push(`Linha ${n}: sem brinco`); return; }
    if (vistos.has(brinco)) { erros.push(`Linha ${n}: brinco ${brinco} repetido na planilha`); return; }
    vistos.add(brinco);
    const reproTxt = U.sem(v(l, 'repro')); const catTxt = U.sem(v(l, 'categoria'));
    let comCria = null; const cc = U.sem(v(l, 'comCria'));
    if (cc) comCria = cc.includes('solteir') || cc === 'nao' || cc === 'n' ? false : (cc.includes('parid') || cc.includes('cria') || U.sim(cc));
    for (const t of [reproTxt, catTxt]) { if (t.includes('parid') || t.includes('c/ cria') || t.includes('com cria')) comCria = true; if (t.includes('solteir')) comCria = comCria ?? false; }
    let nasc = U.data(v(l, 'nascimento'));
    let idade = idadeMesesDe(v(l, 'idade'), false); if (idade === null) idade = idadeMesesDe(v(l, 'idadeAnos'), true);
    let cat = U.categoria(v(l, 'categoria'));
    if (idade === null && !cat && /\d/.test(catTxt)) idade = idadeMesesDe(v(l, 'categoria'), false); // "era" em faixa de meses
    if (!nasc && idade !== null) nasc = U.addDias(ref, -idade * 30.44);
    const dgDias = diasGestDe(v(l, 'diasGestacao'), IMP.mapa.diasGestacao !== undefined && /mes/.test(U.sem(IMP.cab[IMP.mapa.diasGestacao])));
    let sexo = U.sexo(v(l, 'sexo'));
    if (!sexo && /\bmacho\b/.test(catTxt)) sexo = 'M'; if (!sexo && /\bfemea\b/.test(catTxt)) sexo = 'F';
    if (!sexo && cat) sexo = U.sexoDaCategoria(cat);
    if (!sexo && (dgDias || U.repro(v(l, 'repro')) || comCria)) sexo = 'F';
    if (!cat) { cat = U.sugerirCategoria(sexo, nasc ? U.idadeMeses(nasc, ref) : null, comCria); if (cat) avisos.push(`Linha ${n} (${brinco}): categoria definida como ${CAT_NOME[cat]}`); }
    if (!cat) { erros.push(`Linha ${n} (${brinco}): sem sexo/categoria`); return; }
    if (!sexo) sexo = U.sexoDaCategoria(cat);
    const o = { brinco, sexo, categoria: cat };
    const eletr = U.normBrinco(v(l, 'eletronico')); if (eletr) o.eletronico = eletr;
    const nome = String(v(l, 'nome') || '').trim(); if (nome) o.nome = nome;
    const raca = U.raca(v(l, 'raca')); if (raca) o.raca = raca;
    if (nasc) o.nascimento = nasc;
    const peso = U.num(v(l, 'peso')); if (peso) { o.pesoAtual = peso; o.dataPeso = U.data(v(l, 'dataPeso')) || ref; }
    let rp = U.repro(v(l, 'repro')) || (/prenh/.test(catTxt) ? 'prenha' : /vazi/.test(catTxt) ? 'vazia' : null);
    if (!rp && dgDias) rp = 'prenha';
    if (rp) o.repro = rp;
    if (comCria !== null) o.comCria = comCria;
    let pp = U.data(v(l, 'dataPrevParto'));
    if (!pp && dgDias && o.repro === 'prenha') pp = U.addDias(ref, cfg.regras.diasGestacao - dgDias);
    if (dgDias && o.repro === 'prenha') o.diasGestacaoImport = dgDias;
    if (pp) o.dataPrevParto = pp;
    const dsm = U.data(v(l, 'dataDesmame')); const dsmS = v(l, 'desmamado');
    if (dsm) { o.desmamado = true; o.dataDesmame = dsm; } else if (dsmS !== '') o.desmamado = U.sim(dsmS);
    const pd = U.num(v(l, 'pesoDesmame')); if (pd) o.pesoDesmame = pd;
    const mae = U.normBrinco(v(l, 'maeBrinco')); if (mae) o.maeBrinco = mae;
    const pai = String(v(l, 'pai') || '').trim(); if (pai) o.pai = pai;
    let ret = String(v(l, 'retiro') || '').trim(); if (ignorarRetiro || U.sem(ret) === U.sem(FAZ.nome)) ret = '';
    if (ret) { const id = retPorNome.get(U.sem(ret)); if (id) o.retiroId = id; else { o._retiroNome = ret; novosRetiros.add(ret); } } else if (retPad) o.retiroId = retPad;
    const lote = String(v(l, 'lote') || '').trim();
    if (lote) { const lt = lotePorNome.get(U.sem(lote)); if (lt) o.loteId = lt.id; else { o._loteNome = lote; novosLotes.add(lote); } }
    const falhas = U.num(v(l, 'iatfFalhas')); if (falhas !== null) o.iatfFalhas = falhas;
    const cc2 = U.num(v(l, 'custoCompra')); if (cc2) o.custoCompra = cc2;
    const obs = String(v(l, 'obs') || '').trim(); if (obs) o.obs = obs;
    const atual = porBrinco.get(brinco);
    Object.assign(o, CALC.avaliarDescarte({ ...(atual || {}), ...o }, cfg, ref));
    registros.push({ o, atual });
  });
  IMP.registros = registros; IMP.novosRetiros = [...novosRetiros]; IMP.novosLotes = [...novosLotes];
  const novos = registros.filter(r => !r.atual).length, atual = registros.length - novos;
  const cont = {}; registros.forEach(r => cont[r.o.categoria] = (cont[r.o.categoria] || 0) + 1);
  $('#passo3').innerHTML = `<div class="card"><h3>Conferência</h3>
    <div class="grid g4"><div class="kpi"><div class="rot">Novos</div><div class="val">${U.n(novos)}</div></div><div class="kpi"><div class="rot">Atualizar existentes</div><div class="val">${U.n(atual)}</div></div><div class="kpi"><div class="rot">Erros (ignorados)</div><div class="val">${erros.length}</div></div><div class="kpi"><div class="rot">Avisos</div><div class="val">${avisos.length}</div></div></div>
    <p>${Object.entries(cont).map(([k, n]) => `<span class="tag verde">${CAT_NOME[k]}: ${n}</span>`).join(' ')}</p>
    ${registros.some(r => !r.o.retiroId && !r.o._retiroNome) ? `<div class="alerta lar">${U.n(registros.filter(r => !r.o.retiroId && !r.o._retiroNome).length)} animais sem retiro. Escolha o <b>retiro padrão</b> lá em cima antes de importar.</div>` : ''}
    ${IMP.novosRetiros.length ? `<div class="alerta azul">Serão criados os retiros: ${IMP.novosRetiros.map(U.esc).join(', ')}</div>` : ''}
    ${IMP.novosLotes.length ? `<div class="alerta azul">Serão criados os lotes: ${IMP.novosLotes.map(U.esc).join(', ')}</div>` : ''}
    ${erros.length ? `<details><summary>Ver erros</summary><div class="muted">${erros.slice(0, 300).map(U.esc).join('<br>')}</div></details>` : ''}
    ${avisos.length ? `<details><summary>Ver avisos</summary><div class="muted">${avisos.slice(0, 300).map(U.esc).join('<br>')}</div></details>` : ''}
    <h3 style="margin-top:12px">Prévia</h3>
    ${tabela([{ t: 'Brinco', f: r => U.esc(r.o.brinco) + (r.atual ? ' <span class="tag azul">atualiza</span>' : ' <span class="tag verde">novo</span>') }, { t: 'Cat.', f: r => CAT_NOME[r.o.categoria] }, { t: 'Raça', f: r => U.esc(r.o.raca || '') }, { t: 'Nasc.', f: r => U.dataBR(r.o.nascimento) }, { t: 'Peso', n: 1, f: r => r.o.pesoAtual || '' }, { t: 'Repro', f: r => (REPRO[r.o.repro || ''] || '') + (r.o.comCria ? ' · parida' : '') }, { t: 'Retiro', f: r => U.esc(r.o._retiroNome || nomeRetiro(r.o.retiroId)) }], registros.slice(0, 50))}
    <div class="linha" style="margin-top:12px"><button class="btn" id="gravar" ${registros.length ? '' : 'disabled'}>Importar ${U.n(registros.length)} animais</button><span id="prog" class="muted"></span></div></div>`;
  $('#gravar').onclick = gravarImportacao;
}
async function gravarImportacao() {
  $('#gravar').disabled = true;
  try {
    // cria retiros e lotes novos
    for (const nome of IMP.novosRetiros) { const ref = sub(FID, 'retiros').doc(); await ref.set({ nome, criadoEm: ts() }); C.retiros.push({ id: ref.id, nome }); }
    const retPorNome = new Map(C.retiros.map(r => [U.sem(r.nome), r.id]));
    for (const nome of IMP.novosLotes) { const ref = sub(FID, 'lotes').doc(); const r1 = IMP.registros.find(r => r.o._loteNome === nome); const retiroId = r1 ? (r1.o.retiroId || retPorNome.get(U.sem(r1.o._retiroNome || '')) || null) : null; await ref.set({ nome, retiroId, criadoEm: ts() }); C.lotes.push({ id: ref.id, nome, retiroId }); }
    const lotePorNome = new Map(C.lotes.map(l => [U.sem(l.nome), l.id]));
    const ops = []; const ref0 = $('#dataRef').value || U.hoje();
    for (const { o, atual } of IMP.registros) {
      if (o._retiroNome) { o.retiroId = retPorNome.get(U.sem(o._retiroNome)) || null; delete o._retiroNome; }
      if (o._loteNome) { o.loteId = lotePorNome.get(U.sem(o._loteNome)) || null; delete o._loteNome; }
      if (atual) ops.push({ tipo: 'update', ref: sub(FID, 'animais').doc(atual.id), dados: { ...o, atualizadoEm: ts() } });
      else {
        const ref = sub(FID, 'animais').doc();
        ops.push({ tipo: 'set', ref, dados: { repro: '', comCria: false, desmamado: false, iatfFalhas: 0, iatfTotal: 0, partos: 0, custoSanitario: 0, custoCompra: 0, ...o, status: 'ativo', origem: 'importacao', dataEntrada: ref0, criadoEm: ts(), atualizadoEm: ts() } });
        const ev = novoEvento(FID, { id: ref.id, ...o }, 'cadastro', ref0, { origem: 'importação Excel' }); ops.push({ tipo: 'set', ref: ev.ref, dados: ev.dados });
      }
    }
    await gravarEmLotes(ops, (f, t) => $('#prog').textContent = `Gravando ${U.n(f)} de ${U.n(t)}…`);
    $('#prog').textContent = 'Atualizando resumo…';
    await recalcularResumo(FID);
    toast(`Importação concluída: ${U.n(IMP.registros.length)} animais`); LISTA_ANIMAIS = [];
    $('#prog').innerHTML = '<b>Concluído!</b>';
  } catch (e) { console.error(e); toast('Erro: ' + e.message, 'erro', 6000); $('#gravar').disabled = false; }
}

/* ---------- Nascimentos ---------- */
TELAS.nascimentos = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Nascimentos</h2><span class="esp"></span>${mesSel('mes')}<button class="btn" id="novo">+ Registrar nascimento</button></div><div id="lista"></div>`;
  const carregar = async () => {
    const evs = docs(await sub(FID, 'eventos').where('mes', '==', $('#mes').value).where('tipo', '==', 'nascimento').get()).sort((a, b) => b.data.localeCompare(a.data));
    $('#lista').innerHTML = `<div class="card">${tabela([{ t: 'Data', f: e => U.dataBR(e.data) }, { t: 'Bezerro', f: e => U.esc(e.brinco) }, { t: 'Mãe', f: e => U.esc(e.dados.mae || '') }, { t: 'Sexo', f: e => e.dados.sexo === 'F' ? 'Fêmea' : 'Macho' }, { t: 'Peso', n: 1, f: e => e.dados.peso ? e.dados.peso + ' kg' : '' }, { t: 'Retiro', f: e => U.esc(nomeRetiro(e.retiroId)) }], evs, { clique: 1, vazio: 'Nenhum nascimento no mês.' })}</div>`;
    ligarCliques($('#lista'), evs, e => fichaAnimal(e.animalId));
  };
  $('#mes').onchange = carregar; $('#novo').onclick = () => formNascimento(carregar); carregar();
};
function formNascimento(depois) {
  modal('Registrar nascimento', `<div class="grid g2">
    <label>Brinco da mãe *<input name="mae" required></label><label>Data *<input type="date" name="data" value="${U.hoje()}"></label>
    <label>Sexo *<select name="sexo"><option value="M">Macho</option><option value="F">Fêmea</option></select></label>
    <label>Brinco do bezerro (se já tiver)<input name="brinco" placeholder="em branco = provisório"></label>
    <label>Peso ao nascer (kg)<input type="number" step="0.1" name="peso"></label><label>Raça<select name="raca">${opcoes(RACAS, '', 'Igual à mãe')}</select></label></div>`, {
    aoSalvar: async (f) => {
      const d = lerForm(f); const mae = await buscarPorBrinco(d.mae); if (!mae) throw new Error('Mãe não encontrada');
      await registrarNascimento(FID, mae, d, CALC.cfg(FAZ)); toast('Nascimento registrado'); if (depois) depois();
    }
  });
}
// usado também pelo app do vaqueiro (função duplicada lá de forma simples)
async function registrarNascimento(fid, mae, d, cfg) {
  let brinco = U.normBrinco(d.brinco);
  if (brinco) { const ex = await buscarPorBrinco(brinco); if (ex && ex.status === 'ativo') throw new Error('Brinco do bezerro já existe'); }
  else brinco = 'N' + d.data.replace(/-/g, '').slice(2) + '-' + mae.brinco;
  const b = db.batch(); const ref = sub(fid, 'animais').doc();
  const bez = { brinco, sexo: d.sexo, categoria: d.sexo === 'F' ? 'bezerra' : 'bezerro', raca: d.raca || mae.raca || null, nascimento: d.data, maeBrinco: mae.brinco, retiroId: mae.retiroId || null, loteId: mae.loteId || null, pesoAtual: U.num(d.peso), dataPeso: U.num(d.peso) ? d.data : null, pesoNascimento: U.num(d.peso), status: 'ativo', origem: 'nascimento', dataEntrada: d.data, repro: '', comCria: false, desmamado: false, iatfFalhas: 0, iatfTotal: 0, partos: 0, custoSanitario: 0, custoCompra: 0, criadoEm: ts(), atualizadoEm: ts() };
  b.set(ref, bez);
  const updMae = { comCria: true, repro: 'vazia', dataPrevParto: null, partos: (mae.partos || 0) + 1, ultimoParto: d.data, iatfFalhas: 0, atualizadoEm: ts() };
  if (mae.categoria === 'novilha') updMae.categoria = 'vaca';
  Object.assign(updMae, CALC.avaliarDescarte({ ...mae, ...updMae }, cfg));
  b.update(sub(fid, 'animais').doc(mae.id), updMae);
  const e1 = novoEvento(fid, { id: ref.id, ...bez }, 'nascimento', d.data, { mae: mae.brinco, sexo: d.sexo, peso: U.num(d.peso) }); b.set(e1.ref, e1.dados);
  const e2 = novoEvento(fid, mae, 'parto', d.data, { sexo: d.sexo, bezerro: brinco }); b.set(e2.ref, e2.dados);
  contarMovimento(b, fid, 'nascimentos', U.mes(d.data), 1, mae.retiroId);
  b.set(sub(fid, 'resumo').doc('atual'), { pendente: true }, { merge: true });
  await b.commit();
  return brinco;
}

/* ---------- Compras ---------- */
TELAS.compras = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Compras</h2><span class="esp"></span><button class="btn" id="novo">+ Lançar compra</button></div><div id="lista"></div>`;
  const carregar = async () => {
    const l = docs(await sub(FID, 'movimentacoes').where('tipo', '==', 'compra').get()).sort((a, b) => b.data.localeCompare(a.data));
    $('#lista').innerHTML = `<div class="card">${tabela([{ t: 'Data', f: m => U.dataBR(m.data) }, { t: 'Fornecedor', f: m => U.esc(m.contraparte) }, { t: 'Categoria', f: m => CAT_NOME[m.categoria] || '' }, { t: 'Qtd', n: 1, f: m => U.n(m.quantidade) }, { t: 'Peso médio', n: 1, f: m => m.pesoTotal ? U.n(m.pesoTotal / m.quantidade) + ' kg' : '—' }, { t: 'Custo total', n: 1, f: m => U.brl(m.custoTotal) }, { t: 'Por cabeça', n: 1, f: m => U.brl(m.custoTotal / m.quantidade) }, { t: 'Retiro', f: m => U.esc(nomeRetiro(m.retiroId)) }], l, { vazio: 'Nenhuma compra lançada.' })}</div>`;
  };
  $('#novo').onclick = () => modal('Lançar compra', `<div class="grid g3">
    <label>Data *<input type="date" name="data" value="${U.hoje()}"></label><label>Fornecedor<input name="contraparte"></label><label>Retiro *<select name="retiroId">${opcoes(C.retiros, '', 'Selecione')}</select></label>
    <label>Lote<select name="loteId">${opcoes(C.lotes, '', '—')}</select></label><label>Categoria *<select name="categoria">${opcoes(CATEGORIAS, '', 'Selecione')}</select></label><label>Raça<select name="raca">${opcoes(RACAS, '', '—')}</select></label>
    <label>Quantidade *<input type="number" name="quantidade"></label><label>Peso total (kg)<input type="number" step="0.1" name="pesoTotal"></label><label>Valor dos animais (R$) *<input type="number" step="0.01" name="valor"></label>
    <label>Frete (R$)<input type="number" step="0.01" name="frete"></label><label>Comissão (R$)<input type="number" step="0.01" name="comissao"></label><label>Idade aprox. (meses)<input type="number" name="idade"></label></div>
    <label>Brincos (um por linha – opcional; faltantes recebem número provisório)<textarea name="brincos" rows="4"></textarea></label><label>Observações<input name="obs"></label>`, {
    larga: true, aoSalvar: async (f) => {
      const d = lerForm(f); const qtd = U.num(d.quantidade); const valor = U.num(d.valor);
      if (!d.retiroId || !d.categoria || !qtd || !valor) throw new Error('Preencha retiro, categoria, quantidade e valor');
      const brincos = linhasTexto(d.brincos).map(U.normBrinco);
      if (brincos.length > qtd) throw new Error('Há mais brincos que a quantidade');
      if (brincos.length) { const ex = (await buscarVarios(brincos)).filter(a => a.status === 'ativo'); if (ex.length) throw new Error('Brincos já existentes: ' + ex.map(a => a.brinco).join(', ')); }
      const custoTotal = valor + (U.num(d.frete) || 0) + (U.num(d.comissao) || 0); const porCab = Math.round(custoTotal / qtd * 100) / 100;
      const pesoMed = U.num(d.pesoTotal) ? Math.round(U.num(d.pesoTotal) / qtd * 10) / 10 : null;
      const mref = sub(FID, 'movimentacoes').doc(); const ops = []; const ids = [];
      const nasc = U.num(d.idade) ? U.addDias(d.data, -U.num(d.idade) * 30.44) : null;
      for (let i = 0; i < qtd; i++) {
        const ref = sub(FID, 'animais').doc(); ids.push(ref.id);
        const brinco = brincos[i] || `C${d.data.replace(/-/g, '').slice(2)}-${mref.id.slice(0, 4).toUpperCase()}-${i + 1}`;
        const a = { brinco, sexo: U.sexoDaCategoria(d.categoria), categoria: d.categoria, raca: d.raca || null, nascimento: nasc, retiroId: d.retiroId, loteId: d.loteId || null, pesoAtual: pesoMed, dataPeso: pesoMed ? d.data : null, custoCompra: porCab, compraId: mref.id, status: 'ativo', origem: 'compra', dataEntrada: d.data, repro: '', comCria: false, desmamado: true, iatfFalhas: 0, iatfTotal: 0, partos: 0, custoSanitario: 0, criadoEm: ts(), atualizadoEm: ts() };
        ops.push({ tipo: 'set', ref, dados: a });
        const ev = novoEvento(FID, { id: ref.id, ...a }, 'compra', d.data, { fornecedor: d.contraparte, custo: porCab, peso: pesoMed }); ops.push({ tipo: 'set', ref: ev.ref, dados: ev.dados });
      }
      ops.push({ tipo: 'set', ref: mref, dados: { tipo: 'compra', data: d.data, mes: U.mes(d.data), contraparte: d.contraparte, retiroId: d.retiroId, categoria: d.categoria, quantidade: qtd, pesoTotal: U.num(d.pesoTotal), valor, frete: U.num(d.frete) || 0, comissao: U.num(d.comissao) || 0, custoTotal, animalIds: ids, obs: d.obs || null, usuario: SESSAO.user.email, criadoEm: ts() } });
      await gravarEmLotes(ops);
      const b = db.batch(); lancarFinanceiro(b, FID, 'compras', U.mes(d.data), custoTotal, d.retiroId); contarMovimento(b, FID, 'compras', U.mes(d.data), qtd, d.retiroId); await b.commit();
      await recalcularResumo(FID); toast(`Compra lançada: ${qtd} animais`); carregar();
    }
  });
  carregar();
};

/* ---------- Vendas ---------- */
TELAS.vendas = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Vendas</h2><span class="esp"></span><button class="btn" id="novo">+ Lançar venda</button></div><div id="lista"></div>`;
  const carregar = async () => {
    const l = docs(await sub(FID, 'movimentacoes').where('tipo', '==', 'venda').get()).sort((a, b) => b.data.localeCompare(a.data));
    $('#lista').innerHTML = `<div class="card">${tabela([{ t: 'Data', f: m => U.dataBR(m.data) }, { t: 'Comprador', f: m => U.esc(m.contraparte) }, { t: 'Tipo', f: m => U.esc(m.finalidade) }, { t: 'Qtd', n: 1, f: m => U.n(m.quantidade) }, { t: 'Peso médio', n: 1, f: m => m.pesoTotal ? U.n(m.pesoTotal / m.quantidade) + ' kg' : '—' }, { t: 'Valor', n: 1, f: m => U.brl(m.valor) }, { t: 'Custo acumulado', n: 1, f: m => U.brl(m.custoAcumulado) }, { t: 'Resultado', n: 1, f: m => `<b style="color:${m.valor - m.custoAcumulado >= 0 ? 'var(--verde)' : 'var(--erro)'}">${U.brl(m.valor - m.custoAcumulado)}</b>` }], l, { vazio: 'Nenhuma venda lançada.' })}</div>`;
  };
  $('#novo').onclick = () => modal('Lançar venda', `<div class="grid g3">
    <label>Data *<input type="date" name="data" value="${U.hoje()}"></label><label>Comprador / frigorífico<input name="contraparte"></label>
    <label>Finalidade<select name="finalidade"><option>Abate</option><option>Reposição</option><option>Descarte</option><option>Reprodução</option><option>Outro</option></select></label>
    <label>Selecionar por<select name="modo"><option value="brincos">Lista de brincos</option><option value="lote">Lote inteiro</option><option value="descarte">Todos marcados para descarte</option></select></label>
    <label>Lote (se for lote inteiro)<select name="loteId">${opcoes(C.lotes, '', '—')}</select></label>
    <label>Valor total recebido (R$) *<input type="number" step="0.01" name="valor"></label>
    <label>Peso total de saída (kg)<input type="number" step="0.1" name="pesoTotal"></label><label>Arrobas pagas (romaneio)<input type="number" step="0.01" name="arrobas"></label><label>Descontos (frete/Funrural etc.)<input type="number" step="0.01" name="descontos"></label></div>
    <label>Brincos (um por linha)<textarea name="brincos" rows="4"></textarea></label><div id="avisoVenda"></div>`, {
    larga: true, aoSalvar: async (f) => {
      const d = lerForm(f); const valor = U.num(d.valor); if (!valor) throw new Error('Informe o valor');
      let animais = [];
      if (d.modo === 'brincos') { const bs = linhasTexto(d.brincos); animais = (await buscarVarios(bs)).filter(a => a.status === 'ativo'); const nao = bs.map(U.normBrinco).filter(b => !animais.find(a => a.brinco === b)); if (nao.length && !f._ok) { $('#avisoVenda', f).innerHTML = `<div class="alerta lar">Não encontrados/inativos: ${nao.map(U.esc).join(', ')}. Clique em salvar de novo para seguir sem eles.</div>`; f._ok = 1; return false; } }
      else if (d.modo === 'lote') { if (!d.loteId) throw new Error('Escolha o lote'); animais = docs(await sub(FID, 'animais').where('loteId', '==', d.loteId).where('status', '==', 'ativo').get()); }
      else animais = docs(await sub(FID, 'animais').where('descarte', '==', true).where('status', '==', 'ativo').get());
      if (!animais.length) throw new Error('Nenhum animal selecionado');
      const hoje = d.data; const carencia = animais.filter(a => a.carenciaAte && a.carenciaAte >= hoje);
      if (carencia.length && d.finalidade === 'Abate' && !f._carOk) { $('#avisoVenda', f).innerHTML = `<div class="alerta verm"><b>${carencia.length} animal(is) em carência de medicamento:</b> ${carencia.map(a => `${U.esc(a.brinco)} (até ${U.dataBR(a.carenciaAte)})`).join(', ')}.<br>Para abate isso pode gerar problema no frigorífico. Clique em salvar de novo se quiser seguir mesmo assim.</div>`; f._carOk = 1; return false; }
      const liquido = valor - (U.num(d.descontos) || 0); const porCab = liquido / animais.length; const pesoMed = U.num(d.pesoTotal) ? U.num(d.pesoTotal) / animais.length : null;
      const custoAcumulado = animais.reduce((s, a) => s + (a.custoCompra || 0) + (a.custoSanitario || 0), 0);
      const mref = sub(FID, 'movimentacoes').doc(); const ops = [];
      for (const a of animais) {
        ops.push({ tipo: 'update', ref: sub(FID, 'animais').doc(a.id), dados: { status: 'vendido', dataSaida: d.data, valorVenda: Math.round(porCab * 100) / 100, pesoSaida: pesoMed, vendaId: mref.id, atualizadoEm: ts() } });
        const ev = novoEvento(FID, a, 'venda', d.data, { comprador: d.contraparte, valor: porCab, peso: pesoMed }); ops.push({ tipo: 'set', ref: ev.ref, dados: ev.dados });
      }
      ops.push({ tipo: 'set', ref: mref, dados: { tipo: 'venda', data: d.data, mes: U.mes(d.data), contraparte: d.contraparte, finalidade: d.finalidade, quantidade: animais.length, pesoTotal: U.num(d.pesoTotal), arrobas: U.num(d.arrobas), valor: liquido, valorBruto: valor, descontos: U.num(d.descontos) || 0, custoAcumulado, animalIds: animais.map(a => a.id), brincos: animais.map(a => a.brinco), usuario: SESSAO.user.email, criadoEm: ts() } });
      await gravarEmLotes(ops);
      const b = db.batch(); lancarFinanceiro(b, FID, 'vendas', U.mes(d.data), liquido); contarMovimento(b, FID, 'vendas', U.mes(d.data), animais.length); await b.commit();
      await recalcularResumo(FID); toast(`Venda lançada: ${animais.length} animais`); carregar();
    }
  });
  carregar();
};

/* ---------- Mortes e saídas ---------- */
TELAS.saidas = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Mortes e saídas</h2><span class="esp"></span><button class="btn" id="novo">+ Registrar saída</button></div><div id="lista"></div>`;
  const carregar = async () => {
    const l = docs(await sub(FID, 'movimentacoes').where('tipo', '==', 'saida').get()).sort((a, b) => b.data.localeCompare(a.data));
    $('#lista').innerHTML = `<div class="card">${tabela([{ t: 'Data', f: m => U.dataBR(m.data) }, { t: 'Brinco', f: m => U.esc(m.brincos.join(', ')) }, { t: 'Motivo', f: m => U.esc(m.motivo) }, { t: 'Causa', f: m => U.esc(m.causa || '') }, { t: 'Retiro', f: m => U.esc(nomeRetiro(m.retiroId)) }], l, { vazio: 'Nenhuma saída registrada.' })}</div>`;
  };
  $('#novo').onclick = () => formSaida(carregar);
  carregar();
};
function formSaida(depois) {
  modal('Registrar morte / saída', `<div class="grid g2"><label>Brinco *<input name="brinco"></label><label>Data *<input type="date" name="data" value="${U.hoje()}"></label>
    <label>Motivo<select name="motivo"><option>Morte</option><option>Consumo na fazenda</option><option>Roubo/desaparecido</option><option>Doação</option><option>Outro</option></select></label><label>Causa / detalhe<input name="causa"></label></div>`, {
    aoSalvar: async (f) => {
      const d = lerForm(f); const a = await buscarPorBrinco(d.brinco); if (!a || a.status !== 'ativo') throw new Error('Animal ativo não encontrado');
      const b = db.batch();
      b.update(sub(FID, 'animais').doc(a.id), { status: 'morto', motivoSaida: d.motivo, dataSaida: d.data, atualizadoEm: ts() });
      const ev = novoEvento(FID, a, 'saida', d.data, { motivo: d.motivo, causa: d.causa }); b.set(ev.ref, ev.dados);
      b.set(sub(FID, 'movimentacoes').doc(), { tipo: 'saida', data: d.data, mes: U.mes(d.data), motivo: d.motivo, causa: d.causa, retiroId: a.retiroId || null, animalIds: [a.id], brincos: [a.brinco], perda: (a.custoCompra || 0) + (a.custoSanitario || 0), usuario: SESSAO.user.email, criadoEm: ts() });
      contarMovimento(b, FID, d.motivo === 'Morte' ? 'mortes' : 'outrasSaidas', U.mes(d.data), 1, a.retiroId); marcarPendente(b);
      await b.commit(); toast('Saída registrada'); if (depois) depois();
    }
  });
}

/* ---------- Custos gerais ---------- */
TELAS.custos = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Custos gerais</h2><span class="esp"></span>${mesSel('mes')}<button class="btn" id="novo">+ Lançar custo</button></div>
    <p class="muted">Sal, ração, mão de obra, arrendamento… Lançados por retiro ou para a fazenda toda. Entram no custo por cabeça.</p><div id="lista"></div>`;
  const carregar = async () => {
    const l = docs(await sub(FID, 'custos').where('mes', '==', $('#mes').value).get()).sort((a, b) => b.data.localeCompare(a.data));
    const tot = l.reduce((s, c) => s + c.valor, 0);
    $('#lista').innerHTML = `<div class="card"><div class="linha"><b>Total do mês: ${U.brl2(tot)}</b></div>${tabela([{ t: 'Data', f: c => U.dataBR(c.data) }, { t: 'Tipo', f: c => U.esc(c.tipoCusto) }, { t: 'Descrição', f: c => U.esc(c.descricao || '') }, { t: 'Retiro', f: c => c.retiroId ? U.esc(nomeRetiro(c.retiroId)) : 'Fazenda toda' }, { t: 'Valor', n: 1, f: c => U.brl2(c.valor) }, { t: '', f: c => `<button class="btn sec peq" data-del="${c.id}">Excluir</button>` }], l, { vazio: 'Nenhum custo no mês.' })}</div>`;
    $$('[data-del]').forEach(bt => bt.onclick = async () => { const c = l.find(x => x.id === bt.dataset.del); if (!(await confirmar('Excluir este custo?'))) return; const b = db.batch(); b.delete(sub(FID, 'custos').doc(c.id)); lancarFinanceiro(b, FID, 'gerais', c.mes, -c.valor, c.retiroId); await b.commit(); carregar(); });
  };
  $('#mes').onchange = carregar;
  $('#novo').onclick = () => modal('Lançar custo', `<div class="grid g2"><label>Data *<input type="date" name="data" value="${U.hoje()}"></label><label>Tipo<select name="tipoCusto">${opcoes(TIPOS_CUSTO)}</select></label>
    <label>Valor (R$) *<input type="number" step="0.01" name="valor"></label><label>Retiro<select name="retiroId">${opcoes(C.retiros, '', 'Fazenda toda')}</select></label></div><label>Descrição<input name="descricao"></label>`, {
    aoSalvar: async (f) => {
      const d = lerForm(f); const v = U.num(d.valor); if (!v) throw new Error('Informe o valor');
      const b = db.batch(); b.set(sub(FID, 'custos').doc(), { data: d.data, mes: U.mes(d.data), tipoCusto: d.tipoCusto, descricao: d.descricao, valor: v, retiroId: d.retiroId || null, usuario: SESSAO.user.email, criadoEm: ts() });
      lancarFinanceiro(b, FID, 'gerais', U.mes(d.data), v, d.retiroId || null); await b.commit(); toast('Custo lançado'); carregar();
    }
  });
  carregar();
};

/* ---------- Medicamentos ---------- */
TELAS.medicamentos = async (el) => {
  await carregarCadastros();
  el.innerHTML = `<div class="linha"><h2>Medicamentos</h2><span class="esp"></span><button class="btn" id="novo">+ Cadastrar</button></div>
  <div class="card">${tabela([{ t: 'Nome', f: m => `<b>${U.esc(m.nome)}</b><div class="muted">${U.esc(m.tipo || '')}</div>` }, { t: 'Frasco', f: m => `${U.n(m.volume)} ${U.esc(m.unidade || 'ml')} · ${U.brl2(m.precoFrasco)}` }, { t: 'Custo/unid.', n: 1, f: m => U.brl2((m.precoFrasco || 0) / (m.volume || 1)) }, { t: 'Dose padrão', n: 1, f: m => m.dosePadrao ? `${m.dosePadrao} ${m.unidade || 'ml'} = ${U.brl2(CALC.custoDose(m, m.dosePadrao))}` : '—' }, { t: 'Carência', n: 1, f: m => m.carenciaDias ? m.carenciaDias + ' dias' : '—' }, { t: 'Estoque', n: 1, f: m => { const fr = (m.estoque || 0) / (m.volume || 1); const baixo = m.estoqueMin && fr <= m.estoqueMin; return `<span class="tag ${baixo ? 'verm' : 'verde'}">${U.n(fr, 1)} frascos</span>`; } }, { t: '', f: m => `<button class="btn sec peq" data-ent="${m.id}">Entrada</button>` }], C.meds, { clique: 1, vazio: 'Nenhum medicamento cadastrado.' })}</div>`;
  ligarCliques(el, C.meds, formMed);
  $$('[data-ent]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const m = C.meds.find(x => x.id === b.dataset.ent); modal(`Entrada de estoque – ${m.nome}`, `<div class="grid g2"><label>Frascos comprados<input type="number" name="fr"></label><label>Novo preço do frasco (opcional)<input type="number" step="0.01" name="preco" placeholder="${m.precoFrasco}"></label></div>`, { aoSalvar: async (f) => { const d = lerForm(f); const fr = U.num(d.fr); if (!fr) throw new Error('Informe os frascos'); const upd = { estoque: inc(fr * (m.volume || 1)) }; if (U.num(d.preco)) upd.precoFrasco = U.num(d.preco); await sub(FID, 'medicamentos').doc(m.id).update(upd); toast('Estoque atualizado'); abrir('medicamentos'); } }); });
  $('#novo').onclick = () => formMed(null);
};
function formMed(m) {
  m = m || {};
  modal(m.id ? 'Editar medicamento' : 'Novo medicamento', `<div class="grid g2">
    <label>Nome *<input name="nome" value="${U.esc(m.nome || '')}"></label><label>Tipo<select name="tipo">${opcoes(TIPOS_MED, m.tipo)}</select></label>
    <label>Unidade<select name="unidade">${opcoes(['ml', 'dose', 'g', 'comprimido'], m.unidade || 'ml')}</select></label><label>Volume do frasco (na unidade) *<input type="number" step="0.01" name="volume" value="${m.volume || ''}"></label>
    <label>Preço do frasco (R$) *<input type="number" step="0.01" name="precoFrasco" value="${m.precoFrasco || ''}"></label><label>Dose padrão (na unidade)<input type="number" step="0.01" name="dosePadrao" value="${m.dosePadrao || ''}"></label>
    <label>Carência para abate (dias)<input type="number" name="carenciaDias" value="${m.carenciaDias || ''}"></label><label>Estoque mínimo (frascos)<input type="number" name="estoqueMin" value="${m.estoqueMin || ''}"></label>
    ${m.id ? '' : '<label>Estoque inicial (frascos)<input type="number" name="estoqueIni"></label>'}<label class="chk"><input type="checkbox" name="inativo" ${m.inativo ? 'checked' : ''}>Inativo (não aparece no curral)</label></div>`, {
    aoSalvar: async (f) => {
      const d = lerForm(f); const o = { nome: d.nome, tipo: d.tipo, unidade: d.unidade, volume: U.num(d.volume), precoFrasco: U.num(d.precoFrasco), dosePadrao: U.num(d.dosePadrao), carenciaDias: U.num(d.carenciaDias) || 0, estoqueMin: U.num(d.estoqueMin) || 0, inativo: d.inativo };
      if (!o.nome || !o.volume || o.precoFrasco === null) throw new Error('Preencha nome, volume e preço');
      if (m.id) await sub(FID, 'medicamentos').doc(m.id).update(o); else await sub(FID, 'medicamentos').add({ ...o, estoque: (U.num(d.estoqueIni) || 0) * o.volume, criadoEm: ts() });
      toast('Salvo'); abrir('medicamentos');
    }
  });
}

/* ---------- Aplicações ---------- */
TELAS.aplicacoes = async (el) => {
  el.innerHTML = `<div class="linha"><h2>Aplicações de medicamento</h2><span class="esp"></span>${mesSel('mes')}<button class="btn sec" id="exp">Exportar</button></div><div id="lista"></div>`;
  let l = [];
  const carregar = async () => {
    l = docs(await sub(FID, 'eventos').where('mes', '==', $('#mes').value).where('tipo', '==', 'sanidade').get()).sort((a, b) => b.data.localeCompare(a.data));
    const porMed = {}; l.forEach(e => { const k = e.dados.medicamento; porMed[k] = porMed[k] || { n: 0, custo: 0, dose: 0 }; porMed[k].n++; porMed[k].custo += e.dados.custo || 0; porMed[k].dose += e.dados.dose || 0; });
    const tot = l.reduce((s, e) => s + (e.dados.custo || 0), 0);
    $('#lista').innerHTML = `<div class="grid g2"><div class="card"><h3>Resumo do mês – ${U.brl2(tot)}</h3>${tabela([{ t: 'Medicamento', f: x => U.esc(x[0]) }, { t: 'Aplicações', n: 1, f: x => U.n(x[1].n) }, { t: 'Total usado', n: 1, f: x => U.n(x[1].dose, 1) }, { t: 'Custo', n: 1, f: x => U.brl2(x[1].custo) }], Object.entries(porMed))}</div>
      <div class="card"><h3>Lançamentos (${l.length})</h3>${tabela([{ t: 'Data', f: e => U.dataBR(e.data) }, { t: 'Brinco', f: e => U.esc(e.brinco) }, { t: 'Medicamento', f: e => U.esc(e.dados.medicamento) }, { t: 'Dose', n: 1, f: e => U.n(e.dados.dose, 1) }, { t: 'Custo', n: 1, f: e => U.brl2(e.dados.custo) }, { t: 'Por', f: e => U.esc((e.usuario || '').split('@')[0]) }], l.slice(0, 500), { clique: 1 })}</div></div>`;
    ligarCliques($('#lista').children[0].children[1], l.slice(0, 500), e => fichaAnimal(e.animalId));
  };
  $('#mes').onchange = carregar;
  $('#exp').onclick = () => exportarExcel(l.map(e => ({ Data: U.dataBR(e.data), Brinco: e.brinco, Medicamento: e.dados.medicamento, Dose: e.dados.dose, Unidade: e.dados.unidade, Custo: e.dados.custo, Retiro: nomeRetiro(e.retiroId), Usuario: e.usuario })), `aplicacoes_${$('#mes').value}.xlsx`);
  carregar();
};

/* ---------- Protocolos IATF ---------- */
TELAS.protocolos = async (el) => {
  await carregarCadastros();
  el.innerHTML = `<div class="linha"><h2>Protocolos de IATF</h2><span class="esp"></span>${C.protocolos.length ? '' : '<button class="btn sec" id="padrao">Criar protocolo padrão (3 manejos)</button>'}<button class="btn" id="novo">+ Novo protocolo</button></div>
  <p class="muted">Cada fazenda tem seus protocolos. Marque qual etapa é a inseminação – é nela que o animal fica como "inseminada" e conta para a regra de descarte.</p>
  <div class="card">${tabela([{ t: 'Protocolo', f: p => `<b>${U.esc(p.nome)}</b>` }, { t: 'Etapas', f: p => p.etapas.map(e => `<span class="tag ${e.ia ? 'verde' : ''}">${U.esc(e.nome)} (dia ${e.dia})${e.ia ? ' · IA' : ''}</span>`).join(' ') }, { t: 'DG após IA', n: 1, f: p => (p.diasDG || 30) + ' dias' }], C.protocolos, { clique: 1, vazio: 'Nenhum protocolo cadastrado.' })}</div>`;
  ligarCliques(el, C.protocolos, formProtocolo);
  $('#novo').onclick = () => formProtocolo(null);
  if ($('#padrao')) $('#padrao').onclick = async () => { await sub(FID, 'protocolos').add({ nome: 'IATF padrão (D0-D8-D10)', diasDG: 30, etapas: [{ nome: 'D0 – implante + BE', dia: 0, ia: false }, { nome: 'D8 – retirada + PGF + eCG + CE', dia: 8, ia: false }, { nome: 'D10 – inseminação', dia: 10, ia: true }], criadoEm: ts() }); toast('Protocolo criado'); abrir('protocolos'); };
};
function formProtocolo(p) {
  p = p || { etapas: [{ nome: 'D0', dia: 0 }, { nome: 'D8', dia: 8 }, { nome: 'D10 – IA', dia: 10, ia: true }], diasDG: 30 };
  const linhaEtapa = (e, i) => `<div class="grid g3 etapa"><label>Etapa<input data-k="nome" value="${U.esc(e.nome || '')}"></label><label>Dia<input type="number" data-k="dia" value="${e.dia ?? ''}"></label><label class="chk" style="margin-top:18px"><input type="checkbox" data-k="ia" ${e.ia ? 'checked' : ''}>É a inseminação</label></div>`;
  modal(p.id ? 'Editar protocolo' : 'Novo protocolo', `<label>Nome *<input name="nome" value="${U.esc(p.nome || '')}"></label><label>Diagnóstico de gestação (dias após IA)<input type="number" name="diasDG" value="${p.diasDG || 30}"></label>
    <h3>Etapas</h3><div id="etapas">${p.etapas.map(linhaEtapa).join('')}</div><button class="btn sec peq" id="addEt" type="button">+ Etapa</button>${p.id ? ' <button class="btn perigo peq" id="delP" type="button">Excluir protocolo</button>' : ''}`, {
    aoAbrir: (f) => { $('#addEt', f).onclick = () => $('#etapas', f).insertAdjacentHTML('beforeend', linhaEtapa({}, 0)); if ($('#delP', f)) $('#delP', f).onclick = async () => { await sub(FID, 'protocolos').doc(p.id).delete(); f.remove(); abrir('protocolos'); }; },
    aoSalvar: async (f) => {
      const etapas = $$('.etapa', f).map(r => ({ nome: $('[data-k=nome]', r).value.trim(), dia: U.num($('[data-k=dia]', r).value) || 0, ia: $('[data-k=ia]', r).checked })).filter(e => e.nome);
      const o = { nome: $('[name=nome]', f).value.trim(), diasDG: U.num($('[name=diasDG]', f).value) || 30, etapas };
      if (!o.nome || !etapas.length) throw new Error('Informe nome e etapas');
      if (p.id) await sub(FID, 'protocolos').doc(p.id).update(o); else await sub(FID, 'protocolos').add({ ...o, criadoEm: ts() });
      abrir('protocolos');
    }
  });
}

/* ---------- Touros e sêmen ---------- */
TELAS.touros = async (el) => {
  await carregarCadastros();
  el.innerHTML = `<div class="linha"><h2>Touros e sêmen</h2><span class="esp"></span><button class="btn" id="novo">+ Cadastrar</button></div>
  <div class="card">${tabela([{ t: 'Nome', f: t => `<b>${U.esc(t.nome)}</b>` }, { t: 'Tipo', f: t => t.tipo === 'semen' ? 'Sêmen' : 'Touro (monta)' }, { t: 'Raça', f: t => U.esc(t.raca || '') }, { t: 'Preço da dose', n: 1, f: t => t.precoDose ? U.brl2(t.precoDose) : '—' }], C.touros, { clique: 1, vazio: 'Nenhum cadastrado.' })}</div>`;
  const form = (t) => { t = t || {}; modal(t.id ? 'Editar' : 'Novo touro/sêmen', `<div class="grid g2"><label>Nome *<input name="nome" value="${U.esc(t.nome || '')}"></label><label>Tipo<select name="tipo">${opcoes([{ id: 'semen', nome: 'Sêmen' }, { id: 'touro', nome: 'Touro (monta)' }], t.tipo || 'semen')}</select></label><label>Raça<select name="raca">${opcoes(RACAS, t.raca, '—')}</select></label><label>Preço da dose (R$)<input type="number" step="0.01" name="precoDose" value="${t.precoDose || ''}"></label></div>`, { aoSalvar: async (f) => { const d = lerForm(f); if (!d.nome) throw new Error('Informe o nome'); const o = { nome: d.nome, tipo: d.tipo, raca: d.raca || null, precoDose: U.num(d.precoDose) || 0 }; if (t.id) await sub(FID, 'touros').doc(t.id).update(o); else await sub(FID, 'touros').add(o); abrir('touros'); } }); };
  ligarCliques(el, C.touros, form); $('#novo').onclick = () => form(null);
};

/* ---------- Descarte ---------- */
TELAS.descarte = async (el) => {
  const l = docs(await sub(FID, 'animais').where('descarte', '==', true).where('status', '==', 'ativo').get()).sort((a, b) => String(a.brinco).localeCompare(String(b.brinco), 'pt', { numeric: true }));
  const r = CALC.cfg(FAZ).regras;
  el.innerHTML = `<div class="linha"><h2>Candidatos a descarte (${l.length})</h2><span class="esp"></span><button class="btn sec" id="exp">Exportar</button></div>
  <div class="alerta azul">Regras desta fazenda: ${r.maxIatfFalhas} IATF seguidas sem prenhez · vacas com ${r.idadeMaxVacaAnos} anos ou mais. Ajuste em Configuração › Regras.</div>
  <div class="card">${tabela([{ t: 'Brinco', f: a => `<b>${U.esc(a.brinco)}</b>` }, { t: 'Categoria', f: a => CAT_NOME[a.categoria] }, { t: 'Motivo', f: a => U.esc(a.motivoDescarte || '') }, { t: 'Retiro', f: a => U.esc(nomeRetiro(a.retiroId)) }, { t: 'Peso', n: 1, f: a => a.pesoAtual ? U.n(a.pesoAtual) + ' kg' : '—' }, { t: 'Carência', f: a => a.carenciaAte && a.carenciaAte >= U.hoje() ? `<span class="tag lar">até ${U.dataBR(a.carenciaAte)}</span>` : '' }], l, { clique: 1, vazio: 'Nenhum animal marcado para descarte.' })}</div>`;
  ligarCliques(el, l, a => fichaAnimal(a.id));
  $('#exp').onclick = () => exportarExcel(l.map(linhaExport), `descarte_${U.hoje()}.xlsx`);
};

/* ---------- Previsão de partos ---------- */
TELAS.partos = async (el) => {
  const l = docs(await sub(FID, 'animais').where('repro', '==', 'prenha').where('status', '==', 'ativo').get()).sort((a, b) => (a.dataPrevParto || '9').localeCompare(b.dataPrevParto || '9'));
  const porMes = {}; l.forEach(a => { const m = a.dataPrevParto ? a.dataPrevParto.slice(0, 7) : 'sem data'; porMes[m] = (porMes[m] || 0) + 1; });
  el.innerHTML = `<div class="linha"><h2>Previsão de partos (${l.length} prenhas)</h2><span class="esp"></span><button class="btn sec" id="exp">Exportar</button></div>
  <div class="card"><div>${Object.entries(porMes).map(([m, n]) => `<span class="tag verde">${m === 'sem data' ? m : U.mesBR(m)}: ${n}</span>`).join(' ')}</div></div>
  <div class="card">${tabela([{ t: 'Brinco', f: a => `<b>${U.esc(a.brinco)}</b>` }, { t: 'Parto previsto', f: a => U.dataBR(a.dataPrevParto) }, { t: 'Retiro', f: a => U.esc(nomeRetiro(a.retiroId)) }, { t: 'Touro/sêmen', f: a => U.esc((a.ultimaIatf && a.ultimaIatf.touro) || a.pai || '') }], l, { clique: 1, vazio: 'Nenhuma prenha registrada.' })}</div>`;
  ligarCliques(el, l, a => fichaAnimal(a.id));
  $('#exp').onclick = () => exportarExcel(l.map(linhaExport), `partos_${U.hoje()}.xlsx`);
};

/* ---------- Manejos ---------- */
TELAS.manejos = async (el) => {
  const l = docs(await sub(FID, 'manejos').get()).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  el.innerHTML = `<div class="linha"><h2>Manejos realizados</h2><span class="esp"></span><button class="btn" onclick="window.open('manejo.html${QS}','_blank')">Abrir manejo no curral ↗</button></div>
  <div class="card">${tabela([{ t: 'Data', f: m => U.dataBR(m.data) }, { t: 'Retiro', f: m => U.esc(nomeRetiro(m.retiroId)) }, { t: 'Tipos', f: m => (m.tipos || []).map(t => `<span class="tag">${U.esc(t)}</span>`).join(' ') }, { t: 'Animais', n: 1, f: m => U.n(m.totais && m.totais.passaram) }, { t: 'Faltaram', n: 1, f: m => U.n(m.totais && m.totais.faltaram) }, { t: 'Status', f: m => m.status === 'fechado' ? '<span class="tag verde">fechado</span>' : '<span class="tag lar">aberto</span>' }, { t: 'Operador', f: m => U.esc((m.usuario || '').split('@')[0]) }], l, { clique: 1, vazio: 'Nenhum manejo ainda.' })}</div>`;
  ligarCliques(el, l, (m) => {
    const t = m.totais || {};
    modal(`Manejo ${U.dataBR(m.data)} – ${nomeRetiro(m.retiroId)}`, `<div class="grid g3">
      <div class="kpi"><div class="rot">Passaram</div><div class="val">${U.n(t.passaram)}</div></div><div class="kpi"><div class="rot">Esperados</div><div class="val">${U.n(t.esperados)}</div></div><div class="kpi"><div class="rot">Faltaram</div><div class="val">${U.n(t.faltaram)}</div></div>
      <div class="kpi"><div class="rot">Pesados</div><div class="val">${U.n(t.pesados)}</div><div class="det">média ${U.n(t.pesoMedio)} kg</div></div><div class="kpi"><div class="rot">Prenhas / vazias</div><div class="val">${U.n(t.prenhas)} / ${U.n(t.vazias)}</div></div><div class="kpi"><div class="rot">Novos descartes</div><div class="val">${U.n(t.descartes)}</div></div></div>
      ${m.faltantes && m.faltantes.length ? `<h3 style="margin-top:12px">Não passaram (${m.faltantes.length})</h3><p class="muted">${m.faltantes.map(U.esc).join(', ')}</p>` : ''}`, { larga: true });
  });
};

/* ---------- Relatórios ---------- */
TELAS.relatorios = async (el) => {
  el.innerHTML = `<h2>Relatórios</h2><div class="card"><p class="muted">Os relatórios leem o rebanho inteiro da fazenda. Use quando precisar.</p>
    <div class="linha"><label style="margin:0">Retiro<select id="rRet">${opcoes(C.retiros, '', 'Todos')}</select></label><button class="btn" id="gerar">Gerar relatórios</button></div></div><div id="rel"></div>`;
  $('#gerar').onclick = async () => {
    $('#rel').innerHTML = '<div class="vazio">Calculando…</div>';
    let q = sub(FID, 'animais').where('status', '==', 'ativo'); const r = $('#rRet').value; if (r) q = q.where('retiroId', '==', r);
    const lista = docs(await q.get()); const cfg = CALC.cfg(FAZ); const hoje = U.hoje();
    lista.forEach(a => { const av = CALC.avaliar(a, C.cot, cfg); a._valor = av.valor; a._margem = av.valor - (a.custoCompra || 0) - (a.custoSanitario || 0); a._diasPeso = a.dataPeso ? U.diffDias(a.dataPeso, hoje) : 99999; });
    const fin = (await sub(FID, 'resumo').doc('financeiro').get()).data() || {};
    const meses = [...new Set([...Object.keys(fin.sanitario || {}), ...Object.keys(fin.gerais || {}), ...Object.keys(fin.compras || {}), ...Object.keys(fin.vendas || {})])].sort().reverse().slice(0, 12);
    const v = (o, m) => ((o || {})[m] || {})[r ? 'r_' + r : 'total'] || 0;
    const top = (arr, fn, n = 30) => [...arr].sort(fn).slice(0, n);
    const colsA = (extra) => [{ t: 'Brinco', f: a => `<b>${U.esc(a.brinco)}</b>` }, { t: 'Cat.', f: a => CAT_NOME[a.categoria] }, { t: 'Retiro', f: a => U.esc(nomeRetiro(a.retiroId)) }, ...extra];
    const cab = lista.length || 1;
    const custoMes = meses.map(m => ({ m, san: v(fin.sanitario, m), ger: v(fin.gerais, m), comp: v(fin.compras, m), vend: r ? 0 : v(fin.vendas, m) }));
    $('#rel').innerHTML = `
      <div class="card"><h3>Custos por mês ${r ? '– ' + U.esc(nomeRetiro(r)) : ''}</h3>${tabela([{ t: 'Mês', f: x => U.mesBR(x.m) }, { t: 'Sanitário', n: 1, f: x => U.brl(x.san) }, { t: 'Custos gerais', n: 1, f: x => U.brl(x.ger) }, { t: 'Custo/cabeça (san.+gerais)', n: 1, f: x => U.brl2((x.san + x.ger) / cab) }, { t: 'Compras', n: 1, f: x => U.brl(x.comp) }, ...(r ? [] : [{ t: 'Vendas', n: 1, f: x => U.brl(x.vend) }])], custoMes, { vazio: 'Sem lançamentos financeiros.' })}<p class="muted">Custo por cabeça usa o rebanho atual (${U.n(lista.length)} cab.).</p></div>
      <div class="grid g2">
        <div class="card"><h3>Maior gasto direto</h3>${tabela(colsA([{ t: 'Gasto', n: 1, f: a => U.brl2(a.custoSanitario) }]), top(lista.filter(a => a.custoSanitario), (a, b) => b.custoSanitario - a.custoSanitario), { clique: 1 })}</div>
        <div class="card"><h3>Menor ganho de peso (GMD)</h3>${tabela(colsA([{ t: 'GMD', n: 1, f: a => U.n(a.gmd, 3) }]), top(lista.filter(a => a.gmd != null), (a, b) => a.gmd - b.gmd), { clique: 1 })}</div>
        <div class="card"><h3>Maior ganho de peso (GMD)</h3>${tabela(colsA([{ t: 'GMD', n: 1, f: a => U.n(a.gmd, 3) }]), top(lista.filter(a => a.gmd != null), (a, b) => b.gmd - a.gmd), { clique: 1 })}</div>
        <div class="card"><h3>Menor margem estimada</h3>${tabela(colsA([{ t: 'Valor', n: 1, f: a => U.brl(a._valor) }, { t: 'Margem', n: 1, f: a => U.brl(a._margem) }]), top(lista, (a, b) => a._margem - b._margem), { clique: 1 })}</div>
        <div class="card"><h3>Sem pesagem há mais de 120 dias</h3>${tabela(colsA([{ t: 'Último peso', f: a => a.dataPeso ? U.dataBR(a.dataPeso) : 'nunca' }]), top(lista.filter(a => a._diasPeso > 120), (a, b) => b._diasPeso - a._diasPeso, 100), { clique: 1 })}</div>
        <div class="card"><h3>Vacas vazias</h3>${tabela(colsA([{ t: 'IATF s/ sucesso', n: 1, f: a => a.iatfFalhas || 0 }]), lista.filter(a => a.repro === 'vazia' && a.sexo === 'F'), { clique: 1 })}</div>
      </div>
      <button class="btn sec" id="expTudo">Exportar rebanho completo (Excel)</button>`;
    $$('#rel .card').forEach(card => { const rows = $$('tr[data-i]', card); if (!rows.length) return; });
    $$('#rel tr[data-i]').forEach(tr => tr.onclick = async () => { const b = $('td b', tr); if (b) { const a = lista.find(x => x.brinco === b.textContent); if (a) fichaAnimal(a.id); } });
    $('#expTudo').onclick = () => exportarExcel(lista.map(linhaExport), `rebanho_${FAZ.nome}_${hoje}.xlsx`, 'Rebanho');
  };
};

/* ---------- Retiros e lotes ---------- */
TELAS.retiros = async (el) => {
  await carregarCadastros();
  el.innerHTML = `<div class="grid g2"><div class="card"><div class="linha"><h3>Retiros</h3><span class="esp"></span><button class="btn peq" id="novoR">+ Retiro</button></div>
    ${tabela([{ t: 'Retiro', f: r => `<b>${U.esc(r.nome)}</b>` }, { t: 'Responsável', f: r => U.esc(r.responsavel || '') }, { t: 'Lotes', n: 1, f: r => C.lotes.filter(l => l.retiroId === r.id).length }], C.retiros, { clique: 1, vazio: 'Cadastre os retiros da fazenda.' })}</div>
    <div class="card"><div class="linha"><h3>Lotes / pastos</h3><span class="esp"></span><button class="btn peq" id="novoL">+ Lote</button></div><div id="tl">${tabela([{ t: 'Lote', f: l => `<b>${U.esc(l.nome)}</b>` }, { t: 'Retiro', f: l => U.esc(nomeRetiro(l.retiroId)) }], C.lotes, { clique: 1, vazio: 'Nenhum lote.' })}</div></div></div>`;
  const fr = (r) => { r = r || {}; modal(r.id ? 'Editar retiro' : 'Novo retiro', `<label>Nome *<input name="nome" value="${U.esc(r.nome || '')}"></label><label>Responsável<input name="responsavel" value="${U.esc(r.responsavel || '')}"></label>`, { aoSalvar: async (f) => { const d = lerForm(f); if (!d.nome) throw new Error('Informe o nome'); if (r.id) await sub(FID, 'retiros').doc(r.id).update(d); else await sub(FID, 'retiros').add({ ...d, criadoEm: ts() }); abrir('retiros'); } }); };
  const fl = (l) => { l = l || {}; modal(l.id ? 'Editar lote' : 'Novo lote', `<label>Nome *<input name="nome" value="${U.esc(l.nome || '')}"></label><label>Retiro<select name="retiroId">${opcoes(C.retiros, l.retiroId, '—')}</select></label>`, { aoSalvar: async (f) => { const d = lerForm(f); if (!d.nome) throw new Error('Informe o nome'); if (l.id) await sub(FID, 'lotes').doc(l.id).update(d); else await sub(FID, 'lotes').add({ ...d, criadoEm: ts() }); abrir('retiros'); } }); };
  ligarCliques(el.children[0].children[0], C.retiros, fr); ligarCliques($('#tl'), C.lotes, fl);
  $('#novoR').onclick = () => fr(null); $('#novoL').onclick = () => fl(null);
};

/* ---------- Regras e valoração ---------- */
TELAS.regras = async (el) => {
  const cfg = CALC.cfg(FAZ);
  const cotDoc = (await sub(FID, 'resumo').doc('cotacao').get().catch(() => null) || { data: () => null }).data();
  el.innerHTML = `<h2>Preços e regras – ${U.esc(FAZ.nome)}</h2>
  <div class="card"><h3>Regras de descarte e reprodução</h3><div class="grid g3">
    <label>Descartar após quantas IATF seguidas sem prenhez<input type="number" id="rIatf" value="${cfg.regras.maxIatfFalhas}"></label>
    <label>Idade máxima da vaca (anos)<input type="number" id="rIdade" value="${cfg.regras.idadeMaxVacaAnos}"></label>
    <label>Duração da gestação (dias)<input type="number" id="rGest" value="${cfg.regras.diasGestacao}"></label></div>
    <p class="muted">O sistema não descarta sozinho: ele marca o animal como candidato e mostra o alerta no curral.</p></div>
  <div class="card" id="cardPrecos"><h3>Preço por categoria</h3>
    <div class="grid g3"><label>Base da arroba<select id="rBase"><option value="pe" ${cfg.base === 'pe' ? 'selected' : ''}>Gado em pé (peso vivo ÷ 30 kg)</option><option value="carcaca" ${cfg.base === 'carcaca' ? 'selected' : ''}>Carcaça (peso × rendimento ÷ 15 kg)</option></select></label></div>
    <p class="muted">O valor automático vem da cotação da praça (boi e vaca). Para usar outro valor, preencha o <b>valor manual</b>: ele passa a valer no lugar do automático. Deixe em branco para voltar ao automático.</p>
    <div id="semPrecoAviso"></div>
    ${tabela([{ t: 'Categoria', f: c => `<b>${c.nome}</b>` },
      { t: 'Cobrança', f: c => `<select data-u="${c.id}" style="min-width:110px">${opcoes([{ id: 'arroba', nome: 'R$/@' }, { id: 'cabeca', nome: 'R$/cabeça' }], cfg.precos[c.id].unidade)}</select>` },
      { t: 'Referência automática', f: c => `<select data-ref="${c.id}" style="min-width:120px">${opcoes([{ id: 'boi', nome: '@ do boi' }, { id: 'vaca', nome: '@ da vaca' }, { id: '', nome: 'Nenhuma' }], cfg.precos[c.id].ref)}</select>` },
      { t: 'Automático hoje', f: c => `<span data-auto="${c.id}"></span>` },
      { t: 'Valor manual (R$)', f: c => `<input type="number" step="0.01" data-v="${c.id}" value="${cfg.precos[c.id].valor ?? ''}" placeholder="usar automático" style="min-width:110px">` },
      { t: 'Situação', f: c => `<span data-st="${c.id}"></span>` },
      { t: 'Peso estimado (kg)', f: c => `<input type="number" data-p="${c.id}" value="${cfg.pesoPadrao[c.id]}" style="min-width:80px">` },
      { t: 'Rend. carcaça %', f: c => `<input type="number" step="0.1" data-r="${c.id}" value="${cfg.rendimento[c.id]}" style="min-width:70px">` }], CATEGORIAS)}
    <p class="muted">Peso estimado é usado para animais ainda sem pesagem. Rendimento de carcaça só é usado quando a base é "Carcaça".</p></div>
  <div class="card"><h3>Dados da fazenda e cotação da arroba</h3><div class="grid g3"><label>Nome<input id="fNome" value="${U.esc(FAZ.nome)}" ${ehS() ? '' : 'disabled'}></label><label>Estado<select id="fUf" ${ehS() ? '' : 'disabled'}>${opcoes(UFS, FAZ.uf)}</select></label><label>Cidade<input id="fCid" value="${U.esc(FAZ.cidade || '')}"></label><label>Proprietário<input id="fProp" value="${U.esc(FAZ.proprietario || '')}"></label>
    <label>Praça de referência<select id="fPraca"><option value="">Automática (mais próxima da cidade)</option>${((cotDoc && cotDoc.opcoes) || []).map(o => `<option value="${U.esc(o.id)}" ${FAZ.praca === o.id ? 'selected' : ''}>${U.esc(o.fonte)} – ${U.esc(o.nome)} (${U.esc(o.uf)})${o.km != null ? ' · ' + o.km + ' km' : ''} · ${U.brl2(o.valor)}</option>`).join('')}</select></label>
    <label class="chk" style="margin-top:22px"><input type="checkbox" id="fAuto" ${FAZ.cotacaoAuto === false ? '' : 'checked'}>Atualizar arroba automaticamente</label></div>
    <div id="cotInfo">${cotDoc && cotDoc.boi ? `<div class="alerta azul">Boi: <b>${U.brl2(cotDoc.boi.valor)}/@</b> – ${U.esc(cotDoc.boi.fonte)}, ${U.esc(cotDoc.boi.praca)}${cotDoc.boi.km != null ? ` (${cotDoc.boi.km} km)` : ''}, ${U.esc(cotDoc.boi.data || '')}${cotDoc.vaca ? ` · Vaca: <b>${U.brl2(cotDoc.vaca.valor)}/@</b> – ${U.esc(cotDoc.vaca.fonte)}, ${U.esc(cotDoc.vaca.praca)}` : ''}<br><span class="muted">Buscado em ${new Date(cotDoc.buscadoEm).toLocaleString('pt-BR')}. Atualiza sozinho a cada 24 h. Os preços de cada categoria estão logo abaixo.</span></div>` : '<div class="alerta lar">Cotação automática ainda não buscada.</div>'}</div>
    </div>
  <div class="linha" style="position:sticky;bottom:0;background:var(--fundo);padding:10px 0"><span class="esp"></span><button class="btn" id="salvar">Salvar tudo</button></div>`;
  // mostra o valor automático e a situação de cada categoria conforme o que está na tela
  const atualizarPrecos = () => {
    const precos = {}; CATEGORIAS.forEach(c => precos[c.id] = { unidade: $(`[data-u=${c.id}]`).value, ref: $(`[data-ref=${c.id}]`).value, valor: U.num($(`[data-v=${c.id}]`).value) });
    const cfgTela = { ...cfg, precos }; const falta = [];
    CATEGORIAS.forEach(c => {
      const pr = CALC.preco(c.id, C.cot, cfgTela); const un = precos[c.id].unidade === 'cabeca' ? '/cab' : '/@';
      $(`[data-auto=${c.id}]`).innerHTML = pr.auto ? `${U.brl2(pr.auto)}${un} <div class="muted">${U.esc(pr.origemAuto || '')}</div>` : '<span class="muted">—</span>';
      $(`[data-st=${c.id}]`).innerHTML = pr.origem === 'manual' ? '<span class="tag azul">manual</span>' : pr.origem === 'auto' ? '<span class="tag verde">automático</span>' : '<span class="tag verm">⚠ sem valor</span>';
      if (!pr.valor) falta.push(c.nome);
    });
    $('#semPrecoAviso').innerHTML = falta.length ? `<div class="alerta verm">Sem preço automático para: <b>${falta.join(', ')}</b>. Informe o valor manual dessas categorias, senão elas ficam com valor zero no rebanho.</div>` : '';
  };
  $$('#cardPrecos select, #cardPrecos input').forEach(i => i.oninput = i.onchange = atualizarPrecos); atualizarPrecos();
  $('#salvar').onclick = async () => {
    const config = { regras: { maxIatfFalhas: U.num($('#rIatf').value) || 0, idadeMaxVacaAnos: U.num($('#rIdade').value) || 0, diasGestacao: U.num($('#rGest').value) || 285 }, base: $('#rBase').value, metodo: {}, precos: {}, rendimento: {}, pesoPadrao: {} };
    CATEGORIAS.forEach(c => {
      const pr = { unidade: $(`[data-u=${c.id}]`).value, ref: $(`[data-ref=${c.id}]`).value, valor: U.num($(`[data-v=${c.id}]`).value) };
      config.precos[c.id] = pr; config.metodo[c.id] = pr.unidade === 'cabeca' ? 'cabeca' : pr.ref === 'vaca' ? 'arroba_vaca' : 'arroba_boi';
      config.rendimento[c.id] = U.num($(`[data-r=${c.id}]`).value) || 50; config.pesoPadrao[c.id] = U.num($(`[data-p=${c.id}]`).value) || 0;
    });
    const upd = { config, proprietario: $('#fProp').value.trim(), cidade: $('#fCid').value.trim(), praca: $('#fPraca').value, cotacaoAuto: $('#fAuto').checked }; if (ehS()) { upd.nome = $('#fNome').value.trim(); upd.uf = $('#fUf').value; }
    await fz(FID).update(upd); Object.assign(FAZ, upd);
    if (upd.cotacaoAuto) { const rc = await atualizarCotacaoAuto(FID, FAZ, true); if (!rc.doc || !rc.doc.boi) toast('Não consegui buscar a cotação: ' + (rc.erro || ''), 'aviso', 6000); }
    else await sub(FID, 'resumo').doc('cotacao').set({ auto: false }, { merge: true });
    C.cot = await carregarCotacao(FAZ.uf, FID);
    toast('Regras salvas. Recalculando…'); await recalcularResumo(FID); toast('Pronto'); abrir('regras');
  };
};

/* ---------- Usuários (superadmin) ---------- */
TELAS.usuarios = async (el) => {
  // superadmin vê todos os usuários; gerente vê a equipe da fazenda atual e só cadastra vaqueiro/operador
  const S = ehS();
  const l = (S ? docs(await db.collection('usuarios').get()).map(u => ({ ...u, uid: u.id })) : docs(await sub(FID, 'equipe').get()).map(u => ({ ...u, uid: u.id })))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const nomeFaz = (id) => (SESSAO.fazendas.find(f => f.id === id) || {}).nome || id;
  const PAP = { gerente: 'Gerente (admin da fazenda)', operador: 'Operador de curral', vaqueiro: 'Vaqueiro', proprietario: 'Proprietário (só visualiza)' };
  const PAP_GER = { vaqueiro: PAP.vaqueiro, operador: PAP.operador };
  const podeEditar = (u) => S || ['vaqueiro', 'operador'].includes(u.papel);
  el.innerHTML = `<div class="linha"><h2>${S ? 'Usuários e acessos' : 'Equipe – ' + U.esc(FAZ.nome)}</h2><span class="esp"></span><button class="btn" id="novo">+ ${S ? 'Novo usuário' : 'Cadastrar vaqueiro / operador'}</button></div>
  ${S ? '<div class="alerta azul">Você (superadmin) cria fazendas, gerentes e proprietários. O gerente de cada fazenda cadastra os próprios vaqueiros e operadores.</div>' : '<div class="alerta azul">Aqui você cadastra os vaqueiros e operadores de curral desta fazenda. Gerente e proprietário são liberados pelo administrador do sistema.</div>'}
  <div class="card">${tabela([{ t: 'Nome', f: u => `<b>${U.esc(u.nome)}</b><div class="muted">${U.esc(u.email)}</div>` }, { t: 'Papel', f: u => PAP[u.papel] || u.papel }, ...(S ? [{ t: 'Fazendas', f: u => (u.fazendas || []).map(f => `<span class="tag">${U.esc(nomeFaz(f))}</span>`).join(' ') }] : []), { t: 'Retiros', f: u => u.retiros && u.retiros.length ? u.retiros.map(r => U.esc(nomeRetiro(r))).join(', ') : 'Todos' }, { t: '', f: u => u.ativo === false ? '<span class="tag verm">bloqueado</span>' : '' }], l, { clique: 1, vazio: 'Nenhum usuário.' })}</div>`;
  const resumoEquipe = (uid, d) => ({ nome: d.nome, email: d.email, papel: d.papel, retiros: d.retiros || [], ativo: d.ativo !== false, atualizadoEm: ts() });
  const form = async (u) => {
    if (u && !podeEditar(u)) return toast('Só o administrador do sistema altera gerente e proprietário', 'aviso');
    u = u || { fazendas: FID ? [FID] : [], papel: 'vaqueiro' };
    const retirosFaz = FID ? C.retiros : [];
    const papeis = S ? PAP : PAP_GER;
    modal(u.uid ? `Editar ${u.nome}` : (S ? 'Novo usuário' : 'Novo vaqueiro / operador'), `<div class="grid g2">
      <label>Nome *<input name="nome" value="${U.esc(u.nome || '')}"></label><label>Papel<select name="papel">${opcoes(Object.entries(papeis).map(([id, nome]) => ({ id, nome })), u.papel)}</select></label>
      ${u.uid ? `<label>E-mail<input value="${U.esc(u.email)}" disabled></label>` : '<label>E-mail *<input type="email" name="email"></label><label>Senha inicial * (mín. 6)<input name="senha"></label>'}</div>
      ${S ? `<h3>Fazendas</h3>${SESSAO.fazendas.map(f => `<label class="chk"><input type="checkbox" data-f="${f.id}" ${(u.fazendas || []).includes(f.id) ? 'checked' : ''}>${U.esc(f.nome)}</label>`).join('')}` : ''}
      ${retirosFaz.length ? `<h3 style="margin-top:10px">Restringir a retiros de ${U.esc(FAZ.nome)} (nenhum marcado = todos)</h3>${retirosFaz.map(r => `<label class="chk"><input type="checkbox" data-r="${r.id}" ${(u.retiros || []).includes(r.id) ? 'checked' : ''}>${U.esc(r.nome)}</label>`).join('')}` : ''}
      ${u.uid ? `<label class="chk" style="margin-top:10px"><input type="checkbox" name="bloq" ${u.ativo === false ? 'checked' : ''}>Bloquear acesso</label><button class="btn sec peq" id="reset" type="button">Enviar e-mail de troca de senha</button>` : ''}`, {
      aoAbrir: (f) => { if ($('#reset', f)) $('#reset', f).onclick = async () => { await auth.sendPasswordResetEmail(u.email); toast('E-mail enviado'); }; },
      aoSalvar: async (f) => {
        const d = lerForm(f);
        const fazendas = S ? $$('[data-f]', f).filter(c => c.checked).map(c => c.dataset.f) : (u.uid ? (u.fazendas || [FID]) : [FID]);
        const retiros = $$('[data-r]', f).filter(c => c.checked).map(c => c.dataset.r);
        if (!d.nome || !fazendas.length) throw new Error('Informe nome e ao menos uma fazenda');
        if (!S && !['vaqueiro', 'operador'].includes(d.papel)) throw new Error('Papel não permitido');
        const dados = { nome: d.nome, papel: d.papel, fazendas, retiros, ativo: !d.bloq };
        let uid = u.uid, email = u.email;
        if (uid) {
          if (!S) { const atual = (await db.collection('usuarios').doc(uid).get()).data() || {}; dados.fazendas = atual.fazendas || [FID]; }
          await db.collection('usuarios').doc(uid).update(dados);
        } else {
          if (!d.email || (d.senha || '').length < 6) throw new Error('E-mail e senha (mín. 6) obrigatórios');
          const sec = firebase.apps.find(a => a.name === 'sec') || firebase.initializeApp(APP.firebaseConfig, 'sec');
          const secAuth = sec.auth(); if (location.search.includes('emu=1')) { try { secAuth.useEmulator('http://127.0.0.1:9099'); } catch (e) { } }
          try { const cred = await secAuth.createUserWithEmailAndPassword(d.email, d.senha); uid = cred.user.uid; await secAuth.signOut(); }
          catch (e) { if (e.code === 'auth/email-already-in-use') throw new Error('Esse e-mail já tem conta no sistema. Use outro e-mail ou peça ao administrador.'); if (e.code === 'auth/invalid-email') throw new Error('E-mail inválido'); throw e; }
          email = d.email.toLowerCase();
          await db.collection('usuarios').doc(uid).set({ ...dados, uid, email, criadoPor: SESSAO.user.email, criadoEm: ts() });
        }
        // lista da equipe dentro de cada fazenda (é o que o gerente enxerga)
        const b = db.batch(); const eq = resumoEquipe(uid, { ...dados, email });
        dados.fazendas.forEach(fid => b.set(sub(fid, 'equipe').doc(uid), eq));
        if (S) (u.fazendas || []).filter(fid => !dados.fazendas.includes(fid)).forEach(fid => b.delete(sub(fid, 'equipe').doc(uid)));
        await b.commit().catch(e => console.warn('equipe', e));
        toast('Usuário salvo'); abrir('usuarios');
      }
    });
  };
  ligarCliques(el, l, u => form(u)); $('#novo').onclick = () => form(null);
};

/* ---------- Fazendas (superadmin) ---------- */
TELAS.fazendas = async (el) => {
  SESSAO.fazendas = await carregarFazendas(SESSAO.perfil);
  el.innerHTML = `<div class="linha"><h2>Fazendas</h2><span class="esp"></span><button class="btn" id="novo">+ Nova fazenda</button></div>
  <div class="card">${tabela([{ t: 'Fazenda', f: f => `<b>${U.esc(f.nome)}</b>` }, { t: 'UF', f: f => U.esc(f.uf) }, { t: 'Cidade', f: f => U.esc(f.cidade || '') }, { t: 'Proprietário', f: f => U.esc(f.proprietario || '') }, { t: 'Plano', f: f => f.mensalidade ? U.brl(f.mensalidade) + '/mês' : '' }], SESSAO.fazendas, { clique: 1, vazio: 'Cadastre a primeira fazenda.' })}</div>`;
  const form = (f) => {
    f = f || {};
    modal(f.id ? 'Editar fazenda' : 'Nova fazenda', `<div class="grid g2"><label>Nome *<input name="nome" value="${U.esc(f.nome || '')}"></label><label>Estado *<select name="uf">${opcoes(UFS, f.uf || 'MT')}</select></label>
      <label>Cidade * (define a praça da arroba)<input name="cidade" value="${U.esc(f.cidade || '')}" placeholder="ex.: Barra do Garças"></label><label>Proprietário<input name="proprietario" value="${U.esc(f.proprietario || '')}"></label>
      <label>Mensalidade (R$)<input type="number" name="mensalidade" value="${f.mensalidade || ''}"></label><label>Telefone<input name="telefone" value="${U.esc(f.telefone || '')}"></label></div>`, {
      aoSalvar: async (el2) => {
        const d = lerForm(el2); if (!d.nome) throw new Error('Informe o nome'); if (!d.cidade) throw new Error('Informe a cidade (é por ela que o sistema acha a cotação da arroba)'); const o = { ...d, mensalidade: U.num(d.mensalidade) };
        let id = f.id;
        if (id) await fz(id).update(o); else { const ref = await db.collection('fazendas').add({ ...o, config: CONFIG_PADRAO, cotacaoAuto: true, criadoEm: ts() }); id = ref.id; await sub(id, 'retiros').add({ nome: 'Sede', criadoEm: ts() }); }
        const rc = await atualizarCotacaoAuto(id, { ...f, ...o }, true);
        if (rc.doc && rc.doc.boi) toast(`Arroba: ${rc.doc.boi.fonte} – ${rc.doc.boi.praca}: ${U.brl2(rc.doc.boi.valor)}/@`, 'ok', 6000); else toast('Fazenda salva, mas não consegui buscar a cotação agora', 'aviso', 6000);
        if (id === FID) { Object.assign(FAZ, o); C.cot = await carregarCotacao(FAZ.uf, FID); }
        SESSAO.fazendas = await carregarFazendas(SESSAO.perfil); montarSeletor();
        if (!FID && SESSAO.fazendas.length) await trocarFazenda(SESSAO.fazendas[0].id); else abrir('fazendas');
      }
    });
  };
  ligarCliques(el, SESSAO.fazendas, form); $('#novo').onclick = () => form(null);
};

/* ---------- Cotações (superadmin) ---------- */
TELAS.cotacoes = async (el) => {
  const l = docs(await db.collection('cotacoes').get());
  const ufsUsadas = [...new Set(SESSAO.fazendas.map(f => f.uf).filter(Boolean))];
  const todas = [...new Set([...ufsUsadas, ...l.map(c => c.id)])].sort();
  const porUf = Object.fromEntries(l.map(c => [c.id, c]));
  el.innerHTML = `<div class="linha"><h2>Cotações por estado (reposição e reserva)</h2><span class="esp"></span><select id="novaUf" style="max-width:100px">${opcoes(UFS.filter(u => !todas.includes(u)), '', '+ UF')}</select></div>
  <div class="alerta azul">A <b>arroba do boi e da vaca</b> é buscada automaticamente para cada fazenda, pela praça mais próxima da cidade (IMEA no MT; Scot Consultoria e Datagro nos outros estados). Aqui você cadastra o <b>preço por cabeça da reposição</b> (bezerro, bezerra, garrote, novilha) e valores de arroba de <b>reserva</b>, usados só se a busca automática falhar.</div>
  ${todas.map(uf => { const c = porUf[uf] || {}; const cab = c.cabeca || {}; return `<div class="card" data-uf="${uf}"><div class="linha"><h3>${uf}</h3><span class="muted">${c.data ? 'Atualizado em ' + U.dataBR(c.data) : 'Sem cotação'} ${c.fonte ? '· ' + U.esc(c.fonte) : ''}</span></div>
    <div class="grid g4"><label>@ boi gordo (R$)<input type="number" step="0.01" data-k="arrobaBoi" value="${c.arrobaBoi || ''}"></label><label>@ vaca gorda (R$)<input type="number" step="0.01" data-k="arrobaVaca" value="${c.arrobaVaca || ''}"></label>
    <label>Fonte<input data-k="fonte" value="${U.esc(c.fonte || FONTES_SUGERIDAS[uf] || '')}"></label><label>Data do boletim<input type="date" data-k="data" value="${c.data || U.hoje()}"></label>
    ${['bezerro', 'bezerra', 'garrote', 'novilha'].map(k => `<label>${CAT_NOME[k]} (R$/cabeça)<input type="number" step="0.01" data-c="${k}" value="${cab[k] || ''}"></label>`).join('')}</div>
    <button class="btn" data-salvar="${uf}">Salvar ${uf}</button></div>`; }).join('') || '<div class="vazio">Escolha uma UF acima.</div>'}`;
  $('#novaUf').onchange = (e) => { if (e.target.value) { l.push({ id: e.target.value }); db.collection('cotacoes').doc(e.target.value).set({ uf: e.target.value }, { merge: true }).then(() => abrir('cotacoes')); } };
  $$('[data-salvar]').forEach(b => b.onclick = async () => {
    const uf = b.dataset.salvar; const card = $(`[data-uf=${uf}]`);
    const o = { uf, cabeca: {} }; $$('[data-k]', card).forEach(i => o[i.dataset.k] = i.type === 'number' ? U.num(i.value) : i.value.trim()); $$('[data-c]', card).forEach(i => o.cabeca[i.dataset.c] = U.num(i.value));
    o.atualizadoPor = SESSAO.user.email; o.atualizadoEm = ts();
    const batch = db.batch(); batch.set(db.collection('cotacoes').doc(uf), o); batch.set(db.collection('cotacoes').doc(uf).collection('historico').doc(o.data || U.hoje()), o); await batch.commit();
    toast(`Cotação ${uf} salva. Recalculando fazendas…`);
    for (const f of SESSAO.fazendas.filter(f => f.uf === uf)) { try { await recalcularResumo(f.id); } catch (e) { console.warn(e); } }
    if (FAZ && FAZ.uf === uf) C.cot = await carregarCotacao(uf, FID);
    toast('Valores atualizados'); abrir('cotacoes');
  });
};
