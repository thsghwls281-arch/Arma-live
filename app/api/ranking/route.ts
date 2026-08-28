import {createHash} from "node:crypto";
import {getCache} from "@vercel/functions";
import {NextRequest} from "next/server";
import {calculateStock} from "@/lib/engine";
import {kbQuotes} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {STOCK_BY_SYMBOL} from "@/lib/stocks";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=300;
type RankingRow=ReturnType<typeof calculateStock>&{symbol:string;name:string;sector:string;price:number;changeRate:number|null;volume:number|null};

export async function POST(req:NextRequest){
 try{
  const body:any=await req.json().catch(()=>({}));
  const rawSymbols:string[]=Array.isArray(body?.symbols)?body.symbols.map(String):[];
  const symbols=[...new Set<string>(rawSymbols)].filter(symbol=>/^\d{6}$/.test(symbol)&&STOCK_BY_SYMBOL.has(symbol)).slice(0,20);
  if(!symbols.length)return Response.json({ok:false,message:"후보 종목을 1개 이상 선택하세요."},{status:400});
  const key=`ranking:v1:${createHash("sha256").update([...symbols].sort().join(",")).digest("hex").slice(0,24)}`;
  const cache=getCache({namespace:"arma-live"});
  const cached=await cache.get(key);
  if(cached)return Response.json({...cached as object,cached:true},{headers:{"Cache-Control":"private, no-store"}});
  const [market,quotes,historyRows]=await Promise.all([
   calculateMarket(),kbQuotes(symbols),Promise.all(symbols.map(async symbol=>{const stock=STOCK_BY_SYMBOL.get(symbol)!;try{return [symbol,await yahooStockHistory(symbol,stock.market)] as const}catch{return null}}))
  ]);
  const historyBySymbol=new Map<string,number[]>();historyRows.forEach(row=>{if(row)historyBySymbol.set(row[0],row[1])});
  const rows:RankingRow[]=[];for(const symbol of symbols){const stock=STOCK_BY_SYMBOL.get(symbol)!,quote=quotes.get(symbol),history=historyBySymbol.get(symbol);if(!quote?.price||!history)continue;try{rows.push({symbol,name:quote.name||stock.name,sector:stock.sector,price:quote.price,changeRate:quote.changeRate,volume:quote.volume,...calculateStock(history,quote.price,market.aScore,market.mScore)})}catch{}}
  if(rows.length<5)throw new Error(`계산 가능한 종목이 ${rows.length}개뿐입니다. 잠시 후 다시 시도하세요.`);
  rows.sort((a,b)=>b.armaScore-a.armaScore||a.prs-b.prs);
  const result={ok:true,asOf:new Date().toISOString(),candidateCount:symbols.length,calculatedCount:rows.length,failedCount:symbols.length-rows.length,aScore:market.aScore,mScore:market.mScore,regime:market.regime,top5:rows.slice(0,5),provisional:true};
  await cache.set(key,result,{ttl:300,tags:["arma-live-ranking"],name:"ARMA LIVE TOP5"});
  return Response.json({...result,cached:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){console.error("[ranking]",e);return Response.json({ok:false,message:e instanceof Error?e.message:"랭킹 계산 실패"},{status:500})}
}
