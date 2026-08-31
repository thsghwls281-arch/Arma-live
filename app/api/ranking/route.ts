import {getCache} from "@vercel/functions";
import {NextRequest} from "next/server";
import {calculateStock} from "@/lib/engine";
import {kbQuotes} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {STOCKS,STOCK_BY_SYMBOL} from "@/lib/stocks";
import {getOfficialSectorMembership,resolveOfficialSectorId,type OfficialSectorMembership} from "@/lib/official-sectors";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

type Cache=ReturnType<typeof getCache>;
type Market=Awaited<ReturnType<typeof calculateMarket>>;
type StockInput={name:string;price:number;changeRate:number|null;volume:number|null;history:number[]};
type RankingRow=ReturnType<typeof calculateStock>&{symbol:string;name:string;sector:string|null;price:number;changeRate:number|null;volume:number|null};

async function getMarket(cache:Cache){
 const key="market:official:v2";
 const cached=await cache.get(key) as Market|undefined;
 if(cached)return cached;
 const market=await calculateMarket();
 await cache.set(key,market,{ttl:300,tags:["arma-live-market"],name:"ARMA LIVE 공식 A/M"});
 return market;
}

async function getStockInputs(symbols:string[],cache:Cache){
 const inputs=new Map<string,StockInput>();
 const cachedRows=await Promise.all(symbols.map(async symbol=>[symbol,await cache.get(`stock:v1:${symbol}`)] as const));
 for(const [symbol,value] of cachedRows)if(value)inputs.set(symbol,value as StockInput);
 const missing=symbols.filter(symbol=>!inputs.has(symbol));
 if(!missing.length)return inputs;

 const chunkSize=20;
 for(let i=0;i<missing.length;i+=chunkSize){
  const chunk=missing.slice(i,i+chunkSize);
  const [quotes,histories]=await Promise.all([
   kbQuotes(chunk),
   Promise.all(chunk.map(async symbol=>{const stock=STOCK_BY_SYMBOL.get(symbol)!;try{return[symbol,await yahooStockHistory(symbol,stock.market)] as const}catch{return null}}))
  ]);
  const historyBySymbol=new Map<string,number[]>();
  histories.forEach(row=>{if(row)historyBySymbol.set(row[0],row[1])});
  await Promise.all(chunk.map(async symbol=>{
   const quote=quotes.get(symbol),history=historyBySymbol.get(symbol),stock=STOCK_BY_SYMBOL.get(symbol);
   if(!quote?.price||!history||!stock)return;
   const value:StockInput={name:quote.name||stock.name,price:quote.price,changeRate:quote.changeRate,volume:quote.volume,history};
   inputs.set(symbol,value);
   await cache.set(`stock:v1:${symbol}`,value,{ttl:300,tags:["arma-live-stock",`arma-live-stock:${symbol}`],name:stock.name});
  }));
 }
 return inputs;
}

export async function POST(req:NextRequest){
 try{
  const body:any=await req.json().catch(()=>({}));
  const requestedId=String(body?.sectorId||"");
  const isAll=requestedId==="__all__";
  let membership:OfficialSectorMembership|null=null;
  try{membership=await getOfficialSectorMembership()}catch(error){if(!isAll)throw error}
  const resolvedId=!isAll&&membership?resolveOfficialSectorId(requestedId,membership):null;
  const sector=resolvedId&&membership?membership.byId.get(resolvedId):null;
  if(!isAll&&!sector)return Response.json({ok:false,message:"ARMA Official 섹터 원장에서 계산 범위를 찾지 못했습니다."},{status:400});

  const symbols=isAll?STOCKS.map(stock=>stock.symbol):sector!.symbols;
  if(!isAll&&symbols.length<5)return Response.json({ok:false,message:`${sector!.name}의 LIVE 지원 종목이 ${symbols.length}개뿐입니다.`},{status:503});
  const cache=getCache({namespace:"arma-live"});
  const key=isAll?"global-ranking:v5":`sector-ranking:v5:${sector!.id}`;
  const cached=await cache.get(key);
  if(cached)return Response.json({...cached as object,cached:true},{headers:{"Cache-Control":"private, no-store"}});

  const [market,inputs]=await Promise.all([getMarket(cache),getStockInputs(symbols,cache)]);
  const rows:RankingRow[]=[];
  for(const symbol of symbols){
   const stock=STOCK_BY_SYMBOL.get(symbol),input=inputs.get(symbol),official=membership?.bySymbol.get(symbol);
   if(!stock||!input)continue;
   try{rows.push({symbol,name:input.name||stock.name,sector:official?.sector??null,price:input.price,changeRate:input.changeRate,volume:input.volume,...calculateStock(input.history,input.price,market.calculationAScore,market.calculationMScore)})}catch{}
  }
  const minimum=isAll?20:5;
  if(rows.length<minimum)throw new Error(`계산 가능한 종목이 ${rows.length}개뿐입니다. 잠시 후 다시 시도하세요.`);
  rows.sort((a,b)=>b.armaScore-a.armaScore||a.prs-b.prs);

  const base={ok:true,asOf:new Date().toISOString(),scope:isAll?"all":"sector",sectorId:isAll?"__all__":sector!.id,sectorName:isAll?"전체 종목":sector!.name,candidateCount:symbols.length,calculatedCount:rows.length,failedCount:symbols.length-rows.length,aScore:market.aScore,mScore:market.mScore,regime:market.regime,marketSource:market.inputs.source,basisDate:market.inputs.tradeDate,fallback:market.fallback,provisional:true,sectorSource:membership?"ARMA_OFFICIAL:arma_stocks.sector":"UNAVAILABLE"};
  const result=isAll?{...base,top20:rows.slice(0,20),buyTop10:rows.filter(row=>row.action==="매수").slice(0,10)}:{...base,top5:rows.slice(0,5)};
  await cache.set(key,result,{ttl:300,tags:["arma-live-ranking",isAll?"arma-live-global":`arma-live-sector:${sector!.id}`],name:isAll?"ARMA LIVE 전체 TOP20":`${sector!.name} LIVE TOP5`});
  return Response.json({...result,cached:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){console.error("[ranking]",e);const message=e instanceof Error?e.message:"랭킹 계산 실패";const morning=message.includes("Morning Snapshot");const officialSector=message.includes("Official 섹터")||message.includes("섹터 원장");return Response.json({ok:false,message,aScore:morning?null:undefined,mScore:morning?null:undefined,marketSource:morning?"ARMA_MORNING":undefined},{status:morning||officialSector?503:500})}
}
