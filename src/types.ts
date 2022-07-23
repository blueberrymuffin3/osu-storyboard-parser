export interface Entry {
  values: string[];
  children: Entry[];
}

export interface Coord {
  x: number;
  y: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
}
