/** Training-camp and preseason management. This is a playable NFL-inspired model,
 * not an exact representation of NFL preseason contract, roster exemption, or IR rules. */
import {NFL_2026} from '../config/nfl2026.js';
import {generateFreeAgents,POSITION_COUNTS} from './roster.js';
import {rng,hashString,randomInt} from './random.js';
import {signPlayer,releasePlayer,capSpace} from './finance.js';
import {reconcileDepthChart,defaultDepthChart} from './coaching.js';
import {initializePlayerDevelopment} from './development.js';

export const CAMP_DRILLS=['balanced','offense','defense','conditioning','development'];
export const CAMP_INTENSITIES=['light','standard','contact'];
export const CAMP_SESSIONS=2;
export const CAMP_TARGET_ROSTER=68;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const byTeam=(state,id)=>state.teams.find(t=>t.id===id);

/** Circle-method pairings: 16 distinct games each week and no repeat matchups. */
export function generatePreseasonSchedule(teams,season){
  let rotation=teams.map(t=>t.id);const games=[];
  for(let week=1;week<=NFL_2026.preseasonGames;week++){
    for(let n=0;n<rotation.length/2;n++){
      const first=rotation[n],last=rotation[rotation.length-1-n];
      const home=(week+n)%2===0?first:last,away=home===first?last:first;
      games.push({id:`PS-${season}-${week}-${n+1}`,season,year:season,week,type:'preseason',
        category:'exhibition',home,away,status:'scheduled'});
    }
    rotation=[rotation[0],rotation.at(-1),...rotation.slice(1,-1)];
  }
  return games;
}

const groupFor=focus=>focus==='offense'?['QB','RB','WR','TE','OL']:
  focus==='defense'?['DL','EDGE','LB','CB','S']:null;

function rosterNeedScore(team,player){
  const current=team.roster.filter(p=>p.position===player.position).length;
  return (POSITION_COUNTS[player.position]||1)*1.5-current+player.rating*.08;
}
/** Camp invites are signed on fictional one-year minimum-value deals and count against cap.
 * We deliberately do not claim full NFL Top-51 accounting in this prototype. */
function expandCampRosters(state){
  const year=state.season;
  const candidates=generateFreeAgents(year,state.seed+42893,900);
  for(let i=0;i<candidates.length;i++){candidates[i].id=`CAMP-${year}-${i+1}`;initializePlayerDevelopment(candidates[i],state.seed);}
  state.freeAgents.push(...candidates);
  let signed=0;
  for(const team of state.teams){
    let attempts=0;
    while(team.roster.length<CAMP_TARGET_ROSTER&&attempts++<CAMP_TARGET_ROSTER*3){
      const candidates=state.freeAgents.slice().sort((a,b)=>rosterNeedScore(team,b)-rosterNeedScore(team,a)||b.rating-a.rating);
      let acquired=null;
      for(const p of candidates){
        const salary=900_000+Math.max(0,p.rating-60)*10_000;
        if(capSpace(team,year,state.salaryCap)<salary)break;
        try{acquired=signPlayer(team,p,year,{salary,years:1,signingBonus:0,
          baseCap:state.salaryCap,rosterLimit:NFL_2026.trainingCampRosterLimit});break;}catch{continue;}
      }
      if(!acquired)break;
      state.freeAgents=state.freeAgents.filter(p=>p.id!==acquired.id);signed++;
    }
    team.camp={season:year,focus:'balanced',intensity:'standard',sessions:0,evaluations:{},
      injuries:[],preseasonRecord:{wins:0,losses:0,ties:0},initialPlayers:team.roster.length};
    for(const p of team.roster){team.camp.evaluations[p.id]={score:50,samples:0,practiceScore:0,
      exhibitionScore:0,preseasonSnaps:0,injuries:0};}
    reconcileDepthChart(team);
  }
  return signed;
}

export function beginTrainingCamp(state){
  if(state.phase!=='offseason'||state.offseason?.stage!=='ready')throw Error('Finish the rookie draft first');
  const year=state.offseason.year;
  state.season=year;state.year=year;state.week=0;state.round=0;
  state.phase='trainingCamp';state.preseasonWeek=0;
  state.preseasonGames=generatePreseasonSchedule(state.teams,year);
  const signed=expandCampRosters(state);
  state.events.push({year,text:`Training camp opened with ${signed} league-wide camp signings. Two sessions precede three preseason weeks.`});
  return state;
}

export function configureCamp(state,teamId,{focus,intensity}={}){
  if(state.phase!=='trainingCamp'&&state.phase!=='preseason')throw Error('Camp settings are available only during camp or preseason');
  const t=byTeam(state,teamId);if(!t)throw Error('Unknown franchise');
  if(focus!==undefined){if(!CAMP_DRILLS.includes(focus))throw Error('Invalid camp drill focus');t.camp.focus=focus;}
  if(intensity!==undefined){if(!CAMP_INTENSITIES.includes(intensity))throw Error('Invalid camp intensity');t.camp.intensity=intensity;}
  return t.camp;
}

function updateInjuries(team,seed,sessionId){
  const rand=rng(hashString(`${seed}-${team.id}-${sessionId}-injury`));
  let fresh=0;
  for(const group of ['roster','injuredReserve','practiceSquad'])for(const p of team[group]||[]){
    if(p.injuryWeeks>0){p.injuryWeeks--;if(!p.injuryWeeks)p.injuryLabel=null;continue;}
    if(group!=='roster')continue;
    const intensity=team.camp.intensity,stress=intensity==='contact'?.011:intensity==='light'?.002:.005;
    const durability=p.development?.durability||65;
    if(rand()<stress*(1.5-durability/160)){
      const weeks=randomInt(rand,1,intensity==='contact'?6:4);
      p.injuryWeeks=weeks;p.injuryLabel=weeks>=4?'Hamstring strain':'Minor soft-tissue injury';
      const grade=team.camp.evaluations[p.id];if(grade)grade.injuries++;
      team.camp.injuries.push({playerId:p.id,name:p.name,injury:p.injuryLabel,week:sessionId,estimatedWeeks:weeks});
      fresh++;
    }
  }
  return fresh;
}
function assignGrades(team,seed,sessionId,{game=null}={}){
  const rand=rng(hashString(`${seed}-${team.id}-${sessionId}-grade`));
  const focus=team.camp.focus,positionGroup=groupFor(focus);
  const contributions=game?.boxScore?.players||{};
  for(const player of team.roster){
    initializePlayerDevelopment(player,seed);
    const report=team.camp.evaluations[player.id]??={score:50,samples:0,practiceScore:0,exhibitionScore:0,preseasonSnaps:0,injuries:0};
    if(player.injuryWeeks>0)continue;
    const fit=!positionGroup||positionGroup.includes(player.position)?1:0;
    const coach=team.coach?.skills?.development||0;
    const based=player.rating*.63+player.development.workEthic*.23+coach*1.2+
      (focus==='development'?4:fit*3)+randomInt(rand,-13,13);
    const impact=contributions[player.id];
    const touches=(impact?.rushAttempts||0)+(impact?.targets||0)+(impact?.passAttempts||0)+(impact?.tackles||0);
    const gameBoost=game?clamp((touches>=5?4:0)+(impact?.sacks||0)*5+(impact?.passTD||0)*3+randomInt(rand,-5,5),-10,13):0;
    const evaluation=clamp(Math.round(based+gameBoost),20,99);
    report.score=Math.round((report.score*report.samples+evaluation)/(report.samples+1));
    report.samples++;if(game){report.exhibitionScore=evaluation;report.preseasonSnaps+=touches;}else report.practiceScore=evaluation;
    const intensity=team.camp.intensity;
    const xp=clamp(Math.round((intensity==='contact'?26:intensity==='light'?11:18)*
      (.7+player.development.workEthic/145)*(fit?1.2:1)),4,60);
    player.development.xp+=xp;
  }
}
export function runCampSession(state){
  if(state.phase!=='trainingCamp')throw Error('Not in training camp');
  const session=(state.teams[0].camp?.sessions||0)+1;
  if(session>CAMP_SESSIONS)throw Error('Camp sessions are complete');
  let injuries=0;
  for(const team of state.teams){
    // CPU staff follow conservative camp approaches for injury-risk management.
    if(team.id!==state.managedTeamId){team.camp.focus=team.baseOffense<team.baseDefense?'offense':'defense';team.camp.intensity='standard';}
    injuries+=updateInjuries(team,state.seed,`camp-${session}`);
    assignGrades(team,state.seed,`camp-${session}`);
    team.camp.sessions=session;
  }
  state.events.push({year:state.season,text:`Camp session ${session}/${CAMP_SESSIONS} complete (${injuries} new injuries).`});
  if(session===CAMP_SESSIONS){state.phase='preseason';state.week=1;state.events.push({year:state.season,text:'Preseason Week 1 begins.'});}
  return {session,injuries};
}

/** Rotate preseason starters: weeks 1 and 2 feature more backups, week 3 is a dress rehearsal. */
export function preseasonLineup(team,week){
  const candidates=team.roster.filter(p=>p.injuryWeeks===0);
  const positions=Object.keys(team.depthChart||defaultDepthChart(team));
  const chart={};
  for(const pos of positions){
    const pool=candidates.filter(p=>p.position===pos).sort((a,b)=>b.rating-a.rating);
    const move=week===1?1:week===2?2:0;
    const selected=[...pool.slice(move),...pool.slice(0,move)];
    const slots=team.depthChart?.[pos]?.length||1;
    chart[pos]=selected.slice(0,slots).map(p=>p.id);
  }
  return {...team,roster:candidates,depthChart:chart};
}

export function finishPreseasonWeek(state,results){
  if(state.phase!=='preseason')throw Error('Preseason is not active');
  const week=state.week;
  const games=state.preseasonGames.filter(g=>g.week===week&&g.status==='scheduled');
  if(games.length!==16)throw Error('Preseason schedule is missing games');
  for(const g of games){
    const result=results?.get(g.id);if(!result)throw Error(`Missing preseason simulation for ${g.id}`);
    Object.assign(g,result,{status:'final'});
    for(const injury of result.injuries||[]){const t=byTeam(state,injury.teamId);const p=t?.roster.find(x=>x.id===injury.playerId);if(p){p.injuryWeeks=Math.max(p.injuryWeeks||0,injury.weeks);p.injuryLabel=injury.label;}}
    for(const id of [g.home,g.away]){
      const t=byTeam(state,id);const own=id===g.home?g.scoreHome:g.scoreAway,opp=id===g.home?g.scoreAway:g.scoreHome;
      if(own>opp)t.camp.preseasonRecord.wins++;
      else if(own<opp)t.camp.preseasonRecord.losses++;
      else t.camp.preseasonRecord.ties++;
      assignGrades(t,state.seed,`pre-${week}`,{game:g});
    }
  }
  let injuries=0;
  for(const team of state.teams)injuries+=updateInjuries(team,state.seed,`preseason-${week}`);
  state.events.push({year:state.season,text:`Preseason Week ${week} finished (${games.length} exhibitions, ${injuries} injuries). Results do not count toward standings.`});
  if(week===NFL_2026.preseasonGames){state.phase='cutdown';state.week=0;
    state.events.push({year:state.season,text:'Final roster cutdown is due: active rosters must reach 53 players.'});
  }else state.week++;
  return games;
}

function cutScore(team,p){
  const positionSupply=team.roster.filter(x=>x.position===p.position).length;
  const minimum=(POSITION_COUNTS[p.position]||1);
  const camp=team.camp?.evaluations[p.id];
  return p.rating*.67+(camp?.score??50)*.25+(p.development?.potential||p.rating)*.08-
    (positionSupply<=minimum?35:0)-(p.injuryWeeks>4?6:0);
}
export function autoCutTeam(state,teamId){
  if(state.phase!=='cutdown')throw Error('Automatic cuts require roster cutdown');
  const t=byTeam(state,teamId);if(!t)throw Error('Unknown team');
  let count=0;
  while(t.roster.length>NFL_2026.activeRosterLimit){
    const worst=[...t.roster].sort((a,b)=>cutScore(t,a)-cutScore(t,b)||a.id.localeCompare(b.id))[0];
    const cut=releasePlayer(t,worst.id,state.season);
    state.freeAgents.push(cut);count++;
  }
  reconcileDepthChart(t);
  state.events.push({year:state.season,text:`${t.name} finalized ${count} roster cuts.`});
  return count;
}
export function finalizeCutdown(state){
  if(state.phase!=='cutdown')throw Error('Complete the three preseason weeks before finalizing rosters');
  const controlled=byTeam(state,state.managedTeamId);
  if(controlled.roster.length>NFL_2026.activeRosterLimit)throw Error(`Cut ${controlled.roster.length-53} more players, or use Auto Cuts, before starting Week 1`);
  let cpuCuts=0;
  for(const t of state.teams)if(t.id!==state.managedTeamId)cpuCuts+=autoCutTeam(state,t.id);
  for(const t of state.teams){
    if(t.roster.length>53)throw Error('A team exceeds the regular-season roster limit');
    reconcileDepthChart(t);
    t.practice.completedWeeks=0;
  }
  state.phase='regular';state.week=1;
  state.events.push({year:state.season,text:`Cutdown completed (${cpuCuts} CPU player releases). Regular Season Week 1 begins.`});
  return cpuCuts;
}
export function campSummary(state,teamId){
  const t=byTeam(state,teamId);const camp=t?.camp;
  return {phase:state.phase,year:state.season,session:camp?.sessions||0,totalSessions:CAMP_SESSIONS,
    week:state.phase==='preseason'?state.week:null,rosterSize:t?.roster.length||0,rosterLimit:state.phase==='regular'?NFL_2026.activeRosterLimit:NFL_2026.trainingCampRosterLimit,
    cutsNeeded:Math.max(0,(t?.roster.length||0)-53),focus:camp?.focus||'balanced',
    intensity:camp?.intensity||'standard',preseasonRecord:camp?.preseasonRecord||{wins:0,losses:0,ties:0},
    evaluations:t?.roster.map(p=>({id:p.id,name:p.name,position:p.position,rating:p.rating,
      healthWeeks:p.injuryWeeks,injury:p.injuryLabel||null,
      ...(camp?.evaluations[p.id]||{score:50,samples:0,practiceScore:0,exhibitionScore:0,preseasonSnaps:0})}))
      .sort((a,b)=>b.score-a.score)||[],injuryLog:(camp?.injuries||[]).slice(-15).reverse(),
    upcoming:state.preseasonGames?.filter(g=>g.home===teamId||g.away===teamId).map(g=>({id:g.id,week:g.week,
      home:g.home,away:g.away,status:g.status,scoreHome:g.scoreHome,scoreAway:g.scoreAway}))||[]};
}
