"use client";

import {useEffect,useRef,useState} from "react";

export const SCORE_HELP:Record<string,{title:string;text:string}>={
 ARMA:{title:"ARMA 종합점수",text:"모멘텀·상대가치·수급·위험·섹터·이벤트 정보를 종합한 최종 판단 점수입니다."},
 R:{title:"R-Score · 추세/모멘텀",text:"가격 추세와 상대강도 등 현재 주가의 방향성과 지속 가능성을 평가합니다."},
 AR:{title:"AR-Score · 상대가치",text:"가격 괴리와 평균회귀 가능성 등 상대적인 매력도를 평가합니다."},
 PRS:{title:"PRS · 위험경고",text:"변동성·과열·가격 이격 등을 바탕으로 하락 위험과 과열 정도를 평가합니다. 높을수록 주의가 필요합니다."},
 SLS:{title:"SLS · 섹터강도",text:"해당 종목 또는 섹터가 시장 대비 얼마나 강한 흐름을 보이는지 평가합니다."},
 EIS:{title:"EIS · 이벤트 영향점수",text:"실적·재무·희석·규제·지배구조 등 주요 사건이 주가에 미칠 영향을 0~100으로 평가합니다."},
 Action:{title:"Action · 실행판단",text:"ARMA 점수와 위험·이벤트 상태를 반영한 매수·보유·비중축소·관망 등의 최종 행동 신호입니다."},
 MARKET:{title:"시장 위험",text:"공식 ARMA의 A-Score와 M-Score 및 위험 Override를 종합해 현재 시장 환경을 색상과 문장으로 표시합니다."},
 SECTOR:{title:"섹터 순환",text:"공식 종가 스냅샷을 기준으로 자금과 주가 흐름이 강해지는 섹터를 비교합니다."},
 RANKING:{title:"실시간 순위",text:"KB 현재가를 반영해 등록 후보의 ARMA LIVE 점수를 계산하고 높은 순서로 보여줍니다."},
 BREADTH:{title:"상승 확산도",text:"섹터 안에서 강한 흐름을 보이는 종목의 비율입니다. 높을수록 상승 흐름이 여러 종목으로 퍼져 있습니다."},
 ROTATION5D:{title:"5일 섹터 변화",text:"최근 5거래일 동안 섹터 강도가 얼마나 개선되거나 약해졌는지를 나타냅니다."},
};

const SCORE_LABELS:Record<string,string>={ARMA:"종합점수(ARMA)",R:"추세(R)",AR:"상대가치(AR)",PRS:"위험경고(PRS)",SLS:"섹터강도(SLS)",EIS:"이벤트영향(EIS)",Action:"행동판단(Action)"};

export function HelpTip({code}:{code:string}){
 const [open,setOpen]=useState(false),ref=useRef<HTMLSpanElement>(null),item=SCORE_HELP[code]||{title:code,text:"ARMA 지표 설명입니다."};
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close)},[open]);
 return <span ref={ref} className="relative ml-1 inline-flex align-middle">
  <button type="button" aria-label={`${code} 설명`} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(v=>!v)}} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-black text-slate-600 shadow-sm">?</button>
  {open&&<span role="tooltip" className="fixed inset-x-4 top-1/2 z-[100] w-auto -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-2xl md:absolute md:left-1/2 md:right-auto md:top-7 md:w-72 md:-translate-x-1/2 md:translate-y-0"><b className="block text-base text-slate-900">{item.title}</b><span className="mt-2 block text-sm font-medium leading-6 text-slate-600">{item.text}</span><span className="mt-3 block text-[11px] font-bold text-slate-400">물음표를 다시 누르면 닫힙니다.</span></span>}
 </span>
}

export function MetricLabel({code,label}:{code:string;label?:string}){return <span className="inline-flex items-center">{label||SCORE_LABELS[code]||code}<HelpTip code={code}/></span>}

export function MarketRiskBadge(){
 const [data,setData]=useState<any>(null);
 useEffect(()=>{let active=true;fetch("/api/market-state",{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})).then(x=>{if(active)setData(x.data)}).catch(()=>{if(active)setData({state:"UNKNOWN",label:"데이터 확인 중",tone:"slate",text:"공식 ARMA 시장 상태 연결을 확인하고 있습니다."})});return()=>{active=false}},[]);
 const d=data||{state:"UNKNOWN",label:"불러오는 중",tone:"slate",text:"공식 ARMA 시장 상태를 불러오고 있습니다."};
 const tone=d.tone==="green"?"bg-emerald-500":d.tone==="yellow"?"bg-amber-400":d.tone==="orange"?"bg-orange-500":d.tone==="red"?"bg-red-600":"bg-slate-400";
 return <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex min-w-0 items-center gap-2"><span className={`h-3 w-3 shrink-0 rounded-full ${tone}`}/><div className="min-w-0"><p className="text-[10px] font-black tracking-widest text-slate-400">시장 위험</p><b className="block truncate text-sm text-slate-800">{d.label}</b></div></div><span className="relative"><MarketRiskHelp data={d}/></span></div>
}

function MarketRiskHelp({data}:{data:any}){
 const [open,setOpen]=useState(false),ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close)},[open]);
 return <span ref={ref} className="relative inline-flex"><button type="button" aria-label="시장 상태 설명" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-black text-slate-600 shadow-sm">?</button>{open&&<span role="tooltip" className="fixed inset-x-4 top-1/2 z-[100] w-auto -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-2xl md:absolute md:left-auto md:right-0 md:top-9 md:w-80 md:translate-y-0"><b className="block text-base text-slate-900">{data.label} · {data.state}</b><span className="mt-2 block text-sm font-medium leading-6 text-slate-600">{data.text}</span>{data.tradeDate&&<span className="mt-3 block text-xs font-bold text-slate-400">공식 스냅샷 {String(data.tradeDate).slice(0,10)}</span>}<span className="mt-3 block text-[11px] font-bold text-slate-400">물음표를 다시 누르면 닫힙니다.</span></span>}</span>
}
