import {hashString,rng,randomInt} from './random.js';
import {recordCoachHire} from './legacy.js';

export const STAFF_ROLES=['headCoach','offensiveCoordinator','defensiveCoordinator','scoutingDirector'];
const POOL_SIZES={headCoach:14,offensiveCoordinator:20,defensiveCoordinator:20,scoutingDirector:16};
const FIRST=['Adrian','Blake','Carter','Damien','Elijah','Frank','Grant','Hayden','Isaac','Jared','Kendall','Landon','Miles','Nathan','Owen','Parker','Quentin','Riley','Shawn','Taylor'];
const LAST=['Parker','Mason','Ellis','Wright','Sutton','Olsen','Hart','Turner','Porter','Dixon','Bishop','Brooks','Hayes','Rivera','Burns','Wells'];
const salaryFor=(role,rating)=>Math.round((role==='headCoach'?3_500_000:role==='scoutingDirector'?900_000:1_700_000)*(0.7+rating/120)/100_000)*100_000;
const philosophy=(role,rating,seed)=>{
  const list=role==='offensiveCoordinator'||role==='headCoach'?['balanced','west-coast','vertical','run-first','spread']:
    role==='defensiveCoordinator'?['balanced','man-coverage','zone-coverage','blitz-heavy','run-stop']:['balanced','quarterback','offensive-line','pass-rush','coverage','skill-positions'];
  return list[hashString(`${seed}-${rating}-${role}`)%list.length];
};
export function makeStaff(role,id,name,rating,seed){
  return {id,role,name,rating,philosophy:philosophy(role,rating,seed),salary:salaryFor(role,rating),contractYears:3,
    yearsRemaining:3,experience:randomInt(rng(hashString(`${seed}:${id}:experience`)),2,24)};
}
export function staffInRole(team,role){return role==='headCoach'?team.coach:team.staff?.[role];}
export function setStaffInRole(team,role,staff){if(role==='headCoach')team.coach=staff;else team.staff[role]=staff;}
export function teamStaffCost(team){return STAFF_ROLES.reduce((n,role)=>n+(staffInRole(team,role)?.salary||0),0);}
/** Adds free coaching candidates and safe metadata for existing coordinators on migrated saves. */
export function initializeStaffMarket(state){
  for(const team of state.teams){
    team.staff??={};team.staffBudget??=22_000_000;team.staffMoves??={};
    for(const role of STAFF_ROLES){
      let current=staffInRole(team,role);
      if(!current){current=makeStaff(role,`S-${team.id}-${role}`,`${team.city} Head of Scouting`,67,state.seed);setStaffInRole(team,role,current);}
      const baseline=makeStaff(role,`S-${team.id}-${role}`,current.name,current.rating,state.seed);
      // Preserve experience, XP and skills on the existing head coach, only fill missing fields.
      setStaffInRole(team,role,{...baseline,...current,role,id:current.id||baseline.id});
    }
  }
  if(!state.staffMarket){
    state.staffMarket=[];
    for(const role of STAFF_ROLES)for(let i=0;i<POOL_SIZES[role];i++){
      const rand=rng(hashString(`${state.seed}:${role}:${i}:candidate`));
      state.staffMarket.push(makeStaff(role,`C-${role}-${i+1}`,`${FIRST[randomInt(rand,0,FIRST.length-1)]} ${LAST[randomInt(rand,0,LAST.length-1)]}`,
        randomInt(rand,53,93),state.seed));
    }
  }
  state.staffHiringHistory??=[];
}
function changeStaff(state,team,role,candidate,{cpu=false}={}){
  const prior=staffInRole(team,role);
  if(!candidate||candidate.role!==role)throw Error('Candidate does not match staff role');
  if(prior?.id===candidate.id)throw Error('Candidate already employed');
  const total=teamStaffCost(team)-(prior?.salary||0)+candidate.salary;
  if(total>team.staffBudget)throw Error('Staff payroll budget exceeded');
  const otherRoles=STAFF_ROLES.filter(r=>r!==role);
  if(otherRoles.some(r=>staffInRole(team,r)?.id===candidate.id))throw Error('Staff member already employed by club');
  state.staffMarket=state.staffMarket.filter(c=>c.id!==candidate.id);
  if(prior){
    // A former head coach retains his coaching reputation but returns to market without team career stats.
    state.staffMarket.push({...prior,yearsRemaining:0});
  }
  let incoming=structuredClone(candidate);
  incoming.yearsRemaining=incoming.contractYears;
  if(role==='headCoach'){
    incoming={...incoming,xp:incoming.xp??0,level:incoming.level??1,skillPoints:incoming.skillPoints??0,
      skills:incoming.skills??{offense:0,defense:0,development:0,leadership:0},
      careerWins:incoming.careerWins??0,careerLosses:incoming.careerLosses??0,careerTies:incoming.careerTies??0};
  }
  setStaffInRole(team,role,incoming);
  if(role==='headCoach')recordCoachHire(state,{teamId:team.id,oldCoach:prior,newCoach:incoming,year:state.offseason?.year||state.season+1});
  team.staffMoves[role]=state.offseason?.year||state.season+1;
  const event={year:state.offseason?.year||state.season+1,teamId:team.id,role,name:incoming.name,
    previous:prior?.name||null,cpu};
  state.staffHiringHistory.push(event);
  state.staffHiringHistory=state.staffHiringHistory.slice(-150);
  state.events.push({year:state.season,text:`${team.name} hired ${incoming.name} as ${role.replace(/([A-Z])/g,' $1')}.`});
  return incoming;
}
export function hireStaff(state,teamId,role,candidateId){
  if(state.phase!=='offseason'||state.offseason?.stage==='draft'||state.offseason?.stage==='ready')throw Error('Staff changes require the offseason before the draft');
  if(!STAFF_ROLES.includes(role))throw Error('Invalid staff role');
  const team=state.teams.find(t=>t.id===teamId);if(!team)throw Error('Unknown franchise');
  const year=state.offseason?.year||state.season+1;
  if(team.staffMoves[role]===year)throw Error('This staff position was already filled during the offseason');
  const candidate=state.staffMarket.find(c=>c.id===candidateId&&c.role===role);
  if(!candidate)throw Error('Staff candidate is no longer available');
  return changeStaff(state,team,role,candidate);
}
/** Opposing clubs respond to losing records, vacancies and expiring staff deals. */
export function cpuStaffReview(state,managedTeamId){
  const hires=[];
  for(const team of state.teams){
    if(team.id===managedTeamId)continue;
    const rate=(team.wins+(team.ties||0)*.5)/Math.max(1,team.wins+team.losses+(team.ties||0));
    for(const role of STAFF_ROLES){
      const incumbent=staffInRole(team,role);
      const poor=role==='headCoach'?rate<.36:role==='scoutingDirector'?incumbent.rating<58:
        rate<.40&&incumbent.rating<72;
      const vacant=(incumbent.yearsRemaining??1)<=0;
      const rngVal=rng(hashString(`${state.seed}-${state.season}-${team.id}-${role}-staff`))();
      if(!vacant&&!(poor&&rngVal<.48))continue;
      const shortlist=state.staffMarket.filter(c=>c.role===role&&c.rating>=incumbent.rating+(vacant?0:3))
        .sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id));
      let chosen=shortlist.find(c=>teamStaffCost(team)-(incumbent.salary||0)+c.salary<=team.staffBudget);
      if(!chosen)continue;
      hires.push(changeStaff(state,team,role,chosen,{cpu:true}));
    }
  }
  return hires;
}
/** Contract length progression occurs once at opening of the new league year. */
export function ageStaffContracts(state){
  for(const team of state.teams)for(const role of STAFF_ROLES){
    const coach=staffInRole(team,role);
    coach.yearsRemaining=Math.max(0,(coach.yearsRemaining??3)-1);
  }
}
export function staffSummary(state,teamId){
  const team=state.teams.find(t=>t.id===teamId);if(!team)throw Error('Unknown franchise');
  return {budget:team.staffBudget,spent:teamStaffCost(team),
    candidates:state.staffMarket.map(({id,role,name,rating,philosophy,salary,experience})=>({id,role,name,rating,philosophy,salary,experience}))
      .sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id)),
    recentHires:state.staffHiringHistory.slice(-10).reverse()};
}
