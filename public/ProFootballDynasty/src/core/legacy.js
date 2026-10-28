/** Persistent, independently owned franchise-history records.
 * This is a fictional league history system, NOT the official Pro Football Hall of Fame.
 * We intentionally store compact summaries rather than duplicating full play-by-play logs. */
import { LEADER_CATEGORIES, leaders, calculateAwards } from './statistics.js';

const CATEGORIES={passYards:[5000,10000,20000,30000,40000,50000],passTD:[50,100,200,300,400],
 rushYards:[1000,3000,5000,8000,10000],rushTD:[20,50,80,120],recYards:[1000,3000,5000,8000,10000],
 recTD:[20,50,80,120],sacks:[10,25,50,75,100],interceptions:[10,25,40,60]};
const sum=(p,key)=>Number(p?.[key]||0);
const winner=g=>g.scoreHome>g.scoreAway?g.home:g.away;
const loser=g=>g.scoreHome<g.scoreAway?g.home:g.away;
const gameKey=g=>`${g.season??g.year}:${g.id}`;
function news(state,type,headline,detail,{teamId=null,playerId=null,year=state.season,week=state.week}={}){
 const legacy=state.legacy;
 legacy.sequence++;
 legacy.news.push({id:`N${legacy.sequence}`,type,headline,detail,teamId,playerId,year,week});
 // Retain the most recent 350 updates. Yearbooks and career records are never pruned.
 if(legacy.news.length>350)legacy.news.splice(0,legacy.news.length-350);
}
function coachRecord(state,coach,teamId){
 if(!coach?.id)return null;
 const l=state.legacy,entry=l.coaches[coach.id]??={id:coach.id,name:coach.name,teams:[],wins:0,losses:0,ties:0,
  playoffWins:0,playoffLosses:0,championships:0,firstSeason:state.season,lastSeason:state.season};
 entry.name=coach.name;
 if(teamId){
  let stint=entry.teams.at(-1);
  if(!stint||stint.teamId!==teamId){stint={teamId,fromYear:state.season,toYear:state.season,wins:0,losses:0,ties:0};entry.teams.push(stint);}
  stint.toYear=state.season;entry.lastSeason=state.season;
 }
 return entry;
}
export function ensureLegacy(state,{migration=false}={}){
 if(state.legacy?.version===1)return state.legacy;
 const legacy=state.legacy={version:1,partialHistory:Boolean(migration),sequence:0,news:[],milestones:[],milestoneKeys:[],
  gameKeys:[],seasonKeys:[],coaches:{},rivalries:{},yearbooks:[],retiredPlayers:[],hallOfFame:[],inductionYears:[]};
 // Migrations cannot recover former teams' past game-day coaching appointments.
 // Mark existing final games as already covered so they never inflate rivalries or coaching wins.
 if(migration){
  legacy.gameKeys=[...(state.games||[]),...(state.playoffGames||[])].filter(g=>g.status==='final').map(gameKey);
  for(const p of Object.values(state.careerStatistics?.players||{}))for(const [cat,thresholds] of Object.entries(CATEGORIES))
   for(const threshold of thresholds)if(sum(p,cat)>=threshold)legacy.milestoneKeys.push(`${p.id}:${cat}:${threshold}`);
 }
 for(const t of state.teams||[]){
  const c=coachRecord(state,t.coach,t.id);
  if(c&&migration){c.wins=t.coach.careerWins||0;c.losses=t.coach.careerLosses||0;c.ties=t.coach.careerTies||0;
    c.teams.at(-1).wins=c.wins;c.teams.at(-1).losses=c.losses;c.teams.at(-1).ties=c.ties;}
 }
 news(state,'league','League history office established',migration?'Historical data starts from this upgraded save. Earlier results cannot be fully reconstructed.':'A new chapter of professional football begins.');
 return legacy;
}
function syncCoachStats(state,g){
 const champ=g.type==='playoff'&&g.round===4;
 for(const id of [g.home,g.away]){
  const team=state.teams.find(t=>t.id===id),r=coachRecord(state,team?.coach,id);
  if(!r)continue;
  const stint=r.teams.at(-1),won=winner(g)===id,draw=g.scoreHome===g.scoreAway;
  if(draw){r.ties++;stint.ties++;}
  else if(won){r.wins++;stint.wins++;}else {r.losses++;stint.losses++;}
  if(g.type==='playoff')won?r.playoffWins++:r.playoffLosses++;
  if(champ&&won)r.championships++;
 }
}
function rivalryPair(g){return [g.home,g.away].sort().join(':');}
function rivalryUpdate(state,g){
 const k=rivalryPair(g),r=state.legacy.rivalries[k]??={key:k,teams:[g.home,g.away].sort(),games:0,wins:{},ties:0,
  meetings:[],playoffMeetings:0,oneScoreGames:0};
 r.games++;
 if(g.scoreHome===g.scoreAway)r.ties++;
 else r.wins[winner(g)]=(r.wins[winner(g)]||0)+1;
 if(g.type==='playoff')r.playoffMeetings++;
 if(Math.abs(g.scoreHome-g.scoreAway)<=8)r.oneScoreGames++;
 r.meetings.push({year:g.season??g.year,week:g.week,type:g.type||'regular',winner:g.scoreHome===g.scoreAway?null:winner(g),
  home:g.home,away:g.away,scoreHome:g.scoreHome,scoreAway:g.scoreAway});
 if(r.meetings.length>16)r.meetings.shift();
}
function newMilestones(state,g){
 if(g.type==='playoff'||!g.boxScore?.players)return;
 const known=new Set(state.legacy.milestoneKeys);
 for(const player of Object.values(g.boxScore.players)){
  const total=state.careerStatistics?.players?.[player.id];if(!total)continue;
  for(const [cat,thresholds] of Object.entries(CATEGORIES)){
   if(!sum(player,cat))continue;
   for(const threshold of thresholds){
    const key=`${player.id}:${cat}:${threshold}`;
    if(sum(total,cat)>=threshold&&!known.has(key)){
     known.add(key);state.legacy.milestoneKeys.push(key);
     const item={year:state.season,week:g.week,playerId:player.id,player:player.name,teamId:player.teamId,category:cat,total:threshold};
     state.legacy.milestones.push(item);
     news(state,'milestone',`${player.name} reaches ${threshold.toLocaleString()} career ${LEADER_CATEGORIES[cat]||cat}`,
      `A career milestone in Week ${g.week}.`,{teamId:player.teamId,playerId:player.id});
    }
   }
  }
 }
}
/** Called once after every completed regular or playoff game and after registering player totals. */
export function recordLegacyGame(state,g){
 ensureLegacy(state);
 if(!g||g.status!=='final'||!['regular','playoff'].includes(g.type))return false;
 const key=gameKey(g),l=state.legacy;
 if(l.gameKeys.includes(key))return false;
 l.gameKeys.push(key);
 rivalryUpdate(state,g);syncCoachStats(state,g);newMilestones(state,g);
 const a=state.teams.find(t=>t.id===g.away)?.name||g.away,h=state.teams.find(t=>t.id===g.home)?.name||g.home;
 if(g.type==='playoff'){
  news(state,'playoffs',`${winner(g)===g.home?h:a} advances in the postseason`,
   `${a} ${g.scoreAway}, ${h} ${g.scoreHome}.`,{teamId:winner(g)});
 }else if(Math.abs(g.scoreHome-g.scoreAway)<=3){
  // Limit ordinary game updates. Divisional nail-biters are reported consistently.
  const home=state.teams.find(t=>t.id===g.home),away=state.teams.find(t=>t.id===g.away);
  if(home?.division===away?.division&&home?.conference===away?.conference)
   news(state,'rivalry',`${winner(g)===g.home?h:a} wins a divisional thriller`,`${a} ${g.scoreAway}, ${h} ${g.scoreHome}.`,{teamId:winner(g)});
 }
 return true;
}
/** Called on coach hires, preserving individual career identity across franchises. */
export function recordCoachHire(state,{teamId,oldCoach,newCoach,year}){
 ensureLegacy(state);
 if(oldCoach?.id){const old=coachRecord(state,oldCoach,null);if(old)old.lastSeason=Math.max(old.lastSeason,year-1);}
 if(newCoach?.id){
  const newRecord=coachRecord(state,newCoach,teamId);
  newRecord.teams.at(-1).fromYear=year;newRecord.teams.at(-1).toYear=year;
  if(newRecord.wins===0&&newRecord.losses===0&&newRecord.ties===0&&newRecord.teams.length===1)newRecord.firstSeason=year;
  newRecord.lastSeason=Math.max(newRecord.lastSeason,year);
  news(state,'coaching',`${newCoach.name} takes charge`,`${state.teams.find(t=>t.id===teamId)?.name||teamId} appoints its new head coach.`,{teamId,year});
 }
}
/** Retired players retain full career totals even after they leave the active roster. */
export function recordRetirement(state,player,teamId,year){
 ensureLegacy(state);
 if(state.legacy.retiredPlayers.some(p=>p.playerId===player.id))return;
 const stats=structuredClone(state.careerStatistics?.players?.[player.id]||{});
 const awards=(state.awardHistory||[]).flatMap(y=>y.awards||[]).filter(a=>a.playerId===player.id).map(a=>({year:a.year,award:a.award}));
 const retired={playerId:player.id,name:player.name,position:player.position,teamId,year,age:player.age,
  career:stats,awards};
 state.legacy.retiredPlayers.push(retired);
 news(state,'retirement',`${player.name} announces retirement`,`${player.position} retires after an extended professional career.`,{teamId,playerId:player.id,year});
}
function hallScore(player){
 const s=player.career;
 return sum(s,'passYards')/240+sum(s,'passTD')*2.4+sum(s,'rushYards')/75+sum(s,'recYards')/85+
  sum(s,'rushTD')*2+sum(s,'recTD')*2+sum(s,'sacks')*9+sum(s,'interceptions')*14+
  (player.awards||[]).filter(a=>['Most Valuable Player','Offensive Player of the Year','Defensive Player of the Year'].includes(a.award)).length*65;
}
/** Fictional Hall of Fame model: five-year eligibility, up to five inductees per year. */
export function processHallOfFame(state,year){
 ensureLegacy(state);
 if(state.legacy.inductionYears.includes(year))return [];
 state.legacy.inductionYears.push(year);
 const inducted=new Set(state.legacy.hallOfFame.map(p=>p.playerId));
 const eligible=state.legacy.retiredPlayers.filter(p=>year-p.year>=5&&!inducted.has(p.playerId))
  .map(p=>({...p,score:Math.round(hallScore(p))})).filter(p=>p.score>=125)
  .sort((a,b)=>b.score-a.score||a.playerId.localeCompare(b.playerId)).slice(0,5);
 for(const p of eligible){
  state.legacy.hallOfFame.push({...p,inductedYear:year});
  news(state,'hall',`${p.name} selected for the League Hall of Fame`,
   `The ${year} class recognizes ${p.position} ${p.name}'s career.`,{teamId:p.teamId,playerId:p.playerId,year});
 }
 return eligible;
}
/** Championship-year archive is built before season stats or standings are reset. */
export function archiveSeason(state){
 ensureLegacy(state);
 const l=state.legacy,year=state.season;
 if(l.seasonKeys.includes(year))return l.yearbooks.find(s=>s.year===year);
 if(state.phase!=='offseason'||!state.champion)return null;
 const awards=calculateAwards(state);
 const standings=state.teams.map(t=>({teamId:t.id,wins:t.wins,losses:t.losses,ties:t.ties,
  pointsFor:t.pointsFor,pointsAgainst:t.pointsAgainst,coachId:t.coach?.id,coach:t.coach?.name}));
 const playoffs=state.playoffGames.map(g=>({id:g.id,home:g.home,away:g.away,round:g.round,
  scoreHome:g.scoreHome,scoreAway:g.scoreAway,winner:winner(g)}));
 const leaders=Object.fromEntries(['passYards','rushYards','recYards','passTD','sacks','interceptions']
  .map(cat=>[cat,leadersByCategory(state,cat)]));
 const result={year,champion:state.champion,standings,playoffs,awards,leaders};
 l.seasonKeys.push(year);l.yearbooks.push(result);
 const champion=state.teams.find(t=>t.id===state.champion);
 news(state,'championship',`${champion?.name||state.champion} wins the ${year} championship`,
  `${champion?.name||state.champion} is crowned league champion.`,{teamId:state.champion});
 for(const award of awards.filter(a=>['Most Valuable Player','Offensive Player of the Year','Defensive Player of the Year'].includes(a.award)))
  news(state,'awards',`${award.name} earns ${award.award}`,`Honored for the ${year} campaign.`,{teamId:award.teamId,playerId:award.playerId});
 return result;
}
function leadersByCategory(state,cat){return leaders(state,cat,3).map(p=>({id:p.id,name:p.name,teamId:p.teamId,value:p.value}));}
export function reportDraftClass(state,year){
 ensureLegacy(state);
 const picked=state.offseason?.picks||[];
 const key=`draft:${year}`;
 if(state.legacy.milestoneKeys.includes(key))return;
 state.legacy.milestoneKeys.push(key);
 const first=picked[0];if(first){
  const team=state.teams.find(t=>t.id===first.teamId||t.id===first.ownerId);
  news(state,'draft',`${team?.name||'A franchise'} makes the first selection of ${year}`,
   `${first.name||first.playerName||'A new prospect'} begins a professional career.`,{teamId:team?.id,year});
 }
}
export function legacySummary(state,teamId){
 ensureLegacy(state);
 const l=state.legacy,t=state.teams.find(t=>t.id===teamId);
 const franchise=l.yearbooks.map(y=>({year:y.year,champion:y.champion===teamId,
  ...(y.standings.find(r=>r.teamId===teamId)||{}),playoffWins:y.playoffs.filter(g=>g.winner===teamId).length})).reverse();
 const rivals=Object.values(l.rivalries).filter(r=>r.teams.includes(teamId)).map(r=>{
  const opponent=r.teams.find(id=>id!==teamId);
  const other=state.teams.find(x=>x.id===opponent);
  return {opponentId:opponent,opponent:other?.name||opponent,games:r.games,wins:r.wins[teamId]||0,
   losses:r.wins[opponent]||0,ties:r.ties,playoffMeetings:r.playoffMeetings,oneScoreGames:r.oneScoreGames,
   meetings:r.meetings.filter(g=>g.home===teamId||g.away===teamId).slice(-5).reverse()};
 }).sort((a,b)=>b.games-a.games||b.oneScoreGames-a.oneScoreGames||a.opponent.localeCompare(b.opponent));
 const allCoaches=Object.values(l.coaches).sort((a,b)=>b.championships-a.championships||b.wins-a.wins||a.name.localeCompare(b.name));
 const playerRecords=Object.fromEntries(Object.keys(LEADER_CATEGORIES).map(cat=>[cat,leaders(state,cat,10,{career:true})]));
 const champTotals=Object.fromEntries(state.teams.map(t=>[t.id,l.yearbooks.filter(y=>y.champion===t.id).length]));
 return {franchise,yearbooks:l.yearbooks.slice(-30).reverse(),championships:champTotals,
  news:l.news.slice(-80).reverse(),milestones:l.milestones.slice(-80).reverse(),
  coaches:allCoaches.slice(0,100),rivals:rivals.slice(0,31),hallOfFame:l.hallOfFame.slice().reverse(),
  retiredPlayers:l.retiredPlayers.slice(-90).reverse(),playerRecords,
  historicalCoverage:l.yearbooks.length?`${l.yearbooks[0].year}-${l.yearbooks.at(-1).year}`:'No completed years yet',
  legacyIncomplete:state.statisticsPartial||Boolean(l.partialHistory)};
}
