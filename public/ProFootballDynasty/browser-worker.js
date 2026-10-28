import { fs, path } from './browser-storage.js';
import { simulateMatch } from './src/sim/game.js';
const parentPort = {
  on(event, callback) { if (event === 'message') self.addEventListener('message', e => callback(e.data)); },
  postMessage(value) { self.postMessage(value); }
};
class BrowserSimulationWorker {
  handlers = {message:[], error:[]};
  on(event, callback) { this.handlers[event]?.push(callback); }
  postMessage({id, games, teams, seed, injuryRate}) {
    queueMicrotask(() => {
      try {
        const byId = new Map(teams.map(team => [team.id, team]));
        const results = games.map(game => ({id:game.id, ...simulateMatch(byId.get(game.home), byId.get(game.away), {seed, matchId:game.id, injuryRate})}));
        this.handlers.message.forEach(callback => callback({id, results}));
      } catch (error) {
        this.handlers.message.forEach(callback => callback({id, error:error.message}));
      }
    });
  }
}
import { leagueDirectory, playerProfile } from './src/core/directory.js';
import { NFL_2026 } from './src/config/nfl2026.js';
import { createLeague, upgradeLeague, advanceLeague, stateSummary, signFreeAgent, cutPlayer, trade, startNextSeason, getGameDetail, tradeTargetSummary, franchiseTag, signPractice, releasePractice, promotePractice, elevatePractice, reservePlayer, returnFromReserve, claimPlayer, restructureContract, extendContract, tradePackage, openOffseason, openDraft, selectDraftProspect, simulateCpuDraft, finishDraft, negotiatePlayerOffer, negotiatePlayerExtension, submitTradeOffer, hireFranchiseStaff, prepareCpuWeek, setCampPlan, autoRosterCuts, startRegularSeason } from './src/core/engine.js';
import { setGamePlan, setPracticeFocus, setStarter, spendSkillPoint } from './src/core/coaching.js';
import {preseasonLineup} from './src/core/calendar.js';
import {changeSettings, editFranchise, editPerson, exportLeagueTemplate, importLeagueTemplate} from './src/core/customization.js';
import {validateSlotId, safeSlotName, validateImportPayload} from './src/core/save-slots.js';
import {setTactics} from './src/core/coaching.js';
import { scoutProspect, setScoutingFocus, toggleProspectBookmark } from './src/core/scouting.js';
const dataDir='browser-data';
const slotPath=id=>validateSlotId(id)==='default'?path.join(dataDir,'save.json'):path.join(dataDir,'slots',`${id}.json`);
let activeSlot='default';
let state;
// Do not use a top-level await here. A request can arrive while IndexedDB is
// opening, before a listener registered after that await would be available.
async function initializeLeague() {
  try {
    activeSlot = validateSlotId(JSON.parse(await fs.readFile(path.join(dataDir,'active-slot.json'), 'utf8')).slotId);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    state = upgradeLeague(validateImportPayload(JSON.parse(await fs.readFile(slotPath(activeSlot), 'utf8'))));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = createLeague();
  }
}
const simulation = new BrowserSimulationWorker();
let nextId=0; const pending=new Map();
simulation.on('message',(message)=>{
  const p=pending.get(message.id);if(!p)return;pending.delete(message.id);
  message.error?p.reject(Error(message.error)):p.resolve(message.results);
});
simulation.on('error',(err)=>{
  for(const p of pending.values())p.reject(err);pending.clear();
});
function workerSimulation(games,{preseason=false}={}){
  const id=++nextId;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    simulation.postMessage({id,games,teams:state.teams.map(t=>preseason?preseasonLineup(t,state.week):({ ...t, roster:[...t.roster,...(t.elevationWeek===state.week?t.practiceSquad.filter(p=>t.elevatedPlayerIds.includes(p.id)):[])] })),seed:state.seed+state.season,injuryRate:state.settings.injuryRate});
  });
}
async function writeSlot(slot,source){
  const destination=slotPath(slot);await fs.mkdir(path.dirname(destination),{recursive:true});
  const temp=`${destination}.tmp`;
  try{await fs.writeFile(temp,JSON.stringify(source),'utf8');await fs.rename(temp,destination);}
  finally{await fs.rm(temp,{force:true}).catch(()=>{});}
}
async function save(){await writeSlot(activeSlot,state);}
async function persistActiveSlot(){
  const dest=path.join(dataDir,'active-slot.json');const tmp=`${dest}.tmp`;
  await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(tmp,JSON.stringify({slotId:activeSlot}),'utf8');await fs.rename(tmp,dest);
}
async function slotsList(){
  const rows=[];
  for(const id of ['default',...(await fs.readdir(path.join(dataDir,'slots')).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e)))
    .filter(name=>/^slot-[a-z0-9]{1,24}\.json$/.test(name)).map(name=>name.slice(0,-5))]){
    try{const file=JSON.parse(await fs.readFile(slotPath(id),'utf8'));
      rows.push({id,name:file.slotName||id,season:file.season,phase:file.phase,week:file.week,teamName:file.teams?.find(t=>t.id===file.managedTeamId)?.name||file.teams?.[0]?.name||null,active:id===activeSlot});}
    catch(e){if(e.code!=='ENOENT')rows.push({id,name:id,invalid:true,active:id===activeSlot});}
  }
  if(!rows.some(r=>r.id===activeSlot))rows.unshift({id:activeSlot,name:state.slotName||'Default career',season:state.season,phase:state.phase,week:state.week,active:true});
  return rows;
}
async function createSlot(args){
  const id=validateSlotId(args.slotId);if(id==='default')throw Error('Default save cannot be overwritten as a new slot');
  try{await fs.access(slotPath(id));throw Error('This save slot already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
  const created=createLeague(Number.isInteger(args.seed)?args.seed:2026);created.slotName=safeSlotName(args.name||id);
  await save();await writeSlot(id,created);activeSlot=id;state=created;await persistActiveSlot();
  return stateSummary(state,args.teamId||'T01');
}
async function loadSlot(args){
  const id=validateSlotId(args.slotId);
  const candidate=upgradeLeague(validateImportPayload(JSON.parse(await fs.readFile(slotPath(id),'utf8'))));
  await save();activeSlot=id;state=candidate;await persistActiveSlot();
  return stateSummary(state,args.teamId||'T01');
}
async function deleteSlot(args){
  const id=validateSlotId(args.slotId);if(id==='default'||id===activeSlot)throw Error('Cannot delete the default or active save slot');
  await fs.unlink(slotPath(id));return slotsList();
}
async function renameSlot(args){
  const id=validateSlotId(args.slotId);
  const name=safeSlotName(args.name);
  if(id===activeSlot){state.slotName=name;await save();}
  else {
    const source=upgradeLeague(validateImportPayload(JSON.parse(await fs.readFile(slotPath(id),'utf8'))));
    source.slotName=name;await writeSlot(id,source);
  }
  return slotsList();
}
async function duplicateSlot(args){
  const sourceId=validateSlotId(args.sourceSlotId);
  const destinationId=validateSlotId(args.slotId);
  if(destinationId==='default')throw Error('Cannot overwrite default slot');
  try{await fs.access(slotPath(destinationId));throw Error('Destination slot already exists');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  if(sourceId===activeSlot)await save();
  const source=upgradeLeague(validateImportPayload(JSON.parse(await fs.readFile(slotPath(sourceId),'utf8'))));
  source.slotName=safeSlotName(args.name||`${source.slotName||sourceId} - Copy`);
  await writeSlot(destinationId,source);
  return slotsList();
}
function ownedTeam(id){const team=state.teams.find(t=>t.id===id);if(!team)throw Error('Unknown franchise');return team;}
async function handle(type,args={}){
  if(type==='slotsList')return slotsList();
  if(type==='slotsCreate')return createSlot(args);
  if(type==='slotsLoad')return loadSlot(args);
  if(type==='slotsDelete')return deleteSlot(args);
  if(type==='slotsRename')return renameSlot(args);
  if(type==='slotsDuplicate')return duplicateSlot(args);
  if(type==='exportSave')return JSON.stringify(state);
  if(type==='exportLeagueTemplate')return JSON.stringify(exportLeagueTemplate(state));
  if(type==='importSave'){
    if(typeof args.json!=='string'||args.json.length>32_000_000)throw Error('Import must be a JSON file smaller than 32 MB');
    const imported=upgradeLeague(validateImportPayload(JSON.parse(args.json)));
    imported.slotName=safeSlotName(args.name||'Imported career');
    await save();
    state=imported;await save();return stateSummary(state,args.teamId||'T01');
  }
  if(type==='rules')return {rules:NFL_2026};
  if(type==='directory')return leagueDirectory(state);
  if(type==='playerProfile')return playerProfile(state,args.playerId);
  if(type==='state')return stateSummary(state,args.teamId||'T01');
  if(type==='gameDetail')return getGameDetail(state,args.gameId);
  if(type==='tradeTarget')return tradeTargetSummary(state,args.teamId);
  if(type==='reset'){
    state=createLeague(Number(args.seed)||2026);await save();return stateSummary(state,args.teamId||'T01');
  }
  if(type==='advance'){
    let simulated;
    if(state.phase==='preseason'){
      const games=state.preseasonGames.filter(g=>g.week===state.week&&g.status==='scheduled');
      simulated=new Map((await workerSimulation(games,{preseason:true})).map(g=>[g.id,g]));
    }else if(state.phase==='regular'){
      prepareCpuWeek(state);
      const games=state.games.filter(g=>g.week===state.week&&g.status==='scheduled');
      simulated=new Map((await workerSimulation(games)).map(g=>[g.id,g]));
    }
    advanceLeague(state,simulated);
  }else if(type==='nextSeason')startNextSeason(state);
  else if(type==='settings')changeSettings(state,args.settings);
  else if(type==='importLeagueTemplate'){importLeagueTemplate(state,args.template);}
  else if(type==='editFranchise')editFranchise(state,args.teamId,args.changes);
  else if(type==='editPerson')editPerson(state,args.teamId,args.kind,args.personId,args.changes);
  else if(type==='campPlan')setCampPlan(state,args.teamId,{focus:args.focus,intensity:args.intensity});
  else if(type==='autoCuts')autoRosterCuts(state,args.teamId);
  else if(type==='finalizeCutdown')startRegularSeason(state);
  else if(type==='openOffseason')openOffseason(state,args.teamId||'T01');
  else if(type==='beginDraft')openDraft(state,args.teamId||'T01');
  else if(type==='draftAdvance')simulateCpuDraft(state);
  else if(type==='draftPick')selectDraftProspect(state,args.teamId,args.prospectId);
  else if(type==='autoDraftRemaining')finishDraft(state);
  else if(type==='negotiateFreeAgent')negotiatePlayerOffer(state,args.teamId,args.playerId,{salary:args.salary,years:args.years,signingBonus:args.signingBonus});
  else if(type==='negotiateExtension')negotiatePlayerExtension(state,args.teamId,args.playerId,{salary:args.salary,years:args.years,signingBonus:args.signingBonus});
  else if(type==='proposeTrade')submitTradeOffer(state,args.teamId,args.toTeamId,{aPlayers:args.aPlayers||[],bPlayers:args.bPlayers||[],aPicks:args.aPicks||[],bPicks:args.bPicks||[]});
  else if(type==='sign')signFreeAgent(state,args.teamId,args.playerId,{salary:Number(args.salary),years:Number(args.years),signingBonus:Number(args.signingBonus||0)});
  else if(type==='cut')cutPlayer(state,args.teamId,args.playerId,{june1:Boolean(args.june1)});
  else if(type==='franchiseTag')franchiseTag(state,args.teamId,args.playerId);
  else if(type==='trade')trade(state,args.teamId,args.toTeamId,args.playerId);
  else if(type==='signPractice')signPractice(state,args.teamId,args.playerId);
  else if(type==='releasePractice')releasePractice(state,args.teamId,args.playerId);
  else if(type==='promotePractice')promotePractice(state,args.teamId,args.playerId,Number(args.salary||1_000_000));
  else if(type==='elevatePractice')elevatePractice(state,args.teamId,args.playerId);
  else if(type==='reserve')reservePlayer(state,args.teamId,args.playerId);
  else if(type==='activateIR')returnFromReserve(state,args.teamId,args.playerId);
  else if(type==='claimWaiver')claimPlayer(state,args.teamId,args.waiverId);
  else if(type==='restructure')restructureContract(state,args.teamId,args.playerId,Number(args.amount));
  else if(type==='extend')extendContract(state,args.teamId,args.playerId,{salary:Number(args.salary),years:Number(args.years),signingBonus:Number(args.signingBonus||0),guaranteedSalary:Number(args.guaranteedSalary||0)});
  else if(type==='tradePackage')tradePackage(state,args.teamId,args.toTeamId,{aPlayers:args.aPlayers||[],bPlayers:args.bPlayers||[],aPicks:args.aPicks||[],bPicks:args.bPicks||[]});
  else if(type==='tactics')setTactics(ownedTeam(args.teamId),args.settings||{});
  else if(type==='gameplan')setGamePlan(ownedTeam(args.teamId),{offense:args.offense,defense:args.defense,tempo:args.tempo});
  else if(type==='practice')setPracticeFocus(ownedTeam(args.teamId),args.focus);
  else if(type==='starter')setStarter(ownedTeam(args.teamId),args.position,Number(args.slot),args.playerId);
  else if(type==='coachSkill')spendSkillPoint(ownedTeam(args.teamId),args.skill);
  else if(type==='hireStaff')hireFranchiseStaff(state,args.teamId,args.role,args.candidateId);
  else if(type==='scout')scoutProspect(state,args.teamId,args.prospectId);
  else if(type==='scoutingFocus')setScoutingFocus(state,args.teamId,args.focus);
  else if(type==='bookmarkProspect')toggleProspectBookmark(state,args.teamId,args.prospectId);
  else throw Error(`Unknown action: ${type}`);
  await save();return stateSummary(state,args.teamId||'T01');
}
// Register immediately, before opening IndexedDB. Messages arriving during
// initialization are kept in-order and never lost.
let serial = Promise.resolve();
let initialization;
parentPort.on('message', ({id, type, args = {}}) => {
  serial = serial.then(async () => {
    try {
      await initialization;
      parentPort.postMessage({id, result: await handle(type, args)});
    } catch (error) {
      parentPort.postMessage({id, error: error?.message || String(error)});
    }
  });
});
initialization = initializeLeague();
initialization.then(
  () => parentPort.postMessage({type: 'worker-ready'}),
  error => {
    console.error('League initialization failed:', error);
    parentPort.postMessage({type: 'worker-startup-error', error: error?.message || String(error)});
  }
);
