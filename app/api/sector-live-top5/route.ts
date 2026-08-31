import {getCache} from "@vercel/functions";
import {NextRequest} from "next/server";
import {calculateStock} from "@/lib/engine";
import {kbQuotes} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {STOCK_BY_SYMBOL} from "@/lib/stocks";
import {getOfficialSectorMembership,resolveOfficialSectorId} from "@/lib/official-sectors";

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
   Promise.all(chunk.map(async symbol=>{const stock=STOCK_BY_SYMBOL.get(symbol);if(!stock)return null;try{return[symbol,await yahooStockHistory(symbol,stock.market)] as const}catch{return null}}))
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
  const requested=(Array.isArray(body?.sectorIds)?body.sectorIds:[]).map((value:any)=>String(value)).filter(Boolean);
  const sectorIds=[...new Set(requested)].slice(0,5);
  if(!sectorIds.length)return Response.json({ok:false,message:"계산할 Official 섹터가 없습니다."},{status:400});

  const membership=await getOfficialSectorMembership();
  const sectors=sectorIds.flatMap(requestedId=>{
   const resolvedId=resolveOfficialSectorId(requestedId,membership);
   const sector=resolvedId?membership.byId.get(resolvedId):null;
   return sector?[sector]:[];
  });
  if(!sectors.length)return Response.json({ok:false,message:"ARMA Official 섹터 원장에서 계산 범위를 찾지 못했습니다."},{status:503});

  const cache=getCache({namespace:"arma-live"});
  const cachedResults=new Map<string,any>();
  const missingSectors=[] as typeof sectors;
  for(const sector of sectors){
   const cached=await cache.get(`sector-ranking:v5:${sector.id}`);
   if(cached)cachedResults.set(sector.id,{...(cached as object),cached:true});else missingSectors.push(sector);
  }

  if(missingSectors.length){
   const symbols=[...new Set(missingSectors.flatMap(sector=>sector.symbols))];
   const [market,inputs]=await Promise.all([getMarket(cache),getStockInputs(symbols,cache)]);
   for(const sector of missingSectors){
    const rows:RankingRow[]=[];
    for(const symbol of sector.symbols){
     const stock=STOCK_BY_SYMBOL.get(symbol),input=inputs.get(symbol),official=membership.bySymbol.get(symbol);
     if(!stock||!input)continue;
     try{rows.push({symbol,name:input.name||stock.name,sector:official?.sector??null,price:input.price,changeRate:input.changeRate,volume:input.volume,...calculateStock(input.history,input.price,market.calculationAScore,market.calculationMScore)})}catch{}
    }
    rows.sort((a,b)=>b.armaScore-a.armaScore||a.prs-b.prs);
    const result={ok:true,asOf:new Date().toISOString(),scope:"sector",sectorId:sector.id,sectorName:sector.name,candidateCount:sector.symbols.length,calculatedCount:rows.length,failedCount:sector.symbols.length-rows.length,aScore:market.aScore,mScore:market.mScore,regime:market.regime,marketSource:market.inputs.source,basisDate:market.inputs.tradeDate,fallback:market.fallback,provisional:true,sectorSource:"ARMA_OFFICIAL:arma_stocks.sector",top5:rows.slice(0,5)};
    await cache.set(`sector-ranking:v5:${sector.id}`,result,{ttl:300,tags:["arma-live-ranking",`arma-live-sector:${sector.id}`],name:`${sector.name} LIVE TOP5`});
    cachedResults.set(sector.id,{...result,cached:false});
   }
  }

  const results=sectorIds.map(id=>{
   const resolvedId=resolveOfficialSectorId(id,membership);
   return resolvedId?cachedResults.get(resolvedId)||{ok:false,sectorId:id,sectorName:id,top5:[],message:"LIVE 지원 종목을 계산하지 못했습니다."}:{ok:false,sectorId:id,sectorName:id,top5:[],message:"Official 섹터 원장과 매칭되지 않습니다."};
  });
  return Response.json({ok:true,asOf:new Date().toISOString(),sectorSource:"ARMA_OFFICIAL:arma_stocks.sector",results},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){console.error("[sector-live-top5]",e);const message=e instanceof Error?e.message:"섹터 LIVE TOP5 계산 실패";return Response.json({ok:false,message},{status:503})}
}
