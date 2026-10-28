/** Original, stats-based fictional All-League and All-Star selections; not official NFL voting. */
const SLOTS={QB:2,RB:2,WR:4,TE:2,OL:5,DL:3,EDGE:3,LB:3,CB:3,S:3,K:1,P:1};
const awardScore=p=>{
 switch(p.position){
  case 'QB':return p.passYards*.11+p.passTD*15-p.interceptionsThrown*10;
  case 'RB':return p.rushYards*.8+p.recYards*.25+p.rushTD*32;
  case 'WR':case 'TE':return p.recYards*.8+p.receptions*3+p.recTD*32;
  case 'OL':return (p.offensiveSnaps||0)*.25-(p.sacksAllowed||0)*25;
  case 'DL':case 'EDGE':return p.sacks*45+p.tackles*3+p.forcedFumbles*20;
  case 'LB':case 'CB':case 'S':return p.tackles*5+p.interceptions*45+p.sacks*30;
  case 'K':return p.fgMade*25+p.xpMade*5;
  case 'P':return p.punts*6+p.puntYards*.05;
  default:return 0;
 }
};
export function selectSeasonHonors(state){
 const data=Object.values(state.statistics?.players||{}).filter(p=>p.games>=3);
 const lookup=new Map(state.teams.map(t=>[t.id,t.conference]));
 const grouped=pos=>data.filter(p=>p.position===pos).sort((a,b)=>awardScore(b)-awardScore(a)||a.id.localeCompare(b.id));
 const allPro=[],allStars=[];
 for(const [position,count] of Object.entries(SLOTS)){
  // First and second all-league teams: explicit slot count per position.
  const eligible=grouped(position);
  for(const [i,p] of eligible.slice(0,count*2).entries())allPro.push({playerId:p.id,name:p.name,teamId:p.teamId,position,team:i<count?1:2,score:Math.round(awardScore(p))});
  for(const conference of ['AFC','NFC']){
   const choices=eligible.filter(p=>lookup.get(p.teamId)===conference);
   for(const p of choices.slice(0,count))allStars.push({playerId:p.id,name:p.name,teamId:p.teamId,conference,position,score:Math.round(awardScore(p))});
  }
 }
 // The league selection is a statistical award, not a simulated fan/coach/player ballot.
 return {year:state.season,allPro,allStars};
}
export function finalizeSeasonHonors(state){
 state.honorsHistory??=[];
 if(!state.honorsHistory.some(x=>x.year===state.season))state.honorsHistory.push(selectSeasonHonors(state));
 return state.honorsHistory.find(x=>x.year===state.season);
}
