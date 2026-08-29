import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-iota.vercel.app").replace(/\/$/,"");

export async function GET(){
 try{
  const response=await fetch(`${OFFICIAL_BASE}/api/arma/market`,{cache:"no-store"});
  const json=await response.json();
  if(!response.ok||!json?.ok)throw new Error(json?.message||"공식 ARMA 시장 상태를 불러오지 못했습니다.");
  const official=json.officialRisk;
  if(!official)return NextResponse.json({ok:false,state:"UNKNOWN",label:"데이터 확인 중",tone:"slate",text:"공식 ARMA 시장 스냅샷이 아직 준비되지 않았습니다."},{status:503});
  const risk=official.risk;
  if(!risk)return NextResponse.json({ok:true,state:"LATEST_CLOSE",label:"최근 거래일 기준",tone:"slate",text:"당일 A/M은 N/A이며, 나머지 정보는 최근 공식 거래일 데이터를 기준으로 표시합니다.",tradeDate:official.tradeDate,collectedAt:official.collectedAt,aScore:null,mScore:null,fallback:true},{headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({ok:true,...risk,tradeDate:official.tradeDate,collectedAt:official.collectedAt,snapshotMeta:official.snapshotMeta},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,state:"UNKNOWN",label:"데이터 확인 중",tone:"slate",text:"공식 ARMA 시장 상태 연결을 확인하고 있습니다.",message:error instanceof Error?error.message:"Unknown error"},{status:503});
 }
}
