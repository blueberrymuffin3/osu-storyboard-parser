import { LayerType, Origins } from "osu-classes";
import { Command, decodeCommand } from "./commands.js";
import { Coord, Entry } from "./types.js";

interface StoryboardObjectBase {
  layer: LayerType;
  origin: Origins;
  filepath: string;
  defaultPos: Coord;
  commands: Command[];
}

export interface SpriteObject extends StoryboardObjectBase {
  type: "Sprite";
}

export interface AnimationObject extends StoryboardObjectBase {
  type: "Animation";
  frameCount: number;
  frameDelay: number;
  loops: boolean;
}

export type StoryboardObject = SpriteObject | AnimationObject;

export function decodeObject(entry: Entry): StoryboardObject | null {
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

      const layer = LayerType[entry.values[1] as any];
      if (typeof layer !== "number") {
        console.warn(`Invalid value for layer: ${entry.values[1]}`);
        return null;
      }
      if (layer == LayerType.Samples) {
        console.warn("Samples layer not yet supported");
        return null;
      }

      const origin = Origins[entry.values[2] as any];
      if (typeof origin !== "number") {
        console.warn(`Invalid value for origin: ${entry.values[2]}`);
        return null;
      }

      let filepath = entry.values[3];
      // TODO: Does this need to be more robust?
      if (filepath.startsWith('"') && filepath.endsWith('"')) {
        filepath = filepath.substring(1, filepath.length - 1);
      }

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
          type,
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
          type,
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
