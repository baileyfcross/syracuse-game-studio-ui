// Shared UI: built from web/app.js. Do not edit the generated file.
import {gameFetch} from './browser-api.js?v=5483a3dec7ce';
const fetch = gameFetch;
const el=document.querySelector('#app');
const teamSelect=document.querySelector('#team-select');
const advance=document.querySelector('#advance-btn');
const toast=document.querySelector('#toast');
let data=null,tab='overview',busy=false,conference='AFC';
let selectedGame=null, statCategory='passYards',statScope='regular';
let legacySection='news',legacyCategory='passYards',saveSlots=[];
let teamId='T01'; // The assigned franchise comes from the saved coaching career, never localStorage.
let tradeTarget=null, tradePartnerId='T02';
const money=n=>'$'+(n/1_000_000).toFixed(1)+'M';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const teamBy=id=>data.teams.find(x=>x.id===id)||{};
const score=g=>g.status==='final'?`${g.scoreAway} - ${g.scoreHome}`:'VS';
const gameButton=g=>g.status==='final'?`<button class="button button-small" data-game="${esc(g.id)}">Game report</button>`:'<span class="muted">Not played</span>';
async function loadGame(id){try{const r=await fetch('/api/game?id='+encodeURIComponent(id));const x=await r.json();if(!r.ok)throw Error(x.error||'Failed to load game');selectedGame=x;tab='gamecenter';render();}catch(e){notification(e.message,true);}}
const phaseName=p=>({regular:'REGULAR SEASON',playoffs:'POSTSEASON',offseason:'OFFSEASON',trainingCamp:'TRAINING CAMP',preseason:'PRESEASON',cutdown:'ROSTER CUTDOWN'}[p]||p);
function notification(msg,error=false){toast.textContent=msg;toast.style.display='block';toast.style.background=error?'#552932':'#224e3c';setTimeout(()=>toast.style.display='none',3700);}
const careerModal=document.querySelector('#career-modal');
const careerForm=document.querySelector('#career-setup-form');
const careerNameInput=document.querySelector('#career-manager-name');
const careerTeamInput=document.querySelector('#career-franchise-select');
const careerError=document.querySelector('#career-modal-error');
function syncCareerModal() {
  if(!data)return;
  const career=data.coachCareer;
  const needed=!career||career.status!=='active';
  careerModal.hidden=!needed;
  if(!needed){careerError.hidden=true;return;}
  const status=career?.status;
  document.querySelector('#career-modal-title').textContent=status==='fired'?'You have been fired':status==='resigned'?'Find your next franchise':'Begin your coaching career';
  document.querySelector('#career-modal-info').textContent=status==='fired'
    ?'Ownership has dismissed you after consecutive poor seasons. Your career can continue with a new franchise.'
    :status==='resigned'?'You have resigned from your previous team. Choose the next franchise to continue your career.'
    :'Enter your name and select your franchise. After your first simulation, you cannot switch teams unless you resign or are fired.';
  if(career?.name){careerNameInput.value=career.name;careerNameInput.readOnly=true;}
  else {careerNameInput.value='';careerNameInput.readOnly=false;}
  careerTeamInput.innerHTML=data.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} (${esc(t.conference)} ${esc(t.division)})</option>`).join('');
  careerTeamInput.value=data.teams.find(t=>t.id===teamId)?.id||data.teams[0].id;
  careerError.hidden=true;
  queueMicrotask(()=>{if(!careerModal.hidden)(career?.name?careerTeamInput:careerNameInput).focus();});
}
careerForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.querySelector('#career-start-button');button.disabled=true;careerError.hidden=true;
  try {
    data=await api('coachSelect',{name:careerNameInput.value,franchiseId:careerTeamInput.value});
    teamId=data.coachCareer.teamId;selectedGame=null;tradeTarget=null;directoryCache=null;
    render();notification(`Now managing ${data.team.name}`);
  }catch(error){careerError.textContent=error.message;careerError.hidden=false;}
  finally{button.disabled=false;}
});

async function api(action,args={}){
  const endpoint=action==='state'||action==='rules'?`/api/${action}?team=${encodeURIComponent(teamId)}`:'/api/action';
  const r=await fetch(endpoint,action==='state'||action==='rules'?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:action,args:{...args,teamId}})});
  const x=await r.json();if(!r.ok)throw Error(x.error||'Request failed');return x;
}
async function refresh(){data=await api('state');directoryCache=null;render();}
async function action(type,args={}){
  if(busy)return;busy=true;advance.disabled=true;
  try {data=await api(type,args);directoryCache=null;if(type==='advance'||type==='nextSeason'||type==='reset'||type==='finalizeCutdown')selectedGame=null;notification(type==='advance'?'Simulation completed':type==='nextSeason'?'New season started':type==='negotiateFreeAgent'||type==='negotiateExtension'?(data.lastNegotiation?.accepted?'Offer accepted':'Offer declined'):type==='proposeTrade'?(data.lastTradeDecision?.accepted?'Trade accepted':'Trade rejected'):'Transaction saved');render();}
  catch(e){notification(e.message,true);}finally{busy=false;render();}
}
function heading(title,subtitle,badge){return `<div class="title-area"><div><div class="eyebrow">${phaseName(data.phase)} · ${data.season}</div><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p></div>${badge?`<div class="pill">${esc(badge)}</div>`:''}</div>`;}
function stat(name,value,foot,className=''){return `<article class="stat-card"><div class="key">${esc(name)}</div><div class="value ${className}">${esc(value)}</div><div class="foot">${esc(foot)}</div></article>`;}
function gameTag(g){if(g.status==='scheduled')return `<span class="tag next">UPCOMING</span>`;const isHome=g.home===teamId;const own=isHome?g.scoreHome:g.scoreAway;const other=isHome?g.scoreAway:g.scoreHome;return `<span class="tag ${own>other?'win':own<other?'loss':'bye'}">${own>other?'W':own<other?'L':'T'} ${own}-${other}</span>`;}
function upcoming(){const next=data.schedule.find(g=>g.status==='scheduled');if(!next)return `<div class="empty">No remaining regular-season games.</div>`;const isHome=next.home===teamId;const opp=teamBy(isHome?next.away:next.home);return `<div class="split"><div><div class="muted">WEEK ${next.week} · ${isHome?'HOME':'AWAY'}</div><h2>${esc(opp.name)}</h2><span class="tag next">UPCOMING</span></div><div class="team-mark" style="--tc:${esc(opp.color)}">${esc(opp.nickname?.slice(0,2).toUpperCase())}</div></div>`;}
function overview(){const t=data.team,finished=data.schedule.filter(g=>g.status==='final').slice(-5).reverse();const rosterRows=[...t.roster].sort((a,b)=>b.rating-a.rating).slice(0,7);return `
  ${heading(t.name,`${t.conference} ${t.division} · Franchise office`,`${data.phase==='regular'?`WEEK ${data.week} / 18`:data.phase==='preseason'?`PRESEASON WEEK ${data.week} / 3`:phaseName(data.phase)}`)}
  <section class="stats-grid">
    ${stat('SEASON RECORD',`${t.wins}-${t.losses}${t.ties?'-'+t.ties:''}`,'Regular season','green')}
    ${stat('TEAM MORALE',`${data.development.averageMorale}/100`,'Player satisfaction')}
    ${stat('AVAILABLE CAP',money(data.capSpace),`League cap: ${money(data.salaryCap)}`,'blue')}
    ${stat('ROSTER SIZE',`${t.roster.length} / 53`,'Active/inactive roster','')}
    ${stat('POINT DIFFERENTIAL',(t.pointsFor-t.pointsAgainst>=0?'+':'')+(t.pointsFor-t.pointsAgainst),`${t.pointsFor} scored · ${t.pointsAgainst} allowed`,'orange')}
  </section>
  <div class="two-column"><div>
    ${['trainingCamp','preseason','cutdown'].includes(data.phase)?`<section class="panel"><h3 class="panel-title">NFL Calendar</h3><p>Camp and preseason are in progress. Your club has <strong>${data.camp.rosterSize}</strong> players; <strong>${data.camp.cutsNeeded}</strong> cuts remain before the 53-man deadline.</p><button class="button button-primary" data-go-camp>Open Camp Center</button></section>`:''}
    <section class="panel"><h3 class="panel-title">Next Matchup <span class="panel-kicker">2026 NFL format</span></h3>${upcoming()}</section>
    <section class="panel"><h3 class="panel-title">Recent Games <span class="panel-kicker">REGULAR SEASON</span></h3>${finished.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Week</th><th>Opponent</th><th>Location</th><th>Result</th></tr></thead><tbody>${finished.map(g=>`<tr><td>${g.week}</td><td class="team-name">${esc(teamBy(g.home===t.id?g.away:g.home).name)}</td><td>${g.home===t.id?'Home':'Away'}</td><td>${gameTag(g)} ${gameButton(g)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Your first game has not been played.</div>'}</section>
    <section class="panel"><h3 class="panel-title">Best Players <span class="panel-kicker">OVERALL RATING</span></h3><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Age</th><th class="table-numeric">OVR</th></tr></thead><tbody>${rosterRows.map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.age}</td><td class="table-numeric highlight">${p.rating}</td></tr>`).join('')}</tbody></table></section>
  </div><div>
    <section class="panel"><h3 class="panel-title">Franchise Management <span class="panel-kicker">STAFF</span></h3><div class="split"><span class="muted">Head coach</span><strong>${esc(t.coach.name)}</strong></div><div class="split" style="margin-top:19px"><span class="muted">Coaching rating</span><strong>${t.coach.rating}/100</strong></div><div class="progress-wrap"><div class="progress" style="width:${t.coach.rating}%"></div></div><div class="split" style="margin-top:20px"><span class="muted">Roster capacity</span><strong>${t.roster.length}/53</strong></div><div class="progress-wrap"><div class="progress" style="width:${t.roster.length/53*100}%"></div></div></section>
    <section class="panel"><h3 class="panel-title">League Feed <span class="panel-kicker">LATEST</span></h3>${data.events.slice(0,8).map(x=>`<div class="activity-item"><small>SEASON ${x.year}</small>${esc(x.text)}</div>`).join('')}</section>
  </div></div>`;}
function standings(){const confTeams=data.teams.filter(t=>t.conference===conference);return `${heading('League Standings','Track every division as the season unfolds.')}
  <div class="subnav"><button class="filter ${conference==='AFC'?'selected':''}" data-conf="AFC">AFC CONFERENCE</button><button class="filter ${conference==='NFC'?'selected':''}" data-conf="NFC">NFC CONFERENCE</button></div>
  <div class="standings-grid">${['East','North','South','West'].map(div=>{const teams=confTeams.filter(t=>t.division===div).sort((a,b)=>(b.wins+.5*b.ties)/(b.wins+b.losses+b.ties||1)-(a.wins+.5*a.ties)/(a.wins+a.losses+a.ties||1)||b.pointsFor-b.pointsAgainst-(a.pointsFor-a.pointsAgainst));return `<section class="panel"><h3 class="panel-title">${conference} ${div} <span class="panel-kicker">DIVISION</span></h3><table class="data-table"><thead><tr><th>Team</th><th class="table-numeric">W</th><th class="table-numeric">L</th><th class="table-numeric">T</th><th class="table-numeric">DIFF</th></tr></thead><tbody>${teams.map(t=>`<tr><td class="team-name"><span class="team-chip" style="--tc:${esc(t.color)}">${esc(t.name)}</span></td><td class="table-numeric">${t.wins}</td><td class="table-numeric">${t.losses}</td><td class="table-numeric">${t.ties}</td><td class="table-numeric">${t.pointsFor-t.pointsAgainst}</td></tr>`).join('')}</tbody></table></section>`}).join('')}</div>`;}
function schedule(){return `${heading('Season Schedule',`17 regular season games for ${data.team.name}.`,'18 WEEKS')}
  <section class="panel"><table class="data-table"><thead><tr><th>Week</th><th>Opponent</th><th>Venue</th><th>Category</th><th>Result</th></tr></thead><tbody>${Array.from({length:18},(_,i)=>{const g=data.schedule.find(g=>g.week===i+1);return g?`<tr><td><strong>${g.week}</strong></td><td class="team-name">${esc(teamBy(g.home===teamId?g.away:g.home).name)}</td><td>${g.home===teamId?'Home':'Away'}</td><td>${esc(g.category.replaceAll('-',' '))}</td><td>${gameTag(g)} ${gameButton(g)}</td></tr>`:`<tr><td>${i+1}</td><td colspan="3" class="muted">BYE WEEK</td><td><span class="tag bye">BYE</span></td></tr>`}).join('')}</tbody></table></section>`;}
function roster(){const byPos={};data.team.roster.forEach(p=>(byPos[p.position]??=[]).push(p));return `${heading('Team Roster','Manage contracts and evaluate personnel.','53-MAN LIMIT')}
  <section class="stats-grid">${stat('CURRENT CAP HIT',money(data.salaryCap-data.capSpace),'Includes simplified contract charges')}${stat('AVAILABLE CAP',money(data.capSpace),'Cap space after player contracts','green')}${stat('ACTIVE PLAYERS',data.team.roster.length,'53-man roster limit')}${stat('HEAD COACH',data.team.coach.rating,'Coach rating')}</section>
  ${Object.entries(byPos).map(([pos,players])=>`<section class="panel"><h3 class="panel-title">${esc(pos)} <span class="panel-kicker">${players.length} PLAYERS</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Age</th><th>OVR</th><th>Base Salary</th><th>Contract Through</th><th>Morale</th><th>Development</th><th></th></tr></thead><tbody>${players.sort((a,b)=>b.rating-a.rating).map(p=>`<tr><td class="team-name"><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button></td><td>${p.age}</td><td class="highlight">${p.rating}</td><td>${money(p.contract?.baseSalary||0)}</td><td>${p.contract?.expiresYear??'Unsigned'}</td><td class="${(p.morale??65)<40?'orange':'highlight'}">${p.morale??'-'}/100</td><td>${p.development?.lastSeasonChange>0?'+':''}${p.development?.lastSeasonChange??0} · Work ethic ${p.development?.workEthic??'-'}</td><td><button class="button button-small button-danger" data-cut="${esc(p.id)}">Release</button></td></tr>`).join('')}</tbody></table></div></section>`).join('')}`;}
function freeagency(){return `${heading('Free Agency','Negotiate guaranteed dollars and base salary with available players.',`${data.freeAgents.length} TOP AVAILABLE`)}
  ${data.lastNegotiation?`<section class="panel"><strong>${data.lastNegotiation.accepted?'Contract accepted':'Offer declined'}: ${esc(data.lastNegotiation.playerName)}</strong><p class="muted">${esc(data.lastNegotiation.reason)}${data.lastNegotiation.counter?` · Counter: ${money(data.lastNegotiation.counter.salary)} per year, ${data.lastNegotiation.counter.years} years, ${money(data.lastNegotiation.counter.signingBonus)} signing bonus`:''}</p></section>`:''}
  <section class="panel"><p class="muted">Make offers that meet player expectations. A declined offer does not transfer the player or charge cap space. CPU teams pursue their own signings when the draft opens.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Free Agent</th><th>Position</th><th>Age</th><th>OVR</th><th>Estimated Annual Salary</th><th></th></tr></thead><tbody>${data.freeAgents.map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.age}</td><td class="highlight">${p.rating}</td><td>${money(p.asking||Math.max(900_000,p.rating*65_000))}</td><td><button class="button button-primary button-small" data-sign="${esc(p.id)}">Offer Contract</button> <button class="button button-small" data-ps-sign="${esc(p.id)}">Practice Squad</button></td></tr>`).join('')}</tbody></table></div></section>`;}
function playoffs(){const rounds=['Wild Card','Divisional','Conference Championship','Championship'];return `${heading('Postseason','Four division winners and three wild cards qualify from each conference.','14 TEAMS')}
  ${data.phase==='regular'?'<section class="panel"><div class="empty">Complete the regular season to unlock the playoff bracket.</div></section>':''}
  ${rounds.map((round,i)=>{const games=data.playoffs.filter(g=>g.round===i+1);return `<section class="panel"><h3 class="panel-title">${round}<span class="panel-kicker">ROUND ${i+1}</span></h3>${games.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Conference</th><th>Away</th><th>Home</th><th>Final</th></tr></thead><tbody>${games.map(g=>`<tr><td>${esc(g.conference)}</td><td>${esc(teamBy(g.away).name)}</td><td>${esc(teamBy(g.home).name)}</td><td class="highlight">${g.scoreAway} - ${g.scoreHome}${g.overtime?' (OT)':''} ${gameButton(g)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">Awaiting results</div>'}</section>`}).join('')}
  ${data.champion?`<section class="panel"><div class="eyebrow">LEAGUE CHAMPION</div><h1>🏆 ${esc(teamBy(data.champion).name)}</h1></section>`:''}`;}
function draft(){
 const hist=data.draftHistory?.[0],o=data.offseason;
 const active=o?.stage==='draft',turn=o?.onClock,manager=turn?.ownerId===o?.managedTeamId&&teamId===o?.managedTeamId;
 const prospects=data.scouting.prospects;
 const intro=(!o&&data.phase==='offseason')?`<section class="panel"><h3 class="panel-title">Open the New League Year</h3><p class="muted">Begin the offseason to finalize expiring contracts, open free agency and prepare a 224-pick draft. The selected franchise becomes the controlled team for this offseason.</p><button class="button button-primary" data-open-offseason>Open ${data.season+1} Offseason</button></section>`:'';
 const agency=o?.stage==='freeAgency'?`<section class="panel"><h3 class="panel-title">Offseason Free Agency</h3><p class="muted">You are managing ${esc(teamBy(o.managedTeamId).name)}. Negotiate with free agents or extend veterans before starting the draft. CPU opponents will evaluate and sign roster needs when the draft opens.</p><button class="button button-primary" data-begin-draft>Begin ${o.year} NFL-Style Draft</button></section>`:'';
 const live=active?`<section class="stats-grid">${stat('OVERALL PICK',`${o.completed+1} / ${o.total}`,'Current selection')}${stat('ROUND',turn?.round||'-', 'Seven total rounds')}${stat('ON THE CLOCK',teamBy(turn?.ownerId).nickname||'-',teamBy(turn?.ownerId).name||'')}${stat('PROSPECTS LEFT',prospects.length,'Available draft prospects')}</section>
 <section class="panel"><h3 class="panel-title">${manager?'Make Your Draft Selection':'CPU Franchise On the Clock'}</h3><p class="muted">${manager?'Choose a scouted prospect, then confirm the selection.':'Use Simulate CPU Picks to advance until your franchise owns the next pick.'} Pick assets follow previous trades. Ratings remain scouting estimates before selection.</p>
 ${manager?`<label class="field-label" for="draft-prospect">Available Players</label><select id="draft-prospect" class="form-select">${prospects.map(p=>`<option value="${esc(p.id)}">${p.bookmarked?'★ ':''}${esc(p.name)} · ${esc(p.position)} · Estimated ${p.estimate} ±${p.uncertainty}</option>`).join('')}</select><button class="button button-primary" data-draft-select>Draft Selected Player</button>`:`<button class="button button-primary" data-draft-advance>Simulate CPU Picks</button>`}
 <button class="button button-small" data-draft-auto>Automatically Finish Remaining Draft</button></section>`:'';
 const ready=o?.stage==='ready'?`<section class="panel"><h3 class="panel-title">Draft Complete</h3><p class="muted">All ${o.completed} selections have been made. Proceed to roster finalization and the new regular season. Unsigned players retain their team's draft rights.</p><button class="button button-primary" data-next-season>Start ${o.year} Season</button></section>`:'';
 const picked=o?.recent?.length?`<section class="panel"><h3 class="panel-title">Recent Draft Selections</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Overall</th><th>Team</th><th>Player</th><th>Pos</th><th>OVR</th><th>Signed</th></tr></thead><tbody>${o.recent.map(p=>`<tr><td>${p.overall}</td><td>${esc(teamBy(p.teamId).nickname)}</td><td>${esc(p.name)}</td><td>${p.position}</td><td>${p.rating}</td><td>${p.signed?'Yes':'Draft rights'}</td></tr>`).join('')}</tbody></table></div></section>`:'';
 return `${heading('NFL Draft & History','Manual draft selections, traded picks, scouting and annual records.','7 ROUNDS · 224 PICKS')}
 ${intro}${agency}${live}${ready}${picked}
 <section class="panel"><h3 class="panel-title">Latest Completed Draft <span class="panel-kicker">${hist?hist.year:'UPCOMING'}</span></h3>${hist?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Overall</th><th>Round</th><th>Team</th><th>Player</th><th>Position</th><th>OVR</th></tr></thead><tbody>${hist.picks.filter(p=>p.teamId===teamId).map(p=>`<tr><td>${p.overall??'-'}</td><td>${p.round}</td><td>${esc(teamBy(p.teamId).name)}</td><td>${esc(p.name)}</td><td>${p.position}</td><td>${p.rating}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">The first draft will follow the 2026 season.</div>'}</section>
 <section class="panel"><h3 class="panel-title">Past Champions</h3>${data.history?.length?data.history.map(y=>`<div class="activity-item">${y.year} · ${esc(teamBy(y.champion).name)}</div>`).join(''):'<div class="empty">No seasons completed yet.</div>'}</section>`;
}

const options=(items,selected)=>items.map(v=>`<option value="${esc(v)}" ${selected===v?'selected':''}>${esc(v.replaceAll('-',' '))}</option>`).join('');
function coaching(){
 const t=data.team,c=t.coach,plan=t.gamePlan,practice=t.practice;
 const office=data.management||{candidates:[],budget:0,spent:0};
 const staffRoles=[['headCoach','Head Coach',t.coach],['offensiveCoordinator','Offensive Coordinator',t.staff.offensiveCoordinator],
 ['defensiveCoordinator','Defensive Coordinator',t.staff.defensiveCoordinator],['scoutingDirector','Scouting Director',t.staff.scoutingDirector]];
 const canHire=data.phase==='offseason'&&(!data.offseason||data.offseason.stage==='freeAgency');
 return `${heading('Coaching & Weekly Preparation','Set the schemes and player development priorities that affect the simulation.',`COACH LEVEL ${c.level}`)}
 <section class="stats-grid">
  ${stat('HEAD COACH',c.rating+'/100',c.name)}
  ${stat('CAREER RECORD',`${c.careerWins}-${c.careerLosses}-${c.careerTies}`,'Regular season and playoffs')}
  ${stat('COACHING XP',`${c.xp} / ${c.level*250}`,'XP toward next coaching level')}
  ${stat('SKILL POINTS',c.skillPoints,'Spend on lasting coaching bonuses')}
 </section>
 <div class="two-column"><div>
 <section class="panel"><h3 class="panel-title">Game Plan <span class="panel-kicker">TACTICAL CHOICES</span></h3>
 <p class="muted">Opposing game plans interact. The selected approach changes simulated game outcomes, but does not yet control individual plays.</p>
 <label class="field-label">Offensive Scheme</label><select class="form-select" id="offense-scheme">${options(['balanced','west-coast','vertical','run-first','spread'],plan.offense)}</select>
 <label class="field-label">Defensive Scheme</label><select class="form-select" id="defense-scheme">${options(['balanced','man-coverage','zone-coverage','blitz-heavy','run-stop'],plan.defense)}</select>
 <label class="field-label">Tempo</label><select class="form-select" id="tempo-scheme">${options(['balanced','uptempo','clock-control'],plan.tempo)}</select>
 <button class="button button-primary" data-save-plan>Save Base Game Plan</button>
 </section>
 <section class="panel"><h3 class="panel-title">Game-Day Playbook <span class="panel-kicker">NEW IN V0.8</span></h3>
 <p class="muted">Control personnel, defensive packages, fourth-down decisions, red-zone play selection and substitutions. These settings now affect individual simulated snaps.</p>
 <label class="field-label">Offensive Personnel</label><select class="form-select" id="tactic-personnel">${options(['11-personnel','12-personnel','21-personnel','10-personnel'],plan.personnel||'11-personnel')}</select>
 <label class="field-label">Defensive Package</label><select class="form-select" id="tactic-defense">${options(['base','nickel','dime'],plan.defensePackage||'nickel')}</select>
 <label class="field-label">Fourth Down</label><select class="form-select" id="tactic-fourth">${options(['conservative','balanced','aggressive'],plan.fourthDown||'balanced')}</select>
 <label class="field-label">Red Zone</label><select class="form-select" id="tactic-redzone">${options(['balanced','run','pass'],plan.redZone||'balanced')}</select>
 <label class="field-label">Two-Minute Drill</label><select class="form-select" id="tactic-two-minute">${options(['adaptive','hurry-up','protect-lead'],plan.twoMinute||'adaptive')}</select>
 <label class="field-label">Player Rotation</label><select class="form-select" id="tactic-rotation">${options(['starters','balanced','heavy'],plan.rotation||'balanced')}</select>
 <button class="button button-primary" data-save-tactics>Save Game-Day Playbook</button>
 </section>
 <section class="panel"><h3 class="panel-title">Weekly Practice <span class="panel-kicker">PLAYER DEVELOPMENT</span></h3>
 <p class="muted">Focus influences the chance of player rating gains. Conditioning reduces the probability of new injuries.</p>
 <label class="field-label">Training Emphasis</label><select class="form-select" id="practice-focus">${options(['balanced','offense','defense','conditioning','development'],practice.focus)}</select>
 <button class="button button-primary" data-save-practice>Save Practice Focus</button>
 <p class="muted" style="margin-top:16px">${practice.completedWeeks} weekly sessions completed this season.</p>
 </section>
 </div><div>
 <section class="panel"><h3 class="panel-title">Coaching Staff <span class="panel-kicker">COORDINATORS</span></h3>
 <div class="split"><span>${esc(t.staff.offensiveCoordinator.name)}</span><strong>${t.staff.offensiveCoordinator.rating}</strong></div>
 <div class="split" style="margin-top:16px"><span>${esc(t.staff.defensiveCoordinator.name)}</span><strong>${t.staff.defensiveCoordinator.rating}</strong></div>
 <div class="split" style="margin-top:16px"><span>${esc(t.staff.scoutingDirector?.name||'Scouting Director')}</span><strong>${t.staff.scoutingDirector?.rating||'-'}</strong></div>
 <p class="muted">Coordinators affect team strength; the scouting director improves prospect evaluations. Coaching changes are limited to the offseason before the draft.</p>
 <div class="split"><span class="muted">Coaching payroll</span><strong>${money(office.spent)} / ${money(office.budget)}</strong></div>
 ${staffRoles.map(([role,label,incumbent])=>{const candidates=office.candidates.filter(s=>s.role===role).slice(0,7);return `<div style="margin-top:16px"><label class="field-label">${esc(label)} · ${esc(incumbent?.philosophy||'balanced')} · ${incumbent?.yearsRemaining??0} yrs remaining</label>
 <select class="form-select" id="staff-candidate-${role}" ${canHire?'':'disabled'}>${candidates.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${s.rating} OVR · ${esc(s.philosophy)} · ${money(s.salary)}</option>`).join('')}</select>
 <button class="button button-small" data-staff-hire="${role}" ${!canHire||!candidates.length||t.staffMoves?.[role]===(data.offseason?.year||data.season+1)?'disabled':''}>Hire ${esc(label)}</button></div>`;}).join('')}
 ${!canHire?'<p class="muted">Finish the current season to hire new coaches.</p>':''}
 </section>
 <section class="panel"><h3 class="panel-title">Coach Development <span class="panel-kicker">PERMANENT BONUSES</span></h3>
 ${Object.entries(c.skills).map(([name,level])=>`<div class="split" style="margin:14px 0"><span>${esc(name.toUpperCase())} · ${level}/5</span><button class="button button-small" ${!c.skillPoints||level>=5?'disabled':''} data-skill="${esc(name)}">Upgrade</button></div>`).join('')}
 </section>
 <section class="panel"><h3 class="panel-title">Player Development & Morale <span class="panel-kicker">FRANCHISE CULTURE</span></h3>
 <div class="split"><span>Average team morale</span><strong>${data.development.averageMorale}/100</strong></div>
 <p class="muted">Team results, playing time and coaching leadership affect morale. Work ethic, practice focus, aging and scouting staff influence development. Players with morale below 40 may want a larger role.</p>
 ${data.development.atRisk.slice(0,8).map(p=>`<div class="split" style="margin:8px 0"><span>${esc(p.name)}</span><strong>${p.morale}/100</strong></div>`).join('')||'<p class="muted">No players with critically low morale.</p>'}
 <h4>Previous offseason rating changes</h4>
 ${data.development.recentGrowth.slice(0,7).map(p=>`<div class="split"><span>${esc(p.name)}</span><strong>${p.delta>0?'+':''}${p.delta}</strong></div>`).join('')||'<p class="muted">Development history will appear after your first offseason.</p>'}
 </section>
 <section class="panel"><h3 class="panel-title">Injury Report <span class="panel-kicker">ESTIMATED ABSENCE</span></h3>
 ${t.roster.filter(p=>p.injuryWeeks>0).map(p=>`<div class="split" style="margin:12px 0"><span>${esc(p.name)} (${esc(p.position)})</span><strong>${p.injuryWeeks} weeks</strong></div>`).join('')||'<div class="empty">No players currently injured.</div>'}
 </section>
 </div></div>`;
}
function depth(){
 const t=data.team;
 return `${heading('Depth Chart','Choose starters by position. Injured players are automatically replaced during simulations.','STARTING LINEUP')}
 ${Object.entries(t.depthChart).map(([pos,ids])=>`<section class="panel"><h3 class="panel-title">${esc(pos)} <span class="panel-kicker">${ids.length} STARTERS</span></h3>
 ${ids.map((current,i)=>`<div class="split" style="margin:12px 0"><label class="muted" for="depth-${esc(pos)}-${i}">Starter ${i+1}</label><select class="form-select depth-select" id="depth-${esc(pos)}-${i}" data-depth-pos="${esc(pos)}" data-depth-slot="${i}">
 ${t.roster.filter(p=>p.position===pos).sort((a,b)=>b.rating-a.rating).map(p=>`<option value="${esc(p.id)}" ${current===p.id?'selected':''}>${esc(p.name)} · ${p.rating} OVR ${p.injuryWeeks?'· INJURED':''}</option>`).join('')}
 </select></div>`).join('')||'<div class="muted">No starting spots assigned</div>'}</section>`).join('')}`;
}
function scouting(){
 const sc=data.scouting;
 return `${heading('NFL Draft Scouting',`Evaluate prospects for the ${data.season+1} draft. Each club can scout two times per week.`,`${sc.prospects.length} PROSPECTS`)}
 <section class="panel"><h3 class="panel-title">Scouting Department <span class="panel-kicker">LIMITED INFORMATION</span></h3>
 <p class="muted">Scouting reports now estimate both present ability and long-term ceiling. Your scouting director and department focus improve accuracy. Work ethic is discussed after two evaluations and medical flags after three. True ratings and hidden potential remain private until drafted.</p>
 <label class="field-label" for="scout-focus">Priority Position Group</label><select id="scout-focus" class="form-select">${options(['balanced','quarterback','offensive-line','pass-rush','coverage','skill-positions'],sc.focus)}</select>
 <button class="button button-primary" data-save-scout-focus>Save Scouting Focus</button></section>
 <section class="panel"><h3 class="panel-title">Prospect Board <span class="panel-kicker">TOP 65 BY ESTIMATED GRADE</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Watch</th><th>Prospect</th><th>Pos</th><th>Age</th><th>Estimate</th><th>Uncertainty</th><th>Ceiling</th><th>Interview</th><th>Medical</th><th>Visits</th><th></th></tr></thead><tbody>
 ${sc.prospects.slice(0,65).map(p=>`<tr><td><button class="button button-small" title="Toggle prospect watchlist" data-prospect-bookmark="${esc(p.id)}">${p.bookmarked?'★':'☆'}</button></td><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.age}</td><td class="highlight">${p.estimate}</td><td>±${p.uncertainty}</td><td>${p.projectedCeiling??'Pending'}${p.ceilingUncertainty!=null?' ±'+p.ceilingUncertainty:''}</td><td>${esc(p.workEthic)}</td><td>${esc(p.medical)}</td><td>${p.visits} / 3</td><td><button class="button button-small button-primary" ${p.visits>=3?'disabled':''} data-scout="${esc(p.id)}">Scout</button></td></tr>`).join('')}</tbody></table></div></section>`;
}

const CATEGORIES={passYards:'Passing Yards',passTD:'Passing Touchdowns',rushYards:'Rushing Yards',rushTD:'Rushing Touchdowns',recYards:'Receiving Yards',recTD:'Receiving Touchdowns',receptions:'Receptions',sacks:'Defensive Sacks',interceptions:'Defensive Interceptions',tackles:'Tackles',fgMade:'Field Goals Made'};
function seasonStatistics(){
 const current=statScope==='postseason'?data.postseasonStats:data.stats;
 const t=current.team,leaders=(statScope==='postseason'?data.postseasonLeaders:data.leaders)[statCategory]||[],own=current.players||[];
 const topPlayers=own.filter(p=>p.passYards||p.rushYards||p.recYards||p.sacks||p.interceptions).slice().sort((a,b)=>b.passYards+b.rushYards+b.recYards+30*b.sacks+40*b.interceptions-a.passYards-a.rushYards-a.recYards-30*a.sacks-40*a.interceptions).slice(0,20);
 return `${heading('Statistics & Awards','Season player records, league leaders, career totals and awards.',data.season+' STATISTICS')}
 <section class="stats-grid">
 ${stat('TOTAL OFFENSE',t?.totalYards??0,'Net team yards this season')}
 ${stat('PASSING YARDS',t?.passYards??0,'Net passing, including sacks')}
 ${stat('RUSHING YARDS',t?.rushYards??0,'Team rushing production')}
 ${stat('TURNOVERS',t?.turnovers??0,'Interceptions and lost fumbles')}
 </section>
 ${data.statisticsPartial?'<section class="panel"><p class="muted">This save was upgraded after games had already been played. Statistical coverage is limited to games simulated after upgrading to v0.3.</p></section>':''}
 <div class="two-column"><div>
 <section class="panel"><h3 class="panel-title">NFL Leaderboard <span class="panel-kicker">REGULAR SEASON</span></h3>
 <div class="subnav"><button class="filter ${statScope==='regular'?'selected':''}" data-stats-scope="regular">REGULAR SEASON</button><button class="filter ${statScope==='postseason'?'selected':''}" data-stats-scope="postseason">POSTSEASON</button></div>
 <label class="field-label" for="leader-select">Stat category</label><select class="form-select" id="leader-select">${Object.entries(CATEGORIES).map(([key,name])=>`<option value="${key}" ${key===statCategory?'selected':''}>${esc(name)}</option>`).join('')}</select>
 <table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Franchise</th><th class="table-numeric">Total</th></tr></thead><tbody>
 ${leaders.map((p,i)=>`<tr><td>${i+1}</td><td class="team-name"><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button> <span class="muted">${esc(p.position)}</span></td><td>${esc(teamBy(p.teamId).nickname||teamBy(p.teamId).name)}</td><td class="table-numeric highlight">${p.value.toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No completed games yet</td></tr>'}
 </tbody></table></section>
 <section class="panel"><h3 class="panel-title">Franchise Leaders</h3><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Pass Yds</th><th>Rush Yds</th><th>Rec Yds</th><th>Sacks</th></tr></thead><tbody>
 ${topPlayers.map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.passYards}</td><td>${p.rushYards}</td><td>${p.recYards}</td><td>${p.sacks}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No player statistics yet</td></tr>'}
 </tbody></table></section>
 </div><div>
 <section class="panel"><h3 class="panel-title">Career Records <span class="panel-kicker">ALL COMPLETED REGULAR GAMES</span></h3>
 ${Object.entries(data.careerLeaders||{}).map(([cat,list])=>`<h4>${esc(CATEGORIES[cat]||cat)}</h4>${list.slice(0,3).map((p,i)=>`<div class="split" style="margin:10px 0"><span class="muted">${i+1}. ${esc(p.name)}</span><strong>${p.value.toLocaleString()}</strong></div>`).join('')||'<p class="muted">Not yet available</p>'}`).join('')}
 </section><section class="panel"><h3 class="panel-title">Annual Awards <span class="panel-kicker">COMPLETED SEASONS</span></h3>
 ${data.awardHistory?.length?data.awardHistory.map(year=>`<h4>${year.year}</h4>${year.awards.map(a=>`<div class="activity-item"><small>${esc(a.award)}</small>${esc(a.name)} · ${esc(teamBy(a.teamId).name)}</div>`).join('')}`).join(''):'<div class="empty">Awards are assigned after the championship game.</div>'}</section>
 </div></div>`;
}
function gameCenter(){
 const candidates=[...data.playoffs,...data.schedule,...(data.preseasonSchedule||[])].filter(g=>g.status==='final').reverse();
 const selected=selectedGame?.game;
 const g=selected&&selected.status==='final'?selected:null;
 const b=g?.boxScore, teamTotal=b?.teams||{}, players=b?.players||{};
 const rosterRows=team=>Object.values(players).filter(p=>p.teamId===team&&(
  p.passAttempts||p.rushAttempts||p.targets||p.tackles||p.sacks||p.interceptions||p.fgAttempts))
  .sort((a,b)=>b.passYards+b.rushYards+b.recYards+30*b.sacks-a.passYards-a.rushYards-a.recYards-30*a.sacks).slice(0,32);
 const quarter=q=>q?.map((x,i)=>`<td>${x}</td>`).join('')||'<td colspan="5">-</td>';
 return `${heading('Game Center','Complete game summaries, drive history, per-player box scores and the play log.',g?'FINAL REPORT':'GAME LIBRARY')}
 <section class="panel"><h3 class="panel-title">Your Games <span class="panel-kicker">SELECT A FINAL RESULT</span></h3>
 <div class="game-index">${candidates.map(g=>`<button class="button button-small ${selected?.id===g.id?'button-primary':''}" data-game="${esc(g.id)}">${g.type==='playoff'?'Playoffs':g.type==='preseason'?`PS${g.week}`:`W${g.week}`} · ${esc(teamBy(g.away).nickname||g.away)} ${g.scoreAway}-${g.scoreHome} ${esc(teamBy(g.home).nickname||g.home)}</button>`).join('')||'<span class="muted">No completed games yet. Simulate a week first.</span>'}</div></section>
 ${!g?'<section class="panel"><div class="empty">Select a completed game to view its detailed report.</div></section>':`
 <section class="panel"><div class="eyebrow">${g.type==='playoff'?'POSTSEASON':g.type==='preseason'?`PRESEASON WEEK ${g.week}`:`WEEK ${g.week}`} ${g.overtime?'· OVERTIME':''}</div>
 <div class="score-line"><div><h2>${esc(selectedGame.away.name)}</h2><strong>${g.scoreAway}</strong></div><span>FINAL</span><div><h2>${esc(selectedGame.home.name)}</h2><strong>${g.scoreHome}</strong></div></div>
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Franchise</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>OT</th><th>Final</th></tr></thead><tbody>
 <tr><td>${esc(selectedGame.away.name)}</td>${quarter(b?.quarters?.[g.away])}<td class="highlight">${g.scoreAway}</td></tr>
 <tr><td>${esc(selectedGame.home.name)}</td>${quarter(b?.quarters?.[g.home])}<td class="highlight">${g.scoreHome}</td></tr></tbody></table></div></section>
 <section class="panel"><h3 class="panel-title">Team Comparison</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Metric</th><th>${esc(selectedGame.away.nickname||selectedGame.away.name)}</th><th>${esc(selectedGame.home.nickname||selectedGame.home.name)}</th></tr></thead><tbody>
 ${[['Total yards','totalYards'],['Passing yards','passYards'],['Rushing yards','rushYards'],['First downs','firstDowns'],['Turnovers','turnovers'],['Sacks','sacks'],['Penalties','penalties'],['Penalty yards','penaltyYards'],['Timeouts used','timeoutsUsed'],['Punts','punts'],['FG made','fgMade'],['Possessions','possessions']].map(([label,key])=>`<tr><td>${label}</td><td>${teamTotal[g.away]?.[key]??0}</td><td>${teamTotal[g.home]?.[key]??0}</td></tr>`).join('')}</tbody></table></div></section>
 ${[g.away,g.home].map(id=>`<section class="panel"><h3 class="panel-title">${esc(id===g.away?selectedGame.away.name:selectedGame.home.name)} <span class="panel-kicker">PLAYER BOX SCORE</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Pass A/C</th><th>Pass Yds</th><th>Rush/Yds</th><th>Rec/Yds</th><th>TD (P/R/Rec)</th><th>Sacks</th><th>INT</th></tr></thead><tbody>
 ${rosterRows(id).map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.passAttempts}/${p.completions}</td><td>${p.passYards}</td><td>${p.rushAttempts}/${p.rushYards}</td><td>${p.receptions}/${p.recYards}</td><td>${p.passTD}/${p.rushTD}/${p.recTD}</td><td>${p.sacks}</td><td>${p.interceptions}</td></tr>`).join('')||'<tr><td colspan="9">No recorded stats</td></tr>'}
 </tbody></table></div></section>`).join('')}
 <section class="panel"><h3 class="panel-title">Game-Day Injuries <span class="panel-kicker">${g.injuries?.length||0} REPORTED</span></h3>
 ${(g.injuries||[]).map(i=>`<div class="activity-item">${esc(i.playerName)} (${esc(i.teamId)}) · ${esc(i.label)} · ${i.weeks} estimated week(s)</div>`).join('')||'<p class="muted">No simulated in-game injuries.</p>'}
 <p class="muted">Game-day injuries affect later snaps and are applied to the franchise roster after the game.</p></section>
 <section class="panel"><h3 class="panel-title">Drive Summary <span class="panel-kicker">${g.drives?.length||0} POSSESSIONS</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Quarter</th><th>Offense</th><th>Start</th><th>Plays</th><th>Yards</th><th>Result</th><th>Points</th></tr></thead><tbody>
 ${(g.drives||[]).map(d=>`<tr><td>${d.id}</td><td>${d.quarter}</td><td>${esc(teamBy(d.teamId).nickname||d.teamId)}</td><td>Own ${d.startBall}</td><td>${d.plays}</td><td>${d.yards}</td><td>${esc(d.result)}</td><td class="highlight">${d.points}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><h3 class="panel-title">Play-by-Play <span class="panel-kicker">${g.plays?.length||0} EVENTS</span></h3>
 <div class="play-log">${(g.plays||[]).map(p=>`<div class="play-event"><span class="play-marker">${p.quarter===5?'OT':`Q${p.quarter}`} ${esc(p.clock)}</span><div><small>${esc(p.type.replaceAll('-',' ').toUpperCase())}</small><div>${esc(p.description)}</div></div></div>`).join('')}</div></section>`}`;
}

function financeOffice(){
 const t=data.team,year=data.financialYear,sorted=[...t.roster,...(t.injuredReserve||[])].sort((a,b)=>(b.contract?.baseSalary||0)-(a.contract?.baseSalary||0));
 return `${heading('Contracts & Salary Cap','Review cap commitments, extend players, and restructure salary into bonus proration.','CAP LEDGER')}
 <section class="stats-grid">${stat('CAP LIMIT',money(data.capProjection[0].limit),'Includes carryover')}${stat('USED CAP',money(data.capProjection[0].used),'Active, IR, practice squad, and dead cap')}${stat('AVAILABLE',money(data.capSpace),'Current season','green')}${stat('DEAD CAP',money(data.capProjection[0].deadCap),'Previously committed compensation')}</section>
 <section class="panel"><h3 class="panel-title">Four-Year Cap Projection <span class="panel-kicker">2027+ CAPS ARE ESTIMATES</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Season</th><th>Limit</th><th>Committed</th><th>Dead Cap</th><th>Room</th></tr></thead><tbody>${data.capProjection.map(c=>`<tr><td>${c.year}</td><td>${money(c.limit)}</td><td>${money(c.used)}</td><td>${money(c.deadCap)}</td><td class="highlight">${money(c.space)}</td></tr>`).join('')}</tbody></table></div><p class="muted">2027 and later salary caps are estimated game values, not announced NFL figures. Future guarantees and signing bonuses are projected. Offseason Top 51 accounting is not yet enforced.</p></section>
 <section class="panel"><h3 class="panel-title">Player Contract Ledger</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Pos</th><th>Base</th><th>Bonus Proration</th><th>Cap Hit</th><th>End</th><th>Actions</th></tr></thead><tbody>${sorted.map(p=>{const c=p.contract||{};const base=c.salaries?.[year]??c.baseSalary??0, bonus=c.bonusSchedule?.[year]??(c.signingBonus?Math.round(c.signingBonus/Math.min(c.years||1,5)):0);return `<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${money(base)}</td><td>${money(bonus)}</td><td class="highlight">${money(base+bonus)}</td><td>${c.expiresYear??'-'}</td><td>${t.roster.some(x=>x.id===p.id)?`<button class="button button-small" data-restructure="${esc(p.id)}">Restructure</button> <button class="button button-small" data-extend="${esc(p.id)}">Extend</button> ${data.phase==='offseason'&&c.expiresYear===data.season?`<button class="button button-small" data-tag="${esc(p.id)}">Franchise Tag</button>`:''}`:'IR'}</td></tr>`}).join('')}</tbody></table></div></section>`;
}
function reserveCenter(){
 const t=data.team;
 const ps=t.practiceSquad||[],ir=t.injuredReserve||[],wire=data.waivers||[];
 return `${heading('Player Transactions','Practice squad, injured reserve, waiver claims and game-day availability.','ROSTER OPERATIONS')}
 <section class="stats-grid">${stat('ACTIVE ROSTER',`${t.roster.length}/53`,'Active/inactive list')}${stat('PRACTICE SQUAD',`${ps.length}/16`,'17th international exception not modeled')}${stat('INJURED RESERVE',ir.length,'Cap obligations retained')}${stat('GAME DAY',`${data.gameDay.active.length}/${data.gameDay.limit}`,'Healthy active players')}</section>
 <section class="panel"><h3 class="panel-title">Practice Squad <span class="panel-kicker">UP TO 2 WEEKLY ELEVATIONS</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Position</th><th>OVR</th><th>Elevations</th><th>Actions</th></tr></thead><tbody>${ps.map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.rating}</td><td>${p.elevationCount||0}/3</td><td><button class="button button-small" data-promote="${esc(p.id)}">Sign Active</button> <button class="button button-small" data-elevate="${esc(p.id)}">Elevate</button> <button class="button button-small button-danger" data-ps-release="${esc(p.id)}">Release</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No practice squad players. Add players from Free Agency.</td></tr>'}</tbody></table></div></section>
 <section class="panel"><h3 class="panel-title">Injured Reserve</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Injury Weeks</th><th>Eligible Week</th><th>Actions</th></tr></thead><tbody>${ir.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.position)}</td><td>${p.injuryWeeks}</td><td>${p.irReturnWeek}</td><td><button class="button button-small" data-activate-ir="${esc(p.id)}">Activate</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No players on injured reserve.</td></tr>'}</tbody></table></div></section>
 <section class="panel"><h3 class="panel-title">Injury Report & Game-Day List</h3><p class="muted">Healthy game-day selections: ${data.gameDay.active.length}. Healthy inactives: ${data.gameDay.inactive.length}. Injured: ${data.gameDay.injured.length}. Game-day activation is automatically estimated; manual inactive selection remains a future milestone.</p>${t.roster.filter(p=>p.injuryWeeks>0).map(p=>`<div class="activity-item">${esc(p.name)} (${esc(p.position)}) · ${p.injuryWeeks} weeks <button class="button button-small" data-ir="${esc(p.id)}">Move to IR</button></div>`).join('')||'<p class="muted">No active-roster injuries.</p>'}</section>
 <section class="panel"><h3 class="panel-title">Waiver Wire <span class="panel-kicker">CLAIMS RESOLVE ON WEEKLY ADVANCE</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Position</th><th>OVR</th><th>Claims</th><th></th></tr></thead><tbody>${wire.map(w=>`<tr><td>${esc(w.player.name)}</td><td>${esc(w.player.position)}</td><td>${w.player.rating}</td><td>${w.claims}</td><td><button class="button button-small" data-waiver="${esc(w.id)}">Place Claim</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No waiver listings.</td></tr>'}</tbody></table></div></section>`;
}
const playerOption=p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.position)} ${p.rating}</option>`;
const pickOption=p=>`<option value="${esc(p.id)}">${p.year} Round ${p.round} (${esc(teamBy(p.originalTeamId).nickname)})</option>`;
function tradeCenter(){
 const own=data.team;
 const opponents=data.teams.filter(t=>t.id!==own.id);
 const target=tradeTarget?.id===tradePartnerId?tradeTarget:null;
 return `${heading('Trade Center','Negotiate CPU trade offers with players and owned draft picks.','CPU TRADE EVALUATION')}
 ${data.lastTradeDecision?`<section class="panel"><strong>${data.lastTradeDecision.accepted?'Trade accepted':'Trade rejected'}</strong><p class="muted">${esc(data.lastTradeDecision.reason)} · Incoming value ${data.lastTradeDecision.delivered}, requested value ${data.lastTradeDecision.requested}, needed ${data.lastTradeDecision.minimum}. Values are fictional scouting estimates.</p></section>`:''}<section class="panel"><h3 class="panel-title">Build a Trade</h3><p class="muted">Choose up to one player and one draft pick from each club. CPU executives evaluate age, ability, position needs, contract burden and draft-pick value. Accepted offers must still pass salary-cap and roster rules.</p>
 <label class="field-label">Other franchise</label><select class="form-select" id="trade-partner">${opponents.map(t=>`<option value="${t.id}" ${t.id===tradePartnerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
 <div class="two-column"><div><h3>${esc(own.name)} sends</h3><label class="field-label">Player</label><select id="a-player" class="form-select"><option value="">No player</option>${own.roster.map(playerOption).join('')}</select><label class="field-label">Draft pick</label><select id="a-pick" class="form-select"><option value="">No pick</option>${data.draftPicks.map(pickOption).join('')}</select></div>
 <div><h3>${esc(target?.name||teamBy(tradePartnerId).name)}</h3><label class="field-label">Player</label><select id="b-player" class="form-select"><option value="">No player</option>${target?.roster.map(playerOption).join('')||''}</select><label class="field-label">Draft pick</label><select id="b-pick" class="form-select"><option value="">No pick</option>${target?.picks.map(pickOption).join('')||''}</select></div></div>
 <button class="button button-primary" data-trade-execute ${target?'':'disabled'}>Submit Trade Offer</button>
 </section><section class="panel"><h3 class="panel-title">Owned Future Draft Picks</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Season</th><th>Round</th><th>Original Club</th></tr></thead><tbody>${data.draftPicks.map(p=>`<tr><td>${p.year}</td><td>${p.round}</td><td>${esc(teamBy(p.originalTeamId).name)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function campCenter(){
 const c=data.camp,active=['trainingCamp','preseason','cutdown'].includes(data.phase);
 const games=data.preseasonSchedule||[];
 const scoreText=g=>g.status==='final'?`${g.scoreAway}-${g.scoreHome}`:'Scheduled';
 return `${heading('Training Camp & Preseason','Evaluate your roster, rotate preseason starters, monitor injuries and prepare for the 53-player cutdown.',
 active?(data.phase==='trainingCamp'?`CAMP ${c.session}/${c.totalSessions}`:data.phase==='preseason'?`PRESEASON WEEK ${data.week}`:'53-MAN CUTDOWN'):'CALENDAR ARCHIVE')}
 <section class="stats-grid">${stat('ACTIVE ROSTER',`${c.rosterSize} / ${active?'90':'53'}`,'Camp limit is 90; regular season 53')}
 ${stat('CUTS NEEDED',c.cutsNeeded,'Required before regular season','orange')}
 ${stat('EXHIBITION RECORD',`${c.preseasonRecord.wins}-${c.preseasonRecord.losses}-${c.preseasonRecord.ties}`,'Does not count toward standings')}
 ${stat('CAMP SESSIONS',`${c.session} / ${c.totalSessions}`,'Two evaluations before exhibitions')}</section>
 <div class="two-column"><div>
 <section class="panel"><h3 class="panel-title">Camp Preparation</h3>
 <p class="muted">Practice focus changes player evaluation, development experience and injury exposure. Contact sessions increase development XP but carry greater injury risk.</p>
 <div class="form-row"><label class="field-label">Training focus<select class="form-select" id="camp-focus">${['balanced','offense','defense','conditioning','development'].map(v=>`<option value="${v}" ${v===c.focus?'selected':''}>${v}</option>`).join('')}</select></label>
 <label class="field-label">Contact intensity<select class="form-select" id="camp-intensity">${['light','standard','contact'].map(v=>`<option value="${v}" ${v===c.intensity?'selected':''}>${v}</option>`).join('')}</select></label></div>
 <button class="button button-primary" data-save-camp ${['trainingCamp','preseason'].includes(data.phase)?'':'disabled'}>Save Camp Plan</button>
 ${data.phase==='trainingCamp'?`<p class="muted">Use the top-right Advance button to complete camp session ${c.session+1}.</p>`:''}
 ${data.phase==='cutdown'?`<p class="muted">You must release players until your active roster contains 53 or fewer before regular-season Week 1.</p>
 <button class="button button-primary" data-auto-cuts>Auto-select Final Roster</button>
 <button class="button" data-finalize-cuts ${c.cutsNeeded?'disabled':''}>Begin Regular Season</button>`:''}</section>
 <section class="panel"><h3 class="panel-title">Preseason Games <span class="panel-kicker">THREE WEEKS</span></h3><table class="data-table"><thead><tr><th>Week</th><th>Opponent</th><th>Location</th><th>Result</th></tr></thead><tbody>
 ${games.map(g=>`<tr><td>${g.week}</td><td>${esc(teamBy(g.home===teamId?g.away:g.home).name)}</td><td>${g.home===teamId?'Home':'Away'}</td><td>${scoreText(g)} ${g.status==='final'?gameButton(g):''}</td></tr>`).join('')||'<tr><td colspan="4">Preseason begins after the rookie draft.</td></tr>'}
 </tbody></table><p class="muted">Exhibition game scores and player evaluations are stored separately from regular-season statistics and coaching wins.</p></section>
 <section class="panel"><h3 class="panel-title">Injury Report</h3>${c.injuryLog.length?c.injuryLog.map(i=>`<div class="activity-item"><strong>${esc(i.name)}</strong> - ${esc(i.injury)} (${i.estimatedWeeks} estimated weeks, ${esc(i.week)})</div>`).join(''):'<p class="muted">No camp injuries recorded.</p>'}</section>
 </div><div><section class="panel"><h3 class="panel-title">Training Camp Evaluations <span class="panel-kicker">${c.evaluations.length} PLAYERS</span></h3>
 <p class="muted">Scores are staff evaluations for this camp, not guaranteed future player ratings. Healthy players earn more evaluation opportunities.</p>
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Camp</th><th>Sessions</th><th>Health</th><th></th></tr></thead><tbody>
 ${c.evaluations.map(p=>`<tr><td class="team-name">${esc(p.name)}</td><td>${p.position}</td><td>${p.rating}</td><td class="highlight">${p.score}</td><td>${p.samples}</td><td>${p.healthWeeks?`${p.healthWeeks}w · ${esc(p.injury||'Injured')}`:'Healthy'}</td><td>${data.phase==='cutdown'?`<button class="button button-small button-danger" data-cut="${esc(p.id)}">Cut</button>`:''}</td></tr>`).join('')}
 </tbody></table></div></section></div></div>`;
}
function legacyCenter(){
 const l=data.legacy||{}, sections={news:'League News',seasons:'Season Archive',coaches:'Coaching Careers',records:'Record Book',rivalries:'Rivalries',hall:'Hall of Fame'};
 const nav=`<div class="subnav">${Object.entries(sections).map(([k,v])=>`<button class="filter ${legacySection===k?'selected':''}" data-legacy-section="${k}">${v}</button>`).join('')}</div>`;
 let body='';
 if(legacySection==='news')body=`<section class="panel"><h3 class="panel-title">League News <span class="panel-kicker">LATEST STORIES</span></h3>${l.news?.length?l.news.slice(0,70).map(n=>`<div class="activity-item"><small>${esc(n.year)} · ${esc(n.type.toUpperCase())}${n.week?` · Week ${n.week}`:''}</small><strong>${esc(n.headline)}</strong><div class="muted">${esc(n.detail)}</div></div>`).join(''):'<div class="empty">League news begins when games are simulated.</div>'}</section>`;
 if(legacySection==='seasons')body=`<section class="panel"><h3 class="panel-title">Franchise Yearbooks <span class="panel-kicker">PRESERVED FOREVER</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Year</th><th>Record</th><th>Playoff Wins</th><th>Champion?</th><th>Head Coach</th></tr></thead><tbody>${(l.franchise||[]).map(y=>`<tr><td>${y.year}</td><td>${y.wins}-${y.losses}${y.ties?'-'+y.ties:''}</td><td>${y.playoffWins}</td><td>${y.champion?'Yes':'No'}</td><td>${esc(y.coach)}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Complete a season to create the first yearbook.</td></tr>'}</tbody></table></div></section>
  <section class="panel"><h3 class="panel-title">Championship Archive</h3>${(l.yearbooks||[]).map(y=>`<div class="activity-item"><strong>${y.year} · ${esc(teamBy(y.champion).name||y.champion)}</strong><small>League champion</small><div class="muted">${y.awards?.filter(a=>a.award==='Most Valuable Player').map(a=>`MVP: ${esc(a.name)}`).join('')||'No MVP awarded'}</div></div>`).join('')||'<p class="muted">No completed seasons yet.</p>'}</section>`;
 if(legacySection==='coaches')body=`<section class="panel"><h3 class="panel-title">Head Coach Career Registry</h3><p class="muted">Coaching careers remain attached to each coach even after changing franchises. Historical upgrades preserve available totals, but cannot infer earlier appointments.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Coach</th><th>Career Record</th><th>Playoff</th><th>Titles</th><th>Franchises</th></tr></thead><tbody>${(l.coaches||[]).slice(0,60).map(c=>`<tr><td class="team-name">${esc(c.name)}</td><td>${c.wins}-${c.losses}${c.ties?'-'+c.ties:''}</td><td>${c.playoffWins}-${c.playoffLosses}</td><td>${c.championships}</td><td>${c.teams.map(t=>esc(teamBy(t.teamId).nickname||t.teamId)).join(', ')}</td></tr>`).join('')}</tbody></table></div></section>`;
 if(legacySection==='records')body=`<section class="panel"><h3 class="panel-title">All-Time Player Leaders <span class="panel-kicker">REGULAR-SEASON CAREERS</span></h3><label class="field-label" for="legacy-category">Career category</label><select class="form-select" id="legacy-category">${Object.entries(CATEGORIES).map(([cat,name])=>`<option value="${cat}" ${legacyCategory===cat?'selected':''}>${esc(name)}</option>`).join('')}</select><div class="table-wrap"><table class="data-table"><thead><tr><th>Rank</th><th>Player</th><th>Position</th><th>Franchise</th><th class="table-numeric">Total</th></tr></thead><tbody>${(l.playerRecords?.[legacyCategory]||[]).map((p,i)=>`<tr><td>${i+1}</td><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${esc(teamBy(p.teamId).name||p.teamId)}</td><td class="table-numeric highlight">${p.value.toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="5">No career statistics yet.</td></tr>'}</tbody></table></div></section>
  <section class="panel"><h3 class="panel-title">Career Milestones</h3>${(l.milestones||[]).slice(0,35).map(m=>`<div class="activity-item">${esc(m.player)}: ${m.total.toLocaleString()} career ${esc(CATEGORIES[m.category]||m.category)} <small>${m.year}, Week ${m.week}</small></div>`).join('')||'<p class="muted">Milestones appear as players accumulate career stats.</p>'}</section>`;
 if(legacySection==='rivalries')body=`<section class="panel"><h3 class="panel-title">Franchise Rivalries <span class="panel-kicker">HEAD-TO-HEAD HISTORY</span></h3><p class="muted">Rivalries track actual games played, including postseason meetings and close results, across seasons.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Opponent</th><th>Meetings</th><th>W-L-T</th><th>Close Games</th><th>Playoff Games</th><th>Recent Meetings</th></tr></thead><tbody>${(l.rivals||[]).map(r=>`<tr><td class="team-name">${esc(r.opponent)}</td><td>${r.games}</td><td>${r.wins}-${r.losses}-${r.ties}</td><td>${r.oneScoreGames}</td><td>${r.playoffMeetings}</td><td>${r.meetings.map(m=>`<span class="muted">${m.year} ${m.scoreAway}-${m.scoreHome}</span>`).join(' · ')}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Play a game to begin rivalry records.</td></tr>'}</tbody></table></div></section>`;
 if(legacySection==='hall')body=`<section class="panel"><h3 class="panel-title">League Hall of Fame <span class="panel-kicker">FICTIONAL ELIGIBILITY MODEL</span></h3><p class="muted">Retired players become eligible five league years after retirement. Up to five qualified players are inducted per year. Inductions are determined by simulated career production and major awards, not official Hall of Fame voting.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Inducted</th><th>Player</th><th>Pos</th><th>Last Franchise</th><th>Retired</th><th>Honor Score</th></tr></thead><tbody>${(l.hallOfFame||[]).map(p=>`<tr><td>${p.inductedYear}</td><td class="team-name">${esc(p.name)}</td><td>${esc(p.position)}</td><td>${esc(teamBy(p.teamId).name||p.teamId)}</td><td>${p.year}</td><td>${p.score}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">The first inductees become eligible five years after retirement.</td></tr>'}</tbody></table></div></section>
  <section class="panel"><h3 class="panel-title">Recent Retirements</h3>${(l.retiredPlayers||[]).slice(0,30).map(p=>`<div class="activity-item"><strong>${esc(p.name)}</strong> <small>${esc(p.position)} · Retired ${p.year} · ${esc(teamBy(p.teamId).name||p.teamId)}</small></div>`).join('')||'<p class="muted">No recorded retirements yet.</p>'}</section>`;
 return `${heading('League History & Legacy','Long-term franchise reporting, records, coaching careers and the professional league archive.',l.historicalCoverage||'LIVE ARCHIVE')}
  <section class="stats-grid">${stat('ARCHIVED SEASONS',(l.yearbooks||[]).length,'Completed championship years')}${stat('FRANCHISE TITLES',l.championships?.[teamId]||0,'Championships won')}${stat('LEGACY STORIES',(l.news||[]).length,'Recent archived news')}${stat('HALL INDUCTEES',(l.hallOfFame||[]).length,'Qualified retired players')}</section>
  ${l.legacyIncomplete?'<section class="panel"><p class="muted">This save predates the legacy module. Pre-upgrade coaching history and game-by-game rivalries cannot be fully reconstructed.</p></section>':''}${nav}${body}`;
}

function customizationCenter(){
 const t=data.team,s=data.settings||{},h=data.honorsHistory?.[0];
 const choices=(id,items,current)=>`<select id="${id}" class="form-select">${items.map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join('')}</select>`;
 const positionOrder=['QB','RB','WR','TE','OL','DL','EDGE','LB','CB','S','K','P'];
 const people=[t.coach,...Object.values(t.staff||{}),...t.roster].filter(Boolean);
 return `${heading('Customization & Saves','Edit franchise identity, sandbox people and gameplay options, or manage separate careers.','v1.0 SANDBOX')}
 <section class="panel"><h3 class="panel-title">Franchise Identity <span class="panel-kicker">32-TEAM FORMAT PRESERVED</span></h3>
 <p class="muted">Change the selected franchise name and color without disturbing its division, schedule or franchise ID. Official NFL marks are not bundled.</p>
 <div class="form-row"><label class="field-label">City<input class="form-select" id="franchise-city" maxlength="40" value="${esc(t.city)}"></label><label class="field-label">Nickname<input class="form-select" id="franchise-nickname" maxlength="32" value="${esc(t.nickname)}"></label><label class="field-label">Team Color<input class="form-select" id="franchise-color" type="color" value="${esc(t.color)}"></label></div>
 <button class="button button-primary" data-custom-franchise>Save Franchise Identity</button></section>
 <section class="panel"><h3 class="panel-title">Player & Coach Editor</h3>
 <p class="muted">Edit the current team's roster and staff. This is a sandbox editor; edited ratings affect future simulation and historical box scores remain unchanged.</p>
 <label class="field-label">Choose Person</label><select class="form-select" id="edit-person">${people.map(p=>`<option value="${esc(p.id)}" data-kind="${t.roster.includes(p)?'player':'coach'}">${esc(p.name)} · ${esc(p.position||p.role||'Coach')} · OVR ${p.rating}</option>`).join('')}</select>
 <button class="button" data-edit-person>Edit Selected</button></section>
 <section class="panel"><h3 class="panel-title">Simulation & Management Settings</h3>
 <div class="settings-grid">
 <label class="field-label">Front Office Difficulty${choices('setting-difficulty',[['casual','Casual - easier negotiations'],['standard','Standard'],['challenging','Challenging - stricter trades and contracts']],s.difficulty)}</label>
 <label class="field-label">Game-Day Injury Rate${choices('setting-injuryRate',[['low','Low'],['standard','Standard'],['high','High']],s.injuryRate)}</label>
 <label class="field-label">Scouting Workload${choices('setting-scoutingDifficulty',[['relaxed','Relaxed - 3 visits/week'],['standard','Standard - 2 visits/week'],['strict','Strict - 1 visit/week']],s.scoutingDifficulty)}</label>
 <label class="field-label">Offseason Development${choices('setting-developmentRate',[['slow','Slow'],['standard','Standard'],['fast','Fast']],s.developmentRate)}</label>
 </div><button class="button button-primary" data-save-settings>Save Gameplay Settings</button>
 <p class="muted">Settings affect future decisions and games only. No retroactive changes to played games.</p></section>
 <section class="panel"><h3 class="panel-title">Career Save Slots <span class="panel-kicker">LOCALLY STORED</span></h3>
 <p class="muted">Default career uses data/save.json on desktop; other careers use data/slots/. Browser saves are kept in this browser. You may delete any career. Deleting the default resets it to a new blank league; deleting the active secondary career returns you to the default.</p>
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Career</th><th>Season</th><th>Phase</th><th>Actions</th></tr></thead><tbody>
 ${saveSlots.map(slot=>`<tr><td class="team-name">${esc(slot.name)} ${slot.active?'(Active)':''}${slot.invalid?' (Invalid)':''}</td><td>${slot.season||'-'}</td><td>${esc(slot.phase||'-')}</td><td>${!slot.active&&!slot.invalid?`<button class="button button-small" data-load-slot="${esc(slot.id)}">Load</button>`:''} <button class="button button-small button-danger" data-delete-career="${esc(slot.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="4">No careers found yet.</td></tr>'}
 </tbody></table></div>
 <div class="form-row"><label class="field-label">New Career Name<input id="slot-new-name" class="form-select" maxlength="48" placeholder="My new franchise"></label><label class="field-label">Random Seed<input id="slot-new-seed" class="form-select" type="number" value="2026"></label></div>
 <button class="button button-primary" data-create-slot>Create New Career</button>
 <button class="button" data-refresh-slots>Refresh Slots</button></section>
 <section class="panel"><h3 class="panel-title">Fictional League Identity Template</h3>
 <p class="muted">Share or back up all 32 fictional franchise names and colors without exporting players, contracts or saves. League templates preserve conference and division alignment.</p>
 <a class="button" href="/api/league-template" download="pfd-league-template.json">Export League Template</a>
 <label class="field-label">Import a 32-franchise identity template<input id="league-template-file" class="form-select" type="file" accept=".json,application/json"></label>
 <button class="button" data-import-league-template>Import League Identity Template</button></section>
 <section class="panel"><h3 class="panel-title">Import & Export</h3>
 <p class="muted">Export the current career to a JSON file. Import replaces the active career only after your confirmation. Import is limited to compatible 32-team saves of 32 MB or less.</p>
 <a class="button" href="/api/export" download="pro-football-dynasty-career.json">Export Active Save (JSON)</a>
 <label class="field-label">Import a career JSON file<input type="file" id="import-file" accept=".json,application/json" class="form-select"></label>
 <button class="button button-danger" data-import-save>Import and Replace Active Career</button></section>
 <section class="panel"><h3 class="panel-title">All-League & All-Star Awards <span class="panel-kicker">${h?.year||'AWAITING SEASON END'}</span></h3>
 <p class="muted">Awards use in-game regular-season statistics. These are fictional simulated selections, not official NFL All-Pro or Pro Bowl votes.</p>
 ${!h?'<div class="empty">Complete a season to see first and second All-League teams and the AFC/NFC All-Star selections.</div>':`
 <div class="two-column"><div><h4>First-Team All-League</h4><div class="award-scroller">${h.allPro.filter(a=>a.team===1).map(a=>`<div class="activity-item">${esc(a.position)} · <strong>${esc(a.name)}</strong> · ${esc(teamBy(a.teamId).nickname||a.teamId)}</div>`).join('')}</div><h4>Second-Team All-League</h4><div class="award-scroller">${h.allPro.filter(a=>a.team===2).map(a=>`<div class="activity-item">${esc(a.position)} · <strong>${esc(a.name)}</strong></div>`).join('')}</div></div><div><h4>Conference All-Stars</h4><div class="award-scroller">${h.allStars.map(a=>`<div class="activity-item">${esc(a.conference)} ${esc(a.position)} · <strong>${esc(a.name)}</strong></div>`).join('')}</div></div></div>`}
 </section>`;
}
async function refreshSlots(){try{const r=await fetch('/api/slots');const x=await r.json();if(!r.ok)throw Error(x.error||'Could not list saves');saveSlots=x;if(tab==='customize'||tab==='career')render();}catch(e){notification(e.message,true);}}
function afterCareerSwitch(newData){data=newData;teamId=data.coachCareer?.teamId||data.teamId||'T01';selectedGame=null;tradeTarget=null;directoryCache=null;activeProfile=null;render();refreshSlots();}

function weeklyGamePlan(){
 const t=data.team, next=data.schedule.find(g=>g.status==='scheduled'),rival=next?teamBy(next.home===teamId?next.away:next.home):null;
 const plan=t.gamePlan;
 const choices=[['offense','Offensive Scheme',['balanced','west-coast','vertical','run-first','spread']],['defense','Defensive Scheme',['balanced','man-coverage','zone-coverage','blitz-heavy','run-stop']],['tempo','Clock & Tempo',['balanced','uptempo','clock-control']]];
 const tactics=[['personnel','Offensive Personnel',['11-personnel','12-personnel','21-personnel','10-personnel']],['defensePackage','Defensive Package',['base','nickel','dime']],['fourthDown','Fourth Down',['conservative','balanced','aggressive']],['redZone','Red Zone',['balanced','run','pass']],['twoMinute','Two-Minute',['adaptive','hurry-up','protect-lead']],['rotation','Rotation',['starters','balanced','heavy']]];
 const injured=t.roster.filter(p=>(p.injuryWeeks||0)>0);
 return `${heading('Weekly Game Planning','Prepare your scheme, personnel and situational decisions for the next opponent.',next?`WEEK ${next.week}`:'NO UPCOMING GAME')}
 <section class="stats-grid">${stat('OFFENSE',t.baseOffense,'Base team rating')}${stat('DEFENSE',t.baseDefense,'Base team rating')}${stat('COACH',t.coach.rating,'Leadership')}${stat('UNAVAILABLE',injured.length,'Injury status')}</section>
 <div class="two-column"><div>
 <section class="panel"><h3 class="panel-title">Opponent Scouting Brief</h3>${rival?`<h2>${esc(rival.name)}</h2><p class="muted">${next.home===teamId?'Home':'Away'} · ${rival.conference} ${rival.division}</p><div class="detail-list"><div>Opponent record <strong>${rival.wins}-${rival.losses}-${rival.ties}</strong></div><div>Offense rating <strong>${rival.baseOffense}</strong></div><div>Defense rating <strong>${rival.baseDefense}</strong></div><div>Offense philosophy <strong>${esc(rival.gamePlan?.offense||'Balanced')}</strong></div><div>Defense philosophy <strong>${esc(rival.gamePlan?.defense||'Balanced')}</strong></div><div>Preferred tempo <strong>${esc(rival.gamePlan?.tempo||'Balanced')}</strong></div></div><p class="muted">The brief shows publicly observable team tendencies; it is not a guaranteed preview of every CPU play.</p>`:'<div class="empty">The season has no remaining scheduled regular-season games.</div>'}</section>
 <section class="panel"><h3 class="panel-title">Base Offensive and Defensive Approach</h3><div class="settings-grid">${choices.map(([key,label,values])=>`<label class="field-label">${label}<select id="prep-${key}" class="form-select">${options(values,plan[key])}</select></label>`).join('')}</div><button class="button button-primary" data-save-weekly-plan>Save Base Plan</button></section></div>
 <div><section class="panel"><h3 class="panel-title">Game-Day Packages & Adjustments</h3><div class="settings-grid">${tactics.map(([key,label,values])=>`<label class="field-label">${label}<select id="prep-${key}" class="form-select">${options(values,plan[key]||values[0])}</select></label>`).join('')}</div><button class="button button-primary" data-save-weekly-tactics>Save Situational Playbook</button></section>
 <section class="panel"><h3 class="panel-title">Availability & Rotation</h3>${injured.length?injured.slice(0,12).map(p=>`<div class="activity-item"><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button> · ${p.position} · ${p.injuryWeeks} week(s)</div>`).join(''):'<p class="muted">No active-roster injuries currently reported.</p>'}<button class="button" data-jump="depth">Check Depth Chart</button></section></div></div>`;
}

// v1.1 league browser and deep-link player profile screens.
let directoryCache=null, directoryQuery='',directoryPosition='ALL',directoryTeam='ALL';
let directorySort='rating',directoryDescending=true,directoryPage=0,activeProfile=null,profileReturn='directory';
const DIRECTORY_COLUMNS={name:'Player',teamName:'Franchise',position:'Position',age:'Age',rating:'OVR',salary:'Base Salary',passYards:'Pass Yds',rushYards:'Rush Yds',recYards:'Rec Yds',sacks:'Sacks'};
async function openDirectory(){
  tab='directory';render();
  if(directoryCache)return;
  try{const r=await fetch('/api/directory');const x=await r.json();if(!r.ok)throw Error(x.error||'Directory could not load');directoryCache=x;if(tab==='directory')render();}
  catch(error){notification(error.message,true);}
}
async function openPlayer(id){
  profileReturn=tab;tab='profile';activeProfile=null;render();
  try{const r=await fetch('/api/player?id='+encodeURIComponent(id));const x=await r.json();if(!r.ok)throw Error(x.error||'Player not found');activeProfile=x;if(tab==='profile')render();}
  catch(error){tab=profileReturn;notification(error.message,true);render();}
}
function filteredDirectory(){
  if(!directoryCache)return [];
  const query=directoryQuery.toLowerCase().trim();
  const matches=directoryCache.filter(p=>(directoryPosition==='ALL'||p.position===directoryPosition)
    &&(directoryTeam==='ALL'||p.teamId===directoryTeam||(directoryTeam==='FA'&&!p.teamId))
    &&(!query||`${p.name} ${p.teamName} ${p.position}`.toLowerCase().includes(query)));
  const factor=directoryDescending?-1:1;
  matches.sort((a,b)=>{
    let x=a[directorySort],y=b[directorySort];
    if(typeof x==='number'||typeof y==='number')return factor*((Number(x)||0)-(Number(y)||0))||a.name.localeCompare(b.name);
    return factor*String(x??'').localeCompare(String(y??''))||a.name.localeCompare(b.name);
  });
  return matches;
}
function directoryRows(){
  const result=filteredDirectory();directoryPage=Math.min(directoryPage,Math.max(0,Math.ceil(result.length/75)-1));
  const rows=result.slice(directoryPage*75,directoryPage*75+75);
  return {result,rows,html:rows.map(p=>`<tr><td class="team-name"><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button></td><td>${esc(p.teamName)}</td><td>${esc(p.position)}</td><td>${p.age}</td><td class="highlight">${p.rating}</td><td>${money(p.salary)}</td><td>${p.passYards}</td><td>${p.rushYards}</td><td>${p.recYards}</td><td>${p.sacks}</td></tr>`).join('')||'<tr><td colspan="10" class="muted">No matching players.</td></tr>'};
}
function directory(){
  const {result,html}=directoryRows();
  return `${heading('League Player Directory','Browse, compare, and open profiles from every franchise and free agency.',directoryCache?`${directoryCache.length} PLAYERS`:'LOADING')}
 <section class="panel"><div class="directory-controls">
 <label>Search players<input id="directory-query" class="form-select" type="search" placeholder="Name, team or position" value="${esc(directoryQuery)}"></label>
 <label>Position<select id="directory-position" class="form-select"><option value="ALL">All positions</option>${[...new Set((directoryCache||[]).map(p=>p.position))].sort().map(p=>`<option value="${esc(p)}" ${directoryPosition===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
 <label>Franchise<select id="directory-team" class="form-select"><option value="ALL">All franchises</option><option value="FA" ${directoryTeam==='FA'?'selected':''}>Free Agents</option>${data.teams.map(t=>`<option value="${t.id}" ${directoryTeam===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
 </div>
 <p class="muted" id="directory-count">${result.length} matching players · Page ${directoryPage+1} of ${Math.max(1,Math.ceil(result.length/75))}. Select any player to view their profile.</p>
 <div class="table-wrap"><table class="data-table directory-table"><thead><tr>${Object.entries(DIRECTORY_COLUMNS).map(([key,label])=>`<th><button class="sortable-heading" data-directory-sort="${key}" title="Sort by ${label}">${label}${directorySort===key?(directoryDescending?' ↓':' ↑'):''}</button></th>`).join('')}</tr></thead><tbody id="directory-rows">${html}</tbody></table></div>
 <div class="pagination"><button class="button" data-directory-page="prev" ${directoryPage===0?'disabled':''}>Previous</button><span id="directory-page-status">${directoryPage+1} / ${Math.max(1,Math.ceil(result.length/75))}</span><button class="button" data-directory-page="next" ${(directoryPage+1)*75>=result.length?'disabled':''}>Next</button></div></section>`;
}
function updateDirectoryRows(){if(tab!=='directory'||!directoryCache)return;
 const {result,html}=directoryRows();const body=document.querySelector('#directory-rows');if(body)body.innerHTML=html;
 const label=document.querySelector('#directory-count');if(label)label.textContent=`${result.length} matching players · Page ${directoryPage+1} of ${Math.max(1,Math.ceil(result.length/75))}. Select any player to view their profile.`;
 const status=document.querySelector('#directory-page-status');if(status)status.textContent=`${directoryPage+1} / ${Math.max(1,Math.ceil(result.length/75))}`;
 const prev=document.querySelector('[data-directory-page="prev"]'),next=document.querySelector('[data-directory-page="next"]');if(prev)prev.disabled=directoryPage===0;if(next)next.disabled=(directoryPage+1)*75>=result.length;
}
function statLine(name,stats){return `<section class="panel"><h3 class="panel-title">${name}</h3>${stats?`<div class="profile-metrics">${[['Games',stats.games],['Pass Yards',stats.passYards],['Pass TD',stats.passTD],['Rush Yards',stats.rushYards],['Rush TD',stats.rushTD],['Receiving Yards',stats.recYards],['Receiving TD',stats.recTD],['Tackles',stats.tackles],['Sacks',stats.sacks],['INT',stats.interceptions]].map(([label,value])=>`<div><small>${label}</small><strong>${Number(value||0).toLocaleString()}</strong></div>`).join('')}</div>`:'<p class="muted">No recorded statistics for this period.</p>'}</section>`;}
function playerPage(){const p=activeProfile;if(!p)return `${heading('Player Profile','Loading player information...')}<div class="loading">Fetching profile...</div>`;
 return `${heading(p.name,`${p.position} · ${p.teamName} · ${p.status}`,`OVR ${p.rating}`)}
 <div class="subnav"><button class="button" data-profile-back>← Back</button><button class="button" data-player-team="${esc(p.teamId||'')}" ${!p.teamId?'disabled':''}>Open Franchise Roster</button></div>
 <section class="stats-grid">${stat('OVERALL',p.rating,'Current ability','green')}${stat('AGE',p.age,'Years')}${stat('MORALE',p.morale??'N/A','Team satisfaction')}${stat('HEALTH',p.injuryWeeks?`${p.injuryWeeks} wks`:'Available',p.injuryLabel||p.status)}</section>
 <div class="two-column"><div>${statLine('Current Regular Season',p.season)}${statLine('Career Totals',p.career)}</div><div><section class="panel"><h3 class="panel-title">Contract & Development</h3>
 <div class="detail-list"><div>Current team <strong>${esc(p.teamName)}</strong></div><div>Roster status <strong>${esc(p.status)}</strong></div><div>Annual base salary <strong>${p.contract?money(p.contract.baseSalary):'Unsigned'}</strong></div><div>Contract expires <strong>${p.contract?.expiresYear??'N/A'}</strong></div><div>Signing bonus <strong>${p.contract?money(p.contract.signingBonus):'N/A'}</strong></div><div>Work ethic <strong>${p.workEthic??'Unreported'}</strong></div><div>Last progression <strong>${p.lastSeasonChange??'N/A'}</strong></div></div></section>${statLine('Career Postseason (current year)',p.postseason)}</div></div>`;
}
function careerHub(){return `${heading('Career Manager','Save and switch between independent franchise careers.',`${saveSlots.length} SLOTS`)}
 <section class="panel"><h3 class="panel-title">Your Careers <span class="panel-kicker">AUTO SAVED</span></h3><p class="muted">Delete any career, including the active one. Deletion requires typing DELETE and cannot be undone. Export a backup first if needed.</p><div class="career-grid">${saveSlots.map(s=>`<article class="career-card ${s.active?'career-active':''}"><div class="split"><strong>${esc(s.name)}</strong>${s.active?'<span class="tag win">ACTIVE</span>':''}</div><p class="muted">${esc(s.teamName||'Franchise')} · ${s.season||'-'} · ${esc(phaseName(s.phase||'unknown'))} Week ${s.week||'-'}</p><p class="muted">${esc(s.id)}</p><div class="career-actions"><button class="button button-small" data-load-slot="${esc(s.id)}" ${s.active?'disabled':''}>Load</button><button class="button button-small" data-rename-slot="${esc(s.id)}">Rename</button><button class="button button-small" data-duplicate-slot="${esc(s.id)}">Duplicate</button><button class="button button-small button-danger" data-delete-career="${esc(s.id)}">Delete</button></div></article>`).join('')||'<div class="muted">No saves yet</div>'}</div></section>
 <section class="panel"><h3 class="panel-title">New Career</h3><div class="form-row"><label>Career name<input class="form-select" id="slot-new-name" maxlength="48" placeholder="New franchise"></label><label>Seed<input class="form-select" type="number" id="slot-new-seed" value="2026"></label></div><button class="button button-primary" data-create-slot>Create & Switch</button></section>
 <section class="panel"><h3 class="panel-title">Portable Backups</h3><p class="muted">Download the active career before a major change or importing another save.</p><a href="/api/export" download="pro-football-dynasty-career.json" class="button">Export Active Career (JSON)</a> <button class="button" data-open-customization>League Templates & Import Options</button></section>`;}
function franchiseDashboard(){const t=data.team;const upcomingGame=data.schedule.find(g=>g.status==='scheduled');const expiring=t.roster.filter(p=>(p.contract?.expiresYear??9999)<=data.season).sort((a,b)=>b.rating-a.rating);
 const hurt=t.roster.filter(p=>(p.injuryWeeks||0)>0).sort((a,b)=>b.rating-a.rating);
 const top=[...t.roster].sort((a,b)=>b.rating-a.rating).slice(0,6);
 const game=upcomingGame?data.teams.find(x=>x.id===(upcomingGame.home===t.id?upcomingGame.away:upcomingGame.home)):null;
 const delta=game?{off:t.baseOffense-game.baseDefense,def:t.baseDefense-game.baseOffense}:null;
 return `${heading('Front Office Command Center',`${t.name} · personnel, scouting, and matchup outlook`,'FRANCHISE REPORT')}
 <section class="stats-grid">${stat('Record',`${t.wins}-${t.losses}-${t.ties}`,'Regular season')}${stat('Cap Room',money(data.capSpace),'Available spending')}${stat('Injured',hurt.length,'Active roster players')}${stat('Expiring Deals',expiring.length,'Contract expires this year')}</section>
 <div class="two-column"><div><section class="panel"><h3 class="panel-title">Next Opponent</h3>${game?`<h2>${esc(game.name)}</h2><p class="muted">Week ${upcomingGame.week} · ${upcomingGame.home===t.id?'Home':'Away'} · ${game.conference} ${game.division}</p><div class="matchup-bars"><div><span>Offense vs Defense</span><strong>${delta.off>=0?'+':''}${delta.off}</strong></div><div><span>Defense vs Offense</span><strong>${delta.def>=0?'+':''}${delta.def}</strong></div></div><p class="muted">Ratings comparison only. Coaching choices, fatigue, and randomness also affect outcomes.</p><button class="button" data-jump="coaching">Open Game Planning</button>`:'<p class="muted">No scheduled regular-season opponent.</p>'}</section>
 <section class="panel"><h3 class="panel-title">Top Personnel</h3><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Contract</th></tr></thead><tbody>${top.map(p=>`<tr><td><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button></td><td>${p.position}</td><td class="highlight">${p.rating}</td><td>${p.contract?.expiresYear??'N/A'}</td></tr>`).join('')}</tbody></table></section></div>
 <div><section class="panel"><h3 class="panel-title">Front Office Priorities</h3>${[['Contracts',expiring,'finance'],['Injuries',hurt,'reserves']].map(([label,list,target])=>`<h4>${label} · ${list.length}</h4>${list.length?list.slice(0,5).map(p=>`<div class="activity-item"><button class="player-link" data-player="${esc(p.id)}">${esc(p.name)}</button> · ${p.position} · OVR ${p.rating}</div>`).join(''):'<p class="muted">No urgent issues.</p>'}<button class="button button-small" data-jump="${target}">Open ${label}</button>`).join('')}</section><section class="panel"><h3 class="panel-title">Latest League News</h3>${data.events.slice(0,8).map(e=>`<div class="activity-item">${esc(e.text||e.message||'League update')}</div>`).join('')||'<p class="muted">No recent league events.</p>'}</section></div></div>`;
}

const VIEWS={customize:customizationCenter,weeklyprep:weeklyGamePlan,career:careerHub,dashboard:franchiseDashboard,directory,profile:playerPage,overview,camp:campCenter,standings,schedule,roster,freeagency,finance:financeOffice,reserves:reserveCenter,tradecenter:tradeCenter,coaching,depth,scouting,playoffs,draft,gamecenter:gameCenter,statistics:seasonStatistics,legacy:legacyCenter};
function render(){
  if(!data)return;
  teamId=data.coachCareer?.teamId||data.coachCareer?.lastTeamId||data.teamId||'T01';
  if(!data.teams.some(t=>t.id===teamId))teamId='T01';
  teamSelect.disabled=!data.coachCareer||data.coachCareer.status!=='active'||Boolean(data.coachCareer.locked);
  teamSelect.title=teamSelect.disabled?'Your franchise is locked until you resign or are fired':'You can change teams until your first simulation';
  teamSelect.innerHTML=data.teams.map(t=>`<option value="${t.id}" ${t.id===teamId?'selected':''}>${esc(t.name)}</option>`).join('');
  const isOff=data.phase==='offseason';
  const off=data.offseason;
  advance.textContent=isOff?(!off?'Open Offseason →':off.stage==='freeAgency'?'Begin Draft →':off.stage==='draft'?'Simulate CPU Picks →':'Start Training Camp →'):data.phase==='trainingCamp'?`Run Camp Session ${data.camp.session+1}/${data.camp.totalSessions} →`:data.phase==='preseason'?`Simulate Preseason Week ${data.week} →`:data.phase==='cutdown'?'Finalize 53-Man Roster →':data.phase==='playoffs'?`Advance Playoffs (${data.round}/4) →`:`Simulate Week ${data.week} →`;
  advance.disabled=busy||data.coachCareer?.status!=='active'||(isOff&&off?.stage==='draft'&&off.onClock?.ownerId===off.managedTeamId);
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
  document.querySelector('#header-tab').textContent=tab.toUpperCase();
  const c=data.coachCareer;
  const managerBar=c?.status==='active'?`<div class="manager-status"><div><strong>${esc(c.name)}</strong> <span class="muted"> · ${esc(data.team.name)} · ${c.locked?'Franchise locked':'Changes allowed until first simulation'}</span></div><button class="button button-small" data-coach-resign>Resign as Manager</button></div>`:'';
  el.innerHTML=managerBar+VIEWS[tab]();
  syncCareerModal();
}
teamSelect.addEventListener('change',async()=>{
  const career=data?.coachCareer;
  if(!career||career.status!=='active'||career.locked){teamSelect.value=teamId;notification('You cannot change franchises while under contract.',true);return;}
  try{data=await api('coachSelect',{name:career.name,franchiseId:teamSelect.value});teamId=data.coachCareer.teamId;tradeTarget=null;selectedGame=null;render();}
  catch(error){teamSelect.value=teamId;notification(error.message,true);}
});
document.querySelector('#navigation').addEventListener('click',e=>{const btn=e.target.closest('[data-tab]');if(!btn)return;tab=btn.dataset.tab;render();if(tab==='tradecenter')loadTradeTarget();if(tab==='customize'||tab==='career')refreshSlots();if(tab==='directory')openDirectory();if(tab==='gamecenter'&&!selectedGame){const latest=[...data.playoffs,...data.schedule,...(data.preseasonSchedule||[])].filter(g=>g.status==='final').at(-1);if(latest)loadGame(latest.id);}});
advance.addEventListener('click',()=>{if(data.phase==='cutdown')return action('finalizeCutdown');if(data.phase!=='offseason')return action('advance');const stage=data.offseason?.stage;return action(!stage?'openOffseason':stage==='freeAgency'?'beginDraft':stage==='draft'?'draftAdvance':'nextSeason');});
el.addEventListener('click',async e=>{
  if(e.target.closest('[data-coach-resign]')){
    if(!confirm('Resign as manager? You will leave your current franchise and must choose a new team before continuing.'))return;
    await action('coachResign');return;
  }
  const playerBtn=e.target.closest('[data-player]');if(playerBtn){await openPlayer(playerBtn.dataset.player);return;}
  if(e.target.closest('[data-profile-back]')){tab=profileReturn;render();if(tab==='directory')openDirectory();return;}
  const playerTeam=e.target.closest('[data-player-team]');if(playerTeam&&playerTeam.dataset.playerTeam){notification('You may view other players, but can only manage your assigned team.');return;}
  const jump=e.target.closest('[data-jump]');if(jump){tab=jump.dataset.jump;render();return;}
  const sorting=e.target.closest('[data-directory-sort]');if(sorting){
    const key=sorting.dataset.directorySort;directoryDescending=directorySort===key?!directoryDescending:!['name','teamName','position'].includes(key);directorySort=key;directoryPage=0;render();return;}
  const page=e.target.closest('[data-directory-page]');if(page){directoryPage=Math.max(0,directoryPage+(page.dataset.directoryPage==='next'?1:-1));updateDirectoryRows();return;}
  if(e.target.closest('[data-open-customization]')){tab='customize';render();return;}
  const rename=e.target.closest('[data-rename-slot]');if(rename){const target=saveSlots.find(x=>x.id===rename.dataset.renameSlot);const name=prompt('Career name',target?.name||'Career');if(name===null)return;try{saveSlots=await api('slotsRename',{slotId:rename.dataset.renameSlot,name});render();notification('Career renamed');}catch(err){notification(err.message,true);}return;}
  const duplicate=e.target.closest('[data-duplicate-slot]');if(duplicate){const target=saveSlots.find(x=>x.id===duplicate.dataset.duplicateSlot);const name=prompt('Name for the copy',(target?.name||'Career')+' Copy');if(name===null)return;const id='slot-'+Math.random().toString(36).slice(2,10);try{saveSlots=await api('slotsDuplicate',{sourceSlotId:duplicate.dataset.duplicateSlot,slotId:id,name});render();notification('Career duplicated');}catch(err){notification(err.message,true);}return;}
  if(e.target.closest('[data-refresh-slots]')){await refreshSlots();return;}
  if(e.target.closest('[data-custom-franchise]')){
    await action('editFranchise',{changes:{city:document.querySelector('#franchise-city').value,nickname:document.querySelector('#franchise-nickname').value,color:document.querySelector('#franchise-color').value}});return;
  }
  if(e.target.closest('[data-save-settings]')){
    const settings=Object.fromEntries(['difficulty','injuryRate','scoutingDifficulty','developmentRate'].map(k=>[k,document.querySelector('#setting-'+k).value]));
    await action('settings',{settings});return;
  }
  if(e.target.closest('[data-edit-person]')){
    const selection=document.querySelector('#edit-person');if(!selection?.value)return;
    const selected=selection.selectedOptions[0];const kind=selected.dataset.kind;
    const person=(kind==='player'?data.team.roster:[data.team.coach,...Object.values(data.team.staff||{})]).find(p=>p.id===selection.value);
    if(!person)return;
    const name=prompt('Name (2-55 characters)',person.name);if(name===null)return;
    const rating=prompt('Overall rating (30-99)',String(person.rating));if(rating===null)return;
    const changes={name,rating:Number(rating)};
    if(kind==='player'){
      const age=prompt('Age (18-45)',String(person.age));if(age===null)return;
      const morale=prompt('Morale (0-100)',String(person.morale??65));if(morale===null)return;
      changes.age=Number(age);changes.morale=Number(morale);
    }
    await action('editPerson',{kind,personId:person.id,changes});return;
  }
  if(e.target.closest('[data-create-slot]')){
    const name=document.querySelector('#slot-new-name')?.value?.trim();if(!name)return notification('Enter a career name',true);
    const id='slot-'+Math.random().toString(36).slice(2,10);
    try{const x=await api('slotsCreate',{slotId:id,name,seed:Number(document.querySelector('#slot-new-seed').value)||2026});afterCareerSwitch(x);notification('New career created');}catch(err){notification(err.message,true);}return;
  }
  const loadSlot=e.target.closest('[data-load-slot]');if(loadSlot){
    if(!confirm('Save your active career and switch to the selected career?'))return;
    try{afterCareerSwitch(await api('slotsLoad',{slotId:loadSlot.dataset.loadSlot}));notification('Career loaded');}catch(err){notification(err.message,true);}return;
  }
  const deleteCareer=e.target.closest('[data-delete-career]');if(deleteCareer){
    if(busy)return;
    const slot=saveSlots.find(s=>s.id===deleteCareer.dataset.deleteCareer);
    if(!slot)return notification('Career not found. Refresh your saves.',true);
    const warning=slot.id==='default'
      ?'This resets the default career to a brand-new league.'
      :slot.active?'The game will switch to the default career.':'Other careers will not be affected.';
    if(!confirm(`Permanently delete "${slot.name}"?\n\n${warning}\nThis cannot be undone. Export a backup first if you want to keep it.`))return;
    if(prompt(`To permanently delete "${slot.name}", type DELETE:`)!=='DELETE')return notification('Career deletion canceled');
    busy=true;
    try {
      const result=await api('slotsDeleteCareer',{slotId:slot.id,confirmation:'DELETE'});
      saveSlots=result.slots;
      // A deleted active career must not keep its old franchise and screen.
      if(slot.active){tab='career';afterCareerSwitch(result.state);}
      else {data=result.state;render();}
      notification('Career deleted');
    }catch(err){notification(err.message,true);}
    finally{busy=false;}
    return;
  }
  if(e.target.closest('[data-import-league-template]')){
    const file=document.querySelector('#league-template-file')?.files?.[0];
    if(!file)return notification('Choose a league template JSON file',true);
    if(file.size>150_000)return notification('League template is too large',true);
    if(!confirm('Replace franchise names and colors for the current career?'))return;
    try{await action('importLeagueTemplate',{template:JSON.parse(await file.text())});notification('League template applied');}catch(err){notification(err.message,true);}return;
  }
  if(e.target.closest('[data-import-save]')){
    const file=document.querySelector('#import-file')?.files?.[0];if(!file)return notification('Choose a JSON save file',true);
    if(file.size>32_000_000)return notification('Save file exceeds 32 MB',true);
    if(!confirm('This will replace the ACTIVE career. Export or switch saves first if needed. Continue?'))return;
    try{const json=await file.text();afterCareerSwitch(await api('importSave',{json,name:file.name.replace(/\.json$/i,'').slice(0,48)}));notification('Imported career saved');}catch(err){notification(err.message,true);}return;
  }

  const historicalTab=e.target.closest('[data-legacy-section]');if(historicalTab){legacySection=historicalTab.dataset.legacySection;render();return;}
  if(e.target.closest('[data-go-camp]')){tab='camp';render();return;}
  if(e.target.closest('[data-save-camp]')){await action('campPlan',{focus:document.querySelector('#camp-focus').value,intensity:document.querySelector('#camp-intensity').value});return;}
  if(e.target.closest('[data-auto-cuts]')){if(confirm('Select the top 53 players based on ratings and camp evaluations? Released players may become free agents.'))await action('autoCuts');return;}
  if(e.target.closest('[data-finalize-cuts]')){await action('finalizeCutdown');return;}
  if(e.target.closest('[data-open-offseason]')){await action('openOffseason');return;}
  if(e.target.closest('[data-begin-draft]')){await action('beginDraft');tab='draft';render();return;}
  if(e.target.closest('[data-draft-advance]')){await action('draftAdvance');return;}
  if(e.target.closest('[data-draft-auto]')){if(confirm('Let the CPU complete all remaining selections for every team?'))await action('autoDraftRemaining');return;}
  if(e.target.closest('[data-draft-select]')){const prospectId=document.querySelector('#draft-prospect')?.value;if(prospectId)await action('draftPick',{prospectId});return;}
  if(e.target.closest('[data-next-season]')){await action('nextSeason');return;}
  const view=e.target.closest('[data-game]');if(view){await loadGame(view.dataset.game);return;}
  const scope=e.target.closest('[data-stats-scope]');if(scope){statScope=scope.dataset.statsScope;render();return;}
  const conf=e.target.closest('[data-conf]');if(conf){conference=conf.dataset.conf;render();return;}
  const release=e.target.closest('[data-cut]');if(release){
    const player=data.team.roster.find(p=>p.id===release.dataset.cut);
    if(!confirm(`Release ${player?.name}? Remaining signing bonus and guarantees may accelerate as dead cap.`))return;
    const june1=confirm('Use a June 1 accounting designation? This spreads qualifying future dead-cap charges to next season and uses one of two annual slots. Cancel for a standard release.');
    await action('cut',{playerId:release.dataset.cut,june1});return;
  }
  const quick=[['[data-ps-sign]','signPractice','psSign','playerId'],['[data-ps-release]','releasePractice','psRelease','playerId'],['[data-promote]','promotePractice','promote','playerId'],['[data-elevate]','elevatePractice','elevate','playerId'],['[data-ir]','reserve','ir','playerId'],['[data-activate-ir]','activateIR','activateIr','playerId'],['[data-waiver]','claimWaiver','waiver','waiverId']];
  for(const [selector,type,key,arg] of quick){const node=e.target.closest(selector);if(node){await action(type,{[arg]:node.dataset[key]});return;}}
  const tag=e.target.closest('[data-tag]');if(tag){await action('franchiseTag',{playerId:tag.dataset.tag});return;}
  const convert=e.target.closest('[data-restructure]');if(convert){const raw=prompt('Convert base salary to a prorated bonus (USD)', '1000000');if(raw!==null&&raw.trim())await action('restructure',{playerId:convert.dataset.restructure,amount:Number(raw)});return;}
  const extend=e.target.closest('[data-extend]');if(extend){
    const salary=prompt('Annual base salary for added years (USD)','3000000');if(salary===null)return;
    const years=prompt('Additional contract years (1-4)','2');if(years===null)return;
    const bonus=prompt('New signing bonus (USD)','500000');if(bonus===null)return;
    await action('negotiateExtension',{playerId:extend.dataset.extend,salary:Number(salary),years:Number(years),signingBonus:Number(bonus)});return;
  }
  if(e.target.closest('[data-trade-execute]')){
    const value=id=>document.querySelector(id)?.value;
    const wrap=x=>x?[x]:[];
    await action('proposeTrade',{toTeamId:tradePartnerId,aPlayers:wrap(value('#a-player')),bPlayers:wrap(value('#b-player')),aPicks:wrap(value('#a-pick')),bPicks:wrap(value('#b-pick'))});
    tradeTarget=null;await loadTradeTarget();return;
  }
  const candidate=e.target.closest('[data-staff-hire]');if(candidate){
    const role=candidate.dataset.staffHire;
    const candidateId=document.querySelector('#staff-candidate-'+role)?.value;
    if(candidateId&&confirm('Replace the current coach or director? This uses your staff budget and can only be done once per role each offseason.'))await action('hireStaff',{role,candidateId});return;
  }
  if(e.target.closest('[data-save-weekly-plan]')){await action('gameplan',{offense:document.querySelector('#prep-offense').value,defense:document.querySelector('#prep-defense').value,tempo:document.querySelector('#prep-tempo').value});return;}
  if(e.target.closest('[data-save-weekly-tactics]')){await action('tactics',{settings:{personnel:document.querySelector('#prep-personnel').value,defensePackage:document.querySelector('#prep-defensePackage').value,fourthDown:document.querySelector('#prep-fourthDown').value,redZone:document.querySelector('#prep-redZone').value,twoMinute:document.querySelector('#prep-twoMinute').value,rotation:document.querySelector('#prep-rotation').value}});return;}
  if(e.target.closest('[data-save-plan]')){await action('gameplan',{offense:document.querySelector('#offense-scheme').value,defense:document.querySelector('#defense-scheme').value,tempo:document.querySelector('#tempo-scheme').value});return;}
  if(e.target.closest('[data-save-tactics]')){await action('tactics',{settings:{personnel:document.querySelector('#tactic-personnel').value,
    defensePackage:document.querySelector('#tactic-defense').value,fourthDown:document.querySelector('#tactic-fourth').value,
    redZone:document.querySelector('#tactic-redzone').value,twoMinute:document.querySelector('#tactic-two-minute').value,
    rotation:document.querySelector('#tactic-rotation').value}});return;}
  if(e.target.closest('[data-save-practice]')){await action('practice',{focus:document.querySelector('#practice-focus').value});return;}
  if(e.target.closest('[data-save-scout-focus]')){await action('scoutingFocus',{focus:document.querySelector('#scout-focus').value});return;}
  const upgrade=e.target.closest('[data-skill]');if(upgrade){await action('coachSkill',{skill:upgrade.dataset.skill});return;}
  const scouting=e.target.closest('[data-scout]');if(scouting){await action('scout',{prospectId:scouting.dataset.scout});return;}
  const bookmark=e.target.closest('[data-prospect-bookmark]');if(bookmark){await action('bookmarkProspect',{prospectId:bookmark.dataset.prospectBookmark});return;}
  const sign=e.target.closest('[data-sign]');if(sign){
    const p=data.freeAgents.find(p=>p.id===sign.dataset.sign);
    if(!p)return;
    const suggestion=p.asking||Math.max(900_000,p.rating*65_000);
    const salary=Number(prompt(`Annual salary offer (USD) for ${p.name}`,String(suggestion)));
    if(!Number.isFinite(salary)||salary<=0)return;
    const years=Number(prompt('Contract duration in years (1-5)','2'));
    if(!Number.isInteger(years)||years<1||years>5)return;
    const bonus=prompt('Signing bonus (USD)',String(Math.round((p.asking||suggestion)*years*.26/50_000)*50_000));
    if(bonus===null)return;
    await action('negotiateFreeAgent',{playerId:p.id,salary,years,signingBonus:Number(bonus)});
  }
});
el.addEventListener('input',e=>{if(e.target.id==='directory-query'){directoryQuery=e.target.value;directoryPage=0;updateDirectoryRows();}});
el.addEventListener('change',async e=>{
  if(e.target.id==='directory-position'){directoryPosition=e.target.value;directoryPage=0;updateDirectoryRows();return;}
  if(e.target.id==='directory-team'){directoryTeam=e.target.value;directoryPage=0;updateDirectoryRows();return;}
  if(e.target.id==='trade-partner'){tradePartnerId=e.target.value;await loadTradeTarget();return;}
  if(e.target.id==='leader-select'){statCategory=e.target.value;render();return;}
  if(e.target.id==='legacy-category'){legacyCategory=e.target.value;render();return;}
  const select=e.target.closest('[data-depth-pos]');if(!select)return;
  await action('starter',{position:select.dataset.depthPos,slot:Number(select.dataset.depthSlot),playerId:select.value});
});
async function loadTradeTarget(){
  if(!data)return;
  if(!data.teams.some(t=>t.id===tradePartnerId&&t.id!==teamId))tradePartnerId=data.teams.find(t=>t.id!==teamId).id;
  try{const r=await fetch('/api/trade-target?id='+encodeURIComponent(tradePartnerId));const target=await r.json();if(!r.ok)throw Error(target.error||'Could not load partner');tradeTarget=target;if(tab==='tradecenter')render();}
  catch(e){notification(e.message,true);}
}
refresh().catch(e=>{el.innerHTML=`<div class="error">Unable to load league: ${esc(e.message)}</div>`;});
