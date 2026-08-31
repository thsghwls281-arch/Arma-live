import {getOfficialSectorMembership} from "@/lib/official-sectors";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
 try{
  const membership=await getOfficialSectorMembership();
  return Response.json({ok:true,source:membership.source,count:membership.stocks.length,sectors:membership.sectors,stocks:membership.stocks},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return Response.json({ok:false,message:error instanceof Error?error.message:"Official 섹터 원장 조회 실패"},{status:502,headers:{"Cache-Control":"private, no-store"}})}
}
