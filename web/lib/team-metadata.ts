export type TeamMetadata = {
  code: string;
  name: string;
  flagCode: string;
};

const TEAM_METADATA: Record<string, TeamMetadata> = {
  ALG: { code: "ALG", name: "Algeria", flagCode: "dz" },
  ARG: { code: "ARG", name: "Argentina", flagCode: "ar" },
  AUS: { code: "AUS", name: "Australia", flagCode: "au" },
  AUT: { code: "AUT", name: "Austria", flagCode: "at" },
  BEL: { code: "BEL", name: "Belgium", flagCode: "be" },
  BIH: { code: "BIH", name: "Bosnia and Herzegovina", flagCode: "ba" },
  BRA: { code: "BRA", name: "Brazil", flagCode: "br" },
  CAN: { code: "CAN", name: "Canada", flagCode: "ca" },
  CIV: { code: "CIV", name: "Ivory Coast", flagCode: "ci" },
  COD: { code: "COD", name: "DR Congo", flagCode: "cd" },
  COL: { code: "COL", name: "Colombia", flagCode: "co" },
  CPV: { code: "CPV", name: "Cape Verde", flagCode: "cv" },
  CRO: { code: "CRO", name: "Croatia", flagCode: "hr" },
  CUR: { code: "CUR", name: "Curacao", flagCode: "cw" },
  CZE: { code: "CZE", name: "Czech Republic", flagCode: "cz" },
  ECU: { code: "ECU", name: "Ecuador", flagCode: "ec" },
  EGY: { code: "EGY", name: "Egypt", flagCode: "eg" },
  ENG: { code: "ENG", name: "England", flagCode: "gb-eng" },
  ESP: { code: "ESP", name: "Spain", flagCode: "es" },
  FRA: { code: "FRA", name: "France", flagCode: "fr" },
  GER: { code: "GER", name: "Germany", flagCode: "de" },
  GHA: { code: "GHA", name: "Ghana", flagCode: "gh" },
  HAI: { code: "HAI", name: "Haiti", flagCode: "ht" },
  IRN: { code: "IRN", name: "Iran", flagCode: "ir" },
  IRQ: { code: "IRQ", name: "Iraq", flagCode: "iq" },
  JOR: { code: "JOR", name: "Jordan", flagCode: "jo" },
  JPN: { code: "JPN", name: "Japan", flagCode: "jp" },
  KOR: { code: "KOR", name: "South Korea", flagCode: "kr" },
  KSA: { code: "KSA", name: "Saudi Arabia", flagCode: "sa" },
  MAR: { code: "MAR", name: "Morocco", flagCode: "ma" },
  MEX: { code: "MEX", name: "Mexico", flagCode: "mx" },
  NED: { code: "NED", name: "Netherlands", flagCode: "nl" },
  NOR: { code: "NOR", name: "Norway", flagCode: "no" },
  NZL: { code: "NZL", name: "New Zealand", flagCode: "nz" },
  PAN: { code: "PAN", name: "Panama", flagCode: "pa" },
  PAR: { code: "PAR", name: "Paraguay", flagCode: "py" },
  POR: { code: "POR", name: "Portugal", flagCode: "pt" },
  QAT: { code: "QAT", name: "Qatar", flagCode: "qa" },
  RSA: { code: "RSA", name: "South Africa", flagCode: "za" },
  SCO: { code: "SCO", name: "Scotland", flagCode: "gb-sct" },
  SEN: { code: "SEN", name: "Senegal", flagCode: "sn" },
  SUI: { code: "SUI", name: "Switzerland", flagCode: "ch" },
  SWE: { code: "SWE", name: "Sweden", flagCode: "se" },
  TUN: { code: "TUN", name: "Tunisia", flagCode: "tn" },
  TUR: { code: "TUR", name: "Turkey", flagCode: "tr" },
  URU: { code: "URU", name: "Uruguay", flagCode: "uy" },
  USA: { code: "USA", name: "United States", flagCode: "us" },
  UZB: { code: "UZB", name: "Uzbekistan", flagCode: "uz" },
};

export function getTeamMetadata(teamCode: string) {
  return TEAM_METADATA[teamCode] ?? {
    code: teamCode,
    name: teamCode,
    flagCode: "un",
  };
}

export function getFlagUrl(teamCode: string) {
  const { flagCode } = getTeamMetadata(teamCode);
  return `https://flagcdn.com/${flagCode}.svg`;
}
