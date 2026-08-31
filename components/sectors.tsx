"use client";

import {useEffect,useMemo,useState} from "react";
import {HelpTip,MetricLabel} from "@/components/help";

const flowArrow=(n:number|null|undefined)=>Number(n)>2?"↑":Number(n)<-2?"↓":"→";
const toneClass=(tone:string)=>tone==="green"?"bg-emerald-500":tone==="yellow"?"bg-amber-400":tone==="orange"?"bg-orange-500":tone==="red"?"bg-red-600":"bg-slate-400";
const won=(n:number)=>new Intl.NumberFormat("ko-KR").format(n)+"원";
const SECTOR_RANK_HISTORY_KEY="arma-live-sector-rank-history:v1";

type RankHistory={tradeDate:string;ranks:Record<string,number>};

function RankChange({current,previous}:{current:number;previous?:number}){
 if(previous==null)return <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-400">—</span>;
 const change=previous-current;
 if(change===0)return <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">유지</span>;
 return <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${change>0?"bg-red-50 text-red-600":"bg-blue-50 text-blue-600"}`}>{change>0?"▲":"▼"} {Math.abs(change)}</span>
}

export function SectorOverview({onOpen}:{onOpen?:(symbol:string)=>void}){
 const [data,setData]=useState<any>(null),[open,setOpen]=useState(false),[previousRanks,setPreviousRanks]=useState<Record<string,number>>({});
 const [liveBySector,setLiveBySector]=useState<Record<string,any>>({}),[liveBusy,setLiveBusy]=useState(false),[liveError,setLiveError]=useState("");
 useEffect(()=>{let active=true;fetch("/api/sectors",{cache:"no-store"}).then(async r=>await r.json()).then(j=>{if(active)setData(j)}).catch(()=>{if(active)setData({ok:false,sectors:[]})});return()=>{active=false}},[]);
 const sectors=useMemo(()=>Array.isArray(data?.sectors)?data.sectors.slice(0,5):[],[data]);
 const topSectorIds=useMemo(()=>sectors.map((sector:any)=>String(sector.sector)),[sectors]);
 useEffect(()=>{
  if(!topSectorIds.length){setLiveBySector({});setLiveError("");return}
  let cancelled=false;
  async function loadLiveTop5(){
   setLiveBusy(true);setLiveError("");
   try{
    const response=await fetch("/api/sector-live-top5",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sectorIds:topSectorIds}),cache:"no-store"});
    const json=await response.json();
    if(!response.ok||!json?.ok)throw new Error(json?.message||"LIVE TOP5를 불러오지 못했습니다.");
    if(cancelled)return;
    const next:Record<string,any>={};
    for(const result of Array.isArray(json.results)?json.results:[])next[String(result.sectorId)]=result;
    setLiveBySector(next);
   }catch(error){if(!cancelled){setLiveBySector({});setLiveError(error instanceof Error?error.message:"LIVE TOP5를 불러오지 못했습니다.")}}
   finally{if(!cancelled)setLiveBusy(false)}
  }
  loadLiveTop5();return()=>{cancelled=true}
 },[topSectorIds.join("|")]);
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
  <div className="rounded-[28px] bg-slate-900 p-6 text-white shadow-xl sm:p-8"><div className="flex items-end justify-between gap-4"><div><p className="flex items-center text-xs font-black tracking-[.18em] text-sky-400">ARMA OFFICIAL · SECTOR ROTATION<HelpTip code="SECTOR"/></p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">섹터 로테이션 TOP5</h2><p className="mt-2 text-sm font-bold text-slate-400">위: 공식 종가 섹터 · 아래: KB 현재가 LIVE 종목 TOP5 · {String(data.tradeDate||"").slice(0,10)}</p></div><button onClick={()=>setOpen(v=>!v)} className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-slate-300">{open?"TOP5":"전체 보기"}</button></div></div>
  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(open?data.sectors:sectors).map((s:any,index:number)=>{const rank=index+1;const score=Number(s.sector_score);const sectorId=String(s.sector);const live=rank<=5?liveBySector[sectorId]:null;return <article key={s.sector} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><div className="flex justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Sector {String(rank).padStart(2,"0")}</p><RankChange current={rank} previous={previousRanks[sectorId]}/></div><h3 className="mt-2 truncate text-lg font-black group-hover:text-blue-600">{s.sector}</h3><p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${toneClass(String(s.tone||""))}`}/>{s.status_label}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">SECTOR SCORE</p><p className="mt-1 text-3xl font-black text-blue-600">{score.toFixed(1)}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-400" style={{width:`${Math.min(100,Math.max(0,score))}%`}}/></div><div className="mt-4 grid grid-cols-4 gap-1 text-center"><Mini code="SLS" label="섹터" value={s.sls}/><Mini code="R" label="추세" value={s.r_score}/><Mini code="BREADTH" label="확산" value={`${Number(s.breadth).toFixed(0)}%`}/><Mini code="ROTATION5D" label="5일" value={`${Number(s.rotation_5d)>0?"+":""}${Number(s.rotation_5d).toFixed(1)}`}/></div><p className="mt-3 text-[11px] font-bold text-slate-400">외국인 {flowArrow(s.foreign_net_buy)} · 기관 {flowArrow(s.institution_net_buy)} · 위험경고 {Number(s.prs).toFixed(0)}</p>{rank<=5&&<div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black tracking-[.14em] text-blue-600">LIVE TOP5 · KB 현재가</p><p className="mt-0.5 text-[10px] font-bold text-slate-400">Official arma_stocks.sector 소속 종목</p></div>{live?.asOf&&<span className="text-[10px] font-bold text-slate-400">{new Date(live.asOf).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}</span>}</div>{liveBusy&&!live?<p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400">LIVE TOP5 계산 중...</p>:liveError&&!live?<p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400">LIVE TOP5 일시 미수신</p>:live?.ok===false?<p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400">{live.message||"LIVE TOP5 미수신"}</p>:Array.isArray(live?.top5)&&live.top5.length?<div className="mt-2 space-y-1.5">{live.top5.map((stock:any,stockIndex:number)=><button key={stock.symbol} onClick={()=>onOpen?.(stock.symbol)} className="grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-left transition hover:bg-blue-50"><b className="text-xs text-blue-600">{stockIndex+1}</b><span className="min-w-0"><b className="block truncate text-xs text-slate-800">{stock.name}</b><small className="block truncate text-[10px] font-bold text-slate-400">{won(Number(stock.price))} · {stock.action}</small></span><b className="text-sm text-blue-600">{stock.armaScore}</b></button>)}</div>:<p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400">계산 가능한 LIVE 종목이 없습니다.</p>}</div>}{rank>5&&open&&<p className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-400">LIVE TOP5는 공식 섹터 상위 5개만 자동 계산합니다.</p>}</article>})}</div>
  <p className="mt-3 flex items-center text-[11px] font-bold text-slate-400">OFFICIAL 섹터 점수와 LIVE 종목 점수는 기준 시점이 다릅니다. 섹터 종합점수는 개별 종목 행동판단을 직접 변경하지 않습니다.<HelpTip code="SLS"/></p>
 </section>
}
function Mini({code,label,value}:{code:string;label:string;value:any}){return <div className="rounded-xl bg-white px-1 py-2"><span className="flex items-center justify-center text-[9px] font-black text-slate-400"><MetricLabel code={code} label={label}/></span><b className="block text-xs">{value==null?"—":typeof value==="number"?value.toFixed(0):value}</b></div>}
