const ME = 'You';
const $ = s => document.querySelector(s);
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = (() => {
  try { return Object.assign({ cur: '₹', groups: [], expenses: [], settles: [], budgets: {} }, JSON.parse(localStorage.ss)); } catch { }
  return { cur: '₹', groups: [], expenses: [], settles: [], budgets: {} };
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
  return `<div class="row"><h1>Dashboard</h1><button class="sec" id="reset">Reset</button></div>
  <div class="tiles">
    <div class="card"><div class="sm">Spent this month</div><div class="big">${money(total)}</div></div>
    <div class="card"><div class="sm">${n >= 0 ? "You're owed" : 'You owe'}</div><div class="big">${money(Math.abs(n))}</div></div>
    <div class="card"><div class="sm">Expenses</div><div class="big">${S.expenses.length}</div></div>
    <div class="card"><div class="sm">Groups</div><div class="big">${S.groups.length}</div></div>
  </div>
  <h2>Recent</h2>
  ${recent.length ? recent.map(e => `<div class="card row"><div><div class="b">${esc(e.note || e.cat)}</div><div class="sm">${e.date.slice(5)}${e.time ? ' ' + esc(e.time) : ''} · ${esc(e.cat)}${e.paidBy && e.paidBy !== ME ? ' · ' + esc(e.paidBy) + ' paid' : ''}</div></div><div class="b">${money(e.amt)}</div></div>`).join('') : '<div class="empty">No expenses yet.</div>'}`;
}


const CATS = ['Metro', 'Auto', 'Dine Out', 'Q-Commerce', 'Water', 'Lulu', 'Family Xpress'];
let view = 'home';
function analysis() {
  const m = new Date().toISOString().slice(0, 7);
  const by = Object.fromEntries(CATS.map(c => [c, 0]));
  S.expenses.filter(e => e.date.slice(0, 7) === m).forEach(e => { if (e.cat in by) by[e.cat] += e.splits[ME] || 0; });
  const max = Math.max(...Object.values(by), 0);
  return `<h1>Analysis</h1><h2>Spending by category · this month</h2><div class="card">${CATS.map(c => `<div class="hb"><span class="hl">${esc(c)}</span><div class="bar"><i style="width:${max ? by[c] / max * 100 : 0}%"></i></div><span class="hv b">${money(by[c])}</span></div>`).join('')}</div>`;
}

const isSplit = e => e.split !== false;
function splitCalc() {
  const paid = Object.fromEntries(PAYERS.map(p => [p, 0]));
  const net = Object.fromEntries(PAYERS.map(p => [p, 0]));
  S.expenses.forEach(e => {
    if (!(e.paidBy in paid)) return;
    paid[e.paidBy] += e.amt;
    if (isSplit(e)) { const other = PAYERS.find(p => p !== e.paidBy); net[e.paidBy] += e.amt / 2; net[other] -= e.amt / 2; }
  });
  S.settles.forEach(t => { if (t.from in net) net[t.from] += t.amt; if (t.to in net) net[t.to] -= t.amt; });
  const [a, b] = PAYERS, debtor = net[a] < net[b] ? a : b, creditor = debtor === a ? b : a;
  return { paid, net, debtor, creditor, amt: r2(Math.abs(net[a])) };
}
const stamp = (d, t) => d ? new Date(`${d}T${t || '00:00'}`).toLocaleString([], t ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '';
function splitView() {
  const c = splitCalc();
  const col = p => {
    const list = S.expenses.filter(e => e.paidBy === p).sort((x, y) => (y.date + (y.time || '')).localeCompare(x.date + (x.time || '')));
    return `<div><div class="sm">${p} paid</div><div class="big">${money(c.paid[p])}</div>
    <div style="margin-top:10px">${list.map(e => `<div class="card"><div class="b">${esc(e.note || e.cat)}</div><div class="sm">${e.date.slice(5)}${e.time ? ' ' + esc(e.time) : ''} · ${esc(e.cat)}</div>
      <div class="row" style="margin-top:8px"><span class="b">${money(e.amt)}</span><button class="tg ${isSplit(e) ? 'on' : ''}" data-tog="${e.id}" role="switch" aria-checked="${isSplit(e)}" aria-label="Split 50/50"><i></i></button></div><div class="sm" style="margin-top:6px">${isSplit(e) ? 'Split 50/50' : 'Paid fully by ' + p}</div></div>`).join('') || '<div class="empty sm">None</div>'}</div></div>`;
  };
  const hist = [...S.settles].reverse();
  return `<h1>Split</h1>
  <div class="card">${c.amt > 0.005 ? `<div class="sm">${c.debtor} owes ${c.creditor}</div><div class="big">${money(c.amt)}</div><button class="pri" id="settle">Mark as settled</button>` : '<div class="b">All settled up</div>'}</div>
  <div class="cols">${PAYERS.map(col).join('')}</div>
  <h2>Settlement history</h2>
  ${hist.map(t => `<div class="card row"><div><div class="b">${esc(t.from)} paid ${esc(t.to)}</div><div class="sm">${stamp(t.date, t.time)}</div></div><div class="b">${money(t.amt)}</div></div>`).join('') || '<div class="empty">No settlements yet.</div>'}
  <div class="sm">Switch on = split 50/50. Switch off = paid fully by that person.</div>`;
}
function show() {
  $('#main').innerHTML = view === 'analysis' ? analysis() : view === 'split' ? splitView() : dashboard();
  document.querySelectorAll('#tabs [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
}
const PAYERS = ['Sana', 'Aman'];
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
  if (e.target.id === 'amt') e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
});
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; st = null; }

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'reset') {
    if (!confirm('Erase all expenses and reset to 0?')) return;
    localStorage.removeItem('ss'); S.expenses = []; S.settles = []; S.groups = []; S.budgets = {};
    show();
  }
  else if (t.dataset.tog) {
    const e = S.expenses.find(x => x.id === t.dataset.tog);
    if (e) { e.split = !isSplit(e); localStorage.ss = JSON.stringify(S); show(); }
  }
  else if (t.id === 'settle') {
    const c = splitCalc();
    if (confirm(`Record ${c.debtor} paying ${c.creditor} ${money(c.amt)}?`)) {
      S.settles.push({ from: c.debtor, to: c.creditor, amt: c.amt, ...nowParts() });
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
