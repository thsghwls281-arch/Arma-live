"use client";

import {useEffect,useMemo,useState} from "react";
import {DEFAULT_SECTOR_ID,SECTOR_GROUPS,STOCKS} from "@/lib/stocks";
import {HelpTip,MarketRiskBadge,MetricLabel} from "@/components/help";
import {SectorOverview} from "@/components/sectors";

const won=(n:number)=>new Intl.NumberFormat("ko-KR").format(n)+"원";
const matchStocks=(query:string)=>{const value=query.trim().toLowerCase();if(!value)return[];return STOCKS.filter(stock=>stock.symbol.includes(value)||stock.name.toLowerCase().includes(value)).slice(0,8)};
const RANKING_CACHE_MS=5*60*1000;
const WATCHLIST_KEY="arma-live-watchlist:v1";

export default function Live(){
 const [mode,setMode]=useState<"live"|"sector"|"watchlist">("live");
 const [q,setQ]=useState(""),[d,setD]=useState<any>(null),[busy,setBusy]=useState(false),[err,setErr]=useState("");
 const [sectorId,setSectorId]=useState("__all__"),[ranking,setRanking]=useState<any>(null),[rankingBusy,setRankingBusy]=useState(false),[rankingError,setRankingError]=useState("");
 const [watchlist,setWatchlist]=useState<string[]>([]);
 const singleMatches=useMemo(()=>matchStocks(q),[q]);
 const selectedSector=useMemo(()=>SECTOR_GROUPS.find(sector=>sector.id===(sectorId==="__all__"?DEFAULT_SECTOR_ID:sectorId))!,[sectorId]);
 const isAll=sectorId==="__all__";
 const watchedStocks=useMemo(()=>watchlist.map(symbol=>STOCKS.find(stock=>stock.symbol===symbol)).filter(Boolean) as typeof STOCKS,[watchlist]);

 useEffect(()=>{try{const saved=localStorage.getItem(WATCHLIST_KEY);if(saved)setWatchlist(JSON.parse(saved))}catch{}},[]);
 function toggleWatch(symbol:string){setWatchlist(current=>{const next=current.includes(symbol)?current.filter(item=>item!==symbol):[...current,symbol];localStorage.setItem(WATCHLIST_KEY,JSON.stringify(next));return next})}

 async function run(){
  const exact=STOCKS.find(stock=>stock.symbol===q.trim()||stock.name.toLowerCase()===q.trim().toLowerCase())||singleMatches[0];
  if(!exact){setErr("종목명 또는 6자리 종목코드를 확인하세요.");return}
  setQ(exact.name);setBusy(true);setErr("");setD(null);
  try{const r=await fetch(`/api/live?symbol=${exact.symbol}`,{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.message);setD(j)}catch(e){setErr(e instanceof Error?e.message:"오류")}finally{setBusy(false)}
 }
 async function runRanking(){
  setRankingBusy(true);setRankingError("");setRanking(null);
  try{
   const cacheKey=`arma-live-ranking:${sectorId}`;
   const saved=sessionStorage.getItem(cacheKey);
   if(saved){const parsed=JSON.parse(saved);if(Date.now()-parsed.savedAt<RANKING_CACHE_MS){setRanking({...parsed.data,cached:true});return}}
   const r=await fetch("/api/ranking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sectorId})}),j=await r.json();
   if(!r.ok)throw new Error(j.message);
   sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data:j}));setRanking(j)
  }catch(e){setRankingError(e instanceof Error?e.message:"랭킹 계산 실패")}finally{setRankingBusy(false)}
 }
 function changeSector(nextId:string){setSectorId(nextId);setRanking(null);setRankingError("")}

 return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
  <header><div className="text-xs font-black tracking-widest text-blue-600">ARMA LIVE · KB 현재가</div><h1 className="mt-2 text-4xl font-black">ARMA LIVE</h1><p className="mt-2 text-sm text-slate-500">KB 현재가 기준 전체 실시간 TOP20과 섹터별 TOP5를 계산합니다.</p><MarketRiskBadge/></header>
  <nav className="mt-6 grid grid-cols-3 rounded-2xl bg-slate-200 p-1" aria-label="ARMA LIVE 주요 메뉴"><button className={`rounded-xl px-2 py-3 text-sm font-black ${mode==="live"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`} onClick={()=>{setMode("live");changeSector("__all__")}}>LIVE</button><button className={`rounded-xl px-2 py-3 text-sm font-black ${mode==="sector"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`} onClick={()=>setMode("sector")}>SECTOR</button><button className={`rounded-xl px-2 py-3 text-sm font-black ${mode==="watchlist"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`} onClick={()=>setMode("watchlist")}>관심종목 {watchlist.length?watchlist.length:""}</button></nav>

  {mode==="live"?<>
   <section className="relative mt-4"><div className="flex gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><input value={q} onChange={e=>setQ(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-500" placeholder="종목명 또는 6자리 코드"/><button onClick={run} disabled={busy} className="rounded-2xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{busy?"계산 중":"현재가 계산"}</button></div>{q&&!STOCKS.some(stock=>stock.name===q)&&singleMatches.length>0&&<SearchResults stocks={singleMatches} onSelect={stock=>setQ(stock.name)}/>}</section>
   {err&&<ErrorBox text={err}/>}
   {d&&<SingleResult data={d} watched={watchlist.includes(d.symbol)} onToggle={()=>toggleWatch(d.symbol)}/>}
   <section className="mt-4 space-y-3">
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center text-xs font-black text-blue-600">실시간 전체 순위<HelpTip code="RANKING"/></p><h2 className="text-xl font-black">ARMA TOP10</h2><p className="mt-1 text-xs font-bold text-slate-400">등록 후보 {STOCKS.length}종목 · ARMA 점수순</p></div><button onClick={runRanking} disabled={rankingBusy} className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{rankingBusy?"계산 중":"ARMA TOP10 계산"}</button></div></article>
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center text-xs font-black text-blue-600">실시간 매수 후보<HelpTip code="RANKING"/></p><h2 className="text-xl font-black">매수 TOP10</h2><p className="mt-1 text-xs font-bold text-slate-400">행동신호 ‘매수’ 종목 · ARMA 점수순</p></div><button onClick={runRanking} disabled={rankingBusy} className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{rankingBusy?"계산 중":"매수 TOP10 계산"}</button></div></article>
    <p className="px-1 text-xs font-bold text-slate-400">두 버튼은 동일한 현재가 데이터를 공유해 중복 조회 없이 두 순위를 함께 갱신합니다.</p>
   </section>
   {rankingError&&<ErrorBox text={rankingError}/>}
   {ranking&&<RankingResult data={ranking} limit={10} watchlist={watchlist} onToggle={toggleWatch}/>}
  </>:mode==="sector"?<>
   <SectorOverview/>
   <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><div><p className="flex items-center text-xs font-black text-blue-600">섹터 LIVE 순위<HelpTip code="RANKING"/></p><h2 className="text-xl font-black">{selectedSector.name}</h2><p className="mt-1 text-xs font-bold text-slate-400">대표 후보 20종목</p></div><button onClick={runRanking} disabled={rankingBusy||isAll} className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{rankingBusy?"TOP5 계산 중":"TOP5 계산"}</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">{SECTOR_GROUPS.map(sector=><button key={sector.id} onClick={()=>changeSector(sector.id)} className={`rounded-2xl border px-3 py-3 text-left text-sm font-black transition ${sector.id===sectorId?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200 text-slate-500 hover:border-blue-300"}`}><span className="block">{sector.name}</span><small className="font-bold opacity-60">후보 {sector.symbols.length}종목</small></button>)}</div>
    <p className="mt-4 text-xs font-bold text-slate-400">섹터 카드는 공식 종가 기준 · TOP5는 KB 현재가 기준 잠정값 · 결과 5분 캐시</p>
   </section>
   {rankingError&&<ErrorBox text={rankingError}/>}
   {ranking&&<RankingResult data={ranking} limit={5} watchlist={watchlist} onToggle={toggleWatch}/>}
  </>:<>
   <WatchlistPanel stocks={watchedStocks} onRemove={toggleWatch} onCalculate={stock=>{setQ(stock.name);setMode("live");setTimeout(()=>{},0)}}/>
  </>}
 </main>
}

function SearchResults({stocks,onSelect}:{stocks:typeof STOCKS;onSelect:(stock:(typeof STOCKS)[number])=>void}){return <div className="absolute left-2 right-2 top-full z-20 overflow-hidden rounded-b-2xl border border-slate-200 bg-white shadow-xl">{stocks.map(stock=><button key={stock.symbol} onClick={()=>onSelect(stock)} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left first:border-0 hover:bg-blue-50"><span><b className="block">{stock.name}</b><small className="text-slate-400">{stock.symbol} · {stock.sector}</small></span><b className="text-blue-600">선택</b></button>)}</div>}
function ErrorBox({text}:{text:string}){return <p className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{text}</p>}
function BasisBadge({data}:{data:any}){if(!data?.fallback)return null;return <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-500"><span className="h-2 w-2 rounded-full bg-slate-400"/>최근 거래일 기준 · {String(data.basisDate||data.inputs?.tradeDate||"").slice(0,10)} · A/M N/A</div>}
function SingleResult({data:d,watched,onToggle}:{data:any;watched:boolean;onToggle:()=>void}){return <><BasisBadge data={d}/><section className="mt-4 grid gap-3 md:grid-cols-3"><article className="rounded-3xl bg-slate-900 p-6 text-white md:col-span-2"><p className="text-xs text-slate-400">{d.symbol} · {new Date(d.asOf).toLocaleString("ko-KR")}</p><div className="mt-2 flex items-end justify-between"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-black">{d.name}</h2><button onClick={onToggle} aria-label={watched?"관심종목 해제":"관심종목 저장"} className="text-2xl text-amber-400">{watched?"★":"☆"}</button></div><b className="mt-1 block text-3xl">{won(d.price)}</b></div><div className="text-right"><b className="text-5xl text-blue-400">{d.armaScore}</b><span className="flex items-center justify-end text-xs text-slate-400">종합점수 (ARMA)<HelpTip code="ARMA"/></span></div></div></article><article className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4"><Score k="R" v={d.rScore}/><Score k="AR" v={d.arScore}/><Score k="PRS" v={d.prs}/><Score k="SLS" v={d.sls}/></article></section><TradePlan data={d}/></>}
function RankingResult({data,limit,watchlist,onToggle}:{data:any;limit:number;watchlist:string[];onToggle:(symbol:string)=>void}){const global=data.scope==="all";const scoreRows=(data.top20||data.top5||[]).slice(0,limit);const buyRows=(data.buyTop10||[]).slice(0,10);return <section className="mt-4"><BasisBadge data={data}/><div className="mt-3 flex items-end justify-between px-1"><div><p className="text-xs font-black text-blue-600">{data.sectorName} · 후보 {data.candidateCount}종목</p><h2 className="text-2xl font-black">{global?"실시간 랭킹":"섹터 현재가 TOP5"}</h2></div><div className="text-right text-xs font-bold text-slate-400">{data.cached?"5분 캐시 재사용":"새로 계산"} · {new Date(data.asOf).toLocaleTimeString("ko-KR")}</div></div>{global?<div className="mt-4 space-y-5"><RankingList title="전체 ARMA 점수 TOP10" eyebrow="ALL STOCKS" rows={scoreRows} watchlist={watchlist} onToggle={onToggle}/><RankingList title="매수 신호 ARMA TOP10" eyebrow="REAL-TIME BUY SIGNAL" rows={buyRows} watchlist={watchlist} onToggle={onToggle} empty="현재 매수 신호 종목이 없습니다."/></div>:<div className="mt-3"><RankingList title="섹터 현재가 TOP5" eyebrow={data.sectorName} rows={scoreRows} watchlist={watchlist} onToggle={onToggle}/></div>}<p className="mt-3 px-1 text-xs font-bold text-slate-400">실시간 잠정값 · 매수·목표·손절 가격은 종목 상세에서 확인합니다.</p></section>}
function RankingList({title,eyebrow,rows,watchlist,onToggle,empty="계산 가능한 종목이 없습니다."}:{title:string;eyebrow:string;rows:any[];watchlist:string[];onToggle:(symbol:string)=>void;empty?:string}){return <section className="rounded-3xl border border-slate-200 bg-slate-50 p-3"><div className="px-1 pb-3"><p className="text-[10px] font-black tracking-[.14em] text-blue-600">{eyebrow}</p><h3 className="text-lg font-black">{title}</h3></div><div className="space-y-3">{rows.map((stock:any,index:number)=><article key={stock.symbol} className="overflow-visible rounded-3xl bg-white shadow-sm"><div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-4"><b className="text-2xl text-blue-600">{index+1}</b><div><div className="flex items-center gap-2"><h4 className="font-black">{stock.name}</h4><button onClick={()=>onToggle(stock.symbol)} aria-label={watchlist.includes(stock.symbol)?"관심종목 해제":"관심종목 저장"} className="text-xl text-amber-500">{watchlist.includes(stock.symbol)?"★":"☆"}</button></div><p className="text-xs text-slate-400">{stock.symbol} · {stock.sector} · {won(stock.price)}</p></div><div className="text-right"><b className="text-3xl text-blue-600">{stock.armaScore}</b><span className="flex items-center justify-end text-xs font-bold text-slate-400">{stock.action}<HelpTip code="Action"/></span></div></div><div className="grid grid-cols-4 border-t border-slate-100 bg-slate-50 p-3 text-center"><Score k="R" v={stock.rScore}/><Score k="AR" v={stock.arScore}/><Score k="PRS" v={stock.prs}/><Score k="SLS" v={stock.sls}/></div></article>)}{rows.length===0&&<div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-400">{empty}</div>}</div></section>}
function WatchlistPanel({stocks,onRemove,onCalculate}:{stocks:typeof STOCKS;onRemove:(symbol:string)=>void;onCalculate:(stock:(typeof STOCKS)[number])=>void}){return <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-xs font-black text-blue-600">MY WATCHLIST</p><h2 className="text-2xl font-black">관심종목</h2><p className="mt-1 text-xs font-bold text-slate-400">이 기기에 저장되며 사용자가 해제하기 전까지 유지됩니다.</p></div>{stocks.length?<div className="mt-4 space-y-2">{stocks.map(stock=><article key={stock.symbol} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><b className="block">{stock.name}</b><span className="text-xs font-bold text-slate-400">{stock.symbol} · {stock.sector}</span></div><div className="flex gap-2"><button onClick={()=>onCalculate(stock)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">검색으로 이동</button><button onClick={()=>onRemove(stock.symbol)} aria-label="관심종목 해제" className="rounded-xl border border-slate-200 px-3 py-2 font-black text-amber-500">★</button></div></article>)}</div>:<div className="mt-4 rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">LIVE 검색이나 순위에서 ☆를 눌러 관심종목을 저장하세요.</div>}</section>}
function TradePlan({data:d,compact=false}:{data:any;compact?:boolean}){return <section className={compact?"border-t border-slate-100 p-4":"mt-3 rounded-3xl bg-white p-5"}><div className="flex justify-between"><div><p className="text-xs font-black text-blue-600">1~4주 실행계획</p>{!compact&&<h3 className="flex items-center text-xl font-black">{d.action}<HelpTip code="Action"/></h3>}</div><span className="text-sm font-bold text-slate-500">손익비 1:{d.tradePlan.riskReward}</span></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">{[["매수 하단",d.tradePlan.buyLow],["매수 상단",d.tradePlan.buyHigh],["1차 매도",d.tradePlan.firstSell],["2차 매도",d.tradePlan.secondSell],["손절가",d.tradePlan.stop]].map(([k,v],i)=><div key={String(k)} className="rounded-2xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{k}</span><b className={`block ${i===4?"text-blue-600":i>1?"text-red-600":""}`}>{won(Number(v))}</b></div>)}</div>{!compact&&<p className="mt-4 text-xs font-bold text-slate-400">목표 매도가는 빨간색 · 손절가는 파란색 · {d.regime} · LIVE 잠정값</p>}</section>}
function Score({k,v}:{k:string;v:number|null|undefined}){return <div className="rounded-2xl bg-slate-50 p-3"><span className="text-xs font-black text-slate-400"><MetricLabel code={k}/></span><b className="block text-xl">{v==null?"—":v}</b></div>}
