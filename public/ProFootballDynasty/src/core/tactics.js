/** v0.8 game-day strategy. Probabilities are gameplay tuning, not an officiating rulebook. */
export const PERSONNEL = Object.freeze({
  '11-personnel':{RB:1,TE:1,WR:3},
  '12-personnel':{RB:1,TE:2,WR:2},
  '21-personnel':{RB:2,TE:1,WR:2},
  '10-personnel':{RB:1,TE:0,WR:4}
});
export const DEFENSE_PACKAGES = Object.freeze({
  base:{DL:3,EDGE:2,LB:3,CB:2,S:1},
  nickel:{DL:3,EDGE:2,LB:2,CB:3,S:1},
  dime:{DL:2,EDGE:2,LB:1,CB:4,S:2}
});
export const FOURTH_DOWN_STYLES = Object.freeze(['conservative','balanced','aggressive']);
export const RED_ZONE_STYLES = Object.freeze(['balanced','run','pass']);
export const TWO_MINUTE_STYLES = Object.freeze(['adaptive','hurry-up','protect-lead']);
export const ROTATION_STYLES = Object.freeze(['starters','balanced','heavy']);
export const DEFAULT_TACTICS = Object.freeze({personnel:'11-personnel',defensePackage:'nickel',
  fourthDown:'balanced',redZone:'balanced',twoMinute:'adaptive',rotation:'balanced'});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const valid={personnel:Object.keys(PERSONNEL),defensePackage:Object.keys(DEFENSE_PACKAGES),fourthDown:FOURTH_DOWN_STYLES,
  redZone:RED_ZONE_STYLES,twoMinute:TWO_MINUTE_STYLES,rotation:ROTATION_STYLES};
export function normalizeTactics(plan={}){
  return Object.fromEntries(Object.keys(valid).map(k=>[k,valid[k].includes(plan[k])?plan[k]:DEFAULT_TACTICS[k]]));
}
export function updateTactics(team,options={}){
  if(!team.gamePlan)team.gamePlan={offense:'balanced',defense:'balanced',tempo:'balanced'};
  for(const [key,value] of Object.entries(options)){
    if(!Object.hasOwn(valid,key))throw Error(`Unknown tactical setting: ${key}`);
    if(!valid[key].includes(value))throw Error(`Invalid tactical setting ${key}: ${value}`);
  }
  team.gamePlan={...team.gamePlan,...normalizeTactics(team.gamePlan),...options};
  return team.gamePlan;
}
export function chooseSnapTactics({gamePlan={},down,toGo,ball,quarter,secondsRemaining,scoreDifference=0}){
  const t=normalizeTactics(gamePlan);
  const late=quarter>=2&&(secondsRemaining<=120||quarter===2&&secondsRemaining<=120);
  const chasing=scoreDifference<0;
  const base={balanced:.56,'west-coast':.64,vertical:.72,spread:.67,'run-first':.38}[gamePlan.offense]??.56;
  const spread=t.personnel==='10-personnel'?.09:t.personnel==='21-personnel'?-.10:t.personnel==='12-personnel'?-.035:0;
  const redZone=ball>=80?(t.redZone==='pass'?.13:t.redZone==='run'?-.17:0):0;
  const hurry=late&&(chasing||t.twoMinute==='hurry-up');
  const preserve=late&&!chasing&&t.twoMinute==='protect-lead';
  const passChance=clamp(base+spread+redZone+(down>=3?.11:0)+(toGo>=10?.06:0)+(hurry?.23:0)-(preserve?.21:0),.15,.9);
  const tempo=hurry?'uptempo':preserve?'clock-control':gamePlan.tempo||'balanced';
  return {personnel:t.personnel,defensePackage:t.defensePackage,passChance,tempo,hurry,preserve};
}
export function fourthDownCall({gamePlan={},ball,toGo,scoreDifference=0,secondsRemaining=3600,fgDistance=117-ball}){
  const style=normalizeTactics(gamePlan).fourthDown;
  const needPoints=scoreDifference<0&&secondsRemaining<240;
  const aggressiveness={conservative:-.18,balanced:0,aggressive:.22}[style];
  const inRange=fgDistance<=60;
  const goChance=clamp((ball>=50?.32:.035)+(toGo<=2?.27:toGo>=8?-.17:0)+aggressiveness+(needPoints?.5:0),0,.97);
  return {goChance,defaultChoice:inRange?'field-goal':'punt'};
}
export function penaltyWeights({defenseScheme='balanced',offenseTempo='balanced'}={}){
  return {falseStart:offenseTempo==='uptempo'?2.5:2,offensiveHolding:3,
    defensiveOffside:defenseScheme==='blitz-heavy'?2.5:1.5,defensiveHolding:defenseScheme==='man-coverage'?2:1};
}
