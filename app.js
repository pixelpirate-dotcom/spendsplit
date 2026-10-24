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
  const byCat = {};
  mine.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + (e.splits[ME] || 0));
  const cats = Object.entries(byCat).filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]);
  const n = net();
  const recent = [...S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<h1>Dashboard</h1>
  <div class="tiles">
    <div class="card"><div class="sm">Spent this month</div><div class="big">${money(total)}</div></div>
    <div class="card"><div class="sm">${n >= 0 ? "You're owed" : 'You owe'}</div><div class="big">${money(Math.abs(n))}</div></div>
    <div class="card"><div class="sm">Expenses</div><div class="big">${S.expenses.length}</div></div>
    <div class="card"><div class="sm">Groups</div><div class="big">${S.groups.length}</div></div>
  </div>
  <h2>By category</h2>
  ${cats.length ? `<div class="card">${cats.map(([c, v]) => {
    const lim = S.budgets[c], pct = Math.min(100, v / (lim || total) * 100);
    return `<div class="row"><span>${esc(c)}</span><span class="b">${money(v)}${lim ? `<span class="sm"> / ${money(lim)}</span>` : ''}</span></div>
      <div class="bar"><i class="${lim && v > lim ? 'over' : ''}" style="width:${pct}%"></i></div>`;
  }).join('')}</div>` : '<div class="empty">No spending this month.</div>'}
  <h2>Recent</h2>
  ${recent.length ? recent.map(e => `<div class="card row"><div><div class="b">${esc(e.note || e.cat)}</div><div class="sm">${e.date.slice(5)}${e.time ? ' ' + esc(e.time) : ''} · ${esc(e.cat)}</div></div><div class="b">${money(e.amt)}</div></div>`).join('') : '<div class="empty">No expenses yet.</div>'}`;
}

const CATS = ['Metro', 'Auto', 'Dine Out', 'Q-Commerce', 'Water', 'Lulu', 'Family Xpress'];
let st = null;

function renderSheet() {
  const el = $('#sheet');
  el.hidden = false;
  el.innerHTML = `<div class="panel">
    <div class="row"><b>New expense</b><button class="x" id="close">✕</button></div>
    <input class="amt" id="amt" type="number" inputmode="decimal" placeholder="${esc(S.cur)}0" value="${esc(st.amt)}">
    <div class="chips">${CATS.map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
    <div class="row" style="gap:8px"><input id="note" placeholder="Note" value="${esc(st.note)}"><input id="date" type="date" value="${st.date}" style="width:150px"><input id="time" type="time" value="${st.time}" style="width:120px"></div>
    <button class="pri" id="save">Save</button></div>`;
}
function sync() {
  st.amt = $('#amt').value; st.note = $('#note').value; st.date = $('#date').value || st.date; st.time = $('#time').value || st.time;
}
function nowParts() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; st = null; }

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'addbtn') { st = { amt: '', cat: CATS[0], note: '', ...nowParts() }; renderSheet(); $('#amt').focus(); }
  else if (!st) return;
  else if (t.id === 'close') closeSheet();
  else if (t.dataset.cat) { sync(); st.cat = t.dataset.cat; renderSheet(); }
  else if (t.id === 'save') {
    sync();
    const amt = r2(parseFloat(st.amt));
    if (!(amt > 0)) return alert('Enter an amount');
    S.expenses.push({ id: Math.random().toString(36).slice(2, 9), amt, cat: st.cat, note: st.note.trim(), date: st.date, time: st.time, gid: null, paidBy: ME, splits: { [ME]: amt } });
    localStorage.ss = JSON.stringify(S);
    closeSheet(); $('#main').innerHTML = dashboard();
  }
});

$('#main').innerHTML = dashboard();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
