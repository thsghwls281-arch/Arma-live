import {NextRequest} from "next/server";
import {kbQuote} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {calculateStock} from "@/lib/engine";
import {STOCK_BY_SYMBOL} from "@/lib/stocks";
import {getOfficialSectorMembership} from "@/lib/official-sectors";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const symbol=(req.nextUrl.searchParams.get("symbol")||"").trim();
 const stock=STOCK_BY_SYMBOL.get(symbol);
 if(!stock)return Response.json({ok:false,message:"지원하는 종목명 또는 6자리 종목코드를 입력하세요."},{status:400});
 try{
  const [quote,market,history,sectorResult]=await Promise.all([
   kbQuote(symbol),
   calculateMarket(),
   yahooStockHistory(symbol,stock.market),
   getOfficialSectorMembership().then(value=>({ok:true as const,value})).catch(error=>({ok:false as const,error}))
  ]);
  if(!quote.price)throw new Error("현재가가 없습니다.");
  const officialStock=sectorResult.ok?sectorResult.value.bySymbol.get(symbol):null;
  const sector=officialStock?.sector??null;
  return Response.json({ok:true,symbol,...quote,name:quote.name||stock.name,sector,sectorSource:"ARMA_OFFICIAL:arma_stocks.sector",sectorStatus:sector?"OFFICIAL":sectorResult.ok?"N/A":"UNAVAILABLE",...market,...calculateStock(history,quote.price,market.calculationAScore,market.calculationMScore),live:true,provisional:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){const message=e instanceof Error?e.message:"계산 실패";const morning=message.includes("Morning Snapshot");return Response.json({ok:false,message,aScore:morning?null:undefined,mScore:morning?null:undefined,marketSource:morning?"ARMA_MORNING":undefined},{status:morning?503:500})}
}
