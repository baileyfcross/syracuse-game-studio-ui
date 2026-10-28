/** Slot IDs cannot contain path characters or be used to traverse the save folder. */
export function validateSlotId(id){
 if(id==='default')return id;
 if(typeof id!=='string'||!/^slot-[a-z0-9]{1,24}$/.test(id))throw Error('Invalid save slot ID');
 return id;
}
export function safeSlotName(name){
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>48||/[\x00-\x1f<>]/.test(name))throw Error('Save name must contain 2-48 printable characters');
 return name.trim();
}
export function validateImportPayload(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid save JSON');
 if(!Number.isInteger(input.version)||!Array.isArray(input.teams)||input.teams.length!==32||input.teams.some(t=>!t||typeof t!=='object'||!/^T(?:0[1-9]|[12][0-9]|3[0-2])$/.test(t.id)))throw Error('Save must be a compatible 32-team league');
 if(!new Set(input.teams.map(t=>t.id)).size||new Set(input.teams.map(t=>t.id)).size!==32)throw Error('Save contains duplicate franchise IDs');
 if(!Number.isInteger(input.season)||input.season<2020||input.season>2300||!Number.isInteger(input.seed)||!Array.isArray(input.games)||!Array.isArray(input.playoffGames)||!Array.isArray(input.freeAgents)||!Array.isArray(input.prospects))throw Error('Save data missing required league fields');
 return input;
}
