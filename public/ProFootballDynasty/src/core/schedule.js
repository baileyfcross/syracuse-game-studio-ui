/** Simplified NFL schedule: 17 games across 18 weeks with balanced home/away games. */
const SAME_CONFERENCE_PAIRINGS = [ [[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]] ];
export function generateSchedule(teams, year=2026) {
  if (teams.length !== 32) throw Error('Schedule requires 32 teams');
  const group = (conf,div)=> teams.filter(t=>t.conference===conf && ['East','North','South','West'][div]===t.division).sort((a,b)=>a.slot-b.slot);
  const pairs = SAME_CONFERENCE_PAIRINGS[((year-2026)%3+3)%3];
  const rotation = ((year-2026)%4+4)%4;
  const extraRotation = (rotation+1)%4;
  const factor = new Map(Array.from({length:17},(_,i)=>[i+1,[]]));
  let nextId=1;
  function add(w,a,b,kind,firstHome) {
    if(a.id===b.id) throw Error('Self game');
    const [h,v] = firstHome ? [a,b]:[b,a];
    factor.get(w).push({id:`G${year}-${nextId++}`,year,week:w,home:h.id,away:v.id,type:'regular',category:kind,status:'scheduled',scoreHome:null,scoreAway:null});
  }
  // Six games against division rivals, home and away.
  const matches = [ [[0,3],[1,2]], [[0,2],[3,1]], [[0,1],[2,3]] ];
  for (const conf of ['AFC','NFC']) for(let d=0;d<4;d++) {
    const a=group(conf,d);
    matches.forEach((round,idx)=>round.forEach(([x,y])=>{
      const firstHome = ((year+d+x+y+(conf==='AFC'?0:1))&1)===0;
      add(idx+1,a[x],a[y],'division',firstHome);
      add(idx+4,a[x],a[y],'division',!firstHome);
    }));
  }
  // Four games against the rotating same-conference division.
  for(const conf of ['AFC','NFC']) for(const [d1,d2] of pairs) {
    const a=group(conf,d1),b=group(conf,d2);
    for(let offset=0;offset<4;offset++)for(let s=0;s<4;s++)
      add(7+offset,a[s],b[(s+offset)%4],'same-conference-rotation',((year+d1+d2+offset+s)&1)===0);
  }
  // Four games against the rotating other-conference division.
  for(let aDiv=0;aDiv<4;aDiv++) {
    const afc=group('AFC',aDiv),nfc=group('NFC',(aDiv+rotation)%4);
    for(let offset=0;offset<4;offset++)for(let s=0;s<4;s++)
      add(11+offset,afc[s],nfc[(s+offset)%4],'cross-conference-rotation',((year+aDiv+offset+s)&1)===0);
  }
  // Two matching-prior-finish games inside each conference.
  for(const conf of ['AFC','NFC']) {
    const rest = SAME_CONFERENCE_PAIRINGS.filter(p=>JSON.stringify(p)!==JSON.stringify(pairs));
    rest.forEach((matching,idx)=> matching.forEach(([d1,d2])=> {
      for(let slot=0;slot<4;slot++)
        add(15+idx,group(conf,d1)[slot],group(conf,d2)[slot], 'conference-standing',((year+idx+slot+d1)&1)===0);
    }));
  }
  // 17th game: different opposite-conference division, same previous-place position.
  for(let d=0;d<4;d++)for(let slot=0;slot<4;slot++)
    add(17,group('AFC',d)[slot],group('NFC',(d+extraRotation)%4)[slot],'interconference-standing',((year+slot+d)&1)===0);
  // 17 full weekly matchings from opponent formula. Add Week 10 and relocate
  // one disjoint 16-game matching to distribute each team's one bye.
  const baseToFinal={1:5,2:7,3:9,4:11,5:13,6:18,7:1,8:2,9:3,10:4,11:6,12:8,13:12,14:14,15:15,16:16,17:17};
  const games=[...factor.values()].flat().map(g=>({...g,week:baseToFinal[g.week]}));
  // Byes fall in Weeks 5, 7, 11 and 13 in this MVP.
  for(const conf of ['AFC','NFC']) for(let d=0;d<4;d++) {
    const ids=group(conf,d).map(t=>t.id);
    const round=(d+(conf==='NFC'?1:0)+year)%2;
    matches[round].forEach(([x,y],idx)=>{
      const src=(idx===0?round+1:round+4);
      const game=games.find(g=>g.category==='division'&&g.week===baseToFinal[src]&&
        [g.home,g.away].includes(ids[x])&&[g.home,g.away].includes(ids[y]));
      if(!game)throw Error('Unable to relocate bye-week matchup');
      game.week=10;
    });
  }
  balanceHomeAndAway(teams,games);
  games.sort((a,b)=>a.week-b.week||a.id.localeCompare(b.id));
  validateSchedule(teams,games);
  return games;
}

/** Orient the 11 nondivision edges per team using an Euler tour plus a dummy
 * node. Every team then has 5 or 6 nondivision home games and 3 division home
 * games, yielding an NFL-compatible 8/9 home split. */
function balanceHomeAndAway(teams,games){
  const nonDiv=games.filter(g=>g.category!=='division');
  const edges=nonDiv.map(g=>({a:g.home,b:g.away,game:g}));
  for(const t of teams) edges.push({a:'DUMMY',b:t.id,game:null});
  const adjacency=new Map([...teams.map(t=>t.id),'DUMMY'].map(id=>[id,[]]));
  edges.forEach((e,i)=>{adjacency.get(e.a).push(i);adjacency.get(e.b).push(i);});
  const used=new Set(), stack=['DUMMY'];
  while(stack.length){
    const current=stack[stack.length-1];
    const links=adjacency.get(current);
    while(links.length&&used.has(links[links.length-1]))links.pop();
    if(!links.length){stack.pop();continue;}
    const ei=links.pop();if(used.has(ei))continue;
    used.add(ei);const edge=edges[ei];
    const other=edge.a===current?edge.b:edge.a;
    if(edge.game){edge.game.home=current;edge.game.away=other;}
    stack.push(other);
  }
  if(used.size!==edges.length)throw Error('Incomplete schedule home/away balancing');
}

export function validateSchedule(teams,games) {
  if(games.length!==272)throw Error(`Expected 272 games, found ${games.length}`);
  const opponents=new Map(teams.map(t=>[t.id,[]]));
  const weeks=new Map(teams.map(t=>[t.id,new Set()]));
  for(const g of games){
    if(g.week<1||g.week>18)throw Error(`Bad week ${g.week}`);
    for(const id of [g.home,g.away]) {
      if(!weeks.has(id))throw Error(`Unknown team ${id}`);
      if(weeks.get(id).has(g.week))throw Error(`Double booking team ${id} week ${g.week}`);
      weeks.get(id).add(g.week);
    }
    opponents.get(g.home).push(g.away);
    opponents.get(g.away).push(g.home);
  }
  for(const t of teams){
    const homeGames=games.filter(g=>g.home===t.id).length;
    if(homeGames!==8&&homeGames!==9)throw Error(`${t.name}: ${homeGames} home games`);
    const opps=opponents.get(t.id);
    if(opps.length!==17||weeks.get(t.id).size!==17)throw Error(`${t.name}: expected 17 distinct weeks`);
    const div=opps.filter(id=>teams.some(o=>o.id===id&&o.division===t.division&&o.conference===t.conference));
    if(div.length!==6)throw Error(`${t.name}: expected 6 division games`);
  }
  return true;
}
