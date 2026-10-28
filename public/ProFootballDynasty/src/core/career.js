/** Human manager career. Kept separate from CPU head-coach personnel contracts. */
export function normalizeManagerName(value) {
  if (typeof value !== 'string') throw Error('Enter your manager name');
  const name = value.trim().replace(/\s+/g,' ');
  if (name.length < 2 || name.length > 55 || /[<>\x00-\x1f]/.test(name))
    throw Error('Manager name must be 2-55 characters without control or markup characters');
  return name;
}
export function ensureCoachCareer(state, {migration = false} = {}) {
  if (state.coachCareer !== undefined) return state.coachCareer;
  if (!migration) { state.coachCareer = null; return null; }
  const teamId = state.teams.some(t=>t.id===state.managedTeamId) ? state.managedTeamId : state.teams[0].id;
  const team = state.teams.find(t=>t.id===teamId);
  const progressed = state.phase !== 'regular' || state.week > 1 ||
    state.games.some(g=>g.status==='final') || Boolean(state.history?.length);
  state.coachCareer = {
    name: team?.coach?.name || 'Previous Manager', teamId, lastTeamId:teamId,
    status:'active', locked:progressed, startedSeason:state.season,
    seasonsCoached:0, consecutivePoorSeasons:0, lastEvaluatedSeason:null,
    history:[{season:state.season,type:'migration',teamId,note:'Existing career imported from an earlier save.'}]
  };
  return state.coachCareer;
}
export function chooseCoachTeam(state, {name, franchiseId} = {}) {
  const team = state.teams.find(t=>t.id===franchiseId);
  if (!team) throw Error('Select a valid franchise');
  const career = state.coachCareer;
  if (career?.status === 'active' && career.locked)
    throw Error('You are under contract. Resign or be fired before managing another team.');
  const validName = normalizeManagerName(name);
  if (career?.status === 'active' && career.name !== validName)
    throw Error('Manager name cannot be changed after beginning a career');
  state.coachCareer = {
    name:validName,teamId:franchiseId,lastTeamId:franchiseId,
    status:'active',locked:false,startedSeason:state.season,
    seasonsCoached:career?.seasonsCoached||0,
    consecutivePoorSeasons:0,lastEvaluatedSeason:career?.lastEvaluatedSeason||null,
    history:[...(career?.history||[]),{season:state.season,type:'hired',teamId:franchiseId}]
  };
  state.managedTeamId=franchiseId;
  if (state.offseason) state.offseason.managedTeamId=franchiseId;
  state.events.push({year:state.season,text:`${validName} took over the ${team.name} franchise.`});
  return state.coachCareer;
}
export function resignCoach(state) {
  const career=requireActiveCoach(state);
  career.history.push({season:state.season,type:'resigned',teamId:career.teamId});
  state.events.push({year:state.season,text:`${career.name} resigned from ${state.teams.find(t=>t.id===career.teamId)?.name}.`});
  career.lastTeamId=career.teamId;
  career.teamId=null;career.status='resigned';career.locked=false;
  career.consecutivePoorSeasons=0;
  state.managedTeamId=null;
  if (state.offseason) state.offseason.managedTeamId=null;
  return career;
}
export function requireActiveCoach(state) {
  const career=state.coachCareer;
  if (!career || career.status!=='active' || !state.teams.some(t=>t.id===career.teamId))
    throw Error('Choose your name and franchise before continuing the career.');
  return career;
}
export function requireManagedTeam(state, teamId) {
  const career=requireActiveCoach(state);
  if (career.teamId!==teamId)
    throw Error('You can only manage your assigned franchise. Resign or be fired to change teams.');
  return career;
}
export function lockCoachTeam(state) {requireActiveCoach(state).locked=true;}
/** Fictional ownership mechanic: two consecutive seasons with four or fewer wins result in firing.
 * Only evaluate one time per completed season, after the championship game. */
export function evaluateCoachJob(state) {
  const career=state.coachCareer;
  if (!career || career.status!=='active' || state.phase!=='offseason' ||
    career.lastEvaluatedSeason===state.season) return false;
  const team=state.teams.find(t=>t.id===career.teamId);
  if (!team) return false;
  career.lastEvaluatedSeason=state.season;
  career.seasonsCoached++;
  career.consecutivePoorSeasons=team.wins<=4?career.consecutivePoorSeasons+1:0;
  career.history.push({season:state.season,type:'season',teamId:team.id,wins:team.wins,losses:team.losses,ties:team.ties});
  if (career.consecutivePoorSeasons<2) return false;
  career.history.push({season:state.season,type:'fired',teamId:team.id});
  state.events.push({year:state.season,text:`${career.name} was dismissed by ${team.name} following consecutive poor seasons.`});
  career.lastTeamId=career.teamId;
  career.teamId=null;career.status='fired';career.locked=false;
  career.consecutivePoorSeasons=0;
  state.managedTeamId=null;
  if (state.offseason) state.offseason.managedTeamId=null;
  return true;
}
