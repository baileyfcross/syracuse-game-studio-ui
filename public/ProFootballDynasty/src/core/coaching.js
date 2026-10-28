import {normalizeTactics,updateTactics} from './tactics.js';
import { rng, hashString, randomInt } from './random.js';
import {trainPlayer} from './development.js';

/** Independent NFL-style coaching, weekly preparation and starting depth decisions.
 * Bonuses are game balance approximations, not official football coefficients. */
export const OFFENSE_SCHEMES = Object.freeze(['balanced','west-coast','vertical','run-first','spread']);
export const DEFENSE_SCHEMES = Object.freeze(['balanced','man-coverage','zone-coverage','blitz-heavy','run-stop']);
export const TEMPOS = Object.freeze(['balanced','uptempo','clock-control']);
export const PRACTICE_FOCUSES = Object.freeze(['balanced','offense','defense','conditioning','development']);
export const COACH_SKILLS = Object.freeze(['offense','defense','development','leadership']);

export const DEFAULT_STARTERS={QB:1,RB:1,WR:3,TE:1,OL:5,DL:3,EDGE:2,LB:2,CB:2,S:2,K:1,P:1,LS:1};
export function defaultDepthChart(team){
  return Object.fromEntries(Object.entries(DEFAULT_STARTERS).map(([position,n])=>
    [position,team.roster.filter(p=>p.position===position).sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id)).slice(0,n).map(p=>p.id)]));
}
/** Full position ranking, including backups. Independent of roster array order. */
export function defaultDepthOrder(team){
  return Object.fromEntries(Object.keys(DEFAULT_STARTERS).map(position=>[position,
    team.roster.filter(p=>p.position===position).sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id)).map(p=>p.id)]));
}
export function reconcileDepthOrder(team){
  const defaults=defaultDepthOrder(team);
  team.depthOrder??={};
  team.depthChart??={};
  for(const [position,validIds] of Object.entries(defaults)){
    const valid=new Set(validIds);
    const order=[...new Set([
      ...(team.depthOrder[position]||team.depthChart[position]||[]).filter(id=>valid.has(id)),
      ...validIds
    ])];
    team.depthOrder[position]=order;
    team.depthChart[position]=order.slice(0,DEFAULT_STARTERS[position]);
  }
  return team.depthOrder;
}
/** Reject malformed updates and duplicates, then update the simulation starters. */
export function setDepthOrder(team,position,ids){
  if(!(position in DEFAULT_STARTERS))throw Error('Unknown depth chart position');
  if(!Array.isArray(ids))throw Error('Invalid depth chart order');
  const eligible=team.roster.filter(p=>p.position===position).map(p=>p.id);
  if(ids.length!==eligible.length||new Set(ids).size!==eligible.length||
    !ids.every(id=>eligible.includes(id)))throw Error('Depth chart must include each eligible player exactly once');
  reconcileDepthOrder(team);
  team.depthOrder[position]=[...ids];
  team.depthChart[position]=ids.slice(0,DEFAULT_STARTERS[position]);
  return team.depthOrder[position];
}
export function autoSortDepth(team,position){
  if(!(position in DEFAULT_STARTERS))throw Error('Unknown depth chart position');
  const ordered=team.roster.filter(p=>p.position===position).sort((a,b)=>
    (a.injuryWeeks>0)-(b.injuryWeeks>0)||b.rating-a.rating||a.id.localeCompare(b.id)).map(p=>p.id);
  return setDepthOrder(team,position,ordered);
}
export function initializeTeamManagement(team,seed=2026){
  const random=rng(hashString(`${seed}-${team.id}-coaching`));
  team.coach={...team.coach,xp:0,level:1,skillPoints:0,skills:{offense:0,defense:0,development:0,leadership:0},careerWins:0,careerLosses:0,careerTies:0};
  team.staff={offensiveCoordinator:{name:`${team.city} Offensive Coordinator`,rating:randomInt(random,48,86)},
    defensiveCoordinator:{name:`${team.city} Defensive Coordinator`,rating:randomInt(random,48,86)}};
  team.gamePlan={offense:'balanced',defense:'balanced',tempo:'balanced',...normalizeTactics()};
  team.practice={focus:'balanced',completedWeeks:0};
  team.depthChart=defaultDepthChart(team);
  team.depthOrder=defaultDepthOrder(team);
  team.bookmarks=[];
}
export function upgradeLegacyTeam(team,seed){
  if(!team.staff||!team.gamePlan||!team.practice||!team.depthChart){
    const oldCoach=team.coach;
    initializeTeamManagement(team,seed);
    team.coach={...team.coach,name:oldCoach.name,rating:oldCoach.rating};
  }
  team.coach.skills??={offense:0,defense:0,development:0,leadership:0};
  team.coach.skillPoints??=0;team.coach.xp??=0;team.coach.level??=1;
  team.coach.careerWins??=0;team.coach.careerLosses??=0;team.coach.careerTies??=0;
  team.bookmarks??=[];
  team.gamePlan={...team.gamePlan,...normalizeTactics(team.gamePlan)};
  reconcileDepthOrder(team);
}
export function reconcileDepthChart(team){
  reconcileDepthOrder(team);
  return team.depthChart;
}
export function setGamePlan(team,{offense,defense,tempo}){
  const next={...team.gamePlan};
  for(const [key,values] of [['offense',OFFENSE_SCHEMES],['defense',DEFENSE_SCHEMES],['tempo',TEMPOS]]){
    const value={offense,defense,tempo}[key];
    if(value!==undefined){if(!values.includes(value))throw Error(`Invalid ${key} scheme: ${value}`);next[key]=value;}
  }
  team.gamePlan=next;return next;
}
export function setPracticeFocus(team,focus){
  if(!PRACTICE_FOCUSES.includes(focus))throw Error('Invalid practice focus');
  team.practice.focus=focus;return team.practice;
}
export function setStarter(team,position,slot,playerId){
  if(!(position in DEFAULT_STARTERS))throw Error('Unknown depth chart position');
  if(!Number.isInteger(slot)||slot<0||slot>=DEFAULT_STARTERS[position])throw Error('Invalid depth chart slot');
  const player=team.roster.find(p=>p.id===playerId);
  if(!player||player.position!==position)throw Error('Starter must be a roster player at this position');
  reconcileDepthOrder(team);
  const list=[...team.depthOrder[position]];
  const from=list.indexOf(playerId);
  // Swap rather than duplicate: previously assigned starter becomes a backup.
  [list[from],list[slot]]=[list[slot],list[from]];
  setDepthOrder(team,position,list);
  return team.depthChart;
}
export function starterFor(team,position,slot=0){
  const ids=team.depthChart?.[position]||[];
  const p=team.roster.find(p=>p.id===ids[slot]&&p.position===position&&p.injuryWeeks===0);
  if(p)return p;
  return team.roster.filter(p=>p.position===position&&p.injuryWeeks===0)
    .sort((a,b)=>b.rating-a.rating)[slot]||null;
}
export function awardCoachExperience(team,game){
  const own=game.home===team.id?game.scoreHome:game.scoreAway;
  const opp=game.home===team.id?game.scoreAway:game.scoreHome;
  if(own>opp)team.coach.careerWins++;
  else if(own<opp)team.coach.careerLosses++;
  else team.coach.careerTies++;
  team.coach.xp+=own>opp?35:own===opp?18:12;
  // Success unlocks persistent skill points at deterministic XP thresholds.
  while(team.coach.xp>=team.coach.level*250){
    team.coach.xp-=team.coach.level*250;
    team.coach.level++;team.coach.skillPoints++;
  }
}
export function spendSkillPoint(team,skill){
  if(!COACH_SKILLS.includes(skill))throw Error('Unknown coaching skill');
  if(team.coach.skillPoints<1)throw Error('No coaching skill points available');
  if(team.coach.skills[skill]>=5)throw Error('Coaching skill already at maximum level');
  team.coach.skillPoints--;team.coach.skills[skill]++;
  return team.coach;
}
export function advanceWeeklyDevelopment(team,seed,season,week){
  const focus=team.practice?.focus||'balanced';
  const random=rng(hashString(`${seed}-${season}-${week}-${team.id}-practice`));
  const relevant={offense:['QB','RB','WR','TE','OL'],defense:['DL','EDGE','LB','CB','S']};
  let improved=0,injured=0;
  for(const player of team.roster){
    if(player.injuryWeeks>0){player.injuryWeeks--;continue;}
    // Experience and potential replace instant random overall-rating rolls.
    if(trainPlayer(player,team,random))improved++;
    // Injuries are a gameplay abstraction until the full snap-by-snap engine exists.
    const injuryChance=(focus==='conditioning'?0.002:0.006)*(1+(65-(player.development?.durability||65))/180);
    if(random()<injuryChance){player.injuryWeeks=randomInt(random,1,4);injured++;}
  }
  team.practice.completedWeeks++;
  return {improved,injured};
}

/** Configure game-day personnel, situational play calling and rotation policy. */
export function setTactics(team,options){return updateTactics(team,options);}
