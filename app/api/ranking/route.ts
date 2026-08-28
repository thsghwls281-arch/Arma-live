import {getCache} from "@vercel/functions";
import {NextRequest} from "next/server";
import {calculateStock} from "@/lib/engine";
import {kbQuotes} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {SECTOR_BY_ID,STOCK_BY_SYMBOL} from "@/lib/stocks";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

type Cache=ReturnType<typeof getCache>;
type Market=Awaited<ReturnType<typeof calculateMarket>>;
type StockInput={name:string;price:number;changeRate:number|null;volume:number|null;history:number[]};
type RankingRow=ReturnType<typeof calculateStock>&{symbol:string;name:string;sector:string;price:number;changeRate:number|null;volume:number|null};

async function getMarket(cache:Cache){
 const key="market:v1";
 const cached=await cache.get(key) as Market|undefined;
 if(cached)return cached;
 const market=await calculateMarket();
 await cache.set(key,market,{ttl:300,tags:["arma-live-market"],name:"ARMA LIVE A/M"});
 return market;
}

async function getStockInputs(symbols:string[],cache:Cache){
 const inputs=new Map<string,StockInput>();
 const cachedRows=await Promise.all(symbols.map(async symbol=>[symbol,await cache.get(`stock:v1:${symbol}`)] as const));
 for(const [symbol,value] of cachedRows)if(value)inputs.set(symbol,value as StockInput);
 const missing=symbols.filter(symbol=>!inputs.has(symbol));
 if(!missing.length)return inputs;
 const [quotes,histories]=await Promise.all([
  kbQuotes(missing),
  Promise.all(missing.map(async symbol=>{const stock=STOCK_BY_SYMBOL.get(symbol)!;try{return[symbol,await yahooStockHistory(symbol,stock.market)] as const}catch{return null}}))
 ]);
 const historyBySymbol=new Map<string,number[]>();
 histories.forEach(row=>{if(row)historyBySymbol.set(row[0],row[1])});
 await Promise.all(missing.map(async symbol=>{
  const quote=quotes.get(symbol),history=historyBySymbol.get(symbol);
  if(!quote?.price||!history)return;
  const value:StockInput={name:quote.name||STOCK_BY_SYMBOL.get(symbol)!.name,price:quote.price,changeRate:quote.changeRate,volume:quote.volume,history};
  inputs.set(symbol,value);
  await cache.set(`stock:v1:${symbol}`,value,{ttl:300,tags:["arma-live-stock",`arma-live-stock:${symbol}`],name:STOCK_BY_SYMBOL.get(symbol)!.name});
 }));
 return inputs;
}

export async function POST(req:NextRequest){
 try{
  const body:any=await req.json().catch(()=>({}));
  const sector=SECTOR_BY_ID.get(String(body?.sectorId||""));
  if(!sector)return Response.json({ok:false,message:"계산할 섹터를 선택하세요."},{status:400});
  const symbols=sector.symbols.slice(0,20);
  const cache=getCache({namespace:"arma-live"});
  const key=`sector-ranking:v2:${sector.id}`;
  const cached=await cache.get(key);
  if(cached)return Response.json({...cached as object,cached:true},{headers:{"Cache-Control":"private, no-store"}});
  const [market,inputs]=await Promise.all([getMarket(cache),getStockInputs(symbols,cache)]);
  const rows:RankingRow[]=[];
  for(const symbol of symbols){
   const stock=STOCK_BY_SYMBOL.get(symbol),input=inputs.get(symbol);
   if(!stock||!input)continue;
   try{rows.push({symbol,name:input.name||stock.name,sector:sector.name,price:input.price,changeRate:input.changeRate,volume:input.volume,...calculateStock(input.history,input.price,market.aScore,market.mScore)})}catch{}
  }
  if(rows.length<5)throw new Error(`계산 가능한 종목이 ${rows.length}개뿐입니다. 잠시 후 다시 시도하세요.`);
  rows.sort((a,b)=>b.armaScore-a.armaScore||a.prs-b.prs);
  const result={ok:true,asOf:new Date().toISOString(),sectorId:sector.id,sectorName:sector.name,candidateCount:symbols.length,calculatedCount:rows.length,failedCount:symbols.length-rows.length,aScore:market.aScore,mScore:market.mScore,regime:market.regime,top5:rows.slice(0,5),provisional:true};
  await cache.set(key,result,{ttl:300,tags:["arma-live-ranking",`arma-live-sector:${sector.id}`],name:`${sector.name} LIVE TOP5`});
  return Response.json({...result,cached:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){console.error("[ranking]",e);return Response.json({ok:false,message:e instanceof Error?e.message:"랭킹 계산 실패"},{status:500})}
}

