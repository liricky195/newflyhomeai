/**
 * IATA airport code → IANA timezone identifier.
 * Used to display departure/arrival times in the airport's local time
 * rather than the user's browser timezone.
 *
 * Covers all Gulf airports (the primary stranded-airport market) plus
 * several hundred major airports worldwide for destination display.
 * Falls back to "UTC" for any unknown IATA code.
 */
const AIRPORT_TIMEZONE: Record<string, string> = {
  // ── Gulf / Arabian Peninsula ─────────────────────────────────────────────
  DXB: "Asia/Dubai",   AUH: "Asia/Dubai",   SHJ: "Asia/Dubai",
  RKT: "Asia/Dubai",   AAN: "Asia/Dubai",   DWC: "Asia/Dubai",
  MCT: "Asia/Muscat",  SLL: "Asia/Muscat",  SHO: "Asia/Muscat",
  DOH: "Asia/Qatar",   RUH: "Asia/Riyadh",  JED: "Asia/Riyadh",
  DMM: "Asia/Riyadh",  MED: "Asia/Riyadh",  YNB: "Asia/Riyadh",
  BAH: "Asia/Bahrain", KWI: "Asia/Kuwait",
  ABU: "Asia/Riyadh",  TIF: "Asia/Riyadh",  AJF: "Asia/Riyadh",

  // ── Levant / Iran / Iraq ────────────────────────────────────────────────
  THR: "Asia/Tehran",  IKA: "Asia/Tehran",  MHD: "Asia/Tehran",
  BGW: "Asia/Baghdad", BSR: "Asia/Baghdad", NJF: "Asia/Baghdad",
  EBL: "Asia/Baghdad", AMM: "Asia/Amman",   AQJ: "Asia/Amman",
  BEY: "Asia/Beirut",  DAM: "Asia/Damascus",

  // ── East Africa / Indian Ocean ────────────────────────────────────────
  CAI: "Africa/Cairo",         HRG: "Africa/Cairo",
  SSH: "Africa/Cairo",         LXR: "Africa/Cairo",
  NBO: "Africa/Nairobi",       MBA: "Africa/Nairobi",
  ADD: "Africa/Addis_Ababa",   DAR: "Africa/Dar_es_Salaam",
  KGL: "Africa/Kigali",        EBB: "Africa/Kampala",
  KRT: "Africa/Khartoum",      JIB: "Africa/Djibouti",
  MRU: "Indian/Mauritius",     RUN: "Indian/Reunion",
  SEZ: "Indian/Mahe",          TNR: "Indian/Antananarivo",
  MLE: "Indian/Maldives",

  // ── South Asia ─────────────────────────────────────────────────────────
  CMB: "Asia/Colombo",
  DEL: "Asia/Kolkata",  BOM: "Asia/Kolkata",  MAA: "Asia/Kolkata",
  BLR: "Asia/Kolkata",  CCU: "Asia/Kolkata",  HYD: "Asia/Kolkata",
  AMD: "Asia/Kolkata",  COK: "Asia/Kolkata",  PNQ: "Asia/Kolkata",
  GOI: "Asia/Kolkata",  JAI: "Asia/Kolkata",  NAG: "Asia/Kolkata",
  LKO: "Asia/Kolkata",  PAT: "Asia/Kolkata",  GAU: "Asia/Kolkata",
  IXC: "Asia/Kolkata",  VNS: "Asia/Kolkata",  IXR: "Asia/Kolkata",
  KTM: "Asia/Kathmandu",
  DAC: "Asia/Dhaka",    CGP: "Asia/Dhaka",
  KHI: "Asia/Karachi",  LHE: "Asia/Karachi",  ISB: "Asia/Karachi",
  PEW: "Asia/Karachi",  SKT: "Asia/Karachi",

  // ── Southeast Asia ─────────────────────────────────────────────────────
  SIN: "Asia/Singapore",
  KUL: "Asia/Kuala_Lumpur",   PEN: "Asia/Kuching",
  BKI: "Asia/Kuching",        KCH: "Asia/Kuching",
  BKK: "Asia/Bangkok",        DMK: "Asia/Bangkok",
  HKT: "Asia/Bangkok",        CNX: "Asia/Bangkok",
  SGN: "Asia/Ho_Chi_Minh",    HAN: "Asia/Ho_Chi_Minh",
  DAD: "Asia/Ho_Chi_Minh",
  PNH: "Asia/Phnom_Penh",     REP: "Asia/Phnom_Penh",
  VTE: "Asia/Vientiane",
  RGN: "Asia/Rangoon",        MDL: "Asia/Rangoon",
  CGK: "Asia/Jakarta",        SUB: "Asia/Jakarta",
  DPS: "Asia/Makassar",       UPG: "Asia/Makassar",
  MNL: "Asia/Manila",         CEB: "Asia/Manila",
  DVO: "Asia/Manila",
  ULN: "Asia/Ulaanbaatar",

  // ── East Asia ──────────────────────────────────────────────────────────
  HKG: "Asia/Hong_Kong",      MFM: "Asia/Macau",
  PVG: "Asia/Shanghai",       SHA: "Asia/Shanghai",
  PEK: "Asia/Shanghai",       PKX: "Asia/Shanghai",
  CAN: "Asia/Shanghai",       CTU: "Asia/Shanghai",
  KMG: "Asia/Shanghai",       SZX: "Asia/Shanghai",
  HGH: "Asia/Shanghai",       XIY: "Asia/Shanghai",
  WUH: "Asia/Shanghai",       CSX: "Asia/Shanghai",
  CKG: "Asia/Shanghai",       NKG: "Asia/Shanghai",
  HAK: "Asia/Shanghai",       TNA: "Asia/Shanghai",
  TSN: "Asia/Shanghai",       TAO: "Asia/Shanghai",
  SHE: "Asia/Shanghai",       CGO: "Asia/Shanghai",
  XMN: "Asia/Shanghai",       FOC: "Asia/Shanghai",
  URC: "Asia/Urumqi",
  NRT: "Asia/Tokyo",          HND: "Asia/Tokyo",
  KIX: "Asia/Tokyo",          NGO: "Asia/Tokyo",
  FUK: "Asia/Tokyo",          CTS: "Asia/Tokyo",
  OKA: "Asia/Tokyo",          ITM: "Asia/Tokyo",
  ICN: "Asia/Seoul",          GMP: "Asia/Seoul",
  PUS: "Asia/Seoul",          CJU: "Asia/Seoul",
  TPE: "Asia/Taipei",         TSA: "Asia/Taipei",
  KHH: "Asia/Taipei",

  // ── Central Asia ───────────────────────────────────────────────────────
  ALA: "Asia/Almaty",         NQZ: "Asia/Almaty",
  TAS: "Asia/Tashkent",       SKD: "Asia/Tashkent",
  FRU: "Asia/Bishkek",        ASB: "Asia/Ashgabat",
  GYD: "Asia/Baku",           TBS: "Asia/Tbilisi",
  EVN: "Asia/Yerevan",

  // ── Western Europe ────────────────────────────────────────────────────
  LHR: "Europe/London",  LGW: "Europe/London",
  STN: "Europe/London",  LTN: "Europe/London",
  MAN: "Europe/London",  BHX: "Europe/London",
  EDI: "Europe/London",  GLA: "Europe/London",
  BRS: "Europe/London",  NCL: "Europe/London",
  LBA: "Europe/London",  ABZ: "Europe/London",
  BFS: "Europe/London",
  DUB: "Europe/Dublin",  ORK: "Europe/Dublin",  SNN: "Europe/Dublin",
  CDG: "Europe/Paris",   ORY: "Europe/Paris",
  LYS: "Europe/Paris",   MRS: "Europe/Paris",
  NCE: "Europe/Paris",   TLS: "Europe/Paris",
  BOD: "Europe/Paris",   NTE: "Europe/Paris",
  BVA: "Europe/Paris",
  AMS: "Europe/Amsterdam",    EIN: "Europe/Amsterdam",
  FRA: "Europe/Berlin",  MUC: "Europe/Berlin",
  BER: "Europe/Berlin",  DUS: "Europe/Berlin",
  HAM: "Europe/Berlin",  STR: "Europe/Berlin",
  CGN: "Europe/Berlin",  NUE: "Europe/Berlin",
  HAJ: "Europe/Berlin",  BRE: "Europe/Berlin",
  MAD: "Europe/Madrid",  BCN: "Europe/Madrid",
  AGP: "Europe/Madrid",  PMI: "Europe/Madrid",
  ALC: "Europe/Madrid",  VLC: "Europe/Madrid",
  SVQ: "Europe/Madrid",  BIO: "Europe/Madrid",
  FCO: "Europe/Rome",    MXP: "Europe/Rome",
  LIN: "Europe/Rome",    BGY: "Europe/Rome",
  VCE: "Europe/Rome",    NAP: "Europe/Rome",
  CTA: "Europe/Rome",    PSA: "Europe/Rome",
  BLQ: "Europe/Rome",    CIA: "Europe/Rome",
  ZRH: "Europe/Zurich",  GVA: "Europe/Zurich",
  VIE: "Europe/Vienna",  LNZ: "Europe/Vienna",
  BRU: "Europe/Brussels",     CRL: "Europe/Brussels",
  LIS: "Europe/Lisbon",  OPO: "Europe/Lisbon",  FAO: "Europe/Lisbon",
  CPH: "Europe/Copenhagen",   BLL: "Europe/Copenhagen",
  ARN: "Europe/Stockholm",    GOT: "Europe/Stockholm",
  OSL: "Europe/Oslo",    BGO: "Europe/Oslo",    SVG: "Europe/Oslo",
  HEL: "Europe/Helsinki",     TMP: "Europe/Helsinki",
  WAW: "Europe/Warsaw",  KRK: "Europe/Warsaw",
  ATH: "Europe/Athens",  SKG: "Europe/Athens",  HER: "Europe/Athens",
  IST: "Europe/Istanbul",     SAW: "Europe/Istanbul",
  ESB: "Europe/Istanbul",     AYT: "Europe/Istanbul",
  DLM: "Europe/Istanbul",     ADB: "Europe/Istanbul",
  BUD: "Europe/Budapest",     PRG: "Europe/Prague",
  LJU: "Europe/Ljubljana",    ZAG: "Europe/Zagreb",
  BEG: "Europe/Belgrade",
  OTP: "Europe/Bucharest",    CLJ: "Europe/Bucharest",
  SOF: "Europe/Sofia",
  VNO: "Europe/Vilnius",      RIX: "Europe/Riga",
  TLL: "Europe/Tallinn",

  // ── Russia ────────────────────────────────────────────────────────────
  SVO: "Europe/Moscow",  DME: "Europe/Moscow",
  VKO: "Europe/Moscow",  LED: "Europe/Moscow",
  SVX: "Asia/Yekaterinburg",  OVB: "Asia/Novosibirsk",
  IKT: "Asia/Irkutsk",        KHV: "Asia/Vladivostok",
  VVO: "Asia/Vladivostok",

  // ── North America — Eastern ────────────────────────────────────────────
  JFK: "America/New_York",    LGA: "America/New_York",
  EWR: "America/New_York",    BOS: "America/New_York",
  PHL: "America/New_York",    DCA: "America/New_York",
  IAD: "America/New_York",    BWI: "America/New_York",
  CLT: "America/New_York",    MCO: "America/New_York",
  MIA: "America/New_York",    FLL: "America/New_York",
  TPA: "America/New_York",    RSW: "America/New_York",
  JAX: "America/New_York",    RDU: "America/New_York",
  CLE: "America/New_York",    PIT: "America/New_York",
  CMH: "America/New_York",    CVG: "America/New_York",
  DTW: "America/Detroit",     BUF: "America/New_York",
  ROC: "America/New_York",    SYR: "America/New_York",
  PVD: "America/New_York",
  // ── North America — Central ────────────────────────────────────────────
  ORD: "America/Chicago",     MDW: "America/Chicago",
  MSY: "America/Chicago",     STL: "America/Chicago",
  MKE: "America/Chicago",     BNA: "America/Chicago",
  MEM: "America/Chicago",     MSP: "America/Chicago",
  MCI: "America/Chicago",     OMA: "America/Chicago",
  DSM: "America/Chicago",     IND: "America/Indiana/Indianapolis",
  DFW: "America/Chicago",     DAL: "America/Chicago",
  HOU: "America/Chicago",     IAH: "America/Chicago",
  SAT: "America/Chicago",     AUS: "America/Chicago",
  TUL: "America/Chicago",     OKC: "America/Chicago",
  // ── North America — Mountain ───────────────────────────────────────────
  DEN: "America/Denver",      SLC: "America/Denver",
  ABQ: "America/Denver",      ELP: "America/Denver",
  BOI: "America/Boise",
  PHX: "America/Phoenix",     TUS: "America/Phoenix",
  // ── North America — Pacific ────────────────────────────────────────────
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles",
  SJC: "America/Los_Angeles", OAK: "America/Los_Angeles",
  SEA: "America/Los_Angeles", PDX: "America/Los_Angeles",
  LAS: "America/Los_Angeles", RNO: "America/Los_Angeles",
  SAN: "America/Los_Angeles", SMF: "America/Los_Angeles",
  GEG: "America/Los_Angeles",
  HNL: "Pacific/Honolulu",    OGG: "Pacific/Honolulu",
  KOA: "Pacific/Honolulu",    ITO: "Pacific/Honolulu",
  ANC: "America/Anchorage",

  // ── Canada ────────────────────────────────────────────────────────────
  YYZ: "America/Toronto",     YOW: "America/Toronto",
  YUL: "America/Toronto",     YQB: "America/Toronto",
  YHZ: "America/Halifax",
  YVR: "America/Vancouver",   YYJ: "America/Vancouver",
  YYC: "America/Edmonton",    YEG: "America/Edmonton",
  YWG: "America/Winnipeg",

  // ── Latin America ─────────────────────────────────────────────────────
  GRU: "America/Sao_Paulo",   GIG: "America/Sao_Paulo",
  VCP: "America/Sao_Paulo",   CGH: "America/Sao_Paulo",
  SDU: "America/Sao_Paulo",   CNF: "America/Sao_Paulo",
  BSB: "America/Sao_Paulo",   POA: "America/Sao_Paulo",
  CWB: "America/Sao_Paulo",   SSA: "America/Bahia",
  REC: "America/Recife",      FOR: "America/Fortaleza",
  EZE: "America/Argentina/Buenos_Aires",
  AEP: "America/Argentina/Buenos_Aires",
  SCL: "America/Santiago",
  BOG: "America/Bogota",      MDE: "America/Bogota",
  LIM: "America/Lima",        UIO: "America/Guayaquil",
  CCS: "America/Caracas",
  MEX: "America/Mexico_City", MTY: "America/Monterrey",
  GDL: "America/Mexico_City", CUN: "America/Cancun",
  SJO: "America/Costa_Rica",  GUA: "America/Guatemala",
  HAV: "America/Havana",      KIN: "America/Jamaica",
  SJU: "America/Puerto_Rico", SDQ: "America/Santo_Domingo",
  NAS: "America/Nassau",

  // ── West / Central Africa ─────────────────────────────────────────────
  LOS: "Africa/Lagos",        ABV: "Africa/Lagos",
  ACC: "Africa/Accra",        ABJ: "Africa/Abidjan",
  DKR: "Africa/Dakar",        BKO: "Africa/Bamako",
  OUA: "Africa/Ouagadougou",  NIM: "Africa/Niamey",
  NDJ: "Africa/Ndjamena",     LBV: "Africa/Libreville",
  DLA: "Africa/Douala",       YAO: "Africa/Douala",
  BZV: "Africa/Brazzaville",  FIH: "Africa/Kinshasa",
  FBM: "Africa/Lubumbashi",   BGF: "Africa/Bangui",

  // ── Southern Africa ───────────────────────────────────────────────────
  JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg",
  DUR: "Africa/Johannesburg", PLZ: "Africa/Johannesburg",
  LUN: "Africa/Lusaka",       HRE: "Africa/Harare",
  GBE: "Africa/Gaborone",     WDH: "Africa/Windhoek",

  // ── North Africa ──────────────────────────────────────────────────────
  TUN: "Africa/Tunis",        ALG: "Africa/Algiers",
  CMN: "Africa/Casablanca",   RAK: "Africa/Casablanca",
  TNG: "Africa/Casablanca",   TIP: "Africa/Tripoli",

  // ── Australia & Pacific ───────────────────────────────────────────────
  SYD: "Australia/Sydney",    MEL: "Australia/Melbourne",
  BNE: "Australia/Brisbane",  PER: "Australia/Perth",
  ADL: "Australia/Adelaide",  DRW: "Australia/Darwin",
  CBR: "Australia/Sydney",    HBA: "Australia/Hobart",
  CNS: "Australia/Brisbane",  OOL: "Australia/Brisbane",
  AKL: "Pacific/Auckland",    WLG: "Pacific/Auckland",
  CHC: "Pacific/Auckland",    ZQN: "Pacific/Auckland",
  NAN: "Pacific/Fiji",        GUM: "Pacific/Guam",
  PPT: "Pacific/Tahiti",
};

/** Returns the IANA timezone for a given IATA airport code, or "UTC" if unknown. */
export function getAirportTimezone(iata: string): string {
  return AIRPORT_TIMEZONE[iata.toUpperCase()] ?? "UTC";
}

/**
 * Returns the airport's current GMT offset label, e.g. "GMT+4" or "GMT+5:30".
 * Computed via Intl so DST is respected automatically.
 */
export function gmtOffsetLabelForAirport(iata: string): string {
  const tz = getAirportTimezone(iata);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    // Normalise "UTC" → "GMT", strip trailing ":00" → "GMT+4" not "GMT+4:00"
    return raw.replace(/^UTC/, "GMT").replace(/:00$/, "");
  } catch {
    return "UTC";
  }
}

/**
 * Formats a Unix-second timestamp in a given airport's local timezone.
 * Accepts standard Intl.DateTimeFormatOptions.
 */
export function formatInAirportTz(
  unixSeconds: number,
  iata: string,
  options: Intl.DateTimeFormatOptions
): string {
  const tz = getAirportTimezone(iata);
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz }).format(
    new Date(unixSeconds * 1000)
  );
}

/**
 * Extracts the HH:mm portion from a Duffel ISO 8601 datetime string.
 *
 * Duffel returns times as local airport time with a UTC offset, e.g.
 * "2024-12-15T10:30:00+04:00". Parsing with `new Date()` gives the correct
 * UTC instant, but displaying with `toLocaleTimeString()` re-converts to the
 * user's browser timezone. Instead we extract the local portion directly from
 * the string — it is already in the airport's local time.
 */
export function isoToLocalHHMM(isoString: string): string {
  const m = isoString.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : isoString;
}
