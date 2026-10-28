import { rng, randomInt, hashString } from '../core/random.js';
import { teamUnitRating } from '../core/roster.js';
import { starterFor } from '../core/coaching.js';
import {PERSONNEL, DEFENSE_PACKAGES, chooseSnapTactics, fourthDownCall, normalizeTactics, penaltyWeights} from '../core/tactics.js';

// Original, seeded NFL-style simulation. This is intentionally a game model,
// not a claim to fully implement the 2026 NFL officiating/rulebook.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const weighted=(random,items)=>{
  const sum=items.reduce((n,x)=>n+x[1],0);let value=random()*sum;
  for(const [item,weight] of items){value-=weight;if(value<0)return item;}
  return items.at(-1)[0];
};
const basePlayer=(p)=>({id:p.id,name:p.name,position:p.position,teamId:null,
  passAttempts:0,completions:0,passYards:0,passTD:0,interceptionsThrown:0,sacksTaken:0,
  rushAttempts:0,rushYards:0,rushTD:0,targets:0,receptions:0,recYards:0,recTD:0,
  tackles:0,sacks:0,interceptions:0,forcedFumbles:0,fumblesLost:0,offensiveSnaps:0,defensiveSnaps:0,sacksAllowed:0,
  fgAttempts:0,fgMade:0,xpAttempts:0,xpMade:0,punts:0,puntYards:0,points:0});
const baseTeam=(id)=>({teamId:id,plays:0,firstDowns:0,passYards:0,rushYards:0,totalYards:0,
  thirdDownAttempts:0,thirdDownConversions:0,fourthDownAttempts:0,fourthDownConversions:0,
  turnovers:0,interceptionsThrown:0,fumblesLost:0,sacksAllowed:0,sacks:0,
  penalties:0,penaltyYards:0,timeoutsUsed:0,punts:0,fgAttempts:0,fgMade:0,
  touchdowns:0,possessions:0,timeOfPossession:0,points:0});

export function simulateMatch(home,away,{seed=2026,postseason=false,matchId='',injuryRate='standard'}={}){
  if(!home?.id||!away?.id||home.id===away.id)throw Error('Two distinct teams required');
  const random=rng(hashString(`${seed}-${matchId}-${home.id}-${away.id}`));
  const teamMap={[home.id]:home,[away.id]:away};
  const players={},teams={[home.id]:baseTeam(home.id),[away.id]:baseTeam(away.id)};
  for(const team of [home,away])for(const p of team.roster){players[p.id]={...basePlayer(p),teamId:team.id};}
  const plays=[],drives=[],score={[home.id]:0,[away.id]:0};
  const quarterScores={[home.id]:[0,0,0,0,0],[away.id]:[0,0,0,0,0]};
  let seconds=3600,otSeconds=600,driveIndex=0,ot=false,clockFloor=1800;
  let clockRunning=false;
  const fatigue=Object.fromEntries(Object.keys(players).map(id=>[id,0]));
  const unavailable=new Set(),injuries=[];
  const timeouts={[home.id]:3,[away.id]:3};
  const warnings=new Set(),quarterEnds=new Set();
  const opponent=id=>id===home.id?away.id:home.id;
  const whichQuarter=()=>ot?5:clamp(4-Math.floor(Math.max(0,seconds-1)/900),1,4);
  const timeString=()=>{const t=ot?otSeconds:seconds;const q=whichQuarter();const left=ot?t:t-(4-q)*900;
    return `${Math.floor(Math.max(left,0)/60)}:${String(Math.max(left,0)%60).padStart(2,'0')}`;};
  function add(type,offense,description,extra={}){
    const e={sequence:plays.length+1,quarter:whichQuarter(),clock:timeString(),teamId:offense,
      type,description,...extra};plays.push(e);return e;
  }
  const positionPools=Object.fromEntries([home,away].map(t=>{
    const groups={};
    for(const p of t.roster)if((p.injuryWeeks||0)===0)(groups[p.position]??=[]).push(p);
    return [t.id,groups];
  }));
  const rotationWeight=Object.fromEntries([home,away].map(t=>[t.id,
    {starters:.06,balanced:.25,heavy:.60}[normalizeTactics(t.gamePlan).rotation]]));
  function playerFor(team,position,slot=0){
    const t=teamMap[team],rotation=rotationWeight[team];
    const pool=(positionPools[team][position]||[]).filter(p=>!unavailable.has(p.id));
    if(!pool.length)return null;
    const importance=rotation;
    const preferred=t.depthChart?.[position]||[];
    // Depth chart remains meaningful; rested backups can earn snaps as starters fatigue.
    const choices=pool.sort((a,b)=>{
      const score=p=>p.rating-(fatigue[p.id]||0)*importance+(preferred.includes(p.id)?1.5:0);
      return score(b)-score(a)||a.id.localeCompare(b.id);
    });
    return choices[slot%choices.length]||choices[0];
  }
  function snapUsage(team,participants,defensive=false){
    const seen=new Set();
    for(const p of participants){if(!p||seen.has(p.id)||!players[p.id])continue;seen.add(p.id);
      fatigue[p.id]=Math.min(100,(fatigue[p.id]||0)+(p.position==='QB'?1.1:2.5));
      if(defensive)players[p.id].defensiveSnaps++;else players[p.id].offensiveSnaps++;
    }
  }
  function gameDayInjury(team,positions){
    if(random()>=({low:.0009,standard:.0022,high:.005}[injuryRate]??.0022))return;
    const p=choice(team,positions);
    if(!p||unavailable.has(p.id))return;
    const weeks=randomInt(random,1,5),label=weighted(random,[['Ankle sprain',3],['Shoulder strain',2],['Knee sprain',2],['Concussion protocol',1]]);
    unavailable.add(p.id);injuries.push({teamId:team,playerId:p.id,playerName:p.name,weeks,label});
    add('injury',team,`${p.name} (${p.position}) leaves the game: ${label}; estimated ${weeks} week(s).`,{playerId:p.id,weeks,label});
  }
  function choice(team,positions){
    const possible=positions.flatMap(([pos,count,weight])=>Array.from({length:count},(_,i)=>({p:playerFor(team,pos,i),weight})) )
      .filter(x=>x.p&&players[x.p.id]);
    if(!possible.length)return playerFor(team,'QB');
    return weighted(random,possible.map(x=>[x.p,x.weight]));
  }
  function tick(sec,team){
    const before=ot?otSeconds:seconds;
    const actual=Math.min(Math.max(0,Math.round(sec)),ot?otSeconds:Math.max(0,seconds-clockFloor));
    if(ot)otSeconds-=actual;else seconds-=actual;
    teams[team].timeOfPossession+=actual;
    if(!ot){
      for(const [threshold,label] of [[2700,'End of first quarter'],[1920,'Two-minute warning, first half'],[900,'End of third quarter'],[120,'Two-minute warning, second half']]){
        if(before>threshold&&seconds<=threshold){
          if(label.startsWith('Two')){
            if(!warnings.has(threshold)){add('two-minute-warning',team,label);warnings.add(threshold);clockRunning=false;}
          }else if(!quarterEnds.has(threshold)){add('quarter-end',team,label);quarterEnds.add(threshold);}
        }
      }
    }
    return actual;
  }
  function beforeSnap(offense,defense,tempo,clockLimit){
    const halfRemaining=ot?otSeconds:seconds>1800?seconds-1800:seconds;
    // Teams behind late may use defensive timeouts to preserve a final possession.
    if(!ot&&halfRemaining<=110&&halfRemaining>0&&score[defense]<score[offense]&&clockRunning&&timeouts[defense]>0){
      timeouts[defense]--;teams[defense].timeoutsUsed++;
      add('timeout',defense,`${teamMap[defense].name} takes timeout (${timeouts[defense]} remaining this half).`);
      clockRunning=false;
    }
    const setup=clockRunning?(tempo==='uptempo'?randomInt(random,8,15):tempo==='clock-control'?randomInt(random,30,39):randomInt(random,22,35)):
      (tempo==='uptempo'?randomInt(random,1,4):randomInt(random,4,9));
    const elapsed=tick(setup,offense);
    if(clockLimit!==null&&!ot&&seconds<=clockLimit)return false;
    if(elapsed<setup&&((ot?otSeconds:seconds)<=0))return false;
    return true;
  }
  function point(team,n,kind,extra={}){
    score[team]+=n;teams[team].points+=n;quarterScores[team][whichQuarter()-1]+=n;
    add(kind,team,extra.description||`${teamMap[team].name} scores ${n} points`,{points:n,scoreHome:score[home.id],scoreAway:score[away.id],...extra});
  }
  function kickoff(receiving,description){
    clockRunning=false;
    const start=random()<.69?35:randomInt(random,20,39); // Simplified 2026 kickoff outcomes.
    add('kickoff',opponent(receiving),description||`Kickoff to ${teamMap[receiving].name}, ball at own ${start}`,{receiving,ball:start});
    return start;
  }
  function touchdown(team,kind,scorer,assist){
    teams[team].touchdowns++;
    if(scorer&&players[scorer.id]){
      if(kind==='pass')players[scorer.id].recTD++;
      else players[scorer.id].rushTD++;
      players[scorer.id].points+=6;
    }
    if(kind==='pass'&&assist&&players[assist.id])players[assist.id].passTD++;
    point(team,6,'touchdown',{description:`Touchdown ${teamMap[team].name}! ${scorer?.name||'Offense'} scores${assist?` on a pass from ${assist.name}`:''}.`,playerId:scorer?.id||null});
    const kicker=playerFor(team,'K');
    if(random()<.965){
      if(kicker&&players[kicker.id]){players[kicker.id].xpAttempts++;players[kicker.id].xpMade++;players[kicker.id].points++;}
      point(team,1,'extra-point',{description:`${kicker?.name||'Kicker'} converts the extra point.`});
    }else{
      if(kicker&&players[kicker.id])players[kicker.id].xpAttempts++;
      add('missed-extra-point',team,'Extra point is no good.');
    }
  }
  function consumeSeries(offense,ball,clockLimit){
    const defense=opponent(offense),t=teamMap[offense],d=teamMap[defense],ts=teams[offense],ds=teams[defense];
    let down=1,toGo=Math.min(10,100-ball),pos=ball,drivePlays=0,driveYards=0,firstDowns=0;
    const qb=playerFor(offense,'QB'),k=playerFor(offense,'K'),punter=playerFor(offense,'P');
    const offensePower=teamUnitRating(t,'offense'),defensePower=teamUnitRating(d,'defense');
    const scheme=t.gamePlan?.offense||'balanced',defScheme=d.gamePlan?.defense||'balanced';
    const pressure=(defScheme==='blitz-heavy'?1.7:0)+(defScheme==='man-coverage'?.4:0);
    const skill=clamp((offensePower-defensePower)*.011,-.23,.23);
    const snapshot=()=>({down,distance:toGo,ball:pos});
    for(let loop=0;loop<26;loop++){
      if((ot?otSeconds:seconds)<=0|| (clockLimit!==null&&!ot&&seconds<=clockLimit))return {result:'clock',ball:pos,plays:drivePlays,yards:driveYards};
      if(down===4){
        const fgDistance=117-pos;
        const trailing=score[offense]<score[defense];
        const aggressive=(seconds<200&&!ot&&trailing)||(ot&&trailing);
        const fourth=fourthDownCall({gamePlan:t.gamePlan,ball:pos,toGo,scoreDifference:score[offense]-score[defense],secondsRemaining:ot?otSeconds:seconds});
        const go=(random()<fourth.goChance)||(aggressive&&pos>50&&toGo<=7);
        if(!go&&fgDistance<=60){
          ts.fgAttempts++;if(k&&players[k.id])players[k.id].fgAttempts++;
          tick(randomInt(random,4,7),offense);clockRunning=false;
          const makeProb=clamp(.98-(Math.max(0,fgDistance-30)*.015)+(k?(k.rating-70)*.003:0),.25,.98);
          if(random()<makeProb){
            ts.fgMade++;if(k&&players[k.id]){players[k.id].fgMade++;players[k.id].points+=3;}
            point(offense,3,'field-goal',{description:`${k?.name||'Kicker'} makes a ${fgDistance}-yard field goal.`,distance:fgDistance});
            return {result:'field-goal',plays:drivePlays,yards:driveYards};
          }
          add('missed-field-goal',offense,`${k?.name||'Kicker'} misses from ${fgDistance} yards.`,{...snapshot(),distance:fgDistance});
          return {result:'missed-field-goal',nextBall:clamp(100-(pos-7),20,99),plays:drivePlays,yards:driveYards};
        }
        if(!go){
          const yards=clamp(Math.round(randomInt(random,34,54)+(punter?.rating||70)*.06),28,65);
          const landing=pos+yards;
          const nextBall=landing>=100?20:clamp(100-landing+randomInt(random,0,11),1,45);
          ts.punts++;if(punter&&players[punter.id]){players[punter.id].punts++;players[punter.id].puntYards+=yards;}
          tick(randomInt(random,7,10),offense);clockRunning=false;
          add('punt',offense,`${punter?.name||'Punter'} punts ${yards} yards; ${teamMap[defense].name} takes possession at its ${nextBall}.`,{...snapshot(),yards,nextBall});
          return {result:'punt',nextBall,plays:drivePlays,yards:driveYards};
        }
        ts.fourthDownAttempts++;
      }
      const remaining=ot?otSeconds:seconds>1800?seconds-1800:seconds;
      const tactics=chooseSnapTactics({gamePlan:t.gamePlan,down,toGo,ball:pos,quarter:whichQuarter(),secondsRemaining:remaining,
        scoreDifference:score[offense]-score[defense]});
      if(!beforeSnap(offense,defense,tactics.tempo,clockLimit))return {result:'clock',ball:pos,plays:drivePlays,yards:driveYards};
      const before=snapshot();
      // Pre-snap or nullified-play penalty. No offensive snap or statistics count.
      const penaltyRate=.038+(tactics.tempo==='uptempo'?.007:0)+(defScheme==='blitz-heavy'?.004:0);
      if(random()<penaltyRate){
        const weights=penaltyWeights({defenseScheme:defScheme,offenseTempo:tactics.tempo});
        const flag=weighted(random,Object.entries(weights).map(([k,v])=>[k,v]));
        const onDefense=flag==='defensiveOffside'||flag==='defensiveHolding';
        const guilty=onDefense?defense:offense;
        const yards=flag==='offensiveHolding'?10:5;
        const gain=Math.min(yards,99-pos),loss=Math.min(yards,pos-1);
        teams[guilty].penalties++;teams[guilty].penaltyYards+=onDefense?gain:loss;
        if(onDefense){pos+=gain;toGo-=gain;
          if(flag==='defensiveHolding'||toGo<=0){down=1;toGo=Math.min(10,100-pos);ts.firstDowns++;}
        }else{pos-=loss;toGo+=loss;}
        const desc={falseStart:'False start',offensiveHolding:'Offensive holding (play nullified)',
          defensiveOffside:'Defensive offside',defensiveHolding:'Defensive holding (automatic first down)'}[flag];
        add('penalty',guilty,`${desc} on ${teamMap[guilty].name}; ${yards}-yard foul.`,
          {...before,penalty:flag,penaltyYards:Math.abs(onDefense?gain:loss),nullified:true,autoFirstDown:flag==='defensiveHolding'});
        clockRunning=false;
        continue;
      }
      if(down===3)ts.thirdDownAttempts++;
      const isPass=random()<tactics.passChance;
      // Live-ball time is separate from play-clock runoff.
      tick(isPass?randomInt(random,3,8):randomInt(random,4,9),offense);
      drivePlays++;ts.plays++;clockRunning=true;
      const selectedPersonnel=PERSONNEL[tactics.personnel];
      const offensiveUnit=[playerFor(offense,'QB'),...Array.from({length:5},(_,i)=>playerFor(offense,'OL',i)),
        ...Object.entries(selectedPersonnel).flatMap(([position,n])=>Array.from({length:n},(_,i)=>playerFor(offense,position,i)))];
      const defensiveFormation=normalizeTactics(d.gamePlan).defensePackage;
      const pkg=defensiveFormation==='dime'?'dime':tactics.personnel==='21-personnel'?'base':defensiveFormation;
      const defensiveUnit=Object.entries(DEFENSE_PACKAGES[pkg])
        .flatMap(([position,n])=>Array.from({length:n},(_,i)=>playerFor(defense,position,i)));
      snapUsage(offense,offensiveUnit);snapUsage(defense,defensiveUnit,true);
      add('formation',offense,`${teamMap[offense].name} ${tactics.personnel} vs ${teamMap[defense].name} ${pkg}.`,
        {...before,offensePersonnel:tactics.personnel,defensePackage:pkg,tempo:tactics.tempo,passChance:Math.round(tactics.passChance*100)});
      let gained=0,finish=null,scorer=null,assist=null;
      if(isPass){
        const rec=choice(offense,[['WR',selectedPersonnel.WR,7],['TE',selectedPersonnel.TE,3],['RB',selectedPersonnel.RB,2]]);
        const receiver=rec&&players[rec.id];const passer=qb&&players[qb.id];
        if(receiver)receiver.targets++;
        if(passer)passer.passAttempts++;
        const tired=(fatigue[qb?.id]||0)/100;
        const passProtection=tactics.personnel==='12-personnel'?.012:tactics.personnel==='10-personnel'?-.014:0;
        const packagePressure=pkg==='dime'?.008:pkg==='base'?-.005:0;
        const sackRate=clamp(.055+pressure*.024-skill*.09-passProtection+packagePressure+tired*.015,.02,.2);
        const intRate=clamp(.017+pressure*.006-skill*.02+tired*.012,.005,.07);
        const roll=random();
        if(roll<sackRate){
          gained=-randomInt(random,1,9);
          if(passer){passer.passAttempts--;passer.sacksTaken++;} if(receiver)receiver.targets--;
          ts.sacksAllowed++;ts.passYards+=gained;ds.sacks++;
          const beaten=playerFor(offense,'OL',randomInt(random,0,4));if(beaten&&players[beaten.id])players[beaten.id].sacksAllowed++;
          const rusher=choice(defense,[['EDGE',2,6],['DL',2,4],['LB',2,2]]);
          if(rusher&&players[rusher.id]){players[rusher.id].sacks++;players[rusher.id].tackles++;}
          add('sack',offense,`${qb?.name||'Quarterback'} sacked for a loss of ${-gained}.`,{...before,yards:gained,playerId:qb?.id||null});
        }else if(roll<sackRate+intRate){
          if(passer)passer.interceptionsThrown++;
          ts.turnovers++;ts.interceptionsThrown++;
          const defender=choice(defense,[['CB',2,6],['S',2,4],['LB',2,2]]);
          if(defender&&players[defender.id])players[defender.id].interceptions++;
          const newBall=clamp(100-pos+randomInt(random,-12,12),2,92);
          add('interception',offense,`${qb?.name||'Quarterback'} intercepted by ${defender?.name||teamMap[defense].name}.`,{...before,playerId:qb?.id||null,defenderId:defender?.id||null,nextBall:newBall});
          return {result:'interception',nextBall:newBall,plays:drivePlays,yards:driveYards};
        }else{
          const receiverFatigue=(fatigue[rec?.id]||0)/100;
          const completion=clamp(.67+skill*.22+(scheme==='west-coast'?.04:0)-(defScheme==='man-coverage'?.025:0)-receiverFatigue*.06-tired*.04+(pkg==='dime'?-.012:0),.35,.86);
          if(random()<completion&&rec){
            gained=clamp(Math.round(randomInt(random,1,19)+(scheme==='vertical'?5:0)+skill*18+(random()<.075?randomInt(random,14,42):0)),0,70);
            if(passer){passer.completions++;passer.passYards+=Math.min(gained,100-pos);}
            if(receiver){receiver.receptions++;receiver.recYards+=Math.min(gained,100-pos);}
            ts.passYards+=Math.min(gained,100-pos);
            scorer=rec;assist=qb;
            if(pos+gained<100){const tackler=choice(defense,[['CB',2,5],['S',2,4],['LB',2,3]]);if(tackler&&players[tackler.id])players[tackler.id].tackles++;}
            add('completion',offense,`${qb?.name||'QB'} to ${rec.name} for ${Math.min(gained,100-pos)} yards.`,{...before,yards:Math.min(gained,100-pos),playerId:qb?.id||null,receiverId:rec.id});
          }else{
            add('incomplete',offense,`${qb?.name||'Quarterback'} throws incomplete${rec?` to ${rec.name}`:''}.`,{...before,yards:0,playerId:qb?.id||null});
            clockRunning=false;
          }
        }
      }else{
        const runner=choice(offense,[['RB',selectedPersonnel.RB,8],['QB',1,1],['WR',selectedPersonnel.WR,1]]);
        scorer=runner;
        gained=clamp(Math.round(randomInt(random,-2,11)+skill*10+(tactics.personnel==='21-personnel'?1.1:0)
          -(fatigue[runner?.id]||0)*.018+(pkg==='base'?-0.8:0)+(random()<.07?randomInt(random,8,30):0)), -6,55);
        const gainedActual=clamp(gained,1-pos,100-pos)||0;
        if(runner&&players[runner.id]){players[runner.id].rushAttempts++;players[runner.id].rushYards+=gainedActual;}
        ts.rushYards+=gainedActual;
        if(pos+gainedActual<100){const tackler=choice(defense,[['LB',2,5],['DL',3,3],['EDGE',2,3],['S',2,2]]);if(tackler&&players[tackler.id])players[tackler.id].tackles++;}
        add('rush',offense,`${runner?.name||'Runner'} ${gainedActual>=0?'gains':'loses'} ${Math.abs(gainedActual)} yard${Math.abs(gainedActual)===1?'':'s'}.`,{...before,yards:gainedActual,playerId:runner?.id||null});
        gained=gainedActual;
        if(random()<.009){
          ts.turnovers++;ts.fumblesLost++;if(runner&&players[runner.id])players[runner.id].fumblesLost++;
          const forced=choice(defense,[['LB',2,5],['DL',3,3],['EDGE',2,3],['S',2,2]]);if(forced&&players[forced.id])players[forced.id].forcedFumbles++;
          const recoveredAt=clamp(100-(pos+gained),1,99);
          add('fumble',offense,`${runner?.name||'Ball carrier'} fumbles. ${teamMap[defense].name} recovers.`,{...before,nextBall:recoveredAt});
          return {result:'fumble',nextBall:recoveredAt,plays:drivePlays,yards:driveYards};
        }
      }
      // Injuries are reported after the completed snap and can force in-game substitution.
      gameDayInjury(offense,[['RB',2,2],['WR',3,2],['TE',1,1],['OL',5,1],['QB',1,.25]]);
      gameDayInjury(defense,[['DL',3,2],['EDGE',2,2],['LB',2,2],['CB',3,2],['S',2,1]]);
      // Sideline incompletions and some out-of-bounds plays stop the game clock.
      if(gained!==0&&random()<.065)clockRunning=false;
      pos=clamp(pos+gained,0,100);
      driveYards+=gained;
      if(pos<=0){point(defense,2,'safety',{description:`Safety! ${teamMap[defense].name} tackles the offense in its own end zone.`});return {result:'safety',nextBall:35,plays:drivePlays,yards:driveYards};}
      if(pos>=100){touchdown(offense,isPass?'pass':'rush',scorer,assist);return {result:'touchdown',plays:drivePlays,yards:driveYards};}
      toGo-=gained;
      if(toGo<=0){
        firstDowns++;ts.firstDowns++;
        if(down===3)ts.thirdDownConversions++;
        if(down===4)ts.fourthDownConversions++;
        add('first-down',offense,`${teamMap[offense].name} moves the chains at the ${pos}.`,{ball:pos});
        down=1;toGo=Math.min(10,100-pos);
      }else if(down===4){
        add('turnover-on-downs',offense,`${teamMap[defense].name} takes over on downs.`,{ball:pos});
        return {result:'downs',nextBall:100-pos,plays:drivePlays,yards:driveYards};
      }else down++;
    }
    return {result:'drive-limit',nextBall:100-pos,plays:drivePlays,yards:driveYards};
  }
  function drive(team,ball,halfBoundary=null){
    teams[team].possessions++;clockRunning=false;
    for(const id of Object.keys(fatigue))if(players[id]?.teamId!==team)fatigue[id]=Math.max(0,fatigue[id]-5);
    const startingScore=score[team],id=++driveIndex,startClock=timeString(),startQuarter=whichQuarter();
    add('drive-start',team,`${teamMap[team].name} begins at its ${ball}.`,{driveId:id,ball});
    const result=consumeSeries(team,ball,halfBoundary);
    drives.push({id,teamId:team,quarter:startQuarter,startClock,startBall:ball,endClock:timeString(),
      result:result.result,plays:result.plays,yards:result.yards,points:score[team]-startingScore});
    return result;
  }
  const first=random()<.5?home.id:away.id,other=opponent(first);
  let current=first,ball=kickoff(first,'Opening kickoff.');
  // The half-ending possession is not allowed to continue through halftime.
  for(let half=0;half<2;half++){
    if(half===1){clockFloor=0;timeouts[home.id]=3;timeouts[away.id]=3;
      current=other;ball=kickoff(other,'Second-half kickoff.');}
    const boundary=half===0?1800:0;
    let guard=0;
    while(seconds>boundary&&guard++<90){
      const result=drive(current,ball,boundary);const next=opponent(current);
      if(seconds<=boundary)break;
      if(result.result==='touchdown'||result.result==='field-goal'||result.result==='safety')ball=kickoff(next);
      else ball=result.nextBall??35;
      current=next;
    }
    if(half===0)add('halftime',current,`Halftime: ${teamMap[away.id].name} ${score[away.id]}, ${teamMap[home.id].name} ${score[home.id]}.`);
  }
  let overtime=false;
  if(score[home.id]===score[away.id]){
    overtime=true;ot=true;
    add('overtime-start',first,'Overtime begins (NFL-style equal opportunity possessions).');
    current=random()<.5?home.id:away.id;
    ball=kickoff(current,'Overtime kickoff.');
    let possessionCount=0,guard=0;
    while(guard++<40){
      if(!postseason&&otSeconds<=0)break;
      const result=drive(current,ball);possessionCount++;
      const next=opponent(current);
      // Each club receives an initial possession. If still tied, the next score wins.
      if(possessionCount>=2&&score[home.id]!==score[away.id])break;
      if(possessionCount>2&&score[home.id]!==score[away.id])break;
      if(result.result==='touchdown'||result.result==='field-goal'||result.result==='safety')ball=kickoff(next);
      else ball=result.nextBall??35;
      current=next;
      if(postseason&&otSeconds<=0){otSeconds=900;add('overtime-period',current,'A new postseason overtime period begins.');}
    }
    if(postseason&&score[home.id]===score[away.id]){
      // Defensive backstop for freak sequences with repeated clock-expiry drives.
      const winner=random()<.5?home.id:away.id;
      point(winner,3,'field-goal',{description:`${teamMap[winner].name} wins in extended overtime on a field goal.`});
    }
  }
  for(const team of [home.id,away.id]){
    teams[team].totalYards=teams[team].passYards+teams[team].rushYards;
  }
  add('final',score[home.id]>=score[away.id]?home.id:away.id,
    `Final: ${teamMap[away.id].name} ${score[away.id]}, ${teamMap[home.id].name} ${score[home.id]}.`,
    {scoreHome:score[home.id],scoreAway:score[away.id]});
  return {scoreHome:score[home.id],scoreAway:score[away.id],overtime,
    boxScore:{teams,players,quarters:quarterScores},plays,drives,injuries,
    gameDay:{injuryCount:injuries.length,timeOutsUsed:{[home.id]:teams[home.id].timeoutsUsed,[away.id]:teams[away.id].timeoutsUsed},
      formations:plays.filter(p=>p.type==='formation').reduce((all,p)=>{all[p.offensePersonnel]=(all[p.offensePersonnel]||0)+1;return all;},{})}};
}
