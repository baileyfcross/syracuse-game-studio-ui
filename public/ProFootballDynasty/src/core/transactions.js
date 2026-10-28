import { capSpace, releasePlayer } from './finance.js';
import { reconcileDepthChart } from './coaching.js';
/** Two-way player and pick exchange; validate on clones before touching live state. */
export function exchangeAssets(state,aId,bId,{aPlayers=[],bPlayers=[],aPicks=[],bPicks=[]}={}){
  if(aId===bId)throw Error('Trade partners must differ');
  const a=state.teams.find(t=>t.id===aId),b=state.teams.find(t=>t.id===bId);
  if(!a||!b)throw Error('Unknown franchise');
  for(const xs of [aPlayers,bPlayers,aPicks,bPicks])if(!Array.isArray(xs)||xs.some(id=>typeof id!=='string')||new Set(xs).size!==xs.length)throw Error('Invalid trade assets');
  if(!aPlayers.length&&!bPlayers.length&&!aPicks.length&&!bPicks.length)throw Error('Trade must include assets');
  const pickById=new Map(state.draftPicks.map(p=>[p.id,p]));
  for(const id of aPicks)if(pickById.get(id)?.ownerId!==aId)throw Error('Sending club does not own a draft pick');
  for(const id of bPicks)if(pickById.get(id)?.ownerId!==bId)throw Error('Receiving club does not own a draft pick');
  const year=state.offseason?.year??state.season;
  const x=structuredClone(a),y=structuredClone(b),incomingX=[],incomingY=[];
  for(const [from,ids,out] of [[x,aPlayers,incomingY],[y,bPlayers,incomingX]])for(const id of ids){
    const player=from.roster.find(p=>p.id===id);
    if(!player)throw Error('Trade player not found');
    const copy=structuredClone(player);
    if(copy.contract){copy.contract.signingBonus=0;copy.contract.bonusSchedule={};}
    releasePlayer(from,id,year,{transfer:true});
    out.push(copy);
  }
  x.roster.push(...incomingX);y.roster.push(...incomingY);
  const limit=['trainingCamp','preseason'].includes(state.phase)?90:53;
  if(x.roster.length>limit||y.roster.length>limit)throw Error(`Trade would exceed ${limit}-man roster limit`);
  if(capSpace(x,year,state.salaryCap)<0||capSpace(y,year,state.salaryCap)<0)throw Error('Trade fails salary cap accounting');
  // Atomic application after all checks pass.
  for(const [target,source] of [[a,x],[b,y]]){
    target.roster=source.roster;target.deadCap=source.deadCap;target.deadCapByYear=source.deadCapByYear;
    reconcileDepthChart(target);
  }
  for(const id of aPicks)pickById.get(id).ownerId=bId;
  for(const id of bPicks)pickById.get(id).ownerId=aId;
  state.events.push({year:state.season,text:`${a.name} and ${b.name} exchanged ${aPlayers.length+bPlayers.length} players and ${aPicks.length+bPicks.length} draft picks.`});
  return {aId,bId,aPlayers,bPlayers,aPicks,bPicks};
}
