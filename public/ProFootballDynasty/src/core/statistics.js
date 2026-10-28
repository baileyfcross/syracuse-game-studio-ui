/** Season/career statistical bookkeeping independent of presentation and game engine. */
const PLAYER_FIELDS=['passAttempts','completions','passYards','passTD','interceptionsThrown','sacksTaken',
 'rushAttempts','rushYards','rushTD','targets','receptions','recYards','recTD','tackles','sacks',
 'interceptions','forcedFumbles','fumblesLost','offensiveSnaps','sacksAllowed','fgAttempts','fgMade','xpAttempts','xpMade','punts','puntYards','points'];
const TEAM_FIELDS=['plays','firstDowns','passYards','rushYards','totalYards','thirdDownAttempts',
 'thirdDownConversions','fourthDownAttempts','fourthDownConversions','turnovers','interceptionsThrown',
 'fumblesLost','sacksAllowed','sacks','penalties','penaltyYards','punts','fgAttempts','fgMade',
 'touchdowns','possessions','timeOfPossession','points'];
export const LEADER_CATEGORIES={
 passYards:'Passing Yards',passTD:'Passing TDs',rushYards:'Rushing Yards',rushTD:'Rushing TDs',
 recYards:'Receiving Yards',recTD:'Receiving TDs',receptions:'Receptions',sacks:'Sacks',
 interceptions:'Interceptions',tackles:'Tackles',fgMade:'Field Goals Made'};
const fresh=()=>({teams:{},players:{}});
export function initializeStatistics(state){
 state.statistics??=fresh();state.postseasonStatistics??=fresh();state.careerStatistics??=fresh();
 state.awardHistory??=[];
 return state;
}
function merge(rows,details,fields){
 for(const [key,entry] of Object.entries(details)){
  const totals=rows[key]??={...Object.fromEntries(fields.map(f=>[f,0])),...(entry.name?{id:entry.id,name:entry.name,position:entry.position,teamId:entry.teamId}:{teamId:entry.teamId}),games:0};
  if(entry.name)totals.teamId=entry.teamId; // Current-season display follows the player's latest club.
  for(const field of fields)totals[field]+=(entry[field]||0);
 }
}
export function registerGameStatistics(state,game){
 if(!game.boxScore)return;
 initializeStatistics(state);
 const postseason=game.type==='playoff';
 const destination=postseason?state.postseasonStatistics:state.statistics;
 merge(destination.teams,game.boxScore.teams,TEAM_FIELDS);
 merge(destination.players,game.boxScore.players,PLAYER_FIELDS);
 for(const [id,entry] of Object.entries(game.boxScore.players)){
  // Match appearance: count players who actually recorded an event.
  if(PLAYER_FIELDS.some(field=>entry[field]!==0))destination.players[id].games++;
 }
 for(const team of Object.values(game.boxScore.teams))destination.teams[team.teamId].games++;
 if(!postseason){
  merge(state.careerStatistics.players,game.boxScore.players,PLAYER_FIELDS);
  for(const [id,entry] of Object.entries(game.boxScore.players))
   if(PLAYER_FIELDS.some(field=>entry[field]!==0))state.careerStatistics.players[id].games++;
 }
}
export function leaders(state,category='passYards',limit=12,{career=false,postseason=false}={}){
 if(!(category in LEADER_CATEGORIES))throw Error(`Unknown leader category: ${category}`);
 initializeStatistics(state);
 const source=career?state.careerStatistics:postseason?state.postseasonStatistics:state.statistics;
 return Object.values(source.players).filter(p=>p[category]>0).sort((a,b)=>b[category]-a[category]||a.name.localeCompare(b.name)).slice(0,limit)
  .map(p=>({id:p.id,name:p.name,position:p.position,teamId:p.teamId,value:p[category],games:p.games}));
}
export function teamSeasonStatistics(state,teamId,{postseason=false}={}){
 initializeStatistics(state);
 const source=postseason?state.postseasonStatistics:state.statistics;
 return {team:source.teams[teamId]||null,
  players:Object.values(source.players).filter(p=>p.teamId===teamId)
    .sort((a,b)=>b.passYards+b.rushYards+b.recYards-a.passYards-a.rushYards-a.recYards)};
}
export function calculateAwards(state){
 initializeStatistics(state);
 const roster=Object.values(state.statistics.players);
 const qualify=(fn)=>roster.filter(p=>p.games>0).sort((a,b)=>fn(b)-fn(a))[0];
 const offensive=qualify(p=>p.passYards*.065+p.passTD*6-p.interceptionsThrown*8+p.rushYards*.12+p.recYards*.1+(p.rushTD+p.recTD)*7);
 const defensive=qualify(p=>p.sacks*11+p.interceptions*14+p.tackles*.22);
 const passing=qualify(p=>p.passYards),rushing=qualify(p=>p.rushYards),receiving=qualify(p=>p.recYards);
 const mapping=[['Most Valuable Player',offensive],['Offensive Player of the Year',offensive],
   ['Defensive Player of the Year',defensive],['Passing Leader',passing],
   ['Rushing Leader',rushing],['Receiving Leader',receiving]];
 return mapping.filter(([,p])=>p).map(([award,p])=>({year:state.season,award,playerId:p.id,name:p.name,teamId:p.teamId}));
}
export function finishSeasonStatistics(state){
 initializeStatistics(state);
 const awards=calculateAwards(state);
 if(!state.awardHistory.some(y=>y.year===state.season))state.awardHistory.push({year:state.season,awards});
 return awards;
}
export function resetSeasonStatistics(state){state.statistics=fresh();state.postseasonStatistics=fresh();}
