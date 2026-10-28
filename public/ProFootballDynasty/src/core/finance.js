import { NFL_2026 } from '../config/nfl2026.js';

/** Money is stored as integer USD. Future cap figures are gameplay projections, not official NFL caps. */
const money=(amount,label='Amount')=>{
  if(!Number.isSafeInteger(amount)||amount<0)throw Error(`${label} must be a nonnegative whole-dollar amount`);
  return amount;
};
const yearKey=year=>String(year);
export function annualBase(contract,year){
  if(!contract||year<contract.startYear||year>contract.expiresYear)return 0;
  return contract.salaries?.[yearKey(year)]??contract.baseSalary??0;
}
export function guaranteedBase(contract,year){
  if(!contract)return 0;
  return contract.guarantees?.[yearKey(year)]??(year===contract.startYear?(contract.guaranteedSalary||0):0);
}
export function bonusCharge(contract,year){
  if(!contract)return 0;
  if(contract.bonusSchedule)return contract.bonusSchedule[yearKey(year)]||0;
  const n=Math.min(contract.years||1,NFL_2026.maxSigningBonusProrationYears);
  if(year<contract.startYear||year>=contract.startYear+n)return 0;
  const base=Math.floor((contract.signingBonus||0)/n);
  return base+(year===contract.startYear+n-1?(contract.signingBonus||0)-base*n:0);
}
function proratedBonus(amount,fromYear,throughYear){
  const years=throughYear-fromYear+1,base=Math.floor(amount/years),result={};
  for(let i=0;i<years;i++)result[fromYear+i]=base+(i===years-1?amount-base*years:0);
  return result;
}
export function playerCapHit(player,year){
  const c=player.contract;
  if(!c)return 0;
  return annualBase(c,year)+bonusCharge(c,year)+(c.rosterBonuses?.[yearKey(year)]||0);
}
export function scheduledDeadCap(team,year){
  return team.deadCapByYear?.[yearKey(year)]??(team.financialYear===year?(team.deadCap||0):0);
}
export function capUsed(team,year){
  return scheduledDeadCap(team,year)+[...(team.roster||[]),...(team.injuredReserve||[]),...(team.practiceSquad||[])]
    .reduce((sum,p)=>sum+playerCapHit(p,year),0);
}
export function capLimit(team,base=NFL_2026.salaryCap){return base+(team.capCarryover||0);}
export function capSpace(team,year,base=NFL_2026.salaryCap){return capLimit(team,base)-capUsed(team,year);}
export function capProjection(team,year,base=NFL_2026.salaryCap){
  return Array.from({length:4},(_,i)=>{
    const y=year+i,projectedCap=i?Math.round(NFL_2026.salaryCap*Math.pow(1.04,y-2026)):base;
    return {year:y,limit:capLimit(team,projectedCap),used:capUsed(team,y),deadCap:scheduledDeadCap(team,y),space:capSpace(team,y,projectedCap)};
  });
}
export function initializeFinance(team,year){
  team.financialYear??=year;
  team.deadCapByYear??={[yearKey(team.financialYear)]:team.deadCap||0};
  team.deadCap=scheduledDeadCap(team,year);
  team.capCarryover??=0;
  team.practiceSquad??=[];team.injuredReserve??=[];
  team.elevatedPlayerIds??=[];
  return team;
}
function addDead(team,year,amount){
  if(!amount)return;
  initializeFinance(team,team.financialYear??year);
  team.deadCapByYear[yearKey(year)]=(team.deadCapByYear[yearKey(year)]||0)+amount;
  if(team.financialYear===year)team.deadCap=team.deadCapByYear[yearKey(year)];
}
export function makeContract(year,{salary,years=2,signingBonus=0,guaranteedSalary=0,annualSalaries=null,guarantees=null,voidYears=0}={}){
  money(salary,'Salary');money(signingBonus,'Signing bonus');money(guaranteedSalary,'Guaranteed salary');
  if(!Number.isInteger(years)||years<1||years>7)throw Error('Contract years must be between 1 and 7');
  if(!Number.isInteger(voidYears)||voidYears<0||voidYears>2)throw Error('Void years must be 0 to 2');
  if(voidYears&&years+voidYears>5)throw Error('Total bonus proration cannot exceed 5 years with void years');
  if(annualSalaries && (annualSalaries.length!==years||annualSalaries.some(v=>!Number.isSafeInteger(v)||v<0)))throw Error('Invalid yearly salary schedule');
  if(guarantees && (guarantees.length!==years||guarantees.some(v=>!Number.isSafeInteger(v)||v<0)))throw Error('Invalid yearly guarantee schedule');
  const salaries={},salaryGuarantees={};
  for(let i=0;i<years;i++){
    salaries[year+i]=annualSalaries?.[i]??salary;
    salaryGuarantees[year+i]=guarantees?.[i]??(i===0?guaranteedSalary:0);
    if(salaryGuarantees[year+i]>salaries[year+i])throw Error('Guarantee exceeds base salary');
  }
  const n=Math.min(years+voidYears,NFL_2026.maxSigningBonusProrationYears);
  return {startYear:year,expiresYear:year+years-1,years,baseSalary:salary,signingBonus,
    guaranteedSalary,voidYears,salaries,guarantees:salaryGuarantees,
    bonusSchedule:proratedBonus(signingBonus,year,year+n-1)};
}
export function signPlayer(team,player,year,{salary,years=2,signingBonus=0,guaranteedSalary=0,annualSalaries,guarantees,voidYears=0,baseCap=NFL_2026.salaryCap,rosterLimit=NFL_2026.activeRosterLimit}={}){
  if(!Number.isInteger(rosterLimit)||rosterLimit<1||rosterLimit>90)throw Error('Invalid roster limit');
  if(team.roster.length>=rosterLimit)throw Error(`${rosterLimit}-man roster limit reached`);
  if(team.roster.some(p=>p.id===player.id)||team.injuredReserve?.some(p=>p.id===player.id)||team.practiceSquad?.some(p=>p.id===player.id))throw Error('Player already on team');
  const c=makeContract(year,{salary,years,signingBonus,guaranteedSalary,annualSalaries,guarantees,voidYears});
  const copy=structuredClone(player);copy.contract=c;
  if(capSpace(team,year,baseCap)<playerCapHit(copy,year))throw Error('Not enough current-year salary cap room');
  team.roster.push(copy);return copy;
}
/** Release/trade accelerates the remaining unpaid bonus charges. June 1 defers *future* bonus proration one season. */
export function terminationCharges(contract,year,{june1=false,includeGuarantees=true}={}){
  if(!contract)return {current:0,future:0};
  const final=Math.max(contract.expiresYear,contract.startYear+(contract.voidYears||0)+(contract.years||1)-1);
  let current=0,future=0;
  for(let y=year;y<=final;y++){
    const bonus=bonusCharge(contract,y);
    const guarantee=includeGuarantees?guaranteedBase(contract,y):0;
    if(june1&&y>year)future+=bonus+guarantee;
    else current+=bonus+guarantee;
  }
  return {current,future};
}
export function releasePlayer(team,playerId,year,{june1=false,transfer=false}={}){
  const index=team.roster.findIndex(p=>p.id===playerId);
  if(index<0)throw Error('Player not found on active roster');
  const player=team.roster[index], charges=terminationCharges(player.contract,year,{june1});
  team.roster.splice(index,1);
  addDead(team,year,charges.current);
  if(charges.future)addDead(team,year+1,charges.future);
  const returned=structuredClone(player);returned.contract=null;
  return returned;
}
/** Acquiring teams inherit future base guarantees, not the seller's signing bonus. Fully atomic if cap/roster rules reject. */
export function tradePlayer(from,to,playerId,year,baseCap=NFL_2026.salaryCap,rosterLimit=NFL_2026.activeRosterLimit){
  if(to.roster.length>=rosterLimit)throw Error('Receiving team is at 53 players');
  const p=from.roster.find(x=>x.id===playerId);
  if(!p)throw Error('Player not found');
  const incoming=structuredClone(p);
  if(incoming.contract){incoming.contract.signingBonus=0;incoming.contract.bonusSchedule={};}
  if(capSpace(to,year,baseCap)<playerCapHit(incoming,year))throw Error('Receiving team lacks cap space');
  releasePlayer(from,playerId,year,{transfer:true});
  to.roster.push(incoming);
  return incoming;
}
export function restructurePlayer(team,playerId,year,amount,baseCap=NFL_2026.salaryCap){
  const p=team.roster.find(x=>x.id===playerId);
  if(!p?.contract)throw Error('Contracted active player not found');
  money(amount,'Conversion');if(!amount)throw Error('Conversion must be positive');
  const c=structuredClone(p.contract),current=annualBase(c,year);
  if(amount>current-900_000)throw Error('Conversion would reduce salary below the prototype minimum');
  c.salaries??=Object.fromEntries(Array.from({length:c.years},(_,i)=>[c.startYear+i,c.baseSalary]));
  c.bonusSchedule??=Object.fromEntries(Array.from({length:c.years},(_,i)=>[c.startYear+i,bonusCharge(c,c.startYear+i)]));
  c.salaries[year]-=amount;
  c.baseSalary=c.salaries[year];
  const end=Math.min(year+4,c.expiresYear+(c.voidYears||0));
  for(const [y,charge] of Object.entries(proratedBonus(amount,year,end)))c.bonusSchedule[y]=(c.bonusSchedule[y]||0)+charge;
  c.signingBonus+=amount;
  const original=p.contract;p.contract=c;
  if(capSpace(team,year,baseCap)<0){p.contract=original;throw Error('Restructure exceeds salary cap');}
  return c;
}
export function extendPlayer(team,playerId,year,{salary,years=2,signingBonus=0,guaranteedSalary=0,baseCap=NFL_2026.salaryCap}={}){
  const p=team.roster.find(x=>x.id===playerId);
  if(!p?.contract)throw Error('Player not under contract');
  const old=p.contract;
  if(year>old.expiresYear)throw Error('Player contract already expired');
  const end=old.expiresYear+years;
  if(!Number.isInteger(years)||years<1||years>4||end-year>7)throw Error('Invalid extension length');
  const fresh=makeContract(old.expiresYear+1,{salary,years,signingBonus:0,guaranteedSalary});
  const next=structuredClone(old);
  next.salaries??=Object.fromEntries(Array.from({length:old.years},(_,i)=>[old.startYear+i,old.baseSalary]));
  next.guarantees??={};
  next.bonusSchedule??=Object.fromEntries(Array.from({length:old.years},(_,i)=>[old.startYear+i,bonusCharge(old,old.startYear+i)]));
  Object.assign(next.salaries,fresh.salaries);Object.assign(next.guarantees,fresh.guarantees);
  next.expiresYear=end;next.years=end-old.startYear+1;
  const proration=proratedBonus(money(signingBonus,'Signing bonus'),year,Math.min(year+4,end));
  for(const [y,v] of Object.entries(proration))next.bonusSchedule[y]=(next.bonusSchedule[y]||0)+v;
  next.signingBonus=(old.signingBonus||0)+signingBonus;
  p.contract=next;
  if(capSpace(team,year,baseCap)<0){p.contract=old;throw Error('Extension exceeds salary cap');}
  return next;
}
export function finalizeContractYear(team,newYear){
  initializeFinance(team,team.financialYear??newYear-1);
  // Carry over *unused* cap only, never a negative balance.
  const oldYear=newYear-1;
  const projectedOldCap= Math.round(NFL_2026.salaryCap*Math.pow(1.04,oldYear-2026));
  const unused=capSpace(team,oldYear,projectedOldCap);
  team.capCarryover=Math.min(50_000_000,Math.max(0,unused)); // Gameplay cap, NOT NFL formal limit.
  team.financialYear=newYear;
  team.deadCap=scheduledDeadCap(team,newYear);
}
