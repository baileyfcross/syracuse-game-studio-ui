/** Draft pick ownership stays separate from draft order. Original owner fixes pick position; owner may change. */
export function ensureDraftPicks(state){
  state.draftPicks??=[];
  for(let year=state.season+1;year<=state.season+3;year++)for(let round=1;round<=7;round++)for(const team of state.teams){
    const id=`${year}-R${round}-${team.id}`;
    if(!state.draftPicks.some(p=>p.id===id))state.draftPicks.push({id,year,round,originalTeamId:team.id,ownerId:team.id});
  }
  state.draftPicks=state.draftPicks.filter(p=>p.year>state.season);
  return state.draftPicks;
}
export function swapPickOwnership(state,pickIds,newOwnerId){
  for(const id of pickIds){const pick=state.draftPicks.find(p=>p.id===id);if(!pick)throw Error('Unknown draft pick');pick.ownerId=newOwnerId;}
}
