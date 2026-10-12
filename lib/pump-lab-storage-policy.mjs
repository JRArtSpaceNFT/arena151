// Canonical store authorization. Recovery snapshots preserve the dashboard, not trading permission.
export function canonicalStorageReady({databaseConfigured=false,connected=false,restored=false,lastSaveAt=0,lastRestoreAt=0}={}){
 if(!databaseConfigured)return true;
 return connected===true&&restored===true&&[lastSaveAt,lastRestoreAt].some(x=>typeof x==='number'&&Number.isFinite(x)&&x>0);
}
