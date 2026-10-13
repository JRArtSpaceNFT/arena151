// Research-preserving core admission guard for constrained paper-trading runtimes.
// Cheaply skip full core scoring for coins that cannot pass any active primary/desk
// minimum market-cap safety gate. Never skip management of open positions.
export const ACTIVE_CORE_MIN_MARKET_CAP_USD=40_000;
export function shouldEvaluateCoreToken({marketCap,hasOpenPosition=false}={}){
 if(hasOpenPosition)return true;
 if(typeof marketCap!=='number'||!Number.isFinite(marketCap)||marketCap<=0)return true;
 return marketCap>=ACTIVE_CORE_MIN_MARKET_CAP_USD;
}
export function shouldProcessStrategy({enabled,hasOpenPosition}={}){
 // Inactive historical strategies still remain in the ledger and UI, but do not
 // require per-token equity recalculation absent an open trade to manage.
 return enabled===true||hasOpenPosition===true;
}
