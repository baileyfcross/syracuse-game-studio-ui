import { rng, randomInt } from './random.js';
import { NFL_2026 } from '../config/nfl2026.js';
export const POSITION_COUNTS={QB:2,RB:3,WR:5,TE:3,OL:8,DL:5,EDGE:4,LB:5,CB:5,S:3,K:1,P:1,LS:1};
export const OFFENSE_POS=['QB','RB','WR','TE','OL'];
export const DEFENSE_POS=['DL','EDGE','LB','CB','S'];
const FIRST=['Alex','Jordan','Taylor','Cameron','Drew','Morgan','Chris','Sam','Reese','Avery','Jesse','Marcus','Devon','Eli','Theo','Dante','Cole','Trey','Zion','Noah','Tyler','Miles','Logan','Andre','Jalen','Quinn','Austin','Parker','Isaiah','Nolan'];
const LAST=['Reed','Miller','Johnson','Walker','Brooks','Collins','Clark','Davis','Lopez','Hughes','Williams','Price','Campbell','Bennett','Mitchell','Perry','Hayes','Russell','Morgan','Powell','Bell','Cooper','Foster','Lewis','Harper','Young','King'];
const POS_PREMIUM={QB:2.7,RB:0.8,WR:1.5,TE:1.0,OL:1.4,DL:1.3,EDGE:2.0,LB:1.1,CB:1.5,S:1.0,K:0.55,P:0.55,LS:0.45};
const round100k = n=>Math.round(n/100_000)*100_000;
export function createPlayer(random,id,position,rating,age,year,{rookieRound=null}={}) {
  const base = Math.max(850_000,round100k((0.6+Math.pow((rating-45)/40,2)*4.3)*1_000_000 * POS_PREMIUM[position]));
  const term=rookieRound!==null?4:randomInt(random,1,4);
  return {id,name:`${FIRST[randomInt(random,0,FIRST.length-1)]} ${LAST[randomInt(random,0,LAST.length-1)]}`,
    position, rating, age, rookieRound, injuryWeeks:0,
    contract:{startYear:year,expiresYear:year+term-1,baseSalary:base,signingBonus:round100k(base*0.35),guaranteedSalary:0,years:term}};
}
export function populateRosters(teams,year=2026,seed=2026) {
  const random=rng(seed+91); let count=1;
  for(const team of teams) {
    team.roster=[];
    for(const [position,n] of Object.entries(POSITION_COUNTS))for(let i=0;i<n;i++) {
      const rating=randomInt(random,54,91),age=randomInt(random,22,35);
      team.roster.push(createPlayer(random,`P${count++}`,position,rating,age,year));
    }
  }
  return count;
}
export function generateFreeAgents(year,seed=2026,number=110) {
  const random=rng(seed+year*7); const positions=Object.keys(POSITION_COUNTS);
  return Array.from({length:number},(_,i)=> {
    const position=positions[randomInt(random,0,positions.length-1)];
    const p=createPlayer(random,`FA${year}-${i+1}`,position,randomInt(random,49,82),randomInt(random,23,35),year);
    p.contract=null; return p;
  });
}
export function generateDraftClass(year,seed=2026,number=260) {
  const random=rng(seed+year*911); let i=0;
  const weight=['QB','RB','WR','WR','TE','OL','OL','OL','DL','EDGE','EDGE','LB','CB','CB','S','K','P'];
  return Array.from({length:number},(_,index)=>{
    const position=weight[randomInt(random,0,weight.length-1)];
    const p=createPlayer(random,`R${year}-${++i}`,position,randomInt(random,48,84),randomInt(random,21,24),year,{rookieRound:7});
    p.contract=null;p.scoutedRating=Math.max(40,Math.min(99,p.rating+randomInt(random,-9,9)));
    return p;
  }).sort((a,b)=>b.scoutedRating-a.scoutedRating);
}
export function teamUnitRating(team,unit) {
  const formations=unit==='offense'?{QB:1,RB:1,WR:3,TE:1,OL:5}:{DL:3,EDGE:2,LB:2,CB:2,S:2};
  const starters=[];
  for(const [position,count] of Object.entries(formations)) {
    const all=team.roster.filter(p=>p.position===position&&p.injuryWeeks===0).sort((a,b)=>b.rating-a.rating);
    const chosen=[];
    for(const id of team.depthChart?.[position]||[]) {
      const p=all.find(p=>p.id===id);
      if(p&&!chosen.includes(p)&&chosen.length<count)chosen.push(p);
    }
    for(const p of all)if(chosen.length<count&&!chosen.includes(p))chosen.push(p);
    starters.push(...chosen);
  }
  if(!starters.length)return unit==='offense'?team.baseOffense:team.baseDefense;
  const unitBase=unit==='offense'?team.baseOffense:team.baseDefense;
  const avg=starters.reduce((sum,p)=>sum+p.rating+((p.morale??65)-65)*.055,0)/starters.length;
  const coach=team.coach?.skills?.[unit]||0;
  const staff=unit==='offense'?team.staff?.offensiveCoordinator:team.staff?.defensiveCoordinator;
  const staffBonus=staff?(staff.rating-65)*.09:0;
  const practiceBonus=team.practice?.focus===unit?1.5:0;
  return Math.round(avg*.8+unitBase*.2 + coach*.7 + staffBonus + practiceBonus);
}
export function checkRosterLimit(team) {
  if(team.roster.length>NFL_2026.activeRosterLimit)throw Error(`${team.name} exceeds 53-man roster limit`);
}
