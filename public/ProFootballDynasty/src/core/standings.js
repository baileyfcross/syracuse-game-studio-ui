export function recalculateRecords(state) {
  for(const t of state.teams){ t.wins=0;t.losses=0;t.ties=0;t.pointsFor=0;t.pointsAgainst=0; }
  const by=new Map(state.teams.map(t=>[t.id,t]));
  for(const g of state.games.filter(g=>g.type==='regular'&&g.status==='final')){
    const h=by.get(g.home),a=by.get(g.away);
    h.pointsFor+=g.scoreHome;h.pointsAgainst+=g.scoreAway;
    a.pointsFor+=g.scoreAway;a.pointsAgainst+=g.scoreHome;
    if(g.scoreHome>g.scoreAway){h.wins++;a.losses++;}
    else if(g.scoreHome<g.scoreAway){a.wins++;h.losses++;}
    else {a.ties++;h.ties++;}
  }
  return state.teams;
}
export const winPct=t=> {const n=t.wins+t.losses+t.ties;return n?(t.wins+t.ties/2)/n:0;};
export function headToHeadPct(state,a,b){
  const games=state.games.filter(g=>g.status==='final'&&g.type==='regular'&&[g.home,g.away].includes(a.id)&&[g.home,g.away].includes(b.id));
  if(!games.length)return null;
  let points=0;
  for(const g of games) {
    if(g.scoreHome===g.scoreAway)points+=.5;
    else if((g.scoreHome>g.scoreAway&&g.home===a.id)||(g.scoreAway>g.scoreHome&&g.away===a.id))points++;
  }
  return points/games.length;
}
function groupPct(state,team,filter){
  const games=state.games.filter(g=>g.status==='final'&&g.type==='regular'&&[g.home,g.away].includes(team.id)&&filter(state.teams.find(t=>t.id===(g.home===team.id?g.away:g.home))));
  if(!games.length)return 0;
  let points=0;
  for(const g of games){
    if(g.scoreHome===g.scoreAway)points+=.5;
    else if((g.home===team.id&&g.scoreHome>g.scoreAway)||(g.away===team.id&&g.scoreAway>g.scoreHome))points++;
  }
  return points/games.length;
}
// This is a partial tiebreak implementation: head-to-head, division/conference,
// point differential. Full multi-club NFL strength-of-victory procedures are TODO.
export function compareTeams(state,a,b) {
  let delta=winPct(b)-winPct(a);
  if(Math.abs(delta)>1e-9)return delta;
  const h2h=headToHeadPct(state,a,b);
  if(h2h!==null&&h2h!==.5)return h2h>.5?-1:1;
  if(a.conference===b.conference&&a.division===b.division){
    delta=groupPct(state,b,t=>t.conference===b.conference&&t.division===b.division)-groupPct(state,a,t=>t.conference===a.conference&&t.division===a.division);
    if(Math.abs(delta)>1e-9)return delta;
  }
  if(a.conference===b.conference){
    delta=groupPct(state,b,t=>t.conference===b.conference)-groupPct(state,a,t=>t.conference===a.conference);
    if(Math.abs(delta)>1e-9)return delta;
  }
  delta=(b.pointsFor-b.pointsAgainst)-(a.pointsFor-a.pointsAgainst);
  return delta||a.id.localeCompare(b.id);
}
export function rankConference(state,conference){return state.teams.filter(t=>t.conference===conference).sort((a,b)=>compareTeams(state,a,b));}
export function playoffSeeds(state,conference){
  const conf=state.teams.filter(t=>t.conference===conference);
  const champions=['East','North','South','West'].map(d=> conf.filter(t=>t.division===d).sort((a,b)=>compareTeams(state,a,b))[0]);
  const sortedChamps=champions.sort((a,b)=>compareTeams(state,a,b));
  const wild=conf.filter(t=>!champions.includes(t)).sort((a,b)=>compareTeams(state,a,b)).slice(0,3);
  return [...sortedChamps,...wild].map((team,i)=>({seed:i+1,teamId:team.id,conference}));
}
export function getDraftOrder(state) {
  // Non-playoff teams 1-18 sorted worst to best, followed by elimination groups.
  const seeds=['AFC','NFC'].flatMap(c=>playoffSeeds(state,c));
  const inPlayoffs=new Set(seeds.map(x=>x.teamId));
  const lower=state.teams.filter(t=>!inPlayoffs.has(t.id)).sort((a,b)=>compareTeams(state,b,a));
  const finished=(state.playoffGames||[]);
  const exitRound=new Map();
  for(const g of finished)if(g.status==='final') {
    const loser=g.scoreHome>g.scoreAway?g.away:g.home;
    exitRound.set(loser,g.round);
  }
  const playoffTeams=state.teams.filter(t=>inPlayoffs.has(t.id)).sort((a,b)=>{
    const ar=exitRound.get(a.id)??5,br=exitRound.get(b.id)??5;
    return ar-br||compareTeams(state,b,a);
  });
  return [...lower,...playoffTeams].map(t=>t.id);
}
