/** 2026 rules preset. Advanced NFL business rules remain separately tracked as TODOs. */
export const NFL_2026 = Object.freeze({
  id: 'nfl-2026', season: 2026,
  conferences: ['AFC', 'NFC'], divisions: ['East', 'North', 'South', 'West'],
  teamsPerDivision: 4, teams: 32,
  regularSeasonGames: 17, weeks: 18, preseasonGames: 3,
  trainingCampRosterLimit: 90, trainingCampSessions: 2,
  // Calendar dates are season-specific; the 2026 cutdown deadline is Aug 30 at 6 p.m. ET.
  cutdown2026: '2026-08-30T18:00:00-04:00',
  playoffTeamsPerConference: 7, divisionChampionsPerConference: 4,
  divisionGames: 6, sameConferenceRotationGames: 4,
  crossConferenceRotationGames: 4, standingsPlacementGames: 2,
  extraInterconferenceGames: 1,
  draftRounds: 7, basePicksPerRound: 32,
  activeRosterLimit: 53, gameDayActivesWithEightOL: 48,
  gameDayActivesOtherwise: 47, minOLFor48: 8,
  practiceSquadLimit: 16, practiceSquadLimitInternationalPathway: 17,
  salaryCap: 301_200_000,
  quarters: 4, quarterMinutes: 15,
  regulationMinutes: 60, regularSeasonOvertimeMinutes: 10,
  postseasonOvertimePeriodMinutes: 15,
  possessionsGuaranteedInOvertime: 1,
  firstRoundRookieContractYears: 4, draftRound2To7ContractYears: 4,
  undraftedRookieContractYears: 3, firstRoundFifthYearOption: true,
  maxSigningBonusProrationYears: 5,
  sources: {
    rulebook: 'https://operations.nfl.com/rules-officiating/2026-nfl-rulebook',
    schedule: 'https://operations.nfl.com/calendar-events/nfl-schedule/making-the-schedule',
    salaryCap: 'https://operations.nfl.com/calendar-events/nfl-free-agency/nfl-salary-cap',
    draft: 'https://operations.nfl.com/calendar-events/nfl-draft/nfl-draft-rules',
    contracts: 'https://operations.nfl.com/calendar-events/nfl-free-agency/contract-language',
    tiebreakers: 'https://www.nfl.com/standings/tie-breaking-procedures'
  }
});
export const DIVISIONS = ['East', 'North', 'South', 'West'];
