import JSZip from "jszip";
import { readFile, writeFile } from "node:fs/promises";
import { loadStoryboard } from "../dist/index.js";

async function testMap(oszFile, difficulty) {
  const osz = await readFile(oszFile);
  const zip = await JSZip.loadAsync(osz);

  const osuFile = zip.filter(
    (path) => path.endsWith(".osu") && path.includes(difficulty)
  )[0];

  const osbFile = zip.filter((path) => path.endsWith(".osb"))[0];

  if (osbFile) {
    console.log(`Testing ${osuFile.name} & ${osbFile.name} from ${oszFile}`);
  } else {
    console.log(`Testing ${osuFile.name} from ${oszFile}`);
  }

  const osuString = await osuFile.async("string");
  const osbString = await osbFile?.async("string");

  const startTime = performance.now();
  const storyboard = loadStoryboard(osuString, osbString);
  const elapsed = performance.now() - startTime;
  console.log(`Processed in ${elapsed} ms`);

  await writeFile(
    `${oszFile} ${difficulty}.json`,
    JSON.stringify(storyboard, null, 2)
  );
}
await testMap("Panda Eyes - ILY.osz", "[Light Insane]");
await testMap(
  "Oedo Controller (feat. TORIENA) - yunomi.osz",
  "[Enkrypteve's Advanced]"
);
