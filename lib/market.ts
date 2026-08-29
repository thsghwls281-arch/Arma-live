import {round} from "./engine";

const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-iota.vercel.app").replace(/\/$/,"");

async function closes(symbol:string,range="3mo"){
 const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
 const r=await fetch(u,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"}});
 if(!r.ok)throw new Error(`market data ${symbol}`);
 const j=await r.json(),q=j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close||[];
 return q.map(Number).filter(Number.isFinite);
}

export async function calculateMarket(){
 const response=await fetch(`${OFFICIAL_BASE}/api/market/morning`,{cache:"no-store",headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("공식 Morning Snapshot을 불러오지 못했습니다.");
 const payload=await response.json();
 const snapshot=payload?.todayValid===true?payload?.todaySnapshot:null;
 const a=Number(snapshot?.a_score),m=Number(snapshot?.m_score);
 if(!snapshot||!Number.isFinite(a)||!Number.isFinite(m))throw new Error("공식 Morning Snapshot 미수신 · A/M은 N/A입니다.");
 return{
  aScore:round(a),
  mScore:round(m),
  regime:snapshot.regime||((a>=58&&m>=58)?"RISK_ON":(a<42||m<42)?"RISK_OFF":"NEUTRAL"),
  asOf:snapshot.collectedAt||snapshot.captured_at_kst||new Date().toISOString(),
  inputs:{source:"ARMA_MORNING",tradeDate:snapshot.tradeDate||payload.today||null,dataConfidence:snapshot.data_confidence??null},
  official:true
 };
}

export async function yahooStockHistory(symbol:string,market:"KS"|"KQ"="KS"){
 return closes(`${symbol}.${market}`,"6mo");
}
