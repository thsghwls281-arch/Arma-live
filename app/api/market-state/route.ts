import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-arma9.vercel.app").replace(/\/$/,"");

function stateFromMorning(snapshot:any){
 const a=Number(snapshot?.a_score),m=Number(snapshot?.m_score);
 const regime=String(snapshot?.regime||((a>=60&&m>=60)?"RISK_ON":(a<=40&&m<=40)?"RISK_OFF":"NEUTRAL"));
 const aOverride=String(snapshot?.a_risk_override||"OFF");
 const mOverride=String(snapshot?.m_override||"OFF");
 const warning=aOverride==="ON"||mOverride==="ON";
 const watch=aOverride==="WATCH"||mOverride==="WATCH";
 if(warning)return{state:"RISK_ALERT",label:"위험 경고",tone:"red",text:`오늘 공식 Morning 기준 A ${a.toFixed(1)} · M ${m.toFixed(1)}. 위험 Override가 ON입니다.`};
 if(regime==="RISK_ON")return{state:"RISK_ON",label:"위험선호",tone:"green",text:`오늘 공식 Morning 기준 A ${a.toFixed(1)} · M ${m.toFixed(1)}. Risk-On 환경입니다.`};
 if(regime==="RISK_OFF")return{state:"RISK_OFF",label:"위험회피",tone:"red",text:`오늘 공식 Morning 기준 A ${a.toFixed(1)} · M ${m.toFixed(1)}. Risk-Off 환경입니다.`};
 if(watch)return{state:"NEUTRAL_WATCH",label:"중립 · 주의",tone:"orange",text:`오늘 공식 Morning 기준 A ${a.toFixed(1)} · M ${m.toFixed(1)}. 중립 환경이지만 Override WATCH가 있습니다.`};
 return{state:"NEUTRAL",label:"중립",tone:"yellow",text:`오늘 공식 Morning 기준 A ${a.toFixed(1)} · M ${m.toFixed(1)}. 중립 환경입니다.`};
}

export async function GET(){
 try{
  const morningResponse=await fetch(`${OFFICIAL_BASE}/api/market/morning`,{cache:"no-store",headers:{Accept:"application/json"}});
  const morning=await morningResponse.json().catch(()=>null);
  const snapshot=morningResponse.ok&&morning?.todayValid===true?morning?.todaySnapshot:null;
  const a=Number(snapshot?.a_score),m=Number(snapshot?.m_score);
  if(snapshot&&Number.isFinite(a)&&Number.isFinite(m)){
   return NextResponse.json({ok:true,...stateFromMorning(snapshot),tradeDate:snapshot.tradeDate||morning.today,collectedAt:snapshot.collectedAt||snapshot.captured_at_kst,aScore:a,mScore:m,regime:snapshot.regime??null,aRiskOverride:snapshot.a_risk_override??null,mOverride:snapshot.m_override??null,marketSource:"ARMA_MORNING",fallback:false},{headers:{"Cache-Control":"no-store"}});
  }

  const response=await fetch(`${OFFICIAL_BASE}/api/arma/market`,{cache:"no-store",headers:{Accept:"application/json"}});
  const json=await response.json();
  if(!response.ok||!json?.ok)throw new Error(json?.message||"공식 ARMA 시장 상태를 불러오지 못했습니다.");
  const official=json.officialRisk;
  if(!official)return NextResponse.json({ok:false,state:"UNKNOWN",label:"데이터 확인 중",tone:"slate",text:"공식 ARMA 시장 스냅샷이 아직 준비되지 않았습니다."},{status:503});
  return NextResponse.json({ok:true,state:"LATEST_CLOSE",label:"최근 거래일 기준",tone:"slate",text:"당일 공식 Morning Snapshot이 없어 A/M은 N/A이며, 나머지 정보는 최근 공식 거래일 데이터를 기준으로 표시합니다.",tradeDate:official.tradeDate,collectedAt:official.collectedAt,aScore:null,mScore:null,marketSource:"LATEST_OFFICIAL_CLOSE",fallback:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,state:"UNKNOWN",label:"데이터 확인 중",tone:"slate",text:"공식 ARMA 시장 상태 연결을 확인하고 있습니다.",message:error instanceof Error?error.message:"Unknown error"},{status:503});
 }
}
