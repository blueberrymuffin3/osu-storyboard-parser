import { Easing, Origins } from "osu-classes";

const INDENT_MAX_LEVEL = 2;
const COMMENT_REGEX = /^\s*\/\//;
const INDENT_REGEX = /^([_ ]*)(.*)$/;
const HEADER_REGEX = /^\[.*]$/;
const HEADER_EVENTS_REGEX = /^\[Events]$/;

function numberOr(text: string, defaultValue: number) {
  return text.trimEnd() === "" ? defaultValue : Number(text);
}

export function loadStoryboard(
  osuContent: string,
  osbContent?: string
): Object[] {
  const entries = parseEntries(osuContent);
  console.log(`Loaded ${entries.length} from .osu`);
  if (osbContent) {
    entries.push(...parseEntries(osbContent));
    console.log(`Loaded ${entries.length} from .osu+.osb`);
  }

  return entries
    .map(decodeEntry)
    .filter((object) => object !== null) as Object[];
}

export interface Entry {
  values: string[];
  children: Entry[];
}

function parseEntries(content: string) {
  const lines = content.split(/\r?\n/);

  let seenHeader = false;
  const entries: Entry[] = [];
  const stack: Entry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (COMMENT_REGEX.test(line)) {
      continue;
    }

    if (line.trimEnd().length === 0) {
      continue; // Empty Line
    }

    if (seenHeader) {
      if (HEADER_REGEX.test(line)) {
        break; // We've reached another section (TimingPoints)
      }
    } else {
      if (HEADER_EVENTS_REGEX.test(line)) {
        seenHeader = true;
      }

      continue;
    }

    const result = INDENT_REGEX.exec(line)!;

    const indentLevel = result[1].length;
    if (indentLevel > INDENT_MAX_LEVEL || indentLevel > stack.length) {
      console.warn(`Unexpected indent on line ${i + 1}`);
    }

    const values = result[2].split(","); // TODO: Breaks on filenames with commas

    stack.length = indentLevel + 1;
    const entry = {
      values,
      children: [],
    };
    stack[indentLevel] = entry;

    if (indentLevel > 0) {
      const parent = stack[indentLevel - 1];
      if (parent) {
        parent.children.push(entry);
      } else {
        console.warn(`Invalid indent on line ${i + 1}`);
      }
    } else {
      entries.push(entry);
    }
  }

  return entries;
}

export enum ObjectLayer {
  Background,
  Fail,
  Pass,
  Foreground,
}

interface Coord {
  x: number;
  y: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

export interface SpriteObject {
  layer: ObjectLayer;
  origin: Origins;
  filepath: string;
  defaultPos: Coord;
  commands: Command[];
}

export interface AnimationObject extends SpriteObject {
  frameCount: number;
  frameDelay: number;
  loops: boolean;
}

type Object = SpriteObject | AnimationObject;

function decodeEntry(entry: Entry): Object | null {
  const type = entry.values[0];

  switch (type) {
    case "Sprite":
    case "Animation": {
      const expectedValuesLength = type === "Sprite" ? 6 : 9;
      if (entry.values.length !== expectedValuesLength) {
        console.warn(
          `Expected ${expectedValuesLength} values, got ${entry.values.length}`
        );
      }

      const layer = ObjectLayer[entry.values[1] as any];
      if (typeof layer !== "number") {
        console.warn(`Invalid value for layer: ${entry.values[1]}`);
        return null;
      }

      const origin = Origins[entry.values[2] as any];
      if (typeof origin !== "number") {
        console.warn(`Invalid value for origin: ${entry.values[2]}`);
        return null;
      }

      const filepath = entry.values[3];
      const defaultPos: Coord = {
        x: Number(entry.values[4]),
        y: Number(entry.values[5]),
      };

      const commands = entry.children.flatMap(decodeCommand);

      if (type === "Animation") {
        const frameCount = Number(entry.values[6]);
        const frameDelay = Number(entry.values[7]);
        const loopType = entry.values[8];
        const loops = loopType !== "LoopOnce"; // LoopForever is the default

        return {
          layer,
          origin,
          filepath,
          defaultPos,
          commands,
          frameCount,
          frameDelay,
          loops,
        };
      } else {
        return {
          layer,
          origin,
          filepath,
          defaultPos,
          commands,
        };
      }
    }
    case "0": // Background
    case "2": // Breaks
      return null;
    default: {
      console.warn(`Unknown type "${type}"`);
      return null;
    }
  }
}

interface CommandBase<Type extends string, Value> {
  type: Type;
  easing: Easing;
  startTime: number;
  endTime: number;
  startValue: Value;
  endValue: Value;
}

export type CommandFade = CommandBase<"F", number>;
export type CommandMove = CommandBase<"M", Coord>;
export type CommandMoveX = CommandBase<"MX", number>;
export type CommandMoveY = CommandBase<"MY", number>;
export type CommandScale = CommandBase<"S", number>;
export type CommandVectorScale = CommandBase<"V", Coord>;
export type CommandRotate = CommandBase<"R", number>;
export type CommandColor = CommandBase<"C", Color>;
export type CommandParam = CommandBase<"P", Color>;
export type Command =
  | CommandFade
  | CommandMove
  | CommandMoveX
  | CommandMoveY
  | CommandScale
  | CommandVectorScale
  | CommandRotate
  | CommandColor
  | CommandParam;

type CommandType = Command["type"];

const commandValueSizeMap = {
  F: 1,
  M: 2,
  MX: 1,
  MY: 1,
  S: 1,
  V: 2,
  R: 1,
  C: 3,
  P: 1,
} as const;

const defaultToEnd =
  <T>(convert: (params: string[]) => T) =>
  (start: string[], end?: string[]): T => {
    if (end) {
      return convert(start.map((value, i) => value ?? end[i]));
    } else {
      return convert(start);
    }
  };
const convertNumberValue = ([value]: string[]) => Number(value);
const convertCoordValue = ([x, y]: string[]): Coord => ({
  x: Number(x),
  y: Number(y),
});
const convertColorValue = ([r, g, b]: string[]): Color => ({
  r: Number(r),
  g: Number(g),
  b: Number(b),
});
const convertParamValue = ([param]: string[]) => param;

const commandValueConverter = {
  F: defaultToEnd(convertNumberValue),
  M: defaultToEnd(convertCoordValue),
  MX: defaultToEnd(convertNumberValue),
  MY: defaultToEnd(convertNumberValue),
  S: defaultToEnd(convertNumberValue),
  V: defaultToEnd(convertCoordValue),
  R: defaultToEnd(convertNumberValue),
  C: defaultToEnd(convertColorValue),
  P: defaultToEnd(convertParamValue),
} as const;

function decodeCommand(entry: Entry): Command[] {
  switch (entry.values[0]) {
    case "L":
    case "T":
      return []; // TODO: Loops and Triggers
    default:
      return decodeBasicCommand(entry);
  }
}

function decodeBasicCommand(entry: Entry): Command[] {
  const easing = Number(entry.values[1]) as Easing;
  if (Easing[easing] === undefined) {
    console.warn(`Unexpected Easing ${entry.values[1]}`);
    return [];
  }

  const startTime = Number(entry.values[2]);
  const endTime = numberOr(entry.values[3], startTime);

  const type = entry.values[0] as CommandType;
  const valueSize = commandValueSizeMap[type];
  const convertValue = commandValueConverter[type];

  if (typeof valueSize !== "number") {
    console.warn(`Unknown command type ${type}`);
    return [];
  }

  const params = entry.values.slice(4);

  if (params.length % valueSize != 0 || params.length < valueSize) {
    console.warn(`Expected n*${valueSize} params, got ${params.length}`);
    return [];
  }

  const valueCount = params.length / valueSize;
  const values = Array(valueCount);

  for (let i = 0; i < values.length; i++) {
    values[i] = params.slice(i * valueSize, (i + 1) * valueSize);
  }

  switch (valueCount) {
    case 1: {
      const value = convertValue(values[0]);
      return [
        {
          type,
          easing,
          startTime,
          endTime,
          startValue: value,
          endValue: value,
        } as Command,
      ];
    }
    case 2: {
      // Standard Form
      return [
        {
          type,
          easing,
          startTime,
          endTime,
          startValue: convertValue(values[0], values[1]),
          endValue: convertValue(values[1]),
        } as Command,
      ];
    }
    default: {
      // Sequential Form
      const convertedValues = values.map((value) => convertValue(value));
      const commands = Array(valueCount - 1);
      const duration = endTime - startTime;
      for (let i = 0; i < commands.length; i++) {
        const offset = duration * i;
        commands[i] = {
          type,
          easing,
          startTime: startTime + offset,
          endTime: endTime + offset,
          startValue: convertedValues[i],
          endValue: convertedValues[i + 1],
        };
      }
      return commands;
    }
  }
}
