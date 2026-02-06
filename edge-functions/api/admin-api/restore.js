// Supabase REST API helpers (from shared)
import {
  select,
  insert,
  remove,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey,
} from "./shared/helpers.js";

export async function onRequestPost(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // 设置 service_role key 用于写入操作
  setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const formData = await context.request.formData();
    const file = formData.get("file");
    const table = formData.get("table");
    const clearBeforeRestore = formData.get("clearBeforeRestore") === "true";

    if (!file) {
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({ success: false, error: "缺少文件" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const text = await file.text();
    const backupData = JSON.parse(text);

    const results = {
      success: true,
      tables: {},
    };

    // 单表恢复
    if (backupData.table && backupData.data) {
      const tableName = backupData.table;
      const data = Array.isArray(backupData.data) ? backupData.data : [];

      if (data.length === 0) {
        resetServiceRoleKey();
        return new Response(
          JSON.stringify({ success: true, message: "没有数据需要恢复" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      // 清空现有数据
      if (clearBeforeRestore) {
        try {
          await remove(supabaseUrl, supabaseAnonKey, tableName, "id=gte.0");
        } catch (error) {
          console.error(`清空表 ${tableName} 失败:`, error);
        }
      }

      // 导入数据
      let inserted = 0;
      let failed = 0;

      for (const item of data) {
        try {
          await insert(supabaseUrl, supabaseAnonKey, tableName, item);
          inserted++;
        } catch (error) {
          console.error(`插入数据失败:`, error);
          failed++;
        }
      }

      results.tables[tableName] = { inserted, failed, total: data.length };

      resetServiceRoleKey();

      return new Response(
        JSON.stringify({
          success: true,
          data: results.tables,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-API-Key",
          },
          status: 200,
        },
      );
    }

    // 全量恢复
    if (backupData.tables) {
      const validTables = [
        "videos",
        "categories",
        "sub_categories",
        "api_sources",
        "sync_schedules",
        "api_config",
        "api_logs",
        "ip_blacklist",
      ];

      // 按顺序恢复表
      const restoreOrder = [
        "categories",
        "sub_categories",
        "videos",
        "api_sources",
        "sync_schedules",
        "api_config",
        "ip_blacklist",
        "api_logs",
      ];

      for (const tableName of restoreOrder) {
        if (!backupData.tables[tableName]) continue;

        const data = Array.isArray(backupData.tables[tableName])
          ? backupData.tables[tableName]
          : [];

        if (data.length === 0) {
          results.tables[tableName] = { inserted: 0, failed: 0, total: 0 };
          continue;
        }

        // 清空现有数据
        if (clearBeforeRestore) {
          try {
            await remove(supabaseUrl, supabaseAnonKey, tableName, "id=gte.0");
          } catch (error) {
            console.error(`清空表 ${tableName} 失败:`, error);
          }
        }

        // 导入数据（分批处理）
        let inserted = 0;
        let failed = 0;
        const batchSize = 100;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          try {
            await insert(supabaseUrl, supabaseAnonKey, tableName, batch);
            inserted += batch.length;
          } catch (error) {
            console.error(`批量插入数据失败:`, error);
            failed += batch.length;
          }
        }

        results.tables[tableName] = { inserted, failed, total: data.length };
      }

      resetServiceRoleKey();

      return new Response(
        JSON.stringify({
          success: true,
          data: results.tables,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-API-Key",
          },
          status: 200,
        },
      );
    }

    resetServiceRoleKey();
    return new Response(
      JSON.stringify({ success: false, error: "无效的备份文件格式" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      },
    );
  } catch (error) {
    resetServiceRoleKey();
    console.error("恢复失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "恢复失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
