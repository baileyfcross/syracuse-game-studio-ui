import { rng,hashString,randomInt } from './random.js';
import { generateDraftClass } from './roster.js';
import {initializePlayerDevelopment} from './development.js';

/** One limited-information view per franchise, without exposing true prospect ratings. */
export function initializeScouting(state){
  state.scouting??={};
  for(const team of state.teams){
    state.scouting[team.id]??={focus:'balanced',reports:{},bookmarks:[]};
  }
}
export const SCOUTING_FOCUSES=['balanced','quarterback','offensive-line','pass-rush','coverage','skill-positions'];
const matches=(focus,p)=>({quarterback:['QB'],'offensive-line':['OL'],'pass-rush':['EDGE','DL'],'coverage':['CB','S'],'skill-positions':['RB','WR','TE']}[focus]||[]).includes(p.position);
export function scoutProspect(state,teamId,prospectId){
  const office=state.scouting?.[teamId];if(!office)throw Error('Unknown scouting office');
  const player=state.prospects.find(p=>p.id===prospectId);if(!player)throw Error('Prospect not found');
  if(state.phase!=='regular'&&state.phase!=='playoffs'&&state.phase!=='offseason')throw Error('Scouting unavailable');
  initializePlayerDevelopment(player,state.seed);
  const report=office.reports[prospectId]??={visits:0};
  if(report.visits>=3)throw Error('Prospect is already fully scouted');
  // Limit scouting during the season. Each club can make two evaluations per week.
  office.weeklyUsage??={};
  const key=`${state.season}:${state.week}:${state.phase}:${state.round}`;
  if((office.weeklyUsage[key]||0)>=({relaxed:3,standard:2,strict:1}[state.settings?.scoutingDifficulty]||2))throw Error('Weekly scouting visit limit reached');
  const random=rng(hashString(`${state.seed}:${teamId}:${prospectId}:${report.visits}`));
  const focusBoost=matches(office.focus,player)?3:0;
  const director=state.teams.find(t=>t.id===teamId)?.staff?.scoutingDirector?.rating||65;
  const departmentBoost=Math.floor(Math.max(0,director-64)/13);
  const uncertainty=Math.max(1,[14,9,4][report.visits]-focusBoost-departmentBoost);
  report.visits++;
  report.estimatedRating=Math.max(30,Math.min(99,player.rating+randomInt(random,-uncertainty,uncertainty)));
  report.uncertainty=uncertainty;
  report.grade=report.estimatedRating>=80?'Elite':report.estimatedRating>=69?'Starter':report.estimatedRating>=58?'Developmental':'Depth';
  const ceilingSpread=Math.max(2,Math.round(uncertainty*1.35));
  report.projectedCeiling=Math.max(report.estimatedRating,Math.min(99,player.development.potential+randomInt(random,-ceilingSpread,ceilingSpread)));
  report.ceilingUncertainty=ceilingSpread;
  report.workEthic=report.visits>=2?(player.development.workEthic>=78?'Excellent':player.development.workEthic<55?'Questionable':'Average'):'Unknown';
  report.medical=report.visits>=3?(player.development.durability<55?'Injury concern':'No major flag'):'Pending';
  office.reports[prospectId]=report;
  office.weeklyUsage[key]=(office.weeklyUsage[key]||0)+1;
  return {...report};
}
export function setScoutingFocus(state,teamId,focus){
  if(!SCOUTING_FOCUSES.includes(focus))throw Error('Invalid scouting focus');
  state.scouting[teamId].focus=focus;
  return state.scouting[teamId];
}
export function toggleProspectBookmark(state,teamId,prospectId){
  if(!state.prospects.some(p=>p.id===prospectId))throw Error('Prospect not found');
  const office=state.scouting[teamId];
  office.bookmarks=office.bookmarks.includes(prospectId)?office.bookmarks.filter(id=>id!==prospectId):[...office.bookmarks,prospectId];
  return office.bookmarks;
}
export function scoutingSummary(state,teamId){
  const office=state.scouting[teamId];
  // The user sees an uncertain initial grade, then increasingly precise private evaluations.
  const prospects=state.prospects.map(p=>{
    const publicEstimate=55+(hashString(`${p.id}-public`) % 30);
    const r=office.reports[p.id];
    return {id:p.id,name:p.name,position:p.position,age:p.age,
      estimate:r?.estimatedRating??publicEstimate,
      uncertainty:r?.uncertainty??20,visits:r?.visits??0,grade:r?.grade??'Unscouted',
      projectedCeiling:r?.projectedCeiling??null,ceilingUncertainty:r?.ceilingUncertainty??null,
      workEthic:r?.workEthic??'Unknown',medical:r?.medical??'Pending',
      bookmarked:office.bookmarks.includes(p.id)};
  }).sort((a,b)=>(Number(b.bookmarked)-Number(a.bookmarked))||b.estimate-a.estimate);
  return {focus:office.focus,reports:office.reports,prospects,bookmarks:office.bookmarks};
}
export function resetScoutingForNewClass(state,year){
  state.prospects=generateDraftClass(year,state.seed);
  for(const p of state.prospects)initializePlayerDevelopment(p,state.seed);
  state.scouting={};initializeScouting(state);
}
