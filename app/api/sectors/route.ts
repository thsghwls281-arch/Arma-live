import {NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const OFFICIAL_BASE=(process.env.ARMA_OFFICIAL_URL||"https://arma2-arma9.vercel.app").replace(/\/$/,"");

export async function GET(){
 try{
  const response=await fetch(`${OFFICIAL_BASE}/api/arma/sectors`,{cache:"no-store"});
  const json=await response.json();
  if(!response.ok||!json?.ok)throw new Error(json?.message||"공식 ARMA 섹터 상태를 불러오지 못했습니다.");
  return NextResponse.json(json,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,tradeDate:null,count:0,sectors:[],status:"UNAVAILABLE",message:error instanceof Error?error.message:"Unknown error"},{status:503})}
}
