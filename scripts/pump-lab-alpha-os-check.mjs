import { createPumpLabAlphaOS } from '../lib/pump-lab-alpha-os.mjs';

const ok=(x,msg)=>{if(!x)throw new Error(msg);};
const alpha=createPumpLabAlphaOS({start:1000,rpcUrl:''});
const base=Date.now();
const token={
  mint:'MintAlpha111',symbol:'ALPHA',price:1,mc:80000,liq:30000,buys:18,sells:7,updatedAt:base,
  history:[
    {ts:base-110000,price:.82,buys:5,sells:4},{ts:base-70000,price:.88,buys:8,sells:5},
    {ts:base-30000,price:.95,buys:13,sells:6},{ts:base-5000,price:1,buys:18,sells:7}
  ],
  chainFlow:[
    {ts:base-24000,slot:1,wallet:'W1',action:'BUY',notionalUsd:10},
    {ts:base-23000,slot:1,wallet:'W2',action:'BUY',notionalUsd:11},
    {ts:base-12000,slot:2,wallet:'W3',action:'BUY',notionalUsd:18},
    {ts:base-6000,slot:3,wallet:'W4',action:'SELL',notionalUsd:7}
  ]
};
const features={momentum:72,acceleration:64,flow:72,liqScore:65,volScore:62,risk:38};
const obs=alpha.observeToken(token,{features});
ok(obs.micro.velocity>=0,'microstructure missing');
ok(Number.isFinite(obs.toxicity.score),'toxicity score missing');

alpha.observeWalletEvent({wallet:'W1',mint:token.mint,ts:base-16*60000,action:'BUY',price:.75,mc:45000,signature:'sig1'},token);
alpha.walletSignals[0].ts=Date.now()-16*60000;
alpha.settleWalletSignals({...token,price:1.1});
ok(alpha.walletStats.get('W1').leadSamples>=1,'wallet lead-lag did not settle');

const fc=alpha.forecasts[0];
ok(fc,'forecast not created');
fc.ts=Date.now()-16*60000;
alpha.settleForecasts({...token,price:1.3});
ok(fc.settled===true,'probability forecast did not settle');

const evald=alpha.evaluateCandidate({
  strategy:{id:'test',name:'Test'},
  token:{...token,price:1.3},
  features,score:76,threshold:64,quality:{score:82},similar:{hit25:55,hit100:12}
});
ok(evald.probability&&evald.execution&&evald.toxicity,'candidate evaluation incomplete');

const proposal=alpha.proposeCapital({
  strategy:{id:'test',name:'Test'},token:{...token,price:1.3},features,score:76,threshold:64,quality:{score:82},similar:{hit25:55,hit100:12}
});
proposal.veto=false;proposal.utility=Math.max(5,proposal.utility);proposal.ts=Date.now()-2000;
alpha.runCapitalAuction(m=>m===token.mint?{...token,price:1.3}:null,(t,b,side)=>({fillPrice:t.price*(side==='buy'?1.005:.995),feeRate:.0125,fixedCost:.02,slippage:.005}));
ok(alpha.master.positions.length>=1,'CIO capital auction did not open a qualified paper position');

const p={id:'paper1',strategy:'test',mint:token.mint,symbol:token.symbol,entry:1.3,entryCost:10,invested:9.8,pnlPct:0};
alpha.recordShadowEntry({position:p,token:{...token,price:1.3},alpha:evald});
alpha.shadow[0].ts=Date.now()-20000;
alpha.markShadow({...token,price:1.34});
ok(alpha.shadow[0].checkpoints.fiveSec!==null,'shadow execution checkpoints missing');

const snap=alpha.snapshot();
ok(snap.subsystems.length===10,'all ten Alpha OS subsystems are not represented');
ok(snap.master&&snap.forecasts&&snap.wallets&&snap.shadow,'Alpha OS snapshot incomplete');

const copy=createPumpLabAlphaOS({start:1000});
ok(copy.restore(alpha.serialize()),'Alpha OS restore failed');
ok(copy.snapshot().subsystems.length===10,'restored Alpha OS invalid');

console.log('PUMP LAB Alpha OS checks passed: 10 subsystems + CIO + persistence');
