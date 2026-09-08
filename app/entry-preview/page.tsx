"use client";

import {useEffect,useState} from "react";

const won=(value:number)=>new Intl.NumberFormat("ko-KR").format(value)+"원";

export default function EntryPreviewPage(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 async function load(){setBusy(true);setError("");try{const response=await fetch("/api/entry-ranking",{cache:"no-store"});const json=await response.json();if(!response.ok||!json.ok)throw new Error(json.message||"Entry Rank 조회 실패");setData(json)}catch(e){setError(e instanceof Error?e.message:"Entry Rank 조회 실패")}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 return <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-4 py-8 text-slate-900">
  <header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-black tracking-widest text-blue-400">SHADOW / LIVE DECISION SUPPORT</p><h1 className="mt-2 text-3xl font-black">Entry Rank 1.0 Preview</h1><p className="mt-2 text-sm text-slate-300">Pullback Setup → Trigger → ARMA Quality/Veto → Flow/Sector → LIVE Price/RR</p><p className="mt-2 text-xs font-bold text-amber-300">OFFICIAL ARMA 산식·테이블 변경 없음</p></header>
  <div className="mt-4 flex items-center justify-between"><div className="text-sm font-bold text-slate-500">{data?`${data.tradeDate} 기준 · ${data.universeCount}개 active universe · ${data.calculatedCount}개 LIVE 계산`:"Preview 데이터 로딩"}</div><button onClick={load} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy?"계산 중":"다시 계산"}</button></div>
  {error&&<p className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
  {data&&<>
   <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><p className="text-xs font-black text-blue-600">신규매수 TOP10 · Pullback Entry 1.0</p><h2 className="text-2xl font-black">지금 들어가기 좋은 종목 순위</h2><p className="mt-1 text-xs font-bold text-slate-400">Entry Rank와 Action은 분리됩니다. 높은 순위여도 가격 부담이 있으면 ‘눌림 시 매수’가 될 수 있습니다.</p></div><div className="divide-y divide-slate-100">{(data.top10||[]).map((row:any,index:number)=><EntryRow key={row.symbol} row={row} rank={index+1}/>)}</div></section>
   <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-blue-600">필수 검증 5종목</p><h2 className="text-xl font-black">KCC · 한화솔루션 · TKG휴켐스 · GS건설 · 씨에스윈드</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.entries(data.tests||{}).map(([symbol,row]:any)=><div key={symbol} className="rounded-2xl border border-slate-200 p-4">{row?<EntryRow row={row} compact/>:<p className="font-bold text-slate-400">{symbol} 계산 불가</p>}</div>)}</div></section>
  </>}
 </main>
}

function EntryRow({row,rank,compact=false}:{row:any;rank?:number;compact?:boolean}){return <div className={compact?"":"p-4"}><div className="flex items-start gap-3"><div className="w-8 shrink-0 text-xl font-black text-blue-600">{rank??""}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><b className="text-lg">{row.name}</b><span className="text-xs font-bold text-slate-400">{row.symbol} · {row.sector||"N/A"}</span><b className="ml-auto text-xl text-blue-600">{row.entryRank}</b></div><div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-600"><span>{won(row.price)}</span><span>ARMA {row.liveArma}</span><span>Pullback {row.pullbackTotalScore??"N/A"} / {row.pullbackState}</span><span>PRS {row.livePrs}</span><span>Sector {row.sectorStatus??"N/A"}</span></div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.action}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Ozawa {row.ozawaStatus}</span><span className="text-xs font-bold text-slate-400">Confidence {row.confidence}</span></div>{!compact&&<ul className="mt-2 text-xs font-medium text-slate-500">{(row.reasons||[]).slice(0,5).map((reason:string)=><li key={reason}>• {reason}</li>)}</ul>}{row.hardGates?.length>0&&<p className="mt-2 text-xs font-black text-red-600">VETO: {row.hardGates.join(", ")}</p>}</div></div></div>}
