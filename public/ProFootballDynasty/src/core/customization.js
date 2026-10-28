/** User-controlled sandbox settings and identity editor.
 * Schedule invariants deliberately remain 32 teams/8 four-team divisions.
 */
import {reconcileDepthChart} from './coaching.js';
import {initializePlayerDevelopment} from './development.js';

export const DEFAULT_SETTINGS=Object.freeze({difficulty:'standard',injuryRate:'standard',scoutingDifficulty:'standard',developmentRate:'standard'});
const CHOICES={difficulty:['casual','standard','challenging'],injuryRate:['low','standard','high'],scoutingDifficulty:['relaxed','standard','strict'],developmentRate:['slow','standard','fast']};
const safeText=(value,max=48)=>{
  if(typeof value!=='string'||value.trim().length<2||value.trim().length>max||/[\x00-\x1f\x7f<>]/.test(value))throw Error('Text must contain 2 to '+max+' printable characters');
  return value.trim().replace(/\s+/g,' ');
};
const number=(value,min,max)=>{
  if(!Number.isInteger(value)||value<min||value>max)throw Error(`Value must be an integer from ${min} to ${max}`);
  return value;
};
const teamBy=(state,id)=>{
 const team=state.teams.find(t=>t.id===id);
 if(!team)throw Error('Unknown franchise');return team;
};
export function initializeCustomization(state){
 state.settings={...DEFAULT_SETTINGS,...(state.settings||{})};
 for(const [key,allowed] of Object.entries(CHOICES))if(!allowed.includes(state.settings[key]))state.settings[key]=DEFAULT_SETTINGS[key];
 state.customizationLog??=[];
 return state;
}
function track(state,text){state.customizationLog.push({year:state.season,week:state.week,text});state.customizationLog=state.customizationLog.slice(-50);}
export function changeSettings(state,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Settings object required');
 for(const [key,value] of Object.entries(patch)){
  if(!CHOICES[key]?.includes(value))throw Error('Invalid gameplay setting: '+key);
 }
 Object.assign(state.settings,patch);track(state,'Gameplay settings changed');return state.settings;
}
export function editFranchise(state,teamId,patch){
 const team=teamBy(state,teamId);
 if(!patch||typeof patch!=='object')throw Error('Franchise details required');
 for(const k of Object.keys(patch))if(!['city','nickname','color'].includes(k))throw Error('Unsupported franchise field');
 const city=patch.city===undefined?team.city:safeText(patch.city,40);
 const nickname=patch.nickname===undefined?team.nickname:safeText(patch.nickname,32);
 const color=patch.color===undefined?team.color:patch.color;
 if(typeof color!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(color))throw Error('Color must be a six-digit hexadecimal value');
 if(state.teams.some(t=>t.id!==teamId&&t.city.toLowerCase()===city.toLowerCase()&&t.nickname.toLowerCase()===nickname.toLowerCase()))throw Error('Another franchise already uses that name');
 team.city=city;team.nickname=nickname;team.name=`${city} ${nickname}`;team.color=color;
 track(state,`${teamId} identity updated to ${team.name}`);
 return team;
}
export function editPerson(state,teamId,kind,id,patch){
 const team=teamBy(state,teamId);
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Player or coach details required');
 const allowed=kind==='player'?['name','rating','age','morale']:kind==='coach'?['name','rating']:[];
 if(!allowed.length)throw Error('Unknown editor kind');
 for(const key of Object.keys(patch))if(!allowed.includes(key))throw Error(`Cannot edit ${key} in this editor`);
 let person;
 if(kind==='coach'){
  person=[team.coach,...Object.values(team.staff||{})].find(p=>p?.id===id);
 }else{
  person=[...team.roster,...(team.injuredReserve||[]),...(team.practiceSquad||[])].find(p=>p.id===id);
 }
 if(!person)throw Error('Person not found on this franchise');
 if(patch.name!==undefined)person.name=safeText(patch.name,55);
 if(patch.rating!==undefined)person.rating=number(patch.rating,30,99);
 if(patch.age!==undefined)person.age=number(patch.age,18,45);
 if(patch.morale!==undefined)person.morale=number(patch.morale,0,100);
 if(kind==='player'){
  initializePlayerDevelopment(person,state.seed);
  person.development.potential=Math.max(person.development.potential,person.rating);
  reconcileDepthChart(team);
 }else if(state.legacy?.coaches?.[person.id]){
  state.legacy.coaches[person.id].name=person.name;
 }
 track(state,`${kind} ${id} edited on ${team.name}`);
 return {id:person.id,name:person.name,rating:person.rating};
}

/** Portable fictional franchise identity pack; never includes player data or saved careers. */
export function exportLeagueTemplate(state){
 return {format:'pfd-league-template',version:1,teams:state.teams.map(t=>({id:t.id,city:t.city,nickname:t.nickname,color:t.color,conference:t.conference,division:t.division}))};
}
export function importLeagueTemplate(state,template){
 if(!template||template.format!=='pfd-league-template'||template.version!==1||!Array.isArray(template.teams)||template.teams.length!==32)throw Error('Expected a 32-team Pro Football Dynasty league template');
 const original=state.teams;
 if(new Set(template.teams.map(t=>t.id)).size!==32)throw Error('Team IDs must be unique');
 const proposed=structuredClone(original);
 for(const row of template.teams){
  const team=proposed.find(t=>t.id===row.id);if(!team)throw Error('Unknown template franchise');
  if(row.conference!==team.conference||row.division!==team.division)throw Error('Template cannot change the current conference or division layout');
  if(Object.keys(row).some(k=>!['id','city','nickname','color','conference','division'].includes(k)))throw Error('Template contains unsupported fields');
  const city=safeText(row.city,40),nickname=safeText(row.nickname,32);
  if(typeof row.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(row.color))throw Error('Invalid template color');
  team.city=city;team.nickname=nickname;team.name=`${city} ${nickname}`;team.color=row.color;
 }
 if(new Set(proposed.map(t=>t.name.toLowerCase())).size!==32)throw Error('Template franchise names must be unique');
 for(let i=0;i<32;i++)for(const k of ['city','nickname','name','color'])original[i][k]=proposed[i][k];
 track(state,'Imported 32-team franchise identity template');
 return exportLeagueTemplate(state);
}
