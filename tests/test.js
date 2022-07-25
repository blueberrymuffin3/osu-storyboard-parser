import JSZip from "jszip";
import { exec as _exec } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { loadStoryboard } from "../dist/index.js";
const exec = promisify(_exec);

let successful = true;

async function testMap(oszFile, id, difficulty) {
  try {
    if (!existsSync(oszFile)) {
      console.log("Downloading", id);
      console.log(
        await (
          await exec(`wget "https://kitsu.moe/api/d/${id}" -O"${oszFile}"`)
        ).stdout
      );
    }

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
    console.log(`Processed storyboard in ${elapsed.toFixed(2)} ms`);

    await writeFile(
      `${oszFile} ${difficulty}.json`,
      JSON.stringify(storyboard, null, 2)
    );
  } catch (error) {
    console.error(`Error testing beatmap "${oszFile}":`);
    console.error(error);
    successful = false;
  }
  console.log("----------------");
}

//prettier-ignore
{
  // No storyboard:
  await testMap("Stars Align - dark cat.osz", 606998, "[Hard]")

  await testMap("new beginnings - nekodex.osz", 1011011, "tutorial");
  await testMap("Oedo Controller (feat. TORIENA) - yunomi.osz", 759903, "[Enkrypteve's Advanced]");
  await testMap("Panda Eyes - ILY.osz", 653534, "[Light Insane]");
  await testMap("EOS - ginkiha.osz", 151720, "[Hyper]");
  await testMap("Yotsuya-san ni Yoroshiku - Himeringo.osz", 100049, "[cheesiest's Light Insane]");
  await testMap("world.execute(me) - Mili.osz", 470977, "mapset.extra");
}

process.exitCode = successful ? 0 : 1;
