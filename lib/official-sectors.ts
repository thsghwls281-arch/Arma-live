import {SECTOR_BY_ID,STOCKS} from "@/lib/stocks";

const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-arma9.vercel.app").replace(/\/$/,"");
const text=(value:unknown)=>{const normalized=String(value??"").trim();return normalized||null};

export type OfficialSectorStock={symbol:string;name:string;market:string|null;sector:string|null};
export type OfficialSectorGroup={id:string;name:string;count:number;symbols:string[]};
export type OfficialSectorMembership={source:string;stocks:OfficialSectorStock[];sectors:OfficialSectorGroup[];bySymbol:Map<string,OfficialSectorStock>;byId:Map<string,OfficialSectorGroup>};

export async function getOfficialSectorMembership():Promise<OfficialSectorMembership>{
 const response=await fetch(`${OFFICIAL_BASE}/api/arma/stock-sectors`,{cache:"no-store"});
 const json:any=await response.json().catch(()=>null);
 if(!response.ok||!json?.ok)throw new Error(json?.message||"ARMA Official 섹터 원장을 불러오지 못했습니다.");
 const supported=new Set(STOCKS.map(stock=>stock.symbol));
 const stocks:(OfficialSectorStock[])=(Array.isArray(json.stocks)?json.stocks:[])
  .map((row:any)=>({symbol:String(row.symbol||"").trim(),name:String(row.name||"").trim(),market:text(row.market),sector:text(row.sector)}))
  .filter((row:OfficialSectorStock)=>supported.has(row.symbol));
 const bySymbol=new Map(stocks.map(stock=>[stock.symbol,stock] as const));
 const grouped=new Map<string,string[]>();
 for(const stock of stocks){if(!stock.sector)continue;const symbols=grouped.get(stock.sector)||[];symbols.push(stock.symbol);grouped.set(stock.sector,symbols)}
 const sectors=[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b,"ko")).map(([name,symbols])=>({id:name,name,count:symbols.length,symbols}));
 const byId=new Map(sectors.map(sector=>[sector.id,sector] as const));
 return {source:String(json.source||"arma_stocks.sector"),stocks,sectors,bySymbol,byId};
}

export function resolveOfficialSectorId(requestedId:string,membership:OfficialSectorMembership){
 const normalized=requestedId.trim();
 if(membership.byId.has(normalized))return normalized;
 const legacy=SECTOR_BY_ID.get(normalized);
 if(legacy&&membership.byId.has(legacy.name))return legacy.name;
 return null;
}
