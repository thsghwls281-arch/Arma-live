export const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));export const avg=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;export const pct=(n:number,p:number)=>p?((n/p)-1)*100:0;export const round=(v:number,d=1)=>Number(v.toFixed(d));
export function rsi(c:number[],p=14){if(c.length<p+1)return 50;let g=0,l=0;for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];d>=0?g+=d:l-=d}if(!l)return 100;const rs=(g/p)/(l/p);return 100-100/(1+rs)}
export function volatility(c:number[],n=20){const a=c.slice(-(n+1));if(a.length<3)return 0;const rs=a.slice(1).map((v,i)=>(v/a[i]-1)*100),m=avg(rs);return Math.sqrt(avg(rs.map(x=>(x-m)**2)))}
const tick=(v:number)=>v>=500000?1000:v>=200000?500:v>=50000?100:v>=20000?50:v>=5000?10:v>=2000?5:1;
const price=(v:number)=>Math.round(v/tick(v))*tick(v);
export function calculateStock(closes0:number[],live:number,aScore:number,mScore:number){
 const validHistory=closes0.filter(v=>Number.isFinite(v)&&v>0);
 if(!Number.isFinite(live)||live<=0)throw new Error("유효한 LIVE 현재가가 필요합니다.");
 const closes=[...validHistory.slice(-69),live];if(closes.length<61)throw new Error("61거래일 이상 유효한 가격 이력이 필요합니다.");
 const ma20=avg(closes.slice(-20)),ma60=avg(closes.slice(-60)),ret5=pct(live,closes.at(-6)!),ret20=pct(live,closes.at(-21)!),ret60=pct(live,closes.at(-61)!),rsi14=rsi(closes),vol20=volatility(closes),dist20=pct(live,ma20),dist60=pct(live,ma60);
 if(![ma20,ma60,ret5,ret20,ret60,rsi14,vol20,dist20,dist60].every(Number.isFinite))throw new Error("LIVE 가격 이력 계산값이 유효하지 않습니다.");
 const rawTrend=50+ret5*1.4+ret20*.75+ret60*.2+dist60*.35,rScore=round(clamp(50+45*Math.tanh((rawTrend-50)/45))),arScore=round(clamp(55-Math.abs(dist20)*2-Math.abs(rsi14-50)*.6+(rsi14<35?15:0))),prs=round(clamp(vol20*12+Math.max(0,rsi14-70)*1.5+Math.max(0,dist20-12)*2.2)),sls=round(clamp(50+(ret20-(mScore-50)/2)*1.25));
 let arma=round(clamp(rScore*.34+arScore*.16+sls*.14+(100-prs)*.14+aScore*.11+mScore*.11-(prs>=75?6:prs>=65?3:0)));
 let action=prs>=85?"비중축소":arma>=68&&prs<60?"매수":arma>=56?"보유":prs>=70?"비중축소":"관망";if((aScore<42||mScore<42)&&action==="매수")action="보유";
 const support=Math.min(...closes.slice(-20)),resistance=Math.max(...closes.slice(-20)),band=Math.max(.018,Math.min(.05,vol20/100*1.15)),buyLow=Math.min(live*(1-band),ma20*.985),buyHigh=Math.min(live,Math.max(ma20*1.01,live*(1-band*.35))),stop=Math.max(buyLow*.95,Math.min(support*.985,buyLow*.975)),risk=Math.max(1,buyHigh-stop),sell1=Math.max(resistance,buyHigh+risk*1.35),sell2=Math.max(sell1*1.035,buyHigh+risk*2.2);
 if(![prs,arma,buyLow,buyHigh,stop,sell1,sell2,risk].every(Number.isFinite))throw new Error("LIVE 실행가격 계산값이 유효하지 않습니다.");
 return{armaScore:arma,rScore,arScore,prs,sls,action,indicators:{ret5:round(ret5,2),ret20:round(ret20,2),ret60:round(ret60,2),rsi14:round(rsi14),ma20:round(ma20),ma60:round(ma60),volatility20:round(vol20,2)},tradePlan:{buyLow:price(buyLow),buyHigh:price(buyHigh),firstSell:price(sell1),secondSell:price(sell2),stop:price(stop),riskReward:round((sell2-buyHigh)/risk,1)}};
}
