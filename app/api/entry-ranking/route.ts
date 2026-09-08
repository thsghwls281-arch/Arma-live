import {getCache} from "@vercel/functions";
import {calculateStock} from "@/lib/engine";
import {kbQuotes} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {getEntryContext,type EntryContextRow} from "@/lib/entry-context";
import {ENTRY_MODEL_VERSION,ENTRY_WEIGHTS,preScreenScore,scoreEntry} from "@/lib/entry-rank";
import {liveMarketCode} from "@/lib/official-sectors";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const REQUIRED_TEST_SYMBOLS=["002380","009830","069260","006360","112610"];
type Market=Awaited<ReturnType<typeof calculateMarket>>;
type StockInput={name:string;price:number;changeRate:number|null;volume:number|null;history:number[]};

async function getMarket(){
 const cache=getCache({namespace:"arma-live"}),key="market:official:v3";
 const cached=await cache.get(key) as Market|undefined;
 if(cached)return cached;
 const market=await calculateMarket();
 await cache.set(key,market,{ttl:300,tags:["arma-live-market"],name:"ARMA LIVE 공식 A/M"});
 return market;
}

async function getInputs(rows:EntryContextRow[]){
 const cache=getCache({namespace:"arma-live"});
 const result=new Map<string,StockInput>();
 const cached=await Promise.all(rows.map(async row=>[row.symbol,await cache.get(`stock:v3:${row.symbol}`)] as const));
 for(const [symbol,value] of cached)if(value)result.set(symbol,value as StockInput);
 const missing=rows.filter(row=>!result.has(row.symbol));
 for(let i=0;i<missing.length;i+=20){
  const chunk=missing.slice(i,i+20),symbols=chunk.map(row=>row.symbol);
  const [quotes,histories]=await Promise.all([
   kbQuotes(symbols),
   Promise.all(chunk.map(async row=>{try{return[row.symbol,await yahooStockHistory(row.symbol,liveMarketCode(row.market))] as const}catch{return null}}))
  ]);
  const historyMap=new Map<string,number[]>();histories.forEach(row=>{if(row)historyMap.set(row[0],row[1])});
  await Promise.all(chunk.map(async row=>{
   const quote=quotes.get(row.symbol),history=historyMap.get(row.symbol);if(!quote?.price||!history)return;
   const value:StockInput={name:quote.name||row.name,price:quote.price,changeRate:quote.changeRate,volume:quote.volume,history};
   result.set(row.symbol,value);
   await cache.set(`stock:v3:${row.symbol}`,value,{ttl:300,tags:["arma-live-stock",`arma-live-stock:${row.symbol}`],name:row.name||row.symbol});
  }));
 }
 return result;
}

function referenceHistory(history:number[],officialClose:number){
 const values=[...history];
 if(values.length)values.pop();
 const last=values.at(-1);
 if(last&&Math.abs(last/officialClose-1)<=.006)values.pop();
 return values;
}

export async function GET(){
 try{
  const [context,market]=await Promise.all([getEntryContext(),getMarket()]);
  const usable=context.rows.filter(row=>row.isActive&&row.official?.arma!=null&&row.pullback);
  const active=usable.filter(row=>["WATCH","FAVORABLE"].includes(String(row.pullback?.state))).sort((a,b)=>preScreenScore(b)-preScreenScore(a));
  const none=usable.filter(row=>!(["WATCH","FAVORABLE"].includes(String(row.pullback?.state)))).sort((a,b)=>preScreenScore(b)-preScreenScore(a));
  const selected=new Map<string,EntryContextRow>();
  [...active.slice(0,125),...none.slice(0,35)].forEach(row=>selected.set(row.symbol,row));
  for(const symbol of REQUIRED_TEST_SYMBOLS){const row=usable.find(item=>item.symbol===symbol);if(row)selected.set(symbol,row)}
  const candidates=[...selected.values()];
  const inputs=await getInputs(candidates);
  const marketRiskOff=market.regime==="RISK_OFF"||market.calculationAScore<42||market.calculationMScore<42;
  const rows:any[]=[];
  for(const contextRow of candidates){
   const input=inputs.get(contextRow.symbol);if(!input)continue;
   try{
    const live=calculateStock(input.history,input.price,market.calculationAScore,market.calculationMScore);
    const officialClose=Number(contextRow.official?.close);
    let referenceTradePlan=null;
    if(Number.isFinite(officialClose)&&officialClose>0){
     const refHistory=referenceHistory(input.history,officialClose);
     if(refHistory.length>=60)referenceTradePlan=calculateStock(refHistory,officialClose,market.calculationAScore,market.calculationMScore).tradePlan;
    }
    const entry=scoreEntry({context:contextRow,live:{armaScore:live.armaScore,rScore:live.rScore,arScore:live.arScore,prs:live.prs},currentPrice:input.price,referenceTradePlan,marketRiskOff});
    rows.push({symbol:contextRow.symbol,name:input.name||contextRow.name,market:contextRow.market,sector:contextRow.sector,price:input.price,changeRate:input.changeRate,volume:input.volume,liveArma:live.armaScore,liveR:live.rScore,liveAr:live.arScore,livePrs:live.prs,liveAction:live.action,liveTradePlan:live.tradePlan,referenceTradePlan,officialArma:contextRow.official?.arma??null,officialR:contextRow.official?.r??null,officialPrs:contextRow.official?.prs??null,...entry});
   }catch{}
  }
  rows.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.entryRank-a.entryRank||b.liveArma-a.liveArma||a.livePrs-b.livePrs);
  const rankable=rows.filter(row=>row.eligible);
  const tests=Object.fromEntries(REQUIRED_TEST_SYMBOLS.map(symbol=>[symbol,rows.find(row=>row.symbol===symbol)??null]));
  return Response.json({ok:true,status:"SHADOW_LIVE_DECISION_SUPPORT",modelVersion:ENTRY_MODEL_VERSION,weights:ENTRY_WEIGHTS,tradeDate:context.tradeDate,asOf:new Date().toISOString(),universeCount:context.count,screenedCount:candidates.length,calculatedCount:rows.length,market:{aScore:market.aScore,mScore:market.mScore,regime:market.regime,marketRiskOff,source:market.inputs.source},top10:rankable.slice(0,10),top30:rankable.slice(0,30),tests,hardGated:rows.filter(row=>!row.eligible).slice(0,20),officialFormulaChanged:false,officialTablesTouched:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){console.error("[entry-ranking]",error);return Response.json({ok:false,message:error instanceof Error?error.message:"Entry ranking failed"},{status:500})}
}
