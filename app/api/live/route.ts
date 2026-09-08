import {NextRequest} from "next/server";
import {kbQuote} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {calculateStock} from "@/lib/engine";
import {STOCK_BY_SYMBOL} from "@/lib/stocks";
import {getOfficialSectorMembership,liveMarketCode} from "@/lib/official-sectors";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const symbol=(req.nextUrl.searchParams.get("symbol")||"").trim();
 if(!/^\d{6}$/.test(symbol))return Response.json({ok:false,message:"지원하는 종목명 또는 6자리 종목코드를 입력하세요."},{status:400});
 try{
  const membership=await getOfficialSectorMembership().catch(()=>null);
  const officialStock=membership?.bySymbol.get(symbol)??null;
  const fallback=STOCK_BY_SYMBOL.get(symbol)??null;
  const stock=officialStock??fallback;
  if(!stock)return Response.json({ok:false,message:"활성 ARMA Universe에 없는 종목입니다."},{status:404});
  const marketCode=officialStock?liveMarketCode(officialStock.market):fallback!.market;
  const [quote,market,history]=await Promise.all([
   kbQuote(symbol),
   calculateMarket(),
   yahooStockHistory(symbol,marketCode)
  ]);
  if(!quote.price)throw new Error("현재가가 없습니다.");
  const sector=officialStock?.sector??null;
  return Response.json({ok:true,symbol,...quote,name:quote.name||stock.name,market:marketCode,sector,sectorSource:officialStock?"ARMA_OFFICIAL:arma_stocks.is_active":"STATIC_FALLBACK",sectorStatus:sector?"OFFICIAL":membership?"N/A":"UNAVAILABLE",...market,...calculateStock(history,quote.price,market.calculationAScore,market.calculationMScore),live:true,provisional:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){const message=e instanceof Error?e.message:"계산 실패";const morning=message.includes("Morning Snapshot");return Response.json({ok:false,message,aScore:morning?null:undefined,mScore:morning?null:undefined,marketSource:morning?"ARMA_MORNING":undefined},{status:morning?503:500})}
}
