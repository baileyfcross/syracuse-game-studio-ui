import { DIVISIONS } from '../config/nfl2026.js';
import { rng, randomInt } from './random.js';
// Original fictional team names. Real NFL team marks are not included.
const NAMES = {
  AFC: {
    East: [['Buffalo','Blizzards'], ['Miami','Sharks'], ['New York','Guardians'], ['New England','Sentinels']],
    North: [['Baltimore','Owls'], ['Cincinnati','Royals'], ['Cleveland','Forge'], ['Pittsburgh','Iron']],
    South: [['Houston','Mustangs'], ['Indianapolis','Racers'], ['Jacksonville','Tides'], ['Nashville','Copperheads']],
    West: [['Denver','Summit'], ['Kansas City','Thunder'], ['Las Vegas','Outlaws'], ['Los Angeles','Comets']]
  },
  NFC: {
    East: [['Dallas','Wranglers'], ['New York','Knights'], ['Philadelphia','Liberty'], ['Washington','Federals']],
    North: [['Chicago','Grizzlies'], ['Detroit','Engines'], ['Green Bay','Lumberjacks'], ['Minnesota','Voyagers']],
    South: [['Atlanta','Firebirds'], ['Charlotte','Prowlers'], ['New Orleans','Jazz'], ['Tampa Bay','Corsairs']],
    West: [['Arizona','Scorpions'], ['Los Angeles','Stars'], ['San Francisco','Gold'], ['Seattle','Evergreens']]
  }
};
const COLORS = ['#3b82f6','#f97316','#a78bfa','#14b8a6','#ec4899','#f59e0b','#60a5fa','#22c55e'];
export function createTeams(seed=2026) {
  const random = rng(seed);
  const teams = [];
  for (const conference of ['AFC','NFC']) for (const [divIdx, division] of DIVISIONS.entries()) {
    NAMES[conference][division].forEach(([city,nickname],slot) => {
      const number = teams.length;
      teams.push({ id: `T${String(number+1).padStart(2,'0')}`, name: `${city} ${nickname}`, city, nickname,
        conference, division, slot, color: COLORS[(number+divIdx)%COLORS.length],
        baseOffense: randomInt(random,65,89), baseDefense:randomInt(random,65,89),
        wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0,
        capCarryover: 0, deadCap: 0, roster:[], coach: {name:`Coach ${nickname}`, rating:randomInt(random,60,92)} });
    });
  }
  return teams;
}
