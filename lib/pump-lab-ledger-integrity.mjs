// Pure guards for preserving historical paper-trading fills across partial recovery snapshots.
export function detailedLedgerTarget(meta = {}, observedCount = 0, max = 2000) {
 const expected = Number(meta.tradeCount);
 return Math.min(max,Math.max(observedCount,Number.isFinite(expected)?Math.max(0,expected):0));
}
export function detailedLedgerGap(target, count) {
 return Math.max(0,Math.floor(Number(target)||0)-Math.max(0,Math.floor(Number(count)||0)));
}
export function mergeHistoricalTrades(current=[],historical=[],max=2000){
 const ids=new Set(),rows=[];
 for(const item of [...current,...historical]){
  if(!item || !item.id || ids.has(item.id))continue;
  ids.add(item.id);rows.push(item);
 }
 rows.sort((a,b)=>(Number(b.closedAt)||0)-(Number(a.closedAt)||0));
 const merged=rows.slice(0,max);
 const existingIds=new Set(current.map(x=>x?.id).filter(Boolean));
 const added=merged.filter(x=>!existingIds.has(x.id)).length;
 return {trades:merged,added};
}
export function permitCanonicalOverwrite(target,count){
 return detailedLedgerGap(target,count)===0;
}
