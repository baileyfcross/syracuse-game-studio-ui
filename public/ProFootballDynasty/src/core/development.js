import {hashString, rng, randomInt} from './random.js';

// Fictional progression and morale model: these coefficients are gameplay balancing, not NFL statistics.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const positionalTraining={offense:['QB','RB','WR','TE','OL'],defense:['DL','EDGE','LB','CB','S']};

/** Stable hidden potential and tendencies survive migrations and do not depend on load order. */
export function initializePlayerDevelopment(player,seed=2026){
  const random=rng(hashString(`${seed}:${player.id}:traits`));
  player.development??={
    potential:clamp(player.rating+randomInt(random,3,18),player.rating,99),
    workEthic:randomInt(random,45,95),
    durability:randomInt(random,45,95),
    xp:0,careerGrowth:0,lastSeasonChange:0,history:[]
  };
  player.development.potential=clamp(Math.max(player.rating,Number(player.development.potential)||player.rating),30,99);
  player.development.workEthic=clamp(Number(player.development.workEthic)||65,1,99);
  player.development.durability=clamp(Number(player.development.durability)||65,1,99);
  player.development.xp=clamp(Number(player.development.xp)||0,0,10000);
  player.development.history??=[];
  player.development.careerGrowth??=0;
  player.development.lastSeasonChange??=0;
  player.morale=clamp(Number.isFinite(player.morale)?player.morale:randomInt(random,55,86),0,100);
  return player;
}
export function ensureLeagueDevelopment(state){
  for(const team of state.teams){
    team.developmentLog??=[];
    for(const group of ['roster','practiceSquad','injuredReserve'])for(const p of team[group]||[])initializePlayerDevelopment(p,state.seed);
  }
  for(const p of [...(state.freeAgents||[]),...(state.prospects||[])])initializePlayerDevelopment(p,state.seed);
  for(const r of state.unsignedRookies||[])initializePlayerDevelopment(r.prospect,state.seed);
}
/** Award training XP weekly, letting work ethic, age, role, focus and staff all contribute. */
export function trainPlayer(player,team,random){
  initializePlayerDevelopment(player);
  const focus=team.practice?.focus||'balanced';
  const positionFit=positionalTraining[focus]?.includes(player.position);
  const coach=team.coach?.skills?.development||0;
  const staff=team.staff?.scoutingDirector?.rating||65;
  const xp=Math.round((10+randomInt(random,0,8))*(.72+player.development.workEthic/140)*
    (focus==='development'?1.65:positionFit?1.4:1)*(1+coach*.07+(staff-65)/550));
  player.development.xp+=Math.max(1,xp);
  // Very modest in-season improvement; most visible ratings changes happen in the offseason.
  const growthThreshold=player.age<=27?340:430;
  if(player.development.xp>=growthThreshold&&player.rating<player.development.potential){
    player.development.xp-=growthThreshold;
    player.rating++;player.development.careerGrowth++;
    return 1;
  }
  return 0;
}
/** Results and playing time influence player satisfaction; does not disclose hidden talent. */
export function updateTeamMorale(team,game,season){
  const ours=game.home===team.id?game.scoreHome:game.scoreAway;
  const theirs=game.home===team.id?game.scoreAway:game.scoreHome;
  const result=ours>theirs?2:ours<theirs?-3:0;
  const box=game.boxScore?.players||{};
  let changed=0;
  for(const player of team.roster){
    initializePlayerDevelopment(player);
    const ownStats=box[player.id];
    const impact=(ownStats?.passAttempts||0)+(ownStats?.rushAttempts||0)+(ownStats?.targets||0)+
      (ownStats?.tackles||0)+(ownStats?.offensiveSnaps||0)/20;
    const starting=Object.values(team.depthChart||{}).some(ids=>ids.includes(player.id));
    const roleDelta=impact>=8?1:!starting&&player.rating>=78?-2:0;
    const injuryDelta=player.injuryWeeks>0?-1:0;
    const leadership=team.coach?.skills?.leadership||0;
    const delta=result+roleDelta+injuryDelta+(leadership>=4&&result<0?1:0);
    const before=player.morale;
    player.morale=clamp(player.morale+delta,10,100);
    if(player.morale!==before)changed++;
  }
  team.moraleHistory??=[];
  team.moraleHistory.push({season,week:game.week??null,result,average:Math.round(team.roster.reduce((s,p)=>s+p.morale,0)/Math.max(1,team.roster.length))});
  team.moraleHistory=team.moraleHistory.slice(-40);
  return changed;
}
/** Single offseason aging pass. Keeps a bounded persistent rating history. */
export function developOffseasonPlayer(player,team,seed,year,rate='standard'){
  initializePlayerDevelopment(player,seed);
  const before=player.rating,random=rng(hashString(`${seed}-${year}-${player.id}-age`));
  const age=player.age;
  const leadership=team.coach?.skills?.development||0;
  const trainer=team.staff?.scoutingDirector?.rating||65;
  let delta=0;
  if(age<=28&&player.rating<player.development.potential){
    const chance=clamp(.14+player.development.workEthic/310+leadership*.035+(trainer-65)/480,0,.8);
    if(random()<clamp(chance*({slow:.55,standard:1,fast:1.35}[rate]||1),0,.95))delta+=1;
    if(player.development.xp>=200&&random()<.35)delta+=1;
  } else if(age>=30){
    const chance=clamp(.05+(age-29)*.095+(100-player.development.durability)/430,0,.92);
    if(random()<chance)delta-=random()<.13?2:1;
  }
  player.rating=clamp(before+delta,30,age<30?player.development.potential:99);
  player.development.lastSeasonChange=player.rating-before;
  player.development.careerGrowth+=Math.max(0,player.rating-before);
  player.development.xp=Math.floor(player.development.xp*.2);
  // Some recovery from a difficult season; avoid endless year-over-year morale accumulation.
  player.morale=clamp(Math.round(player.morale*.75+67*.25),15,100);
  player.development.history.push({season:year,rating:player.rating,change:player.rating-before});
  player.development.history=player.development.history.slice(-16);
  return player.rating-before;
}
export function developmentSummary(team){
  const all=[...team.roster,...(team.practiceSquad||[]),...(team.injuredReserve||[])];
  const avg=all.length?Math.round(all.reduce((s,p)=>s+(p.morale??65),0)/all.length):65;
  return {averageMorale:avg,atRisk:all.filter(p=>(p.morale??65)<40).map(p=>({id:p.id,name:p.name,morale:p.morale})),
    recentGrowth:all.filter(p=>p.development?.lastSeasonChange).map(p=>({id:p.id,name:p.name,delta:p.development.lastSeasonChange}))
      .sort((a,b)=>b.delta-a.delta).slice(0,12),history:(team.moraleHistory||[]).slice(-10)};
}
