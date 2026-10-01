const esc=x=>String(x??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const money=n=>String.fromCharCode(36)+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const one=n=>Number(n||0).toFixed(1);
const price=n=>Number(n||0)>0?Number(n).toPrecision(5):'—';
const held=(a,z)=>{const m=Math.max(0,(Number(z||0)-Number(a||0))/60000);return m<60?m.toFixed(1)+'m':(m/60).toFixed(1)+'h';};
const cls=n=>Number(n||0)>=0?'green':'red';
const sign=n=>Number(n||0)>=0?'+':'';

export function renderBotProfileHtml(payload={}){
  const b=payload.bot||{},s=payload.stats||{},op=payload.openPositions||[],tr=payload.trades||[];
  const best=s.bestTrade,worst=s.worstTrade;
  const openRows=op.map(p=>[
    '<tr><td><b>',String.fromCharCode(36),esc(p.symbol),'</b></td><td>',price(p.entry),
    '</td><td>',price(p.mark),'</td><td class="',cls(p.unrealizedPct),'">',
    sign(p.unrealizedPct),one(p.unrealizedPct),'%</td><td>',held(p.opened,Date.now()),'</td></tr>'
  ].join('')).join('');
  const tradeRows=tr.map(t=>[
    '<tr><td>',new Date(t.closedAt).toLocaleString(),'</td><td><b>',String.fromCharCode(36),esc(t.symbol),
    '</b><br><span class="muted">',esc(t.name||''),'</span></td><td class="',cls(t.pnl),'">',
    sign(t.pnl),money(t.pnl),'</td><td class="',cls(t.pnlPct),'">',sign(t.pnlPct),one(t.pnlPct),
    '%</td><td>',price(t.entry),'</td><td>',price(t.exit),'</td><td>',held(t.opened,t.closedAt),
    '</td><td>',esc(t.why||''),'</td></tr>'
  ].join('')).join('');

  return [
    '<div><span class="pill">',esc(b.risk||''),'</span> <span class="pill">',esc(b.type||'strategy'),'</span></div>',
    '<h1 style="margin:8px 0 2px">',esc(b.icon||'🤖'),' ',esc(b.name||'Bot'),'</h1>',
    '<div class="muted">',esc(b.playbook||b.thesis||''),'</div>',
    '<div class="grid4" style="margin-top:14px">',
      '<div class="smallcard"><span class="muted">EQUITY</span><div class="big">',money(b.equity),'</div><div class="',cls(s.totalPnl),'">',sign(s.totalPnl),money(s.totalPnl),' realized</div></div>',
      '<div class="smallcard"><span class="muted">WIN RATE</span><div class="big">',one(s.winRate),'%</div><div class="mini">',Number(s.wins||0),' wins · ',Number(s.losses||0),' losses</div></div>',
      '<div class="smallcard"><span class="muted">AVG TRADE</span><div class="big ',cls(s.avgPnlPct),'">',sign(s.avgPnlPct),one(s.avgPnlPct),'%</div><div class="mini">profit factor ',one(s.profitFactor),'</div></div>',
      '<div class="smallcard"><span class="muted">MAX DD</span><div class="big">',one(b.dd),'%</div><div class="mini">',op.length,' positions open</div></div>',
    '</div>',
    '<div class="three" style="margin-top:10px">',
      '<div class="smallcard"><b>Best trade</b><div class="green">',best?String.fromCharCode(36)+esc(best.symbol)+' +'+one(best.pnlPct)+'%':'—','</div></div>',
      '<div class="smallcard"><b>Worst trade</b><div class="red">',worst?String.fromCharCode(36)+esc(worst.symbol)+' '+one(worst.pnlPct)+'%':'—','</div></div>',
      '<div class="smallcard"><b>Current era</b><div>',esc(payload.era||''),'</div><div class="mini">',Number(s.eraTrades||0),' era trades</div></div>',
    '</div>',
    '<h3 style="margin-top:18px">How this bot trades</h3>',
    '<div class="smallcard"><div>',esc(b.playbook||b.thesis||'No description available.'),'</div><div class="mini" style="margin-top:8px">Entry gate ',one(b.effectiveMin||b.min),' · stop ',one(b.stop),'% · take ',one(b.take),'% · max ',Number(b.maxOpen||0),' open positions</div></div>',
    '<h3 style="margin-top:18px">Open positions (',op.length,')</h3>',
    op.length?'<div class="scroll" style="max-height:240px"><table class="table"><thead><tr><th>Token</th><th>Entry</th><th>Mark</th><th>Unrealized</th><th>Age</th></tr></thead><tbody>'+openRows+'</tbody></table></div>':'<div class="muted">No open positions.</div>',
    '<h3 style="margin-top:18px">Trade history (',tr.length,')</h3>',
    '<div class="mini" style="margin-bottom:7px">Newest first · full retained ledger for this bot.</div>',
    tr.length?'<div class="scroll" style="max-height:540px"><table class="table"><thead><tr><th>Closed</th><th>Token</th><th>P&L</th><th>P&L %</th><th>Entry</th><th>Exit</th><th>Hold</th><th>Exit reason</th></tr></thead><tbody>'+tradeRows+'</tbody></table></div>':'<div class="muted">No completed trades yet.</div>'
  ].join('');
}
