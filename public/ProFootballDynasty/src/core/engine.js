import { NFL_2026 } from '../config/nfl2026.js';
import { createTeams } from './teams.js';
import { populateRosters, generateFreeAgents, generateDraftClass, POSITION_COUNTS } from './roster.js';
import { generateSchedule } from './schedule.js';
import { simulateMatch } from '../sim/game.js';
import { recalculateRecords, playoffSeeds, getDraftOrder } from './standings.js';
import { initializeDraft, currentPick, draftSelection, advanceCpuDraft, completeDraft } from './draft.js';
import { cpuFreeAgency, negotiateFreeAgent, negotiateExtension, proposeTrade, marketAnnual, positionalNeed } from './offseason.js';
import { signPlayer, releasePlayer, tradePlayer, capSpace, initializeFinance, capProjection, restructurePlayer, extendPlayer, finalizeContractYear, terminationCharges } from './finance.js';
import { markInjuredReserve, activateInjuredReserve, addToPracticeSquad, releaseFromPracticeSquad, promotePracticePlayer, elevatePracticePlayer, clearWeeklyElevations, advanceReserveWeek, queueWaiver, submitWaiverClaim, resolveWaivers, gameDayList, gameRoster } from './personnel.js';
import { ensureDraftPicks } from './picks.js';
import { exchangeAssets } from './transactions.js';
import { initializeTeamManagement, upgradeLegacyTeam, reconcileDepthChart, awardCoachExperience, advanceWeeklyDevelopment } from './coaching.js';
import { initializeScouting, scoutingSummary, resetScoutingForNewClass, scoutProspect } from './scouting.js';
import {initializeStaffMarket,cpuStaffReview,ageStaffContracts,hireStaff,staffSummary} from './staff.js';
import {ensureLeagueDevelopment,updateTeamMorale,developOffseasonPlayer,developmentSummary} from './development.js';
import {beginTrainingCamp,configureCamp,runCampSession,preseasonLineup,finishPreseasonWeek,autoCutTeam,finalizeCutdown,campSummary} from './calendar.js';
import { initializeStatistics, registerGameStatistics, leaders, teamSeasonStatistics, finishSeasonStatistics, resetSeasonStatistics, LEADER_CATEGORIES } from './statistics.js';
import { ensureLegacy, recordLegacyGame, archiveSeason, recordRetirement, processHallOfFame, reportDraftClass, legacySummary } from './legacy.js';
import {initializeCustomization} from './customization.js';
import {finalizeSeasonHonors} from './honors.js';
import {ensureCoachCareer} from './career.js';
export function createLeague(seed=2026){
  const teams=createTeams(seed);
  populateRosters(teams,2026,seed);
  for(const team of teams){initializeTeamManagement(team,seed);initializeFinance(team,2026);}
  const state={version:10,managedTeamId:'T01',season:2026,year:2026,seed,phase:'regular',week:1,round:0,
    salaryCap:NFL_2026.salaryCap,teams,games:generateSchedule(teams,2026),
    playoffGames:[], playoffSeedings:null, champion:null, history:[],draftHistory:[],
    freeAgents:generateFreeAgents(2026,seed),prospects:generateDraftClass(2027,seed),
    waivers:[],events:[{year:2026,text:'The professional football league has opened its 2026 season.'}]};
  initializeStaffMarket(state);ensureLeagueDevelopment(state);
  initializeScouting(state);
  initializeStatistics(state);
  ensureDraftPicks(state);
  ensureLegacy(state);initializeCustomization(state);ensureCoachCareer(state);state.honorsHistory=[];
  state.statisticsPartial=false;
  return state;
}
export function upgradeLeague(state){
  if(![1,2,3,4,5,6,7,8,9,10].includes(state.version))throw Error('Incompatible save version');
  for(const team of state.teams){upgradeLegacyTeam(team,state.seed);initializeFinance(team,state.season);}
  initializeStaffMarket(state);ensureLeagueDevelopment(state);
  initializeScouting(state);
  initializeStatistics(state);
  state.statisticsPartial??=state.games.some(g=>g.status==='final'&&!g.boxScore);
  state.waivers??=[];
  ensureDraftPicks(state);
  state.negotiationHistory??=[];state.unsignedRookies??=[];
  state.managedTeamId??='T01';state.preseasonGames??=[];
  ensureLegacy(state,{migration:state.version<9});initializeCustomization(state);ensureCoachCareer(state,{migration:true});state.honorsHistory??=[];state.version=10;return state;
}
const byId=(state,id)=>{const t=state.teams.find(t=>t.id===id);if(!t)throw Error(`Unknown team ${id}`);return t;};
const compactGame=g=>({id:g.id,year:g.year,season:g.season,week:g.week,home:g.home,away:g.away,
  category:g.category,type:g.type,round:g.round,conference:g.conference,
  status:g.status,scoreHome:g.scoreHome,scoreAway:g.scoreAway,overtime:g.overtime,
  quarters:g.boxScore?.quarters||null,playsAvailable:Boolean(g.plays)});
export function getGameDetail(state,gameId){
  const game=[...state.games,...state.playoffGames,...(state.preseasonGames||[])].find(g=>g.id===gameId);
  if(!game)throw Error('Game not found');
  const team=t=>({id:t.id,name:t.name,conference:t.conference,division:t.division,color:t.color});
  return {game,home:team(byId(state,game.home)),away:team(byId(state,game.away))};
}
export function tradeTargetSummary(state,teamId){
  const team=byId(state,teamId);
  return {id:team.id,name:team.name,roster:team.roster.map(p=>({id:p.id,name:p.name,position:p.position,rating:p.rating,capHit:Math.round(p.contract?.baseSalary||0)})),
    picks:state.draftPicks.filter(p=>p.ownerId===teamId)};
}
export function stateSummary(state,selectedTeamId='T01'){
  const displayedId=state.coachCareer?.teamId||state.coachCareer?.lastTeamId||selectedTeamId;
  const team=byId(state,displayedId);
  const financialYear=state.offseason?.year??state.season;
  const offseason=state.offseason?{...state.offseason,board:undefined,
    onClock:currentPick(state),completed:state.offseason.picks?.length||0,
    total:state.offseason.board?.length||224,recent:(state.offseason.picks||[]).slice(-12).reverse()}:null;
  return {coachCareer:state.coachCareer,settings:state.settings,honorsHistory:(state.honorsHistory||[]).slice(-5).reverse(),customizationLog:state.customizationLog.slice(-12).reverse(),offseason,lastNegotiation:state.lastNegotiation||null,lastTradeDecision:state.lastTradeDecision||null,
    financialYear,season:state.season,phase:state.phase,week:state.week,round:state.round,
    camp:campSummary(state,team.id),preseasonSchedule:(state.preseasonGames||[]).filter(g=>g.home===team.id||g.away===team.id).map(compactGame),
    management:staffSummary(state,team.id),development:developmentSummary(team),managedTeamId:state.managedTeamId,
    champion:state.champion,teamId:team.id,team,capSpace:capSpace(team,financialYear,state.salaryCap),
    capProjection:capProjection(team,financialYear,state.salaryCap),gameDay:gameDayList(team),
    waivers:state.waivers.map(w=>({id:w.id,player:w.player,claims:w.claims.length,availableAfterWeek:w.availableAfterWeek})),
    draftPicks:state.draftPicks.filter(p=>p.ownerId===team.id),
    salaryCap:state.salaryCap,teams:state.teams.map(t=>({...t,roster:undefined,practiceSquad:undefined,injuredReserve:undefined})),
    schedule:state.games.filter(g=>g.home===team.id||g.away===team.id).map(compactGame),
    weekGames:state.games.filter(g=>g.week===state.week).map(compactGame),
    playoffs:state.playoffGames.map(compactGame),events:state.events.slice(-30).reverse(),
    freeAgents:state.freeAgents.slice().sort((a,b)=>b.rating-a.rating).slice(0,100).map(p=>({...p,asking:marketAnnual(p)})),
    draftHistory:state.draftHistory.slice(-1),history:state.history.slice(-5),
    scouting:scoutingSummary(state,team.id),stats:teamSeasonStatistics(state,team.id),
    postseasonStats:teamSeasonStatistics(state,team.id,{postseason:true}),statisticsPartial:state.statisticsPartial,
    leaders:Object.fromEntries(Object.keys(LEADER_CATEGORIES).map(cat=>[cat,leaders(state,cat,10)])),
    postseasonLeaders:Object.fromEntries(Object.keys(LEADER_CATEGORIES).map(cat=>[cat,leaders(state,cat,10,{postseason:true})])),
    awardHistory:state.awardHistory.slice(-5).reverse(),
    legacy:legacySummary(state,team.id),
    careerLeaders:Object.fromEntries(['passYards','rushYards','recYards','sacks'].map(cat=>[cat,leaders(state,cat,5,{career:true})]))};
}

/** Apply game-day injury results after worker simulation, without mutating snapshots. */
export function registerGameDayInjuries(state,game){
  let added=0;
  for(const injury of game.injuries||[]){
    const team=byId(state,injury.teamId);
    const player=team.roster.find(p=>p.id===injury.playerId);
    if(!player)continue;
    // Weekly recovery runs after games, so include this week's decrement.
    const weeks=Math.max(1,Math.min(9,injury.weeks));
    if((player.injuryWeeks||0)<weeks+1){
      player.injuryWeeks=weeks+1;player.injuryLabel=injury.label;added++;
    }
  }
  if(added)state.events.push({year:state.season,text:`${added} game-day injury reports added after ${game.id}.`});
  return added;
}
export function advanceLeague(state,precomputed=null){
  if(state.phase==='trainingCamp')return runCampSession(state);
  if(state.phase==='preseason'){
    const games=state.preseasonGames.filter(g=>g.week===state.week&&g.status==='scheduled');
    const outcomes=precomputed??new Map(games.map(g=>[g.id,simulateMatch(
      preseasonLineup(byId(state,g.home),state.week),
      preseasonLineup(byId(state,g.away),state.week),{seed:state.seed+state.season,matchId:g.id,injuryRate:state.settings.injuryRate})]));
    return finishPreseasonWeek(state,outcomes);
  }
  if(state.phase==='cutdown')throw Error('Complete the 53-man roster cutdown before Week 1.');
  if(state.phase==='regular'){
    prepareCpuWeek(state);
    const games=state.games.filter(g=>g.week===state.week&&g.status==='scheduled');
    for(const g of games){
      const result=precomputed?.get(g.id)??simulateMatch(gameRoster(byId(state,g.home),state.week),gameRoster(byId(state,g.away),state.week),{seed:state.seed+state.season,matchId:g.id,injuryRate:state.settings.injuryRate});
      Object.assign(g,result,{status:'final'});
      registerGameDayInjuries(state,g);
      registerGameStatistics(state,g);
      recordLegacyGame(state,g);
      awardCoachExperience(byId(state,g.home),g);
      awardCoachExperience(byId(state,g.away),g);
      updateTeamMorale(byId(state,g.home),g,state.season);
      updateTeamMorale(byId(state,g.away),g,state.season);
    }
    for(const team of state.teams){
      advanceWeeklyDevelopment(team,state.seed,state.season,state.week);
      advanceReserveWeek(team);clearWeeklyElevations(team);
    }
    recalculateRecords(state);
    for(const x of resolveWaivers(state))state.events.push({year:state.season,text:x.winner?`${x.player} claimed off waivers.`:`${x.player} cleared waivers.`});
    state.events.push({year:state.season,text:`Week ${state.week} completed (${games.length} games).`});
    if(state.week===NFL_2026.weeks){
      state.playoffSeedings={AFC:playoffSeeds(state,'AFC'),NFC:playoffSeeds(state,'NFC')};
      state.phase='playoffs';state.round=0;
      state.events.push({year:state.season,text:'The 14-team postseason has been set.'});
    }else state.week++;
    return games;
  }
  if(state.phase==='playoffs')return advancePlayoffs(state);
  throw Error('Offseason is active. Start next season to continue.');
}
const seedOf=(state,conf,id)=>state.playoffSeedings[conf].find(t=>t.teamId===id).seed;
function playoffResult(state,conf,home,away,round){
  const h=byId(state,home),a=byId(state,away);
  const score=simulateMatch(gameRoster(h,18+round),gameRoster(a,18+round),{seed:state.seed+state.season,postseason:true,matchId:`P-${round}-${conf}-${home}-${away}`,injuryRate:state.settings.injuryRate});
  const game={id:`P${state.season}-${state.playoffGames.length+1}`,season:state.season,week:18+round,
    home,away,type:'playoff',round,conference:conf,status:'final',...score};
  state.playoffGames.push(game);
  registerGameDayInjuries(state,game);
  registerGameStatistics(state,game);
  recordLegacyGame(state,game);
  awardCoachExperience(h,game);awardCoachExperience(a,game);
  updateTeamMorale(h,game,state.season);updateTeamMorale(a,game,state.season);
  return game;
}
function winner(game){return game.scoreHome>game.scoreAway?game.home:game.away;}
export function advancePlayoffs(state){
  if(state.phase!=='playoffs')throw Error('Not in playoffs');
  const next=state.round+1,results=[];
  if(next<=3){
    for(const conf of ['AFC','NFC']){
      const seeds=state.playoffSeedings[conf];
      if(next===1){for(const [h,a] of [[2,7],[3,6],[4,5]])results.push(playoffResult(state,conf,seeds[h-1].teamId,seeds[a-1].teamId,next));}
      else if(next===2){
        const alive=[seeds[0].teamId,...state.playoffGames.filter(g=>g.round===1&&g.conference===conf).map(winner)]
          .sort((a,b)=>seedOf(state,conf,a)-seedOf(state,conf,b));
        results.push(playoffResult(state,conf,alive[0],alive[3],next));
        results.push(playoffResult(state,conf,alive[1],alive[2],next));
      }else{
        const alive=state.playoffGames.filter(g=>g.round===2&&g.conference===conf).map(winner)
          .sort((a,b)=>seedOf(state,conf,a)-seedOf(state,conf,b));
        results.push(playoffResult(state,conf,alive[0],alive[1],next));
      }
    }
  }else if(next===4){
    const afc=winner(state.playoffGames.find(g=>g.round===3&&g.conference==='AFC'));
    const nfc=winner(state.playoffGames.find(g=>g.round===3&&g.conference==='NFC'));
    results.push(playoffResult(state,'CHAMPIONSHIP',afc,nfc,4));
    state.champion=winner(results[0]);state.phase='offseason';
    finishSeasonStatistics(state);
    finalizeSeasonHonors(state);
    archiveSeason(state);
    state.events.push({year:state.season,text:`${byId(state,state.champion).name} won the professional football championship!`});
  }else throw Error('Postseason already completed');
  state.round=next;
  state.events.push({year:state.season,text:`Postseason round ${next} complete.`});
  return results;
}
export function signFreeAgent(state,teamId,playerId,{salary,years,signingBonus}={}){
  const team=byId(state,teamId),index=state.freeAgents.findIndex(p=>p.id===playerId);
  if(index<0)throw Error('Free agent not found');
  const p=state.freeAgents[index];
  const newYear=state.phase==='offseason'?state.season+1:state.season;
  const signed=signPlayer(team,p,newYear,{salary:salary??Math.max(900_000,p.rating*65_000),years:years??2,signingBonus:signingBonus??0,baseCap:state.phase==='offseason'?Math.round(NFL_2026.salaryCap*Math.pow(1.04,newYear-2026)):state.salaryCap,rosterLimit:['trainingCamp','preseason'].includes(state.phase)?90:53});
  state.freeAgents.splice(index,1);
  state.events.push({year:state.season,text:`${team.name} signed ${p.name}.`});
  return signed;
}
export function cutPlayer(state,teamId,playerId,{june1=false}={}){
  const team=byId(state,teamId),p=team.roster.find(x=>x.id===playerId);
  if(!p)throw Error('Player not found');
  const effectiveYear=state.phase==='offseason'?state.season+1:state.season;
  if(june1){
    if((team.june1Designations?.[effectiveYear]||0)>=2)throw Error('Maximum of two June 1 designations reached');
    team.june1Designations??={};
    team.june1Designations[effectiveYear]=(team.june1Designations[effectiveYear]||0)+1;
  }
  // The simplified vested-veteran rule: players age 28+ are immediately unrestricted.
  // Other players enter waivers; users can make claims until the next advance.
  if(p.age<28&&!june1){const w=queueWaiver(state,teamId,playerId);reconcileDepthChart(team);
    state.events.push({year:state.season,text:`${team.name} waived ${p.name}.`});return w.player;}
  const released=releasePlayer(team,playerId,effectiveYear,{june1});
  reconcileDepthChart(team);state.freeAgents.push(released);state.events.push({year:state.season,text:`${team.name} released ${released.name}.`});return released;
}
export function trade(state,fromId,toId,playerId){
  if(fromId===toId)throw Error('Trade requires different teams');
  const a=byId(state,fromId),b=byId(state,toId);
  const p=tradePlayer(a,b,playerId,state.offseason?.year??state.season,state.salaryCap,['trainingCamp','preseason'].includes(state.phase)?90:53);
  reconcileDepthChart(a);reconcileDepthChart(b);state.events.push({year:state.season,text:`${a.name} traded ${p.name} to ${b.name}.`});return p;
}
/** Franchise-tag tender uses an explicitly fictional positional estimate, NOT the official five-year top-five formula. */
export function franchiseTag(state,teamId,playerId){
  if(state.phase!=='offseason'||state.offseason)throw Error('Franchise tags must be used before opening the new league year');
  const team=byId(state,teamId),player=team.roster.find(p=>p.id===playerId);
  if(!player?.contract||player.contract.expiresYear!==state.season)throw Error('Player must have an expiring contract');
  const year=state.season+1;
  if(team.tagUsedYear===year)throw Error('Only one franchise tag per season');
  const shares={QB:.105,RB:.045,WR:.077,TE:.044,OL:.065,DL:.07,EDGE:.085,LB:.068,CB:.065,S:.051,K:.026,P:.026,LS:.026};
  const offer=Math.round((state.salaryCap*1.04)*(shares[player.position]||.05)/100_000)*100_000;
  const old=structuredClone(player.contract);
  player.contract.salaries??=Object.fromEntries(Array.from({length:old.years},(_,i)=>[old.startYear+i,old.baseSalary]));
  player.contract.guarantees??={};player.contract.salaries[year]=offer;player.contract.guarantees[year]=offer;
  player.contract.expiresYear=year;player.contract.years=year-old.startYear+1;
  player.contract.taggedYear=year;
  if(capSpace(team,year,Math.round(state.salaryCap*1.04))<0){player.contract=old;throw Error('Franchise tag would exceed projected salary cap');}
  team.tagUsedYear=year;
  state.events.push({year:state.season,text:`${team.name} applied a franchise-tag tender to ${player.name}.`});
  return player;
}
export function signPractice(state,teamId,playerId){
  const team=byId(state,teamId),i=state.freeAgents.findIndex(p=>p.id===playerId);
  if(i<0)throw Error('Free agent not found');
  const p=addToPracticeSquad(team,state.freeAgents[i],state.offseason?.year??state.season,state.salaryCap);
  state.freeAgents.splice(i,1);state.events.push({year:state.season,text:`${team.name} signed ${p.name} to the practice squad.`});return p;
}
export function releasePractice(state,teamId,playerId){
  const p=releaseFromPracticeSquad(byId(state,teamId),playerId);state.freeAgents.push(p);return p;
}
export function promotePractice(state,teamId,playerId,salary=1_000_000){
  return promotePracticePlayer(byId(state,teamId),playerId,state.offseason?.year??state.season,state.salaryCap,salary);
}
export function elevatePractice(state,teamId,playerId){
  return elevatePracticePlayer(byId(state,teamId),playerId,state.week);
}
export function reservePlayer(state,teamId,playerId){
  const p=markInjuredReserve(byId(state,teamId),playerId,['trainingCamp','preseason','cutdown'].includes(state.phase)?1:state.week,state.season);
  if(['trainingCamp','preseason','cutdown'].includes(state.phase))p.irReturnWeek=5;
  reconcileDepthChart(byId(state,teamId));return p;
}
export function returnFromReserve(state,teamId,playerId){
  const p=activateInjuredReserve(byId(state,teamId),playerId,state.week);reconcileDepthChart(byId(state,teamId));return p;
}
export function claimPlayer(state,teamId,waiverId){return submitWaiverClaim(state,teamId,waiverId);}
export function restructureContract(state,teamId,playerId,amount){
  return restructurePlayer(byId(state,teamId),playerId,state.offseason?.year??state.season,amount,state.salaryCap);
}
export function extendContract(state,teamId,playerId,options){
  return extendPlayer(byId(state,teamId),playerId,state.offseason?.year??state.season,{...options,baseCap:state.salaryCap});
}
export function tradePackage(state,teamId,toTeamId,options){return exchangeAssets(state,teamId,toTeamId,options);}
/** Open the new league year and free agency once. Draft order is frozen before records reset. */
export function openOffseason(state,managedTeamId='T01'){
  if(state.phase!=='offseason')throw Error('Complete the playoffs before opening the offseason');
  if(state.offseason)return state.offseason;
  byId(state,managedTeamId);
  state.managedTeamId=managedTeamId;
  resolveWaivers(state);
  const lastYear=state.season,newYear=lastYear+1;
  const draftOrder=getDraftOrder(state);
  const awards=finishSeasonStatistics(state);
  finalizeSeasonHonors(state);
  archiveSeason(state);
  const seasonLeaders=Object.fromEntries(['passYards','rushYards','recYards','sacks'].map(cat=>[cat,leaders(state,cat,5)]));
  state.history.push({year:lastYear,champion:state.champion,standings:state.teams.map(t=>({id:t.id,wins:t.wins,losses:t.losses,ties:t.ties})),draftOrder,awards,seasonLeaders});
  state.salaryCap=Math.round(NFL_2026.salaryCap*Math.pow(1.04,newYear-2026));
  ageStaffContracts(state);
  const cpuHires=cpuStaffReview(state,managedTeamId);
  state.events.push({year:lastYear,text:`CPU front offices completed ${cpuHires.length} coaching and scouting appointments.`});
  for(const team of state.teams){
    finalizeContractYear(team,newYear);
    team.roster=team.roster.filter(p=>{
      p.age++;
      if(p.contract?.expiresYear<newYear||p.age>38){
        const liability=terminationCharges(p.contract,newYear).current;
        if(liability){team.deadCapByYear[newYear]=(team.deadCapByYear[newYear]||0)+liability;team.deadCap=team.deadCapByYear[newYear];}
        if(p.age>38)recordRetirement(state,p,team.id,newYear);
        else {p.contract=null;state.freeAgents.push(p);}
        return false;
      }
      developOffseasonPlayer(p,team,state.seed,newYear,state.settings.developmentRate);
      return true;
    });
  }
  for(const team of state.teams){
    for(const p of team.injuredReserve){p.age++;p.injuryWeeks=0;if(p.age<=38)developOffseasonPlayer(p,team,state.seed,newYear,state.settings.developmentRate);}
    team.roster.push(...team.injuredReserve.filter(p=>p.age<=38&&p.contract?.expiresYear>=newYear));
    for(const p of team.injuredReserve.filter(p=>p.age>38))recordRetirement(state,p,team.id,newYear);
    for(const p of team.injuredReserve.filter(p=>p.age<=38&&p.contract?.expiresYear<newYear)){p.contract=null;state.freeAgents.push(p);}
    for(const p of team.practiceSquad){p.contract=null;state.freeAgents.push(p);}
    team.injuredReserve=[];team.practiceSquad=[];clearWeeklyElevations(team);
    if(team.roster.length>53){
      for(const p of [...team.roster].sort((a,b)=>a.rating-b.rating).slice(0,team.roster.length-53)){
        state.freeAgents.push(releasePlayer(team,p.id,newYear));
      }
    }
    reconcileDepthChart(team);
  }
  processHallOfFame(state,newYear);
  state.offseason={year:newYear,stage:'freeAgency',managedTeamId,draftOrder,board:[],index:0,picks:[],cpuSignings:[]};
  state.events.push({year:lastYear,text:`The ${newYear} league year has opened. Free agency and contract negotiations are active.`});
  return state.offseason;
}
/** The draft has 224 standard selections; CPU clubs act only at their turns. */
export function openDraft(state,teamId='T01'){
  if(!state.offseason)openOffseason(state,teamId);
  if(state.offseason.stage!=='freeAgency')throw Error('Draft already opened');
  cpuFreeAgency(state,{controlledTeamId:state.offseason.managedTeamId,maxPerClub:2});
  return initializeDraft(state);
}
export function selectDraftProspect(state,teamId,prospectId){
  if(!state.offseason||state.offseason.managedTeamId!==teamId)throw Error('Only the controlled franchise can select manually');
  return draftSelection(state,prospectId);
}
export function simulateCpuDraft(state){return advanceCpuDraft(state);}
export function finishDraft(state){return completeDraft(state);}
export function negotiatePlayerOffer(state,teamId,playerId,offer){return negotiateFreeAgent(state,teamId,playerId,offer);}
export function negotiatePlayerExtension(state,teamId,playerId,offer){return negotiateExtension(state,teamId,playerId,offer);}
export function submitTradeOffer(state,teamId,toTeamId,assets){return proposeTrade(state,teamId,toTeamId,assets);}
/** Finish any pending draft automatically for older headless callers and legacy UI. */
export function startNextSeason(state,{skipPreseason=false}={}){
  if(state.phase!=='offseason')throw Error('Complete the current season before starting another.');
  if(!state.offseason)openOffseason(state);
  if(state.offseason.stage==='freeAgency')openDraft(state,state.offseason.managedTeamId);
  if(state.offseason.stage==='draft')completeDraft(state);
  if(state.offseason.stage!=='ready')throw Error('Finish the draft before progressing');
  const newYear=state.offseason.year;
  reportDraftClass(state,newYear);
  fillRosterDepth(state,newYear);
  for(const team of state.teams){
    reconcileDepthChart(team);
    team.practice.completedWeeks=0;
  }
  state.season=newYear;state.year=newYear;
  state.waivers=[];ensureDraftPicks(state);
  resetSeasonStatistics(state);
  state.statisticsPartial=false;
  state.games=generateSchedule(state.teams,newYear);
  state.playoffGames=[];state.playoffSeedings=null;state.champion=null;
  state.phase=skipPreseason?'regular':'offseason';state.week=1;state.round=0;
  resetScoutingForNewClass(state,newYear+1);
  ensureLeagueDevelopment(state);
  state.lastNegotiation=null;state.lastTradeDecision=null;
  for(const team of state.teams){team.wins=0;team.losses=0;team.ties=0;team.pointsFor=0;team.pointsAgainst=0;}
  if(!skipPreseason)beginTrainingCamp(state);
  else state.preseasonGames=[];
  state.offseason=null;
  state.events.push({year:newYear,text:skipPreseason?
    `Season ${newYear} begins after the ${newYear} rookie draft (headless legacy fast-forward).`:
    `The ${newYear} calendar moves to training camp after the rookie draft.`});
  return state;
}

/** Baseline CPU roster management: replace expired depth players after the draft.
 * Salaries are fictional low-cost depth signings, NOT NFL vet-minimum calculations.
 * This prevents teams shrinking indefinitely over repeated seasons. */
function fillRosterDepth(state,year){
  for(const team of state.teams){
    let attempts=0;
    while(team.roster.length<46 && attempts++<150){
      const counts=Object.fromEntries(Object.keys(POSITION_COUNTS).map(p=>[p,team.roster.filter(x=>x.position===p).length]));
      const shortage=Object.keys(POSITION_COUNTS).sort((a,b)=>(POSITION_COUNTS[b]-counts[b])-(POSITION_COUNTS[a]-counts[a]));
      const needed=shortage.find(pos=>counts[pos]<POSITION_COUNTS[pos]);
      if(!needed)break;
      const players=state.freeAgents.filter(p=>p.position===needed).sort((a,b)=>b.rating-a.rating);
      let signed=false;
      for(const p of players){
        const salary=Math.max(950_000,Math.round((0.6+p.rating/120)*1_000_000/50_000)*50_000);
        try{
          signPlayer(team,p,year,{salary,years:2,signingBonus:0,baseCap:state.salaryCap});
          state.freeAgents=state.freeAgents.filter(x=>x.id!==p.id);
          signed=true;break;
        }catch{continue;}
      }
      if(!signed)break;
    }
  }
}

/** NFL front office personnel decisions use separate coaching candidates and budgets. */
export function hireFranchiseStaff(state,teamId,role,candidateId){return hireStaff(state,teamId,role,candidateId);}
/** Predictable AI preparation, never overrides the human-controlled club. */
export function prepareCpuWeek(state){
  if(state.phase!=='regular')return;
  for(const team of state.teams){
    if(team.id===state.managedTeamId)continue;
    const offense=team.staff?.offensiveCoordinator;
    const defense=team.staff?.defensiveCoordinator;
    const pct=(team.wins+.5*team.ties)/(team.wins+team.losses+team.ties||1);
    const change=team.weeklyAiPreparation!==`${state.season}-${state.week}`;
    if(!change)continue;
    team.gamePlan.offense=offense?.philosophy||'balanced';
    team.gamePlan.defense=defense?.philosophy||'balanced';
    team.gamePlan.tempo=pct<.35?'uptempo':pct>.65?'clock-control':'balanced';
    const weakest=team.baseOffense<team.baseDefense?'offense':'defense';
    team.practice.focus=pct<.45?weakest:'development';
    // Every CPU scouting director directs two legal evaluations per week, using the same
    // uncertainty, focus and usage limits as the controlled franchise.
    const office=state.scouting?.[team.id];
    if(office){
      office.focus=team.staff?.scoutingDirector?.philosophy||'balanced';
      // Precompute scores once; sorting callbacks must not repeatedly walk the full roster.
      const positionalNeeds=Object.fromEntries([...new Set(state.prospects.map(p=>p.position))]
        .map(pos=>[pos,positionalNeed(team,pos)]));
      const candidates=state.prospects.filter(p=>(office.reports[p.id]?.visits||0)<3).map(p=>{
        const report=office.reports[p.id];
        const visits=report?.visits||0;
        const uncertainty=report?.uncertainty||20;
        const estimate=report?.estimatedRating??p.scoutedRating;
        return {p,score:estimate+positionalNeeds[p.position]*.8+uncertainty*.12-visits*3};
      }).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
      for(const {p} of candidates.slice(0,({relaxed:3,standard:2,strict:1}[state.settings?.scoutingDifficulty]||2)))scoutProspect(state,team.id,p.id);
    }
    team.weeklyAiPreparation=`${state.season}-${state.week}`;
  }
}

/** Interactive training-camp settings, auto cutdown and the 53-man Week 1 gate. */
export function setCampPlan(state,teamId,options){return configureCamp(state,teamId,options);}
export function autoRosterCuts(state,teamId){return autoCutTeam(state,teamId);}
export function startRegularSeason(state){return finalizeCutdown(state);}
