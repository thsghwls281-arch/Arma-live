import {avg,clamp,pct,round,volatility} from "./engine";
async function closes(symbol:string,range="3mo"){const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;const r=await fetch(u,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"}});if(!r.ok)throw new Error(`market data ${symbol}`);const j=await r.json(),q=j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close||[];return q.map(Number).filter(Number.isFinite)}
const score=(x:number,scale:number)=>clamp(50+45*Math.tanh(x/scale));
export async function calculateMarket(){const syms=["^GSPC","^IXIC","^SOX","EWY","^VIX","DX-Y.NYB","^TNX","KRW=X","^KS11"];const [sp,nas,sox,ewy,vix,dxy,tnx,krw,kospi]=await Promise.all(syms.map(s=>closes(s)));
 const r1=(c:number[])=>pct(c.at(-1)!,c.at(-2)!),r5=(c:number[])=>pct(c.at(-1)!,c.at(-6)!);
 const a=round(clamp(score(r1(sp),1)*.08+score(r1(nas),1.2)*.07+score(r1(sox),1.6)*.10+score(r1(ewy),1.3)*.20+score(-r1(krw),.8)*.12+score(-r1(dxy),.6)*.08+score(-r1(vix),5)*.15+score(-r1(tnx),1.3)*.10+score(r5(ewy)-r5(sp),2)*.10));
 const k20=pct(kospi.at(-1)!,kospi.at(-21)!),k5=r5(kospi),ma20=avg(kospi.slice(-20)),dist=pct(kospi.at(-1)!,ma20),vol=volatility(kospi);
 const m=round(clamp(score(k5,3)*.25+score(k20,7)*.25+score(dist,3)*.15+score(-vol+1.5,1)*.15+a*.20));
 return{aScore:a,mScore:m,regime:a>=58&&m>=58?"RISK_ON":a<42||m<42?"RISK_OFF":"NEUTRAL",asOf:new Date().toISOString(),inputs:{sp500:r1(sp),nasdaq:r1(nas),sox:r1(sox),ewy:r1(ewy),vix:r1(vix),usdkrw:r1(krw),kospi5:k5,kospi20:k20}};
}
export async function yahooStockHistory(symbol:string,market:"KS"|"KQ"="KS"){return closes(`${symbol}.${market}`,"6mo")}
