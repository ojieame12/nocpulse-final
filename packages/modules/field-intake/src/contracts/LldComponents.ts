export type LldQuarter = "NE" | "NW" | "SE" | "SW";

export type LldMeridian = 1 | 2 | 3 | 4 | 5 | 6;

export type LldComponents = {
  quarter: LldQuarter;
  section: number;
  township: number;
  range: number;
  meridian: LldMeridian;
};

export type ParsedLldCode = {
  raw: string;
  normalized: string;
  components: LldComponents;
};
