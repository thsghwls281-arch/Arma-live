const ENTRY_CONTEXT_BASE=process.env.ARMA_ENTRY_CONTEXT_BASE_URL||"https://arma2-git-feat-entry-rank-1-shadow-20260908-arma9.vercel.app";

export type EntryContextRow={
 symbol:string;name:string;market:string|null;sector:string|null;isActive:boolean;
 official:any;pullback:any|null;ozawa:any|null;sectorContext:any|null;
};

export type EntryContextPayload={
 ok:boolean;status:string;modelVersion:string;tradeDate:string;count:number;generatedAt:string;officialTablesTouched:boolean;rows:EntryContextRow[];
};

export async function getEntryContext():Promise<EntryContextPayload>{
 const response=await fetch(`${ENTRY_CONTEXT_BASE}/api/arma/entry-context`,{cache:"no-store",headers:{Accept:"application/json"}});
 const json:any=await response.json().catch(()=>null);
 if(!response.ok||!json?.ok||!Array.isArray(json.rows))throw new Error(json?.message||"Entry Context를 불러오지 못했습니다.");
 return json as EntryContextPayload;
}
