#!/usr/bin/env node
/**
 * 同步 CLI 入口
 * 用法: pnpm run sync:full
 *      pnpm run sync:incremental 24
 *      pnpm run sync:resync
 */

import { fullSync, incrementalSync, resync } from "./sync";

const args = process.argv.slice(2);
const command = args[0];
const hours = args[1] ? parseInt(args[1], 10) : 24;

async function main() {
  try {
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
  } catch (error) {
    console.error("❌ 同步失败:", error);
    process.exit(1);
  }
}

main();