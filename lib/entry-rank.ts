import {clamp,round} from "@/lib/engine";
import type {EntryContextRow} from "@/lib/entry-context";

export const ENTRY_MODEL_VERSION="Entry-Rank-1.0-shadow";
export const ENTRY_WEIGHTS={pullbackSetup:30,trigger:15,armaQuality:20,flow:10,sector:10,prsRisk:5,livePriceRiskReward:10} as const;

type LiveQuality={armaScore:number;rScore:number;arScore:number;prs:number};
type TradePlan={buyLow:number;buyHigh:number;firstSell:number;secondSell:number;stop:number;riskReward:number};
export type EntryScoreInput={context:EntryContextRow;live?:LiveQuality|null;currentPrice?:number|null;referenceTradePlan?:TradePlan|null;marketRiskOff?:boolean};

const n=(value:unknown,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback};
const sign=(value:unknown)=>{const x=Number(value);return Number.isFinite(x)?x>0?1:x<0?-1:0:0};
const activePullback=(state:string)=>state==="WATCH"||state==="FAVORABLE";

function setupScore(p:any){
 if(!p)return 0;
 const raw=n(p.trendIntegrityScore)+n(p.pullbackStructureScore)+n(p.rsPreservationScore)+n(p.volumeQualityScore);
 const modifier=p.state==="FAVORABLE"?1:p.state==="WATCH"?.95:p.state==="NONE"?.72:.5;
 return round(clamp((raw/90)*30*modifier,0,30));
}

function triggerScore(p:any,o:any){
 if(String(o?.timingAction||"").toUpperCase()==="EXIT_AVOID")return 0;
 const confirmed=Boolean(o?.confirmedPrimaryName)||(Array.isArray(o?.confirmedMatches)&&o.confirmedMatches.length>0);
 const pending=Boolean(o?.pendingPrimaryName)||(Array.isArray(o?.pendingMatches)&&o.pendingMatches.length>0);
 const timingScore=n(o?.timingScore,0),timingPositive=timingScore>0||["HOLD_MANAGE","WATCH"].includes(String(o?.timingAction||"").toUpperCase());
 const strongConfirmation=Boolean(p?.confirmationQualified);
 const confirmationCount=[p?.confirmationPrevHigh,p?.confirmationEma5,p?.confirmation3dHigh].filter(Boolean).length;
 let score=0;
 if(confirmed&&timingPositive&&strongConfirmation)score=15;
 else if(confirmed&&timingPositive)score=12;
 else if(pending&&strongConfirmation)score=12;
 else if(strongConfirmation)score=10+(timingPositive?1:0);
 else score=confirmationCount*2.2+(timingPositive?2:0);
 if(!confirmed&&!pending&&confirmationCount===0&&["EARLY_UPTREND","MATURE_UPTREND"].includes(String(o?.cycleState||"")))score=Math.max(score,1.5);
 if(String(o?.timingAction||"").toUpperCase()==="CAUTION")score=Math.min(score,5);
 return round(clamp(score,0,15));
}

function qualityScore(live:LiveQuality){return round(clamp(live.armaScore*.14+live.rScore*.04+live.arScore*.02,0,20));}
function flowScore(p:any){
 if(!p)return 5;
 const score=5+sign(p.foreignNet5d)*2+sign(p.foreignNet20d)*2+sign(p.institutionNet5d)*1.5+sign(p.institutionNet20d)*1.5+sign(p.foreignOwnershipChange20d)*1;
 return round(clamp(score,0,10));
}
function sectorScore(s:any){
 if(!s)return 5;
 const status=String(s.status||"").toUpperCase();
 let score=status==="IMPROVING"?8:status==="HEALTHY"?7:status==="WEAK"?3:status.includes("RISK")||status.includes("DANGER")?1:5;
 if(n(s.rotation5d)>0)score+=1;else if(n(s.rotation5d)<-15)score-=1;
 if(n(s.rotation20d)>0)score+=.5;else if(n(s.rotation20d)<-15)score-=.5;
 if(n(s.score)>60)score+=.5;else if(n(s.score)<45)score-=.5;
 return round(clamp(score,0,10));
}
function riskScore(prs:number){return prs<40?5:prs<60?4:prs<75?2:prs<85?.5:0;}

function priceScore(current:number|null|undefined,plan:TradePlan|null|undefined,trendQualified:boolean){
 if(!current||!plan?.buyLow||!plan?.buyHigh)return {score:5,status:"N/A",chasePct:null as number|null};
 const high=plan.buyHigh,low=plan.buyLow,chase=((current/high)-1)*100;
 const rrBonus=plan.riskReward>=2?2:plan.riskReward>=1.5?1:0;
 if(current>=low&&current<=high)return {score:round(clamp(8+rrBonus,0,10)),status:"BUY_ZONE",chasePct:round(chase,2)};
 if(current>high&&chase<=2)return {score:6,status:"SLIGHT_CHASE",chasePct:round(chase,2)};
 if(current>high&&chase<=5)return {score:3,status:"CHASE_RISK",chasePct:round(chase,2)};
 if(current>high)return {score:0,status:"EXCESSIVE_CHASE",chasePct:round(chase,2)};
 return {score:trendQualified?4:2,status:"BELOW_BUY_ZONE",chasePct:round(chase,2)};
}

export function scoreEntry(input:EntryScoreInput){
 const c=input.context,p=c.pullback,o=c.ozawa,s=c.sectorContext;
 const official=c.official||{};
 const live:LiveQuality=input.live||{armaScore:n(official.arma),rScore:n(official.r),arScore:n(official.ar),prs:n(official.prs)};
 const setup=setupScore(p),trigger=triggerScore(p,o),quality=qualityScore(live),flow=flowScore(p),sector=sectorScore(s),risk=riskScore(live.prs);
 const price=priceScore(input.currentPrice,input.referenceTradePlan,Boolean(p?.trendQualified));
 const hardGates:string[]=[];
 const state=String(p?.state||"NOT_COMPUTABLE");
 const eventNegative=String(official.eventOverride||"").toUpperCase()==="ON"&&String(official.eventDirection||"").toUpperCase()==="NEGATIVE";
 const fallingKnife=Boolean(p)&&!p.trendQualified&&!p.confirmationQualified&&n(p.drawdownAtr)<0?-n(p.drawdownAtr)>=2.5:n(p?.drawdownAtr)>=2.5;
 if(eventNegative)hardGates.push("NEGATIVE_EVENT_OVERRIDE");
 if(live.prs>=85)hardGates.push("PRS_85_PLUS");
 if(live.armaScore<45&&live.rScore<45)hardGates.push("LOW_ARMA_AND_R");
 if(activePullback(state)&&!p?.trendQualified)hardGates.push("ACTIVE_PULLBACK_TREND_FAIL");
 if(String(o?.timingAction||"").toUpperCase()==="EXIT_AVOID")hardGates.push("OZAWA_EXIT_AVOID");
 if(fallingKnife)hardGates.push("FALLING_KNIFE");
 const entryRank=round(clamp(setup+trigger+quality+flow+sector+risk+price.score,0,100));
 const eligible=hardGates.length===0;
 const qualityStrong=live.armaScore>=55&&live.rScore>=50;
 let action="관망 / 제외";
 if(eligible&&input.marketRiskOff)action="관망 / 신규매수 제한";
 else if(eligible&&activePullback(state)&&p?.trendQualified){
  if(trigger>=9){
   action=price.status==="EXCESSIVE_CHASE"||price.status==="CHASE_RISK"?"눌림 시 매수":price.status==="BELOW_BUY_ZONE"?"돌파 확인 후 매수":"지금 신규매수 가능";
  }else action="돌파 확인 후 매수";
 }else if(eligible&&state==="NONE"&&qualityStrong){
  action=trigger>=8||price.status==="CHASE_RISK"||price.status==="EXCESSIVE_CHASE"?"눌림 시 매수":"돌파 확인 후 매수";
 }
 const coverage=[Boolean(p),Boolean(o),Boolean(s),Boolean(input.referenceTradePlan),Boolean(input.live)].filter(Boolean).length;
 const confidence=coverage>=5?"HIGH":coverage>=3?"MEDIUM":"LOW";
 const ozawaStatus=o?.timingAction==="EXIT_AVOID"?"EXIT_AVOID":o?.confirmedPrimaryName?`CONFIRMED: ${o.confirmedPrimaryName}`:o?.pendingPrimaryName?`PENDING: ${o.pendingPrimaryName}`:o?`${o.cycleState||"N/A"} / PRICE_CONFIRMATION":"N/A";
 const reasons:string[]=[];
 reasons.push(`${state} setup ${setup}/30${p?.trendQualified?" · trend qualified":""}`);
 reasons.push(`Trigger ${trigger}/15 · ${ozawaStatus}`);
 reasons.push(`ARMA ${round(live.armaScore)} / R ${round(live.rScore)} / PRS ${round(live.prs)}`);
 if(s)reasons.push(`Sector ${s.statusLabel||s.status||"N/A"} · rotation5 ${round(n(s.rotation5d),1)}`);
 if(input.referenceTradePlan&&input.currentPrice)reasons.push(`Price ${price.status}${price.chasePct==null?"":` · buyHigh 대비 ${price.chasePct>=0?"+":""}${price.chasePct}%`}`);
 return {modelVersion:ENTRY_MODEL_VERSION,weights:ENTRY_WEIGHTS,entryRank,eligible,hardGates,action,confidence,components:{pullbackSetup:setup,trigger,armaQuality:quality,flow,sector,prsRisk:risk,livePriceRiskReward:price.score},pullbackState:state,pullbackTotalScore:p?.totalScore??null,trendQualified:p?.trendQualified??null,confirmationQualified:p?.confirmationQualified??null,ozawaStatus,sectorStatus:s?.statusLabel||s?.status||null,priceStatus:price.status,chasePct:price.chasePct,reasons:reasons.slice(0,5)};
}

export function preScreenScore(context:EntryContextRow){
 const result=scoreEntry({context});
 return result.entryRank-result.components.livePriceRiskReward;
}
