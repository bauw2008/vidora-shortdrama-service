#!/usr/bin/env node
/**
 * 同步 CLI 入口
 * 用法: pnpm run sync:full
 *      pnpm run sync:incremental 24
 *      pnpm run sync:resync
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// 加载 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env");

try {
  const envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=");
        process.env[key.trim()] = value.trim();
      }
    }
  }
} catch (error) {
  console.warn("无法加载 .env 文件:", (error as Error).message);
}

// 使用动态导入，确保 .env 在导入模块之前加载
const args = process.argv.slice(2);
const command = args[0];
const hours = args[1] ? parseInt(args[1], 10) : 24;

async function main() {
  // 动态导入 sync 模块
  const { fullSync, incrementalSync, resync } = await import("./sync");

  console.log(`🚀 开始执行同步: ${command}`);

  switch (command) {
    case "full":
      await fullSync();
      break;
    case "incremental":
      await incrementalSync(hours);
      break;
    case "resync":
      await resync();
      break;
    default:
      console.error("❌ 未知的同步类型:", command);
      console.log("用法:");
      console.log("  pnpm run sync:full         # 完整同步");
      console.log("  pnpm run sync:incremental 24  # 增量同步（24小时）");
      console.log("  pnpm run sync:resync        # 补充同步");
      process.exit(1);
  }

  console.log("✅ 同步完成");
}

main().catch((error) => {
  console.error("❌ 同步失败:", error);
  process.exit(1);
});
