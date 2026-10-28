/** Independent franchise front-office AI. The estimates below are gameplay models, not a CBA valuation table. */
import { NFL_2026 } from '../config/nfl2026.js';
import { POSITION_COUNTS } from './roster.js';
import { capSpace, signPlayer, extendPlayer, annualBase } from './finance.js';
import { exchangeAssets } from './transactions.js';

const PREMIUM={QB:2.45,RB:.70,WR:1.3,TE:.95,OL:1.24,DL:1.14,EDGE:1.65,LB:1.02,CB:1.25,S:.94,K:.50,P:.50,LS:.40};
const round50k=n=>Math.round(n/50_000)*50_000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const teamBy=(state,id)=>{const t=state.teams.find(t=>t.id===id);if(!t)throw Error('Unknown franchise');return t;};
const futureYear=state=>state.offseason?.year??(state.phase==='offseason'?state.season+1:state.season);
const projectedCap=year=>Math.round(NFL_2026.salaryCap*Math.pow(1.04,year-2026));
export function positionalNeed(team,position){
  const count=team.roster.filter(p=>p.position===position).length;
  const target=POSITION_COUNTS[position]||2;
  const best=team.roster.filter(p=>p.position===position).reduce((v,p)=>Math.max(v,p.rating),0);
  return clamp((target-count)*8, -12, 25)+(best<66?8:best<74?4:0);
}
export function marketAnnual(player){
  const rating=clamp(player.rating,40,99);
  const rate=rating<65?900_000+(rating-40)*45_000:2_025_000+Math.pow((rating-65)/25,1.8)*13_000_000;
  const ageFactor=player.age>33?.68:player.age>30?.85:player.age<26?1.06:1;
  return Math.max(900_000,round50k(rate*(PREMIUM[player.position]||1)*ageFactor));
}
function offerTerms(player,offer){
  const salary=Number(offer.salary),years=Number(offer.years),signingBonus=Number(offer.signingBonus||0);
  if(!Number.isSafeInteger(salary)||salary<900_000||salary>120_000_000)throw Error('Salary must be a whole-dollar value from $900,000 to $120 million');
  if(!Number.isInteger(years)||years<1||years>5)throw Error('Offer years must be 1 through 5');
  if(!Number.isSafeInteger(signingBonus)||signingBonus<0||signingBonus>150_000_000)throw Error('Invalid signing bonus');
  return {salary,years,signingBonus};
}
export function evaluateOffer(player,offer,{extension=false,difficulty='standard'}={}){
  const terms=offerTerms(player,offer),market=marketAnnual(player);
  const desiredYears=player.age>=32?1:player.age>=29?2:player.rating>=78?4:3;
  const annualValue=terms.salary+terms.signingBonus/terms.years;
  const lengthAdjustment=clamp(1-Math.abs(terms.years-desiredYears)*.035,.84,1);
  // Unhappy players demand a premium to remain with their current franchise.
  // This is a fictional negotiation modifier, not an official NFL contract rule.
  const moraleAdjustment=extension?clamp(1+((65-(player.morale??65))*.003),.90,1.17):1;
  const threshold=market*(extension?.96:1)*lengthAdjustment*moraleAdjustment*({casual:.93,standard:1,challenging:1.08}[difficulty]||1);
  const accepted=annualValue>=threshold;
  const counter={salary:round50k(Math.max(900_000,market*.91)),years:desiredYears,
    signingBonus:round50k(Math.max(0,market*desiredYears*.26))};
  return {accepted,market,annualValue,desiredYears,counter,terms,
    reason:accepted?'Offer meets player expectations':extension&&(player.morale??65)<45?'Player is unhappy with his role and wants a larger commitment':'Player requests better total compensation'};
}
function pushHistory(state,item){state.negotiationHistory??=[];state.negotiationHistory.push(item);state.negotiationHistory=state.negotiationHistory.slice(-100);state.lastNegotiation=item;}
/** Human-controlled team sends a contract offer; no player moves on rejection. */
export function negotiateFreeAgent(state,teamId,playerId,offer){
  const team=teamBy(state,teamId),index=state.freeAgents.findIndex(p=>p.id===playerId);
  if(index===-1)throw Error('Free agent is no longer available');
  if(state.phase==='offseason'&&state.offseason?.stage!=='freeAgency')throw Error('Free-agent negotiations are closed for this draft');
  const player=state.freeAgents[index],evaluation=evaluateOffer(player,offer,{difficulty:state.settings?.difficulty});
  if(evaluation.accepted){
    const year=futureYear(state),cap=state.phase==='offseason'?projectedCap(year):state.salaryCap;
    signPlayer(team,player,year,{...evaluation.terms,baseCap:cap,rosterLimit:['trainingCamp','preseason'].includes(state.phase)?90:53});
    state.freeAgents.splice(index,1);
  }
  const result={kind:'freeAgent',teamId,playerId,playerName:player.name,accepted:evaluation.accepted,
    reason:evaluation.reason,counter:evaluation.accepted?null:evaluation.counter,year:futureYear(state)};
  pushHistory(state,result);
  if(evaluation.accepted)state.events.push({year:state.season,text:`${team.name} signed ${player.name} following contract negotiations.`});
  return result;
}
export function negotiateExtension(state,teamId,playerId,offer){
  if(state.phase==='offseason'&&state.offseason?.stage!=='freeAgency'&&state.offseason?.stage!==undefined)throw Error('Extensions are closed during the draft');
  const team=teamBy(state,teamId),player=team.roster.find(p=>p.id===playerId);
  if(!player?.contract)throw Error('No active player contract');
  const year=futureYear(state);
  if(player.rookieRound!=null&&year<player.contract.startYear+3)throw Error('Drafted rookie contracts cannot be renegotiated before three regular seasons');
  const evaluation=evaluateOffer(player,offer,{extension:true,difficulty:state.settings?.difficulty});
  if(evaluation.accepted){
    extendPlayer(team,playerId,year,{...evaluation.terms,baseCap:state.phase==='offseason'?projectedCap(year):state.salaryCap});
  }
  const result={kind:'extension',teamId,playerId,playerName:player.name,accepted:evaluation.accepted,
    reason:evaluation.reason,counter:evaluation.accepted?null:evaluation.counter,year};
  pushHistory(state,result);
  if(evaluation.accepted)state.events.push({year:state.season,text:`${team.name} negotiated a contract extension with ${player.name}.`});
  return result;
}
/** CPU clubs prioritize starting-position holes and younger impact players while reserving cap space. */
export function cpuFreeAgency(state,{controlledTeamId='T01',maxPerClub=2}={}){
  if(state.phase!=='offseason'||state.offseason?.stage!=='freeAgency')throw Error('CPU free agency runs during offseason free agency');
  const year=state.offseason.year,cap=projectedCap(year),signings=[];
  for(const team of state.teams){
    if(team.id===controlledTeamId)continue;
    for(let slot=0;slot<maxPerClub;slot++){
      if(team.roster.length>=53)break;
      const room=capSpace(team,year,cap);
      if(room<1_300_000)break;
      const candidates=state.freeAgents.map(p=>({p,need:positionalNeed(team,p.position),salary:marketAnnual(p)}))
        .filter(x=>x.salary<=room*.65&&x.p.age<35&&team.roster.filter(p=>p.position===x.p.position).length<=(POSITION_COUNTS[x.p.position]||2)+1)
        .sort((a,b)=>(b.need*1.8+b.p.rating-b.salary/1_400_000)-(a.need*1.8+a.p.rating-a.salary/1_400_000));
      const choice=candidates[0];if(!choice||choice.need<0)break;
      const years=choice.p.age>30?1:2;
      try{
        signPlayer(team,choice.p,year,{salary:choice.salary,years,baseCap:cap});
        state.freeAgents=state.freeAgents.filter(p=>p.id!==choice.p.id);
        signings.push({teamId:team.id,playerId:choice.p.id,name:choice.p.name,position:choice.p.position,salary:choice.salary});
      }catch{break;}
    }
  }
  state.events.push({year:state.season,text:`CPU franchise offices completed ${signings.length} free-agent signings.`});
  state.offseason.cpuSignings=(state.offseason.cpuSignings||[]).concat(signings);
  return signings;
}
const playerAssetValue=(player,receiving)=>{
  const ageAdj=player.age<27?1.1:player.age>32?.65:player.age>29?.84:1;
  const quality=Math.max(0,player.rating-52);
  const capBurden=player.contract?Math.max(0,annualBase(player.contract,player.contract.startYear)-marketAnnual(player)) / 1_000_000:0;
  return quality*quality/22*ageAdj*(PREMIUM[player.position]||1)+(positionalNeed(receiving,player.position)*.9)-capBurden*3;
};
const draftAssetValue=(pick,owning)=>{
  const discount=clamp(pick.year-owning.season,1,4);
  const base={1:135,2:72,3:40,4:24,5:14,6:9,7:5}[pick.round]||3;
  return base*Math.pow(.87,discount-1);
};
export function evaluateTrade(state,teamId,cpuTeamId,{aPlayers=[],bPlayers=[],aPicks=[],bPicks=[]}={}){
  if(teamId===cpuTeamId)throw Error('Cannot propose a trade with the same team');
  const a=teamBy(state,teamId),b=teamBy(state,cpuTeamId),assets={aPlayers,bPlayers,aPicks,bPicks};
  for(const arr of Object.values(assets))if(!Array.isArray(arr)||new Set(arr).size!==arr.length)throw Error('Invalid trade assets');
  const picks=new Map(state.draftPicks.map(p=>[p.id,p]));
  const lookupPlayer=(team,id)=>{const p=team.roster.find(p=>p.id===id);if(!p)throw Error('Trade player not found');return p;};
  for(const id of aPicks)if(picks.get(id)?.ownerId!==teamId)throw Error('Trade pick not owned by offering team');
  for(const id of bPicks)if(picks.get(id)?.ownerId!==cpuTeamId)throw Error('Trade pick not owned by CPU team');
  if(![...aPlayers,...bPlayers,...aPicks,...bPicks].length)throw Error('Trade must contain an asset');
  const delivered=aPlayers.reduce((v,id)=>v+playerAssetValue(lookupPlayer(a,id),b),0)+aPicks.reduce((v,id)=>v+draftAssetValue(picks.get(id),state),0);
  const requested=bPlayers.reduce((v,id)=>v+playerAssetValue(lookupPlayer(b,id),b),0)+bPicks.reduce((v,id)=>v+draftAssetValue(picks.get(id),state),0);
  const threshold=requested*({casual:1,standard:1.07,challenging:1.16}[state.settings?.difficulty]||1.07)+2;
  return {accepted:delivered>=threshold,delivered:Math.round(delivered),requested:Math.round(requested),
    minimum:Math.ceil(threshold),reason:delivered>=threshold?'CPU franchise accepted the proposed asset values':'CPU franchise wants more value in return'};
}
export function proposeTrade(state,teamId,cpuTeamId,assets){
  if(state.phase==='offseason'&&state.offseason?.stage==='draft')throw Error('Trades are paused during the live draft in this prototype');
  const rating=evaluateTrade(state,teamId,cpuTeamId,assets);
  if(rating.accepted){
    // exchangeAssets verifies salary cap, roster sizes and ownership atomically.
    exchangeAssets(state,teamId,cpuTeamId,assets);
  }
  state.lastTradeDecision={...rating,teamId,cpuTeamId};
  return state.lastTradeDecision;
}
