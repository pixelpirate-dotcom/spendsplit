const ME = 'You';
const $ = s => document.querySelector(s);
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = (() => {
  try { return Object.assign({ cur: '₹', groups: [], expenses: [], settles: [], budgets: {}, people: ['Sana', 'Aman'], cats: ['Metro', 'Auto', 'Dine Out', 'Q-Commerce', 'Water', 'Lulu', 'Family Xpress'] }, JSON.parse(localStorage.ss)); } catch { }
  return { cur: '₹', groups: [], expenses: [], settles: [], budgets: {}, people: ['Sana', 'Aman'], cats: ['Metro', 'Auto', 'Dine Out', 'Q-Commerce', 'Water', 'Lulu', 'Family Xpress'] };
})();
const money = n => (n < 0 ? '-' : '') + S.cur + Math.abs(r2(n)).toLocaleString(undefined, { maximumFractionDigits: 2 });

function net() {
  let t = 0;
  S.expenses.filter(e => e.gid).forEach(e => { if (e.paidBy === ME) t += e.amt; t -= e.splits[ME] || 0; });
  S.settles.forEach(s => { if (s.from === ME) t += s.amt; if (s.to === ME) t -= s.amt; });
  return r2(t);
}

function dashboard() {
  const m = new Date().toISOString().slice(0, 7);
  const mine = S.expenses.filter(e => e.date.slice(0, 7) === m);
  const total = mine.reduce((a, e) => a + (e.splits[ME] || 0), 0);
  const n = net();
  const recent = [...S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<div class="row"><h1>Dashboard</h1><div class="row" style="gap:8px"><button class="sec" data-v="profile">Profile</button><button class="sec" id="reset">Reset</button></div></div>
  <div class="tiles">
    <div class="card"><div class="sm">Spent this month</div><div class="big">${money(total)}</div></div>
    <div class="card"><div class="sm">${n >= 0 ? "You're owed" : 'You owe'}</div><div class="big">${money(Math.abs(n))}</div></div>
    <div class="card"><div class="sm">Expenses</div><div class="big">${S.expenses.length}</div></div>
    <div class="card"><div class="sm">Groups</div><div class="big">${S.groups.length}</div></div>
  </div>
  <h2>Recent</h2>
  ${recent.length ? recent.map(e => `<div class="card row"><div><div class="b">${esc(e.note || e.cat)}</div><div class="sm">${e.date.slice(5)}${e.time ? ' ' + esc(e.time) : ''} · ${esc(e.cat)}${e.paidBy && e.paidBy !== ME ? ' · ' + esc(e.paidBy) + ' paid' : ''}</div></div><div class="row" style="gap:12px"><span class="b">${money(e.amt)}</span><button class="del" data-del="${e.id}" aria-label="Delete expense">✕</button></div></div>`).join('') : '<div class="empty">No expenses yet.</div>'}`;
}


const CATS = S.cats;
let view = 'home';
function analysis() {
  const m = new Date().toISOString().slice(0, 7);
  const by = Object.fromEntries(CATS.map(c => [c, 0]));
  S.expenses.filter(e => e.date.slice(0, 7) === m).forEach(e => { if (e.cat in by) by[e.cat] += e.splits[ME] || 0; });
  const max = Math.max(...Object.values(by), 0);
  return `<h1>Analysis</h1><h2>Spending by category · this month</h2><div class="card">${CATS.map(c => `<div class="hb"><span class="hl">${esc(c)}</span><div class="bar"><i class="${S.budgets[c] && by[c] > S.budgets[c] ? 'over' : ''}" style="width:${max ? by[c] / max * 100 : 0}%"></i></div><span class="hv b ${S.budgets[c] && by[c] > S.budgets[c] ? 'red' : ''}">${S.budgets[c] && by[c] > S.budgets[c] ? '⚠ ' : ''}${money(by[c])}</span></div>`).join('')}</div>`;
}

const sharers = e => Array.isArray(e.shared) ? e.shared.filter(q => PAYERS.includes(q)) : e.split === false ? [] : [...PAYERS];
const isSplit = e => sharers(e).some(q => q !== e.paidBy);
function splitCalc() {
  const paid = Object.fromEntries(PAYERS.map(p => [p, 0]));
  const net = Object.fromEntries(PAYERS.map(p => [p, 0]));
  S.expenses.forEach(e => {
    if (!(e.paidBy in paid)) return;
    paid[e.paidBy] += e.amt;
    const P = sharers(e);
    if (!P.some(q => q !== e.paidBy)) return;
    net[e.paidBy] += e.amt;
    P.forEach(q => net[q] -= e.amt / P.length);
  });
  S.settles.forEach(t => { if (t.from in net) net[t.from] += t.amt; if (t.to in net) net[t.to] -= t.amt; });
  for (const p in net) net[p] = r2(net[p]);
  const cr = [], db = [];
  for (const p in net) { if (net[p] > 0.005) cr.push([p, net[p]]); else if (net[p] < -0.005) db.push([p, -net[p]]); }
  cr.sort((x, y) => y[1] - x[1]); db.sort((x, y) => y[1] - x[1]);
  const debts = []; let i = 0, j = 0;
  while (i < cr.length && j < db.length) {
    const m = Math.min(cr[i][1], db[j][1]);
    debts.push({ from: db[j][0], to: cr[i][0], amt: r2(m) });
    cr[i][1] -= m; db[j][1] -= m;
    if (cr[i][1] < 0.005) i++;
    if (db[j][1] < 0.005) j++;
  }
  return { paid, net, debts };
}
const stamp = (d, t) => d ? new Date(`${d}T${t || '00:00'}`).toLocaleString([], t ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '';
function splitView() {
  const c = splitCalc();
  const col = p => {
    const list = S.expenses.filter(e => e.paidBy === p).sort((x, y) => (y.date + (y.time || '')).localeCompare(x.date + (x.time || '')));
    const n = c.net[p];
    return `<div><div class="sm">${esc(p)} paid</div><div class="big">${money(c.paid[p])}</div>
    <div class="sm ${n < -0.005 ? 'red' : ''}">${Math.abs(n) < 0.005 ? 'settled' : n > 0 ? 'gets back ' + money(n) : 'owes ' + money(-n)}</div>
    <div style="margin-top:10px">${list.map(e => {
      const sh = sharers(e), on = isSplit(e);
      const label = !on ? 'Paid fully by ' + esc(p) : sh.length === PAYERS.length ? (PAYERS.length === 2 ? 'Split 50/50' : 'Split equally among all') : 'Split between ' + sh.map(esc).join(', ');
      return `<div class="card"><div class="b">${esc(e.note || e.cat)}</div><div class="sm">${e.date.slice(5)}${e.time ? ' ' + esc(e.time) : ''} · ${esc(e.cat)}</div>
      <div class="row" style="margin-top:8px"><span class="b">${money(e.amt)}</span><button class="tg ${on ? 'on' : ''}" data-tog="${e.id}" role="switch" aria-checked="${on}" aria-label="Split"><i></i></button></div>
      <div class="sm" style="margin-top:6px">${label}</div>
      ${PAYERS.length > 2 && on ? `<div class="chips" style="margin:6px 0 0">${PAYERS.map(q => `<button class="chip ${sh.includes(q) ? 'on' : ''}" data-share="${e.id}" data-who="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}</div>`;
    }).join('') || '<div class="empty sm">None</div>'}</div></div>`;
  };
  const hist = [...S.settles].reverse();
  return `<h1>Split</h1>
  <div class="card">${c.debts.length ? c.debts.map((d, i) => `<div class="row"><div><div class="sm">${esc(d.from)} owes ${esc(d.to)}</div><div class="big">${money(d.amt)}</div></div><button class="sec" data-settle="${i}">Mark as settled</button></div>`).join('') : '<div class="b">All settled up</div>'}</div>
  <div class="cols">${PAYERS.map(col).join('')}</div>
  <h2>Settlement history</h2>
  ${hist.map(t => `<div class="card row"><div><div class="b">${esc(t.from)} paid ${esc(t.to)}</div><div class="sm">${stamp(t.date, t.time)}</div></div><div class="b">${money(t.amt)}</div></div>`).join('') || '<div class="empty">No settlements yet.</div>'}
  <div class="sm">Switch on = split equally. Switch off = paid fully by that person.${PAYERS.length > 2 ? ' With 3 or more people you can pick who shares each expense.' : ''}</div>`;
}
function budgeting() {
  const m = new Date().toISOString().slice(0, 7);
  const by = Object.fromEntries(CATS.map(c => [c, 0]));
  S.expenses.filter(e => e.date.slice(0, 7) === m).forEach(e => { if (e.cat in by) by[e.cat] += e.splits[ME] || 0; });
  const tb = CATS.reduce((a, c) => a + (S.budgets[c] || 0), 0), ts = CATS.reduce((a, c) => a + by[c], 0);
  const bar = (v, lim) => `<div class="bar"><i class="${lim && v > lim ? 'over' : ''}" style="width:${lim ? Math.min(100, v / lim * 100) : 0}%"></i></div>`;
  const over = c => S.budgets[c] && by[c] > S.budgets[c];
  const overs = CATS.filter(over);
  const left = (v, lim) => !lim ? 'No budget set' : v > lim ? `⚠ Over budget by ${money(v - lim)}` : `${money(lim - v)} left`;
  return `<h1>Budgeting</h1>
  ${overs.length ? `<div class="warn">⚠ Budget exceeded: ${overs.map(esc).join(', ')}</div>` : ''}
  <div class="card ${tb && ts > tb ? 'overcard' : ''}"><div class="sm">Total budget · this month</div><div class="big">${money(ts)}<span class="sm"> / ${money(tb)}</span></div>${bar(ts, tb)}<div class="sm" style="margin-top:6px">${left(ts, tb)}</div></div>
  <h2>Monthly budget by category</h2>
  ${CATS.map(c => `<div class="card ${over(c) ? 'overcard' : ''}"><div class="row"><span class="b">${esc(c)}${over(c) ? ' <span class="red">⚠ Over budget</span>' : ''}</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="Set budget" value="${S.budgets[c] || ''}" data-bud="${esc(c)}" style="width:120px;text-align:right"></div>
    ${bar(by[c], S.budgets[c])}<div class="row sm" style="margin-top:6px"><span>Spent ${money(by[c])}</span><span class="${over(c) ? 'red b' : ''}">${left(by[c], S.budgets[c])}</span></div></div>`).join('')}`;
}
function profile() {
  return `<h1>Profile</h1>
  <h2>People</h2>
  <div class="card">${PAYERS.map((p, i) => `<div class="row" style="gap:8px"><input type="text" autocomplete="off" maxlength="20" value="${esc(p)}" data-person="${i}">${PAYERS.length > 2 ? `<button class="del" data-delperson="${i}" aria-label="Remove person">✕</button>` : ''}</div>`).join('')}
    <div class="row" style="gap:8px"><input type="text" id="newperson" autocomplete="off" maxlength="20" placeholder="New person"><button class="sec" id="addperson">Add</button></div></div>
  <h2>Labels</h2>
  <div class="card">${CATS.map((c, i) => `<div class="row"><span>${esc(c)}</span>${CATS.length > 1 ? `<button class="del" data-delcat="${i}" aria-label="Remove label">✕</button>` : ''}</div>`).join('')}
    <div class="row" style="gap:8px"><input type="text" id="newcat" autocomplete="off" maxlength="20" placeholder="New label"><button class="sec" id="addcat">Add</button></div></div>
  <div class="sm">Removing a label hides it from the lists and charts; past expenses keep their label.</div>
  <h2>Currency</h2>
  <div class="card"><input type="text" autocomplete="off" maxlength="3" value="${esc(S.cur)}" data-cur style="width:80px"></div>
  <div class="sm">Changing a name updates all of that person's past expenses and settlements. A person with expenses can't be removed.</div>`;
}
function rename(i, raw) {
  const name = raw.trim(), old = PAYERS[i];
  if (!name || name === old) return;
  if (PAYERS.some((p, j) => j !== i && p.toLowerCase() === name.toLowerCase())) return alert('Each person needs a different name');
  S.expenses.forEach(e => { if (e.paidBy === old) e.paidBy = name; });
  S.expenses.forEach(e => { if (Array.isArray(e.shared)) e.shared = e.shared.map(q => q === old ? name : q); });
  S.settles.forEach(t => { if (t.from === old) t.from = name; if (t.to === old) t.to = name; });
  PAYERS[i] = name;
  localStorage.ss = JSON.stringify(S);
}
function addPerson() {
  const v = ($('#newperson').value || '').trim();
  if (!v) return;
  if (PAYERS.some(p => p.toLowerCase() === v.toLowerCase())) return alert('That person already exists');
  PAYERS.push(v); localStorage.ss = JSON.stringify(S); show(); $('#newperson').focus();
}
function removePerson(i) {
  const name = PAYERS[i];
  if (S.expenses.some(e => e.paidBy === name) || S.settles.some(t => t.from === name || t.to === name)) return alert(`${name} has expenses or settlements. Delete those first.`);
  S.expenses.forEach(e => { if (Array.isArray(e.shared)) { e.shared = e.shared.filter(q => q !== name); if (!e.shared.length) { delete e.shared; e.split = false; } } });
  PAYERS.splice(i, 1); localStorage.ss = JSON.stringify(S); show();
}
function show() {
  $('#main').innerHTML = view === 'analysis' ? analysis() : view === 'split' ? splitView() : view === 'budget' ? budgeting() : view === 'profile' ? profile() : dashboard();
  document.querySelectorAll('#tabs [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
}
const PAYERS = S.people;
let st = null;

function renderSheet() {
  const el = $('#sheet'), hadAmt = !st.amt || document.activeElement?.id === 'amt';
  el.hidden = false;
  el.innerHTML = `<div class="panel">
    <div class="row"><b>New expense</b><button class="x" id="close">✕</button></div>
    <input class="amt" id="amt" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(S.cur)}0" value="${esc(st.amt)}">
    <div class="chips">${CATS.map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
    <div class="row" style="gap:8px"><input id="note" placeholder="Note" value="${esc(st.note)}"><input id="date" type="date" value="${st.date}" style="width:150px"><input id="time" type="time" value="${st.time}" style="width:120px"></div>
    <div class="sm" style="margin-top:12px">Who paid</div>
    <div class="chips">${PAYERS.map(p => `<button class="chip ${st.paidBy === p ? 'on' : ''}" data-paid="${p}">${p}</button>`).join('')}</div>
    <button class="pri" id="save">Save</button></div>`;
  if (hadAmt) setTimeout(() => $('#amt')?.focus(), 30);
}
function sync() {
  st.amt = $('#amt').value; st.note = $('#note').value; st.date = $('#date').value || st.date; st.time = $('#time').value || st.time;
}
function nowParts() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
document.addEventListener('input', e => {
  if (e.target.dataset.bud) {
    e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const v = parseFloat(e.target.value);
    if (v > 0) S.budgets[e.target.dataset.bud] = v; else delete S.budgets[e.target.dataset.bud];
    localStorage.ss = JSON.stringify(S);
  }
  if (e.target.id === 'amt') e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
});
document.addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.bud) show();
  else if (d.person !== undefined) { rename(+d.person, e.target.value); show(); }
  else if (d.cur !== undefined) { S.cur = e.target.value.trim() || '₹'; localStorage.ss = JSON.stringify(S); show(); }
});
function addCat() {
  const v = ($('#newcat').value || '').trim();
  if (!v) return;
  if (CATS.some(c => c.toLowerCase() === v.toLowerCase())) return alert('That label already exists');
  CATS.push(v); localStorage.ss = JSON.stringify(S); show(); $('#newcat').focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Enter') { if (e.target.id === 'newcat') addCat(); else if (e.target.id === 'newperson') addPerson(); } });
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; st = null; }

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'reset') {
    if (!confirm('Erase all expenses and reset to 0?')) return;
    S.expenses = []; S.settles = []; S.groups = []; localStorage.ss = JSON.stringify(S);
    show();
  }
  else if (t.dataset.del) {
    const x = S.expenses.find(v => v.id === t.dataset.del);
    if (x) { S.expenses = S.expenses.filter(v => v !== x); localStorage.ss = JSON.stringify(S); show(); }
  }
  else if (t.id === 'addcat') addCat();
  else if (t.dataset.delcat !== undefined) {
    const [c] = CATS.splice(+t.dataset.delcat, 1); delete S.budgets[c];
    localStorage.ss = JSON.stringify(S); show();
  }
  else if (t.dataset.tog) {
    const e = S.expenses.find(x => x.id === t.dataset.tog);
    if (e) { e.split = !isSplit(e); delete e.shared; localStorage.ss = JSON.stringify(S); show(); }
  }
  else if (t.dataset.share) {
    const e = S.expenses.find(x => x.id === t.dataset.share), q = t.dataset.who;
    if (e) {
      const sh = sharers(e), list = sh.includes(q) ? sh.filter(x => x !== q) : [...sh, q];
      if (!list.some(x => x !== e.paidBy)) { e.split = false; delete e.shared; }
      else if (list.length === PAYERS.length) { e.split = true; delete e.shared; }
      else e.shared = PAYERS.filter(x => list.includes(x));
      localStorage.ss = JSON.stringify(S); show();
    }
  }
  else if (t.id === 'addperson') addPerson();
  else if (t.dataset.delperson !== undefined) removePerson(+t.dataset.delperson)
  else if (t.dataset.settle !== undefined) {
    const d = splitCalc().debts[+t.dataset.settle];
    if (d && confirm(`Record ${d.from} paying ${d.to} ${money(d.amt)}?`)) {
      S.settles.push({ from: d.from, to: d.to, amt: d.amt, ...nowParts() });
      localStorage.ss = JSON.stringify(S); show();
    }
  }
  else if (t.dataset.v) { view = t.dataset.v; show(); }
  else if (t.id === 'addbtn') { st = { amt: '', cat: CATS[0], paidBy: PAYERS[0], split: true, note: '', ...nowParts() }; renderSheet(); }
  else if (!st) return;
  else if (t.id === 'close') closeSheet();
  else if (t.dataset.cat) { sync(); st.cat = t.dataset.cat; renderSheet(); }
  else if (t.dataset.paid) { sync(); st.paidBy = t.dataset.paid; renderSheet(); }
  else if (t.id === 'save') {
    sync();
    const amt = r2(parseFloat(st.amt));
    if (!(amt > 0)) return alert('Enter an amount');
    S.expenses.push({ id: Math.random().toString(36).slice(2, 9), amt, cat: st.cat, note: st.note.trim(), date: st.date, time: st.time, gid: null, paidBy: st.paidBy, split: st.split, splits: { [ME]: amt } });
    localStorage.ss = JSON.stringify(S);
    closeSheet(); show();
  }
});

show();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
