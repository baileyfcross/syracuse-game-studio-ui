/** Read-only projections used by league-wide browser and player profiles.
 * Do not expose hidden scouting or development potential in these summaries.
 */
import {initializeStatistics} from './statistics.js';

const collect=(state)=>{
  const rows=[];
  for(const team of state.teams){
    for(const [status,list] of [['Roster',team.roster],['Practice Squad',team.practiceSquad||[]],['Injured Reserve',team.injuredReserve||[]]]){
      for(const p of list)rows.push({p,team,status});
    }
  }
  for(const p of state.freeAgents||[])rows.push({p,team:null,status:'Free Agent'});
  return rows;
};
export function leagueDirectory(state){
  initializeStatistics(state);
  return collect(state).map(({p,team,status})=>({
    id:p.id,name:p.name,teamId:team?.id||null,teamName:team?.name||'Free Agent',status,
    position:p.position,age:p.age,rating:p.rating,morale:p.morale??null,
    injuryWeeks:p.injuryWeeks||0,contractEnd:p.contract?.expiresYear??null,
    salary:p.contract?.baseSalary??0,
    passYards:state.statistics.players[p.id]?.passYards||0,
    rushYards:state.statistics.players[p.id]?.rushYards||0,
    recYards:state.statistics.players[p.id]?.recYards||0,
    sacks:state.statistics.players[p.id]?.sacks||0
  }));
}
export function playerProfile(state,playerId){
  if(typeof playerId!=='string'||playerId.length>100)throw Error('Invalid player ID');
  const hit=collect(state).find(({p})=>p.id===playerId);
  if(!hit)throw Error('Player not found in active league');
  initializeStatistics(state);
  const {p,team,status}=hit;
  const contract=p.contract?{
    baseSalary:p.contract.baseSalary??0,expiresYear:p.contract.expiresYear??null,
    signingBonus:p.contract.signingBonus??0,guaranteedSalary:p.contract.guaranteedSalary??0,
    annualBase:p.contract.annualBase??null
  }:null;
  return {
    id:p.id,name:p.name,position:p.position,age:p.age,rating:p.rating,teamId:team?.id??null,
    teamName:team?.name??'Free Agent',status,morale:p.morale??null,
    injuryWeeks:p.injuryWeeks??0,injuryLabel:p.injuryLabel??null,
    workEthic:p.development?.workEthic??null,lastSeasonChange:p.development?.lastSeasonChange??null,
    contract,season:state.statistics.players[p.id]||null,career:state.careerStatistics.players[p.id]||null,
    postseason:state.postseasonStatistics.players[p.id]||null
  };
}
