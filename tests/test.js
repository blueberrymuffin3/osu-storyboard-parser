import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { loadStoryboard } from "../dist/index.js";

const osz = await readFile("Panda Eyes - ILY.osz");
const zip = await JSZip.loadAsync(osz);

const osuString = await zip
  .file("Panda Eyes - ILY (M a r v o l l o) [Light Insane].osu")
  .async("string");
const osbString = await zip
  .file("Panda Eyes - ILY (M a r v o l l o).osb")
  .async("string");

const storyboard = loadStoryboard(osuString)
