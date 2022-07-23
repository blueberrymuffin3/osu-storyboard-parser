import { LayerType } from "osu-classes";
import { decodeObject, StoryboardObject } from "./objects.js";
import { Entry } from "./types.js";

const INDENT_MAX_LEVEL = 2;
const COMMENT_REGEX = /^\s*\/\//;
const INDENT_REGEX = /^([_ ]*)(.*)$/;
const HEADER_REGEX = /^\[.*]$/;
const HEADER_EVENTS_REGEX = /^\[Events]$/;

export interface Storyboard {
  Background: StoryboardObject[];
  Fail: StoryboardObject[];
  Pass: StoryboardObject[];
  Foreground: StoryboardObject[];
  Overlay: StoryboardObject[];
}

export function loadStoryboard(
  osuContent: string,
  osbContent?: string
): Storyboard | null {
  const entries = parseEntries(osuContent);
  console.log(`Loaded ${entries.length} from .osu`);
  if (osbContent) {
    entries.push(...parseEntries(osbContent));
    console.log(`Loaded ${entries.length} from .osu+.osb`);
  }

  const storyboard: Storyboard = {
    Background: [],
    Fail: [],
    Pass: [],
    Foreground: [],
    Overlay: [],
  };

  for (const entry of entries) {
    const object = decodeObject(entry);
    if (!object) {
      continue;
    }

    const layerName = LayerType[object.layer] as
      | "Background"
      | "Fail"
      | "Pass"
      | "Foreground"
      | "Overlay";
    storyboard[layerName].push(object);
  }

  if (
    storyboard.Background.length === 0 &&
    storyboard.Fail.length === 0 &&
    storyboard.Pass.length === 0 &&
    storyboard.Foreground.length === 0 &&
    storyboard.Overlay.length === 0
  ) {
    return null; // No objects
  }

  return storyboard;
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
