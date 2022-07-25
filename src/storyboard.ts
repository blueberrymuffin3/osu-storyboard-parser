import { LayerType } from "osu-classes";
import { decodeObject, StoryboardObject } from "./objects.js";
import { Entry } from "./types.js";

const INDENT_MAX_LEVEL = 2;
const COMMENT_REGEX = /^\s*\/\//;
const INDENT_REGEX = /^([_ ]*)(.*)$/;
const HEADER_REGEX = /^\[.*]$/i;
const HEADER_EVENTS_REGEX = /^\[Events]$/i;
const HEADER_VARIABLES_REGEX = /^\[Variables]$/i;
const VARIABLE_REGEX = /^(\$[^=]+)=(.+)$/;
const VARIABLE_REPLACER_REGEX = /(\$[^,]+)/g;

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
  console.log(`Loaded ${entries.length} storyboard objects from .osu`);
  if (osbContent) {
    entries.push(...parseEntries(osbContent, true));
    console.log(`Loaded ${entries.length} storyboard objects from .osu+.osb`);
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

function parseEntries(content: string, variablesAllowed = false) {
  const lines = content.split(/\r?\n/);

  let section: "variables" | "events" | null = null;
  const variables = new Map<string, string>();
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

    if (HEADER_REGEX.test(line)) {
      section = null;
      if (HEADER_VARIABLES_REGEX.test(line)) {
        if (variablesAllowed) {
          section = "variables";
        } else {
          console.warn("Illegal variables section found in osu file, ignoring");
        }
      } else if (HEADER_EVENTS_REGEX.test(line)) {
        section = "events";
      }

      continue;
    }

    if (section === "variables") {
      const result = VARIABLE_REGEX.exec(line);
      if (result) {
        variables.set(result[1], result[2]);
      } else {
        console.warn(`Ignoring invalid variable: ${line}`);
      }
    } else if (section === "events") {
      const result = INDENT_REGEX.exec(line)!;

      const indentLevel = result[1].length;
      if (indentLevel > INDENT_MAX_LEVEL || indentLevel > stack.length) {
        console.warn(`Unexpected indent on line ${i + 1}`);
      }

      const content = result[2].replace(VARIABLE_REPLACER_REGEX, (variable) => {
        if (!variablesAllowed) {
          console.warn(
            `Illegal variable reference "${variable}" found in osu file`
          );
          return variable;
        }

        const value = variables.get(variable);
        if (!value) {
          console.warn(`Unknown variable reference "${variable}"`);
          return variable;
        }
        return value;
      });

      const values = content.split(","); // TODO: Breaks on filenames with commas

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
  }

  return entries;
}
