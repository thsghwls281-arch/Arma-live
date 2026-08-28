"use client";

import {useMemo,useState} from "react";
import {DEFAULT_CANDIDATES,STOCKS,STOCK_BY_SYMBOL} from "@/lib/stocks";

const won=(n:number)=>new Intl.NumberFormat("ko-KR").format(n)+"원";
const matchStocks=(query:string)=>{const value=query.trim().toLowerCase();if(!value)return[];return STOCKS.filter(stock=>stock.symbol.includes(value)||stock.name.toLowerCase().includes(value)).slice(0,8)};

export default function Live(){
 const [mode,setMode]=useState<"single"|"ranking">("single");
 const [q,setQ]=useState("삼성SDI"),[d,setD]=useState<any>(null),[busy,setBusy]=useState(false),[err,setErr]=useState("");
 const [candidates,setCandidates]=useState(DEFAULT_CANDIDATES),[candidateQuery,setCandidateQuery]=useState(""),[ranking,setRanking]=useState<any>(null),[rankingBusy,setRankingBusy]=useState(false),[rankingError,setRankingError]=useState("");
 const singleMatches=useMemo(()=>matchStocks(q),[q]);
 const candidateMatches=useMemo(()=>matchStocks(candidateQuery).filter(stock=>!candidates.includes(stock.symbol)),[candidateQuery,candidates]);

 async function run(){
  const exact=STOCKS.find(stock=>stock.symbol===q.trim()||stock.name.toLowerCase()===q.trim().toLowerCase())||singleMatches[0];
  if(!exact){setErr("종목명 또는 6자리 종목코드를 확인하세요.");return}
  setQ(exact.name);setBusy(true);setErr("");setD(null);
  try{const r=await fetch(`/api/live?symbol=${exact.symbol}`,{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.message);setD(j)}catch(e){setErr(e instanceof Error?e.message:"오류")}finally{setBusy(false)}
 }
 async function runRanking(){
  if(!candidates.length)return;setRankingBusy(true);setRankingError("");setRanking(null);
  try{const r=await fetch("/api/ranking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbols:candidates})}),j=await r.json();if(!r.ok)throw new Error(j.message);setRanking(j)}catch(e){setRankingError(e instanceof Error?e.message:"랭킹 계산 실패")}finally{setRankingBusy(false)}
 }
 function addCandidate(symbol:string){if(candidates.length>=20){setRankingError("후보 종목은 최대 20개입니다.");return}setCandidates(current=>[...current,symbol]);setCandidateQuery("");setRanking(null);setRankingError("")}
 function removeCandidate(symbol:string){setCandidates(current=>current.filter(item=>item!==symbol));setRanking(null)}

 return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
  <header><div className="text-xs font-black tracking-widest text-blue-600">INDEPENDENT · NO DATABASE</div><h1 className="mt-2 text-4xl font-black">ARMA LIVE</h1><p className="mt-2 text-sm text-slate-500">KB 현재가 기준 단일 종목과 후보 20종목의 LIVE TOP5를 계산합니다.</p></header>
  <nav className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-200 p-1"><button className={`rounded-xl py-3 font-black ${mode==="single"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`} onClick={()=>setMode("single")}>단일 종목</button><button className={`rounded-xl py-3 font-black ${mode==="ranking"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`} onClick={()=>setMode("ranking")}>LIVE TOP5</button></nav>

  {mode==="single"?<>
   <section className="relative mt-4"><div className="flex gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><input value={q} onChange={e=>setQ(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-500" placeholder="종목명 또는 6자리 코드"/><button onClick={run} disabled={busy} className="rounded-2xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{busy?"계산 중":"현재가 계산"}</button></div>{q&&!STOCKS.some(stock=>stock.name===q)&&singleMatches.length>0&&<SearchResults stocks={singleMatches} onSelect={stock=>setQ(stock.name)}/>}</section>
   {err&&<ErrorBox text={err}/>}
   {d&&<SingleResult data={d}/>}
  </>:<>
   <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between"><div><p className="text-xs font-black text-blue-600">LOW-COST RANKING</p><h2 className="text-xl font-black">후보 종목 {candidates.length}/20</h2></div><button onClick={runRanking} disabled={rankingBusy||!candidates.length} className="rounded-2xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{rankingBusy?"TOP5 계산 중":"랭킹 계산"}</button></div>
    <div className="relative mt-4"><input value={candidateQuery} onChange={e=>setCandidateQuery(e.target.value)} disabled={candidates.length>=20} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-500 disabled:bg-slate-100" placeholder={candidates.length>=20?"최대 20개가 선택되었습니다":"추가할 종목명 또는 코드"}/>{candidateQuery&&candidateMatches.length>0&&<SearchResults stocks={candidateMatches} onSelect={stock=>addCandidate(stock.symbol)}/>}</div>
    <div className="mt-3 flex flex-wrap gap-2">{candidates.map(symbol=>{const stock=STOCK_BY_SYMBOL.get(symbol);return <button key={symbol} onClick={()=>removeCandidate(symbol)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{stock?.name||symbol} <span className="text-slate-400">×</span></button>})}</div>
    <p className="mt-3 text-xs font-bold text-slate-400">수동 실행 · A/M 1회 계산 · 동일 후보 조합 5분 캐시 · 접속 시 자동 호출 없음</p>
   </section>
   {rankingError&&<ErrorBox text={rankingError}/>}
   {ranking&&<RankingResult data={ranking}/>}
  </>}
 </main>
}

function SearchResults({stocks,onSelect}:{stocks:typeof STOCKS;onSelect:(stock:(typeof STOCKS)[number])=>void}){return <div className="absolute left-2 right-2 top-full z-20 overflow-hidden rounded-b-2xl border border-slate-200 bg-white shadow-xl">{stocks.map(stock=><button key={stock.symbol} onClick={()=>onSelect(stock)} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left first:border-0 hover:bg-blue-50"><span><b className="block">{stock.name}</b><small className="text-slate-400">{stock.symbol} · {stock.sector}</small></span><b className="text-blue-600">선택</b></button>)}</div>}
function ErrorBox({text}:{text:string}){return <p className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{text}</p>}
function SingleResult({data:d}:{data:any}){return <><section className="mt-4 grid gap-3 md:grid-cols-3"><article className="rounded-3xl bg-slate-900 p-6 text-white md:col-span-2"><p className="text-xs text-slate-400">{d.symbol} · {new Date(d.asOf).toLocaleString("ko-KR")}</p><div className="mt-2 flex items-end justify-between"><div><h2 className="text-2xl font-black">{d.name}</h2><b className="mt-1 block text-3xl">{won(d.price)}</b></div><div className="text-right"><b className="text-5xl text-blue-400">{d.armaScore}</b><span className="block text-xs text-slate-400">ARMA LIVE</span></div></div></article><article className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4"><Score k="A-LIVE" v={d.aScore}/><Score k="M-LIVE" v={d.mScore}/><Score k="R" v={d.rScore}/><Score k="AR" v={d.arScore}/></article></section><TradePlan data={d}/></>}
function RankingResult({data}:{data:any}){return <section className="mt-4"><div className="flex items-end justify-between px-1"><div><p className="text-xs font-black text-blue-600">LIVE RANKING · {data.candidateCount}종목</p><h2 className="text-2xl font-black">현재가 기준 TOP5</h2></div><div className="text-right text-xs font-bold text-slate-400"><b className="block text-slate-600">A {data.aScore} · M {data.mScore}</b>{data.cached?"5분 캐시 재사용":"새로 계산"} · {new Date(data.asOf).toLocaleTimeString("ko-KR")}</div></div><div className="mt-3 space-y-3">{data.top5.map((stock:any,index:number)=><article key={stock.symbol} className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-4"><b className="text-2xl text-blue-600">{index+1}</b><div><h3 className="font-black">{stock.name}</h3><p className="text-xs text-slate-400">{stock.symbol} · {stock.sector} · {won(stock.price)}</p></div><div className="text-right"><b className="text-3xl text-blue-600">{stock.armaScore}</b><span className="block text-xs font-bold text-slate-400">{stock.action}</span></div></div><div className="grid grid-cols-4 border-t border-slate-100 bg-slate-50 p-3 text-center"><Score k="R" v={stock.rScore}/><Score k="AR" v={stock.arScore}/><Score k="PRS" v={stock.prs}/><Score k="SLS" v={stock.sls}/></div><TradePlan data={stock} compact/></article>)}</div><p className="mt-3 px-1 text-xs font-bold text-slate-400">LIVE 잠정값 · 투자 판단 전 공식 ARMA 종가 데이터와 함께 확인하세요.</p></section>}
function TradePlan({data:d,compact=false}:{data:any;compact?:boolean}){return <section className={compact?"border-t border-slate-100 p-4":"mt-3 rounded-3xl bg-white p-5"}><div className="flex justify-between"><div><p className="text-xs font-black text-blue-600">1~4주 실행계획</p>{!compact&&<h3 className="text-xl font-black">{d.action}</h3>}</div><span className="text-sm font-bold text-slate-500">손익비 1:{d.tradePlan.riskReward}</span></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">{[["매수 하단",d.tradePlan.buyLow],["매수 상단",d.tradePlan.buyHigh],["1차 매도",d.tradePlan.firstSell],["2차 매도",d.tradePlan.secondSell],["손절가",d.tradePlan.stop]].map(([k,v],i)=><div key={String(k)} className="rounded-2xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{k}</span><b className={`block ${i===4?"text-red-600":i>1?"text-blue-600":""}`}>{won(Number(v))}</b></div>)}</div>{!compact&&<p className="mt-4 text-xs font-bold text-slate-400">{d.regime} · LIVE 잠정값</p>}</section>}
function Score({k,v}:{k:string;v:number}){return <div className="rounded-2xl bg-slate-50 p-3"><span className="text-xs font-black text-slate-400">{k}</span><b className="block text-xl">{v}</b></div>}
