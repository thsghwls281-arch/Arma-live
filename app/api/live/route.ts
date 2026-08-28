import {NextRequest} from "next/server";
import {kbQuote} from "@/lib/kb";
import {calculateMarket,yahooStockHistory} from "@/lib/market";
import {calculateStock} from "@/lib/engine";
import {STOCK_BY_SYMBOL} from "@/lib/stocks";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const symbol=(req.nextUrl.searchParams.get("symbol")||"").trim();
 const stock=STOCK_BY_SYMBOL.get(symbol);
 if(!stock)return Response.json({ok:false,message:"지원하는 종목명 또는 6자리 종목코드를 입력하세요."},{status:400});
 try{
  const [quote,market,history]=await Promise.all([kbQuote(symbol),calculateMarket(),yahooStockHistory(symbol,stock.market)]);
  if(!quote.price)throw new Error("현재가가 없습니다.");
  return Response.json({ok:true,symbol,...quote,name:quote.name||stock.name,sector:stock.sector,...market,...calculateStock(history,quote.price,market.aScore,market.mScore),live:true,provisional:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return Response.json({ok:false,message:e instanceof Error?e.message:"계산 실패"},{status:500})}
}
