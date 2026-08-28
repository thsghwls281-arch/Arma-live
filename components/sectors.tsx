"use client";

import {useEffect,useMemo,useState} from "react";
import {HelpTip} from "@/components/help";

const flowArrow=(n:number|null|undefined)=>Number(n)>2?"↑":Number(n)<-2?"↓":"→";
const toneClass=(tone:string)=>tone==="green"?"bg-emerald-500":tone==="yellow"?"bg-amber-400":tone==="orange"?"bg-orange-500":tone==="red"?"bg-red-600":"bg-slate-400";

export function SectorOverview(){
 const [data,setData]=useState<any>(null),[open,setOpen]=useState(false);
 useEffect(()=>{let active=true;fetch("/api/sectors",{cache:"no-store"}).then(async r=>await r.json()).then(j=>{if(active)setData(j)}).catch(()=>{if(active)setData({ok:false,sectors:[]})});return()=>{active=false}},[]);
 const sectors=useMemo(()=>Array.isArray(data?.sectors)?data.sectors.slice(0,6):[],[data]);
 if(!data)return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-400">섹터 상태 불러오는 중...</section>;
 if(!sectors.length)return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-blue-600">SECTOR ROTATION</p><h2 className="text-lg font-black">섹터 신호 준비 중</h2></div></div><p className="mt-2 text-xs font-bold text-slate-400">공식 ARMA 섹터 스냅샷이 적재되면 여기에 표시됩니다.</p></section>;
 return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-blue-600">SECTOR ROTATION</p><h2 className="text-xl font-black">섹터 강도 TOP {Math.min(6,sectors.length)}</h2><p className="mt-1 text-xs font-bold text-slate-400">공식 ARMA 종가 스냅샷 · {String(data.tradeDate||"").slice(0,10)}</p></div><button onClick={()=>setOpen(v=>!v)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500">{open?"간단히":"전체 보기"}</button></div>
  <div className="mt-3 grid gap-2 md:grid-cols-2">{(open?data.sectors:sectors).map((s:any)=><article key={s.sector} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClass(String(s.tone||""))}`}/><b className="truncate">{s.sector}</b><span className="text-[10px] font-black text-slate-400">{s.status_label}</span></div><b className="text-xl text-blue-600">{Number(s.sector_score).toFixed(1)}</b></div><div className="mt-2 grid grid-cols-4 gap-1 text-center"><Mini label="SLS" value={s.sls}/><Mini label="R" value={s.r_score}/><Mini label="확산" value={`${Number(s.breadth).toFixed(0)}%`}/><Mini label="5D" value={`${Number(s.rotation_5d)>0?"+":""}${Number(s.rotation_5d).toFixed(1)}`}/></div><p className="mt-2 text-[11px] font-bold text-slate-400">외국인 {flowArrow(s.foreign_net_buy)} · 기관 {flowArrow(s.institution_net_buy)} · 위험 {Number(s.prs).toFixed(0)}</p></article>)}</div>
  <p className="mt-3 flex items-center text-[11px] font-bold text-slate-400">Sector Score는 현재 참고 지표이며 개별 종목 Action을 직접 변경하지 않습니다.<HelpTip code="SLS"/></p>
 </section>
}
function Mini({label,value}:{label:string;value:any}){return <div className="rounded-xl bg-white px-1 py-2"><span className="block text-[9px] font-black text-slate-400">{label}</span><b className="block text-xs">{value==null?"—":typeof value==="number"?value.toFixed(0):value}</b></div>}
