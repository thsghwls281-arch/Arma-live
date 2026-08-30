"use client";

import {useEffect,useMemo,useState} from "react";
import {HelpTip,MetricLabel} from "@/components/help";

const flowArrow=(n:number|null|undefined)=>Number(n)>2?"↑":Number(n)<-2?"↓":"→";
const toneClass=(tone:string)=>tone==="green"?"bg-emerald-500":tone==="yellow"?"bg-amber-400":tone==="orange"?"bg-orange-500":tone==="red"?"bg-red-600":"bg-slate-400";
const SECTOR_RANK_HISTORY_KEY="arma-live-sector-rank-history:v1";

type RankHistory={tradeDate:string;ranks:Record<string,number>};

function RankChange({current,previous}:{current:number;previous?:number}){
 if(previous==null)return <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-400">—</span>;
 const change=previous-current;
 if(change===0)return <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">유지</span>;
 return <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${change>0?"bg-red-50 text-red-600":"bg-blue-50 text-blue-600"}`}>{change>0?"▲":"▼"} {Math.abs(change)}</span>
}

export function SectorOverview(){
 const [data,setData]=useState<any>(null),[open,setOpen]=useState(false),[previousRanks,setPreviousRanks]=useState<Record<string,number>>({});
 useEffect(()=>{let active=true;fetch("/api/sectors",{cache:"no-store"}).then(async r=>await r.json()).then(j=>{if(active)setData(j)}).catch(()=>{if(active)setData({ok:false,sectors:[]})});return()=>{active=false}},[]);
 const sectors=useMemo(()=>Array.isArray(data?.sectors)?data.sectors.slice(0,6):[],[data]);
 useEffect(()=>{
  if(!data?.tradeDate||!Array.isArray(data?.sectors)||!data.sectors.length)return;
  const tradeDate=String(data.tradeDate).slice(0,10);
  const currentRanks=Object.fromEntries(data.sectors.map((sector:any,index:number)=>[String(sector.sector),index+1]));
  try{
   const saved=localStorage.getItem(SECTOR_RANK_HISTORY_KEY);
   const history:RankHistory[]=saved?JSON.parse(saved):[];
   const prior=history.filter(item=>item.tradeDate<tradeDate).sort((a,b)=>b.tradeDate.localeCompare(a.tradeDate))[0];
   setPreviousRanks(prior?.ranks||{});
   const next=[...history.filter(item=>item.tradeDate!==tradeDate),{tradeDate,ranks:currentRanks}].sort((a,b)=>b.tradeDate.localeCompare(a.tradeDate)).slice(0,10);
   localStorage.setItem(SECTOR_RANK_HISTORY_KEY,JSON.stringify(next));
  }catch{setPreviousRanks({})}
 },[data]);
 if(!data)return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-400">섹터 상태 불러오는 중...</section>;
 if(!sectors.length)return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><p className="flex items-center text-xs font-black text-blue-600">섹터 순환<HelpTip code="SECTOR"/></p><h2 className="text-lg font-black">섹터 신호 준비 중</h2></div></div><p className="mt-2 text-xs font-bold text-slate-400">공식 ARMA 섹터 스냅샷이 적재되면 여기에 표시됩니다.</p></section>;
 return <section className="mt-4">
  <div className="rounded-[28px] bg-slate-900 p-6 text-white shadow-xl sm:p-8"><div className="flex items-end justify-between gap-4"><div><p className="flex items-center text-xs font-black tracking-[.18em] text-sky-400">ARMA OFFICIAL · SECTOR ROTATION<HelpTip code="SECTOR"/></p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">섹터 로테이션</h2><p className="mt-2 text-sm font-bold text-slate-400">공식 종가 스냅샷 · {String(data.tradeDate||"").slice(0,10)}</p></div><button onClick={()=>setOpen(v=>!v)} className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-slate-300">{open?"TOP 6":"전체 보기"}</button></div></div>
  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(open?data.sectors:sectors).map((s:any,index:number)=>{const rank=index+1;const score=Number(s.sector_score);return <article key={s.sector} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><div className="flex justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Sector {String(rank).padStart(2,"0")}</p><RankChange current={rank} previous={previousRanks[String(s.sector)]}/></div><h3 className="mt-2 truncate text-lg font-black group-hover:text-blue-600">{s.sector}</h3><p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${toneClass(String(s.tone||""))}`}/>{s.status_label}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">SECTOR SCORE</p><p className="mt-1 text-3xl font-black text-blue-600">{score.toFixed(1)}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400" style={{width:`${Math.min(100,Math.max(0,score))}%`}}/></div><div className="mt-4 grid grid-cols-4 gap-1 text-center"><Mini code="SLS" label="섹터" value={s.sls}/><Mini code="R" label="추세" value={s.r_score}/><Mini code="BREADTH" label="확산" value={`${Number(s.breadth).toFixed(0)}%`}/><Mini code="ROTATION5D" label="5일" value={`${Number(s.rotation_5d)>0?"+":""}${Number(s.rotation_5d).toFixed(1)}`}/></div><p className="mt-3 text-[11px] font-bold text-slate-400">외국인 {flowArrow(s.foreign_net_buy)} · 기관 {flowArrow(s.institution_net_buy)} · 위험경고 {Number(s.prs).toFixed(0)}</p></article>})}</div>
  <p className="mt-3 flex items-center text-[11px] font-bold text-slate-400">섹터 종합점수는 참고 지표이며 개별 종목 행동판단을 직접 변경하지 않습니다.<HelpTip code="SLS"/></p>
 </section>
}
function Mini({code,label,value}:{code:string;label:string;value:any}){return <div className="rounded-xl bg-white px-1 py-2"><span className="flex items-center justify-center text-[9px] font-black text-slate-400"><MetricLabel code={code} label={label}/></span><b className="block text-xs">{value==null?"—":typeof value==="number"?value.toFixed(0):value}</b></div>}
