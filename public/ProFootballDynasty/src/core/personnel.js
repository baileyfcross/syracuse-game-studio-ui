import { NFL_2026 } from '../config/nfl2026.js';
import { capSpace, playerCapHit, makeContract, releasePlayer, initializeFinance } from './finance.js';

export function markInjuredReserve(team,playerId,week,year){
  initializeFinance(team,year);
  const i=team.roster.findIndex(p=>p.id===playerId);
  if(i<0)throw Error('Player not on active roster');
  const p=team.roster[i];if(p.injuryWeeks<1)throw Error('Only injured players can enter IR');
  const copy={...p,irSince:week,irReturnWeek:week+4};
  team.roster.splice(i,1);team.injuredReserve.push(copy);
  return copy;
}
export function activateInjuredReserve(team,playerId,week){
  const i=(team.injuredReserve||[]).findIndex(p=>p.id===playerId);
  if(i<0)throw Error('Player not on injured reserve');
  const p=team.injuredReserve[i];
  if(week<p.irReturnWeek||p.injuryWeeks>0)throw Error('Player must complete IR return minimum and be healthy');
  if(team.roster.length>=NFL_2026.activeRosterLimit)throw Error('53-man roster limit reached');
  team.injuredReserve.splice(i,1);delete p.irSince;delete p.irReturnWeek;team.roster.push(p);
  return p;
}
const PS_WEEKLY=13_750; // 2026 first-tier weekly CBA rate; eligibility simplified.
export function addToPracticeSquad(team,player,year,baseCap,weeklyPay=PS_WEEKLY){
  initializeFinance(team,year);
  if(team.practiceSquad.length>=NFL_2026.practiceSquadLimit)throw Error('Practice squad is full (16 players)');
  if(team.roster.some(p=>p.id===player.id)||team.injuredReserve.some(p=>p.id===player.id)||team.practiceSquad.some(p=>p.id===player.id))throw Error('Player already employed');
  if(!Number.isSafeInteger(weeklyPay)||weeklyPay<PS_WEEKLY)throw Error('Invalid practice squad weekly pay');
  const p=structuredClone(player);
  p.contract=makeContract(year,{salary:weeklyPay*18,years:1});p.practiceWeeklySalary=weeklyPay;p.elevationCount=0;
  if(capSpace(team,year,baseCap)<playerCapHit(p,year))throw Error('Insufficient salary cap space for practice squad');
  team.practiceSquad.push(p);return p;
}
export function releaseFromPracticeSquad(team,playerId){
  const i=(team.practiceSquad||[]).findIndex(p=>p.id===playerId);
  if(i<0)throw Error('Player not on practice squad');
  const [p]=team.practiceSquad.splice(i,1);
  team.elevatedPlayerIds=team.elevatedPlayerIds.filter(id=>id!==playerId);
  p.contract=null;delete p.practiceWeeklySalary;return p;
}
export function promotePracticePlayer(team,playerId,year,baseCap,salary=1_000_000){
  const found=team.practiceSquad?.find(p=>p.id===playerId);
  if(!found)throw Error('Practice squad player not found');
  if(team.roster.length>=53)throw Error('53-man roster limit reached');
  const clone=structuredClone(team), p=clone.practiceSquad.find(x=>x.id===playerId);
  clone.practiceSquad=clone.practiceSquad.filter(x=>x.id!==playerId);
  p.contract=makeContract(year,{salary,years:1});delete p.practiceWeeklySalary;
  clone.roster.push(p);
  if(capSpace(clone,year,baseCap)<0)throw Error('Insufficient cap space to promote player');
  releaseFromPracticeSquad(team,playerId);
  team.roster.push(p);return p;
}
export function elevatePracticePlayer(team,playerId,week){
  const p=team.practiceSquad?.find(p=>p.id===playerId);
  if(!p)throw Error('Player not on practice squad');
  if((p.elevationCount||0)>=3)throw Error('Player has used three standard elevations; must sign to active roster');
  if(team.elevationWeek!==week){team.elevationWeek=week;team.elevatedPlayerIds=[];}
  if(team.elevatedPlayerIds.includes(playerId))throw Error('Player already elevated this week');
  if(team.elevatedPlayerIds.length>=2)throw Error('Maximum of two standard elevations per week');
  team.elevatedPlayerIds.push(playerId);p.elevationCount=(p.elevationCount||0)+1;
  return p;
}
export function gameRoster(team,week){
  if(team.elevationWeek!==week||!team.elevatedPlayerIds?.length)return team;
  return {...team,roster:[...team.roster,...team.practiceSquad.filter(p=>team.elevatedPlayerIds.includes(p.id))]};
}
export function clearWeeklyElevations(team){team.elevatedPlayerIds=[];team.elevationWeek=null;}
export function gameDayList(team){
  const healthy=team.roster.filter(p=>p.injuryWeeks===0).sort((a,b)=>b.rating-a.rating);
  const ol=healthy.filter(p=>p.position==='OL');
  const limit=ol.length>=8?NFL_2026.gameDayActivesWithEightOL:NFL_2026.gameDayActivesOtherwise;
  const choices=[...ol.slice(0,8),...healthy.filter(p=>p.position!=='OL')].slice(0,limit);
  return {limit,active:choices.map(p=>p.id),inactive:healthy.filter(p=>!choices.includes(p)).map(p=>p.id),injured:team.roster.filter(p=>p.injuryWeeks>0).map(p=>p.id)};
}
export function advanceReserveWeek(team){
  for(const p of team.injuredReserve||[])if(p.injuryWeeks>0)p.injuryWeeks--;
  for(const p of team.practiceSquad||[])if(p.injuryWeeks>0)p.injuryWeeks--;
}
export function queueWaiver(state,teamId,playerId){
  const team=state.teams.find(t=>t.id===teamId);if(!team)throw Error('Unknown team');
  const original=team.roster.find(p=>p.id===playerId);
  if(!original)throw Error('Player not found');
  const oldContract=structuredClone(original.contract);
  const p=releasePlayer(team,playerId,state.season);
  const waiver={id:`W-${state.season}-${state.week}-${playerId}`,player:p,originalContract:oldContract,
    releasedBy:teamId,availableAfterWeek:state.week,claims:[]};
  state.waivers.push(waiver);return waiver;
}
export function submitWaiverClaim(state,teamId,waiverId){
  const record=state.waivers.find(w=>w.id===waiverId);
  if(!record)throw Error('Waiver listing not found');
  if(record.releasedBy===teamId)throw Error('Releasing club cannot reclaim immediately');
  if(!state.teams.some(t=>t.id===teamId))throw Error('Unknown team');
  if(record.claims.includes(teamId))throw Error('Claim already placed');
  record.claims.push(teamId);return record;
}
/** Simple lowest-winning-percentage priority, not the complete NFL waiver order. */
export function resolveWaivers(state){
  const settled=[];
  for(const w of state.waivers){
    if(w.availableAfterWeek>=state.week && state.phase==='regular')continue;
    const priority=[...w.claims].sort((a,b)=>{
      const team=id=>state.teams.find(t=>t.id===id);
      const pct=t=>(t.wins+0.5*t.ties)/(t.wins+t.losses+t.ties||1);
      return pct(team(a))-pct(team(b))||a.localeCompare(b);
    });
    let winner=null;
    for(const id of priority){
      const team=state.teams.find(t=>t.id===id);if(team.roster.length>=53)continue;
      const p=structuredClone(w.player);p.contract=w.originalContract?{...w.originalContract,signingBonus:0,bonusSchedule:{}}:null;
      if(capSpace(team,state.season,state.salaryCap)<playerCapHit(p,state.season))continue;
      team.roster.push(p);winner=id;break;
    }
    if(!winner)state.freeAgents.push(w.player);
    settled.push({player:w.player.name,winner});
  }
  state.waivers=state.waivers.filter(w=>w.availableAfterWeek>=state.week&&state.phase==='regular');
  return settled;
}
