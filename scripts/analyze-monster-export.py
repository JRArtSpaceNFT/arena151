import json, math, sys, statistics
from collections import defaultdict, Counter

path=sys.argv[1] if len(sys.argv)>1 else "monster-export.json"
d=json.load(open(path))
opps=d.get("opportunities",[])
events=d.get("marketEvents",[])
trades=d.get("trades",[])

def n(x,default=0.0):
    try:
        v=float(x)
        return v if math.isfinite(v) else default
    except: return default

def part(mint):
    # Match server deterministic 80/20 approximately via exported samplePartition whenever present.
    return "unknown"

def reason_cat(s):
    z=(s or "").lower()
    tests=[
      ("science / global veto",["science","do nothing","global veto","survival","saturation"]),
      ("risk / manipulation",["risk","toxic","manip","catastrophic","rug","creator"]),
      ("data quality / confirmation",["quality","source","cross","evidence","confirm","unknown","observ"]),
      ("score threshold",["score","threshold","below"," gate","minimum"]),
      ("too early / age",["young","early","age","wait","retest","pullback"]),
      ("liquidity / market cap",["liq","market cap","marketcap"," mc ","graduat","curve"]),
      ("flow / buyers",["flow","buyer","buy ratio","sell pressure","wallet","consensus"]),
      ("momentum / acceleration",["momentum","acceler","breakout","chart","structure","spike","chase"]),
      ("execution / latency",["execution","latency","slippage","fill","network"]),
      ("regime / allocation",["regime","risk off","capital","allocation","exposure"]),
    ]
    for name,needles in tests:
        if any(x in z for x in needles): return name
    return "other" if z else "unspecified"

by=defaultdict(list)
for o in opps:
    by[o.get("mint","")].append(o)

evby=defaultdict(list)
for e in events:
    evby[e.get("mint","")].append(e)
for a in evby.values(): a.sort(key=lambda x:n(x.get("ts")))

trby=defaultdict(list)
for t in trades: trby[t.get("mint","")].append(t)

rows=[]
monsters=[]
for mint,group in by.items():
    group.sort(key=lambda x:n(x.get("firstTs") or x.get("ts")))
    first=group[0]
    best=max([n(x.get("bestReturn")) for x in group] or [0])
    worst=min([n(x.get("worstReturn")) for x in group] or [0])
    monster=best>=75
    f=first.get("features") or {}
    row={
      "mint":mint,"symbol":first.get("symbol",""),"partition":first.get("samplePartition") or "unknown",
      "monster":monster,"bestReturn":best,"worstReturn":worst,
      "reasons":sorted(set(reason_cat(x.get("why")) for x in group)),
      "values":{
        "score":n(first.get("score")),"risk":n(first.get("risk")),"mc":n(first.get("mc")),
        "momentum":n(f.get("momentum")),"acceleration":n(f.get("acceleration")),"flow":n(f.get("flow")),
        "buyRatio":n(f.get("buyRatio"))*100,"volScore":n(f.get("volScore")),"liqScore":n(f.get("liqScore")),
        "age":n(f.get("age")),"sourceQuality":n(f.get("sourceQuality")),"chartQuality":n(f.get("chartQuality")),
        "spikeRisk":n(f.get("spikeRisk")),"memeQuality":n(f.get("memeQuality")),
        "manipulation":n(f.get("manipulationSuspicion")),"flowPersistence":n(f.get("flowPersistence"))
      }
    }
    rows.append(row)
    if not monster: continue
    first_ts=n(first.get("firstTs") or first.get("ts")); first_price=n(first.get("firstPrice") or first.get("price"))
    es=[e for e in evby.get(mint,[]) if n(e.get("ts"))>=first_ts and n(e.get("price"))>0]
    peak=best; peak_price=first_price*(1+peak/100) if first_price else 0; peak_event=None
    if first_price:
        for e in es:
            ret=(n(e.get("price"))/first_price-1)*100
            if ret>peak:
                peak=ret; peak_price=n(e.get("price")); peak_event=e
    catch=None
    for e in es:
        ef=e.get("features") or {}; scores=e.get("scores") or {}
        q=n(e.get("quality")); risk=n(ef.get("risk")); source=n(ef.get("sourceQuality"))
        manip=n((ef.get("meme") or {}).get("manipulationSuspicion",ef.get("manipulationSuspicion")))
        buy=n(ef.get("buyRatio")); flow=n(ef.get("flow")); smax=max([n(v) for v in scores.values()] or [0])
        if q>=50 and risk<=75 and source>=34 and manip<80 and (buy>=.48 or flow>=48) and smax>=58:
            catch=e; break
    def delay(sec):
        e=next((x for x in es if n(x.get("ts"))>=first_ts+sec*1000),None)
        if not e or not first_price: return None
        ep=n(e.get("price"))
        return {"seconds":sec,"moveAlreadyMade":(ep/first_price-1)*100 if ep else None,
                "remainingUpside":(peak_price/ep-1)*100 if ep and peak_price else None,
                "mc":n(e.get("mc"))}
    rc=Counter(reason_cat(x.get("why")) for x in group)
    caught=sorted(set((t.get("strategyName") or t.get("strategy") or "") for t in trby.get(mint,[])))
    monsters.append({
      "mint":mint,"symbol":first.get("symbol",""),"partition":row["partition"],"peakReturn":peak,"worstReturn":worst,
      "rejectCount":len(group),"labWideMiss":len(caught)==0,"caughtBy":caught,
      "topReasons":rc.most_common(),"firstReject":{"ts":first_ts,"mc":n(first.get("mc")),"score":n(first.get("score")),"risk":n(first.get("risk")),"why":first.get("why","")},
      "catchable":None if not catch else {"secondsAfterReject":(n(catch.get("ts"))-first_ts)/1000,"mc":n(catch.get("mc")),
        "moveAlreadyMade":(n(catch.get("price"))/first_price-1)*100 if first_price else None,
        "remainingUpside":(peak_price/n(catch.get("price"))-1)*100 if n(catch.get("price")) else None,
        "quality":n(catch.get("quality")),"risk":n((catch.get("features") or {}).get("risk"))},
      "recovery":{"15":delay(15),"30":delay(30),"60":delay(60),"120":delay(120)}
    })

monsters.sort(key=lambda x:x["peakReturn"],reverse=True)

def corr(a,key):
    vals=[(r["values"].get(key),1.0 if r["monster"] else 0.0) for r in a if isinstance(r["values"].get(key),(int,float))]
    if len(vals)<3:return 0
    xs=[x for x,_ in vals]; ys=[y for _,y in vals]
    mx=sum(xs)/len(xs); my=sum(ys)/len(ys)
    sx=math.sqrt(sum((x-mx)**2 for x in xs)/len(xs)); sy=math.sqrt(sum((y-my)**2 for y in ys)/len(ys))
    return 0 if not sx or not sy else sum((x-mx)*(y-my) for x,y in vals)/len(vals)/sx/sy

train=[r for r in rows if r["partition"]=="train"]
hold=[r for r in rows if r["partition"]=="holdout"]
features=list(rows[0]["values"].keys()) if rows else []
patterns=[]
for k in features:
    tr=corr(train,k); ho=corr(hold,k)
    validated=len(train)>=20 and sum(r["monster"] for r in train)>=3 and len(hold)>=8 and sum(r["monster"] for r in hold)>=2 and (tr==0 or ho==0 or (tr>0)==(ho>0)) and abs(tr)>=.12 and abs(ho)>=.05
    patterns.append({"feature":k,"trainCorr":tr,"holdoutCorr":ho,"validated":validated,"strength":(abs(tr)+abs(ho))/2})
patterns.sort(key=lambda x:(x["validated"],x["strength"]),reverse=True)

def rates(a):
    return 0 if not a else sum(r["monster"] for r in a)/len(a)*100

reasons=sorted(set(x for r in rows for x in r["reasons"]))
reasonstats=[]
for reason in reasons:
    def stat(a):
        z=[r for r in a if reason in r["reasons"]]; base=rates(a)/100
        rate=(sum(r["monster"] for r in z)/len(z)) if z else 0
        return {"n":len(z),"monsterN":sum(r["monster"] for r in z),"rate":rate*100,"lift":rate/base if base else 0}
    tr,ho=stat(train),stat(hold)
    val=tr["n"]>=5 and tr["monsterN"]>=2 and ho["n"]>=2 and ho["monsterN"]>=1 and tr["lift"]>=1.2 and ho["lift"]>=1.1
    reasonstats.append({"reason":reason,"train":tr,"holdout":ho,"validated":val,"strength":(tr["lift"]+ho["lift"])/2})
reasonstats.sort(key=lambda x:(x["validated"],x["strength"]),reverse=True)

recovery=[]
for sec in [15,30,60,120]:
    vals=[m["recovery"][str(sec)] for m in monsters if m["labWideMiss"] and m["recovery"][str(sec)]]
    rem=[x["remainingUpside"] for x in vals if x["remainingUpside"] is not None]
    mov=[x["moveAlreadyMade"] for x in vals if x["moveAlreadyMade"] is not None]
    recovery.append({"seconds":sec,"n":len(vals),"avgMove":sum(mov)/len(mov) if mov else 0,
      "avgRemainingUpside":sum(rem)/len(rem) if rem else 0,"still25Pct":sum(x>=25 for x in rem)/len(rem)*100 if rem else 0})

summary={
 "exportCounts":d.get("counts",{}),"rejectedTokens":len(rows),"monsters":len(monsters),
 "labWideMisses":sum(m["labWideMiss"] for m in monsters),"partialMisses":sum(not m["labWideMiss"] for m in monsters),
 "monsterRate":rates(rows),"trainRate":rates(train),"holdoutRate":rates(hold),
 "validatedFeaturePatterns":sum(p["validated"] for p in patterns),
 "validatedReasonPatterns":sum(p["validated"] for p in reasonstats)
}
print("MONSTER_SUMMARY "+json.dumps(summary,separators=(",",":")))
for p in patterns[:12]: print("MONSTER_PATTERN "+json.dumps(p,separators=(",",":")))
for p in reasonstats[:12]: print("MONSTER_REASON "+json.dumps(p,separators=(",",":")))
for r in recovery: print("MONSTER_RECOVERY "+json.dumps(r,separators=(",",":")))
for i,m in enumerate(monsters,1):
    m["rank"]=i
    print("MONSTER_ROW "+json.dumps(m,separators=(",",":")))
