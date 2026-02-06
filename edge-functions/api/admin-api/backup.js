// Supabase REST API helpers (lightweight)
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function select(supabaseUrl, supabaseKey, table, options = {}) {
  const { columns = '*', filter = '', orderBy = '', limit = '', offset = '', single = false } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (offset) url += `&offset=${offset}`;
  if (single) url += '&limit=1';

  const response = await fetch(url, { headers: getHeaders(supabaseKey) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return single ? (data[0] || null) : data;
}

async function insert(supabaseUrl, supabaseKey, table, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: getHeaders(supabaseKey),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function remove(supabaseUrl, supabaseKey, table, filter) {
  const url = `${supabaseUrl}/rest/v1/${table}?${filter}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(supabaseKey)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  return response.json();
}

function verifyAdminApiKey(context, adminApiKey) {
  const authHeader = context.request.headers.get("Authorization");
  const apiKey = context.request.headers.get("X-API-Key");

  if (!adminApiKey) return false;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7) === adminApiKey;
  }

  if (apiKey) {
    return apiKey === adminApiKey;
  }

  return false;
}

function convertToCSV(data, table) {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      // 处理包含逗号、引号或换行符的值
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const url = new URL(context.request.url);
    const format = url.searchParams.get("format");
    const table = url.searchParams.get("table");

    if (format !== "csv" || !table) {
      return new Response(JSON.stringify({ success: false, error: "缺少必要参数" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 导出单个表为 CSV
    if (table) {
      const validTables = ["videos", "categories", "sub_categories", "api_sources", "sync_schedules", "api_config", "api_logs", "ip_blacklist"];
      if (!validTables.includes(table)) {
        return new Response(JSON.stringify({ success: false, error: "无效的表名" }), {
          headers: { "Content-Type": "application/json" },
          status: 400,
        });
      }

      let orderBy = "id.asc";
      if (table === "videos") orderBy = "synced_at.desc";
      else if (table === "categories") orderBy = "sort.asc";
      else if (table === "sub_categories") orderBy = "name.asc";
      else if (table === "sync_schedules") orderBy = "next_run_time.asc";
      else if (table === "api_logs") orderBy = "request_time.desc";
      else if (table === "ip_blacklist") orderBy = "created_at.desc";

      const data = await select(supabaseUrl, supabaseAnonKey, table, {
        columns: "*",
        orderBy: orderBy
      });

      const csv = convertToCSV(data, table);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}_backup_${timestamp}.csv"`,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        },
        status: 200,
      });
    }

    // 导出所有表为 JSON
    const tables = [
      { name: "categories", orderBy: "sort.asc" },
      { name: "sub_categories", orderBy: "name.asc" },
      { name: "videos", orderBy: "synced_at.desc" },
      { name: "api_sources", orderBy: "id.asc" },
      { name: "sync_schedules", orderBy: "next_run_time.asc" },
      { name: "api_config", orderBy: "id.asc" },
      { name: "ip_blacklist", orderBy: "created_at.desc" },
      { name: "api_logs", orderBy: "request_time.desc" }
    ];

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      try {
        const data = await select(supabaseUrl, supabaseAnonKey, table.name, {
          columns: "*",
          orderBy: table.orderBy
        });
        exportData.tables[table.name] = data || [];
      } catch (error) {
        console.error(`导出表 ${table.name} 失败:`, error);
        exportData.tables[table.name] = { error: error instanceof Error ? error.message : "导出失败" };
      }
    }

    const json = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="full_backup_${timestamp}.json"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("导出失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "导出失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await context.request.json();
    const { action } = body;

    if (action === "export") {
      const [videos, categories, subCategories] = await Promise.all([
        select(supabaseUrl, supabaseAnonKey, "videos", {
          columns: "*",
          orderBy: "synced_at.desc"
        }),
        select(supabaseUrl, supabaseAnonKey, "categories", {
          columns: "*",
          orderBy: "sort.asc"
        }),
        select(supabaseUrl, supabaseAnonKey, "sub_categories", {
          columns: "*",
          orderBy: "name.asc"
        })
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            videos: videos || [],
            categories: categories || [],
            subCategories: subCategories || [],
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
          },
          status: 200,
        },
      );
    } else if (action === "import") {
      const { videos, categories, subCategories } = body;

      if (!videos || !categories) {
        return new Response(
          JSON.stringify({ success: false, error: "缺少必要的数据" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          },
        );
      }

      // 删除所有现有数据
      await remove(supabaseUrl, supabaseAnonKey, "videos", "vod_id.gte.0");
      await remove(supabaseUrl, supabaseAnonKey, "categories", "id.gte.0");
      await remove(supabaseUrl, supabaseAnonKey, "sub_categories", "id.gte.0");

      // 导入数据
      if (categories.length > 0) {
        await insert(supabaseUrl, supabaseAnonKey, "categories", categories);
      }

      if (subCategories && subCategories.length > 0) {
        await insert(supabaseUrl, supabaseAnonKey, "sub_categories", subCategories);
      }

      if (videos.length > 0) {
        await insert(supabaseUrl, supabaseAnonKey, "videos", videos);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "数据导入成功",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
          },
          status: 200,
        },
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "无效的操作" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }
  } catch (error) {
    console.error("备份操作失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "备份操作失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}