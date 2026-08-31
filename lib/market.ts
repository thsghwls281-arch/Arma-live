import {round} from "./engine";

const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-arma9.vercel.app").replace(/\/$/,"");

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
 if(snapshot&&Number.isFinite(a)&&Number.isFinite(m))return{
  aScore:round(a),mScore:round(m),calculationAScore:round(a),calculationMScore:round(m),
  regime:snapshot.regime||((a>=60&&m>=60)?"RISK_ON":(a<=40&&m<=40)?"RISK_OFF":"NEUTRAL"),
  asOf:snapshot.collectedAt||snapshot.captured_at_kst||new Date().toISOString(),
  inputs:{source:"ARMA_MORNING",tradeDate:snapshot.tradeDate||payload.today||null,dataConfidence:snapshot.data_confidence??null},
  official:true,fallback:false
 };

 const latestResponse=await fetch(`${OFFICIAL_BASE}/api/arma/market`,{cache:"no-store",headers:{Accept:"application/json"}});
 if(!latestResponse.ok)throw new Error("최근 공식 ARMA 거래일 데이터를 불러오지 못했습니다.");
 const latest=await latestResponse.json(),official=latest?.officialRisk;
 const latestA=Number(official?.aScore),latestM=Number(official?.mScore);
 if(!official||!Number.isFinite(latestA)||!Number.isFinite(latestM))throw new Error("공식 Morning Snapshot 미수신 · A/M은 N/A입니다.");
 return{
  aScore:null,mScore:null,calculationAScore:round(latestA),calculationMScore:round(latestM),
  regime:(latestA>=60&&latestM>=60)?"RISK_ON":(latestA<=40&&latestM<=40)?"RISK_OFF":"NEUTRAL",
  asOf:official.collectedAt||official.tradeDate,
  inputs:{source:"LATEST_OFFICIAL_CLOSE",tradeDate:official.tradeDate||latest.marketDate||null,dataConfidence:null},
  official:true,fallback:true
 };
}

export async function yahooStockHistory(symbol:string,market:"KS"|"KQ"="KS"){
 return closes(`${symbol}.${market}`,"6mo");
}
