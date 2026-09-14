import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DB = {
  user: "postgres",
  password: "flexflow-dev-pass",
  port: 5433,
  database: "flexflow",
};

const dbDir = resolve(import.meta.dirname, "data");
const pidFile = resolve(import.meta.dirname, ".pid");

function runningPid() {
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function start() {
  process.stdout.write(String(process.pid));

  const existing = runningPid();
  if (existing) {
    console.log(`[dev-db] Already running (pid ${existing}, port ${DB.port}).`);
    process.exit(0);
  }

  const fresh = !existsSync(resolve(dbDir, "PG_VERSION"));
  if (fresh) console.log("[dev-db] First run — initialising cluster…");
  else console.log("[dev-db] Starting existing cluster…");

  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    user: DB.user,
    password: DB.password,
    port: DB.port,
    persistent: true,
  });

  try {
    if (fresh) {
      await pg.initialise();
    }
    await pg.start();
    await pg.createDatabase(DB.database).catch((err) => {
      if (!/duplicate database|already exists/i.test(String(err && err.message))) throw err;
    });
  } catch (err) {
    rmSync(pidFile, { force: true });
    throw err;
  }

  writeFileSync(pidFile, String(process.pid));

  console.log(`[dev-db] ${fresh ? "Initialised and " : ""}database ready on 127.0.0.1:${DB.port}`);
  console.log(`[dev-db] user=${DB.user} password=${DB.password} database=${DB.database} data=${dbDir}`);

  const shutdown = async () => {
    await pg.stop().catch(() => {});
    rmSync(pidFile, { force: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function stop() {
  const pid = runningPid();
  if (!pid) {
    rmSync(pidFile, { force: true });
    console.log("[dev-db] Not running.");
    process.exit(0);
  }
  const res = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "inherit" });
  console.log(res.status === 0 ? `[dev-db] Stopped (pid ${pid}).` : "[dev-db] Failed to stop — check task manager.");
  rmSync(pidFile, { force: true });
  process.exit(0);
}

if (process.argv.includes("--stop")) await stop();
else await start();