import { signPlayer, releasePlayer } from './finance.js';
import { NFL_2026 } from '../config/nfl2026.js';
import { ensureDraftPicks } from './picks.js';
import { generateDraftClass } from './roster.js';
import { positionalNeed } from './offseason.js';
const ROOKIE_BASE_BY_ROUND=[5_500_000,2_400_000,1_550_000,1_250_000,1_080_000,1_000_000,950_000];
const capFor=year=>Math.round(NFL_2026.salaryCap*Math.pow(1.04,year-2026));
export function initializeDraft(state){
  if(state.phase!=='offseason'||state.offseason?.stage!=='freeAgency')throw Error('Begin the offseason free-agency stage first');
  state.offseason.stage='draft';state.offseason.index=0;state.offseason.picks=[];
  const order=state.offseason.draftOrder;
  state.offseason.board=Array.from({length:NFL_2026.draftRounds},(_,round)=>order.map(teamId=>`${state.offseason.year}-R${round+1}-${teamId}`)).flat();
  return currentPick(state);
}
export function currentPick(state){
  if(state.offseason?.stage!=='draft')return null;
  const id=state.offseason.board[state.offseason.index];
  if(!id)return null;
  const asset=state.draftPicks.find(p=>p.id===id);
  if(!asset)throw Error(`Draft asset ${id} missing`);
  return {...asset,overall:state.offseason.index+1};
}
export function cpuDraftChoice(state,teamId){
  const team=state.teams.find(t=>t.id===teamId);if(!team)throw Error('Unknown draft team');
  const office=state.scouting?.[teamId];
  // CPU scouts see their reports, not the prospect's hidden true potential or rating.
  const candidates=state.prospects.map(p=>{
    const report=office?.reports?.[p.id];
    const estimated=report?.estimatedRating??p.scoutedRating;
    const upside=report?.projectedCeiling!=null?(report.projectedCeiling-estimated)*.35:0;
    return {p,score:estimated+upside+(positionalNeed(team,p.position)*.7)+(office?.bookmarks?.includes(p.id)?6:0)};
  });
  candidates.sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
  return candidates[0]?.p?.id;
}
/** One pick at a time. If a cap/53-man restriction blocks signing, draft rights remain owned. */
export function draftSelection(state,prospectId,{cpu=false}={}){
  const pick=currentPick(state);if(!pick)throw Error('No live draft pick');
  if(!cpu&&pick.ownerId!==state.offseason.managedTeamId)throw Error('CPU franchise is on the clock');
  const team=state.teams.find(t=>t.id===pick.ownerId),prospect=state.prospects.find(p=>p.id===prospectId);
  if(!prospect)throw Error('Draft prospect not available');
  const round=pick.round,year=state.offseason.year;prospect.rookieRound=round;
  const salary=ROOKIE_BASE_BY_ROUND[round-1],signingBonus=Math.round(salary*(round===1?1.6:.35));
  // Preserve the rookie's rights if roster and cap constraints prevent immediate signing.
  let signed=false;
  if(team.roster.length>=NFL_2026.activeRosterLimit){
    const replacement=[...team.roster].sort((a,b)=>a.rating-b.rating)[0];
    if(replacement&&replacement.rating<=prospect.rating+5){
      const clone=structuredClone(team);
      const cut=releasePlayer(clone,replacement.id,year);
      try{
        signPlayer(clone,prospect,year,{salary,years:4,signingBonus,baseCap:capFor(year)});
        Object.assign(team,{roster:clone.roster,deadCap:clone.deadCap,deadCapByYear:clone.deadCapByYear});
        state.freeAgents.push(cut);signed=true;
      }catch{/* Keep unsigned rights. */}
    }
  }else{
    try{signPlayer(team,prospect,year,{salary,years:4,signingBonus,baseCap:capFor(year)});signed=true;}catch{/* Keep unsigned rights. */}
  }
  state.prospects=state.prospects.filter(p=>p.id!==prospectId);
  if(!signed){state.unsignedRookies??=[];state.unsignedRookies.push({teamId:team.id,year,prospect:structuredClone(prospect),salary,signingBonus});}
  const selected={overall:pick.overall,round,pickId:pick.id,teamId:team.id,originalTeamId:pick.originalTeamId,
    prospectId,name:prospect.name,position:prospect.position,rating:prospect.rating,signed,cpu};
  state.offseason.picks.push(selected);state.offseason.index++;
  if(state.offseason.index===state.offseason.board.length){
    state.offseason.stage='ready';
    state.draftHistory.push({year,picks:[...state.offseason.picks]});
    state.draftPicks=state.draftPicks.filter(p=>p.year!==year);
    state.events.push({year,text:`The ${year} professional draft completed (${state.offseason.picks.length} picks).`});
  }
  return selected;
}
export function advanceCpuDraft(state){
  if(state.offseason?.stage!=='draft')throw Error('Draft not active');
  const completed=[];
  while(currentPick(state)&&currentPick(state).ownerId!==state.offseason.managedTeamId){
    const pick=currentPick(state),choice=cpuDraftChoice(state,pick.ownerId);
    if(!choice)throw Error('Draft pool exhausted');
    completed.push(draftSelection(state,choice,{cpu:true}));
  }
  return completed;
}
export function completeDraft(state){
  if(state.offseason?.stage!=='draft'&&state.offseason?.stage!=='ready')throw Error('Draft not active');
  let count=0;
  while(currentPick(state)){
    const pick=currentPick(state),choice=cpuDraftChoice(state,pick.ownerId);
    if(!choice)throw Error('Draft pool exhausted');
    draftSelection(state,choice,{cpu:true});count++;
  }
  return count;
}
/** Legacy one-step draft entry still used by migrated seasons, CLI and tests. */
export function autoDraft(state,year=state.season+1){
  if(!state.offseason||state.offseason.stage==='freeAgency')throw Error('Initialize the offseason draft before autoDraft');
  completeDraft(state);
  return state.offseason.picks;
}
