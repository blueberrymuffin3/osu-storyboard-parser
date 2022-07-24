import { Easing } from "osu-classes";
import { Color, Coord, Entry, Parameter } from "./types.js";

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
export type CommandParam = CommandBase<"P", Parameter>;
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
const convertParamValue = ([param]: string[]) => param as Parameter;

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

export function decodeCommand(entry: Entry): Command[] {
  switch (entry.values[0]) {
    case "L":
      return unrollLoopCommand(entry);
    case "T":
      return []; // TODO: Triggers
    default:
      return decodeBasicCommand(entry);
  }
}

function numberOr(text: string, defaultValue: number) {
  return text.trimEnd() === "" ? defaultValue : Number(text);
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

// TODO: Is memory cost of unrolling loops worth it?
function unrollLoopCommand(entry: Entry): Command[] {
  const children = entry.children.flatMap(decodeBasicCommand);
  const startTime = Number(entry.values[1]);
  const duration = children
    .map((command) => command.endTime)
    .reduce((a, b) => Math.max(a, b));
  const loopCount = Number(entry.values[2]);

  const commands: Command[] = [];

  for (let i = 0; i < loopCount; i++) {
    const iterationStartTime = startTime + i * duration;

    commands.push(
      ...children.map((child) => ({
        ...child,
        startTime: child.startTime + iterationStartTime,
        endTime: child.endTime + iterationStartTime,
      }))
    );
  }

  return commands;
}
