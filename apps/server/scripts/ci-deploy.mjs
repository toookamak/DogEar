// DogEar · Workers Builds 一键部署脚本（轨 A，零 Token 方案）
//
// Cloudflare Workers Builds（面板 Git 集成）自带账号凭据，无需配置 API Token。
// 面板只需两处设置：
//   Root directory: apps/server
//   Deploy command: node scripts/ci-deploy.mjs
// Build command 建议填 echo skip（本脚本自带前端构建，Worker 由 wrangler 打包）。
//
// 本脚本按序完成五步（任何一步失败即中止，退出码非 0）：
//   1. 构建前端工作台（apps/web → dist，与 API 同域部署，见 wrangler.toml [assets]）
//   2. 确保 D1 数据库 dogear_prod 存在（不存在则自动创建）
//   3. 把真实 database_id 回填到 CI 工作副本的 wrangler.toml
//      （仓库里保留占位符，真实 id 属于具体 Cloudflare 账号，不提交进 git）
//   4. 应用 D1 迁移（建表与默认数据）
//   5. wrangler deploy 部署 Worker（含前端静态资源）
//
// 测试：WRANGLER_BIN 可指向 mock 脚本（node 可执行文件），用于无凭据的本地行为测试。

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const TOML_PATH = join(SERVER_DIR, "..", "wrangler.toml");
const WEB_DIST = join(SERVER_DIR, "..", "..", "web", "dist");
const DB_NAME = "dogear_prod";
const R2_BUCKET = "dogear-covers";
const PLACEHOLDER = "REPLACE_WITH_YOUR_D1_DATABASE_ID";

const step = (msg) => console.log(`\n==> ${msg}`);
const die = (msg) => {
  console.error(`\n✘ ${msg}`);
  process.exit(1);
};

function wranglerBin() {
  if (process.env.WRANGLER_BIN) return process.env.WRANGLER_BIN;
  // 优先用 apps/server 自带依赖里的 wrangler（版本随 lockfile，行为可预期）
  for (const rel of ["../node_modules/wrangler/bin/wrangler.js", "../../node_modules/wrangler/bin/wrangler.js"]) {
    const p = join(SERVER_DIR, rel);
    if (existsSync(p)) return p;
  }
  return "wrangler";
}

function wrangler(args, { capture = false } = {}) {
  const entry = wranglerBin();
  // wrangler.js 是 node 脚本：直接用当前 node 执行，规避 Windows .bin/.cmd 与 shell 差异；
  // 兜底的 PATH 上的 wrangler 则按可执行文件直接调用
  const isNodeScript = entry.endsWith(".js") || entry.endsWith(".mjs");
  const r = spawnSync(
    isNodeScript ? process.execPath : entry,
    isNodeScript ? [entry, ...args] : args,
    {
      cwd: SERVER_DIR,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      encoding: "utf8",
      env: process.env,
    },
  );
  if (r.error) die(`无法执行 wrangler（${entry}）：${r.error.message}`);
  if (r.status !== 0) die(`wrangler ${args.join(" ")} 失败（exit ${r.status}），见上方日志`);
  return capture ? r.stdout : "";
}
function wranglerAllowFail(args) {
  const entry = wranglerBin();
  const isNodeScript = entry.endsWith(".js") || entry.endsWith(".mjs");
  return spawnSync(
    isNodeScript ? process.execPath : entry,
    isNodeScript ? [entry, ...args] : args,
    { cwd: SERVER_DIR, stdio: "inherit", encoding: "utf8", env: process.env },
  );
}

function ensureR2() {
  const r = wranglerAllowFail(["r2", "bucket", "create", R2_BUCKET]);
  if (r.status === 0) console.log(`R2 桶已创建：${R2_BUCKET}`);
  else console.log(`R2 桶 create 退出 ${r.status}（桶已存在则可忽略）`);
}


function listDatabases() {
  const out = wrangler(["d1", "list", "--json"], { capture: true });
  try {
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    die("wrangler d1 list --json 输出不是合法 JSON，无法解析 database_id（见上方日志）");
  }
}

function findDb(dbs) {
  const db = dbs.find((d) => d.name === DB_NAME);
  if (!db) return null;
  const id = db.uuid || db.id || db.database_id;
  if (!id) die(`d1 list 找到了 ${DB_NAME} 但输出中没有 database_id 字段：${JSON.stringify(db)}`);
  return id;
}

function stampToml(dbId) {
  if (!existsSync(TOML_PATH)) die(`找不到 ${TOML_PATH}`);
  const toml = readFileSync(TOML_PATH, "utf8");
  if (!toml.includes(`database_id = "${dbId}"`)) {
    if (!toml.includes(PLACEHOLDER)) die("wrangler.toml 既无占位符也无该 database_id，无法回填");
    writeFileSync(TOML_PATH, toml.replace(PLACEHOLDER, dbId), "utf8");
    console.log(`已回填 database_id（仅 CI 工作副本）：${dbId}`);
  } else {
    console.log("database_id 已是目标值，跳过回填");
  }
}

function buildWeb() {
  // 前端工作台构建（tsc --noEmit + vite build）。pnpm 在 Windows 上是 .cmd，
  // 需经 shell 调起；Workers Builds（Linux）走同一路径无影响。
  const r = spawnSync("pnpm", ["--filter", "@dogear/web", "build"], {
    cwd: SERVER_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.error) die(`无法执行 pnpm（构建前端工作台）：${r.error.message}`);
  if (r.status !== 0) die(`前端工作台构建失败（exit ${r.status}），见上方日志`);
  if (!existsSync(WEB_DIST)) die(`前端构建完成但找不到产物目录 ${WEB_DIST}`);
}

function main() {
  if (!existsSync(TOML_PATH)) die(`找不到 ${TOML_PATH}，请在 apps/server 目录结构下运行本脚本`);

  step("步骤 1/5 · 构建前端工作台（apps/web）");
  buildWeb();

  step("步骤 2/5 · 确保 D1 数据库 dogear_prod 存在");
  let dbId = findDb(listDatabases());
  if (!dbId) {
    console.log(`D1 数据库 ${DB_NAME} 不存在，自动创建…`);
    wrangler(["d1", "create", DB_NAME]);
    dbId = findDb(listDatabases());
    if (!dbId) die(`创建后仍未在 d1 list 中找到 ${DB_NAME}`);
  }
  console.log(`D1 就绪：${DB_NAME}（${dbId}）`);

  step("步骤 2b · 确保 R2 桶 dogear-covers 存在");
  ensureR2();

  step("步骤 3/5 · 回填 database_id 到 wrangler.toml（工作副本）");
  stampToml(dbId);

  step("步骤 4/5 · 应用 D1 迁移（建表与默认数据）");
  wrangler(["d1", "migrations", "apply", DB_NAME, "--remote"]);

  step("步骤 5/5 · 部署 Worker（含前端静态资源）");
  wrangler(["deploy"]);

  step("✅ 部署完成");
}

main();
