// Supabase REST API helpers (from shared)
import {
  select,
  selectCount,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey,
} from "./shared/helpers.js";

async function deleteLogs(supabaseUrl, supabaseKey, filter) {
  const url = `${supabaseUrl}/rest/v1/api_logs?${filter}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  return response.json();
}

export async function onRequestGet(context) {
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

  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
    const ipFilter = url.searchParams.get("ip");
    const endpointFilter = url.searchParams.get("endpoint");
    const statusFilter = url.searchParams.get("status");

    const from = (page - 1) * pageSize;

    let filter = "";
    if (ipFilter) filter += `&ip_address=eq.${ipFilter}`;
    if (endpointFilter) filter += `&api_endpoint=eq.${endpointFilter}`;
    if (statusFilter) filter += `&response_status=eq.${statusFilter}`;

    const [data, total, configData] = await Promise.all([
      select(supabaseUrl, supabaseAnonKey, "api_logs", {
        columns: "*",
        filter: filter.substring(1),
        orderBy: "request_time.desc",
        limit: pageSize.toString(),
        offset: from.toString(),
      }),
      selectCount(
        supabaseUrl,
        supabaseAnonKey,
        "api_logs",
        filter.substring(1),
      ),
      select(supabaseUrl, supabaseAnonKey, "api_config", {
        columns: "auto_clean_threshold,max_log_count",
        orderBy: "id.asc",
        limit: "1",
        single: true,
      }),
    ]);

    const config = configData || {
      auto_clean_threshold: 80000,
      max_log_count: 100000,
    };

    // 计算统计信息
    const estimatedSizeMB = ((total * 500) / 1024 / 1024).toFixed(2); // 假设每条日志约500字节

    const stats = {
      totalCount: total,
      estimatedSizeMB: estimatedSizeMB,
      maxLogCount: config.max_log_count,
      autoCleanThreshold: config.auto_clean_threshold,
      autoCleanDays: Math.floor(config.auto_clean_threshold / 10000), // 假设每天10000条
      timezone: "Asia/Shanghai",
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        stats,
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
  } catch (error) {
    console.error("获取 API 日志失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取 API 日志失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestDelete(context) {
  const { env } = context;
  const adminApiKey = env.ADMIN_API_KEY;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // 设置 service_role key 用于写入操作
  setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(context.request.url);
    const autoClean = url.searchParams.get("autoClean") === "true";
    const beforeDate = url.searchParams.get("beforeDate");

    // 自动清理：根据配置的阈值计算删除日期
    if (autoClean) {
      const configData = await select(
        supabaseUrl,
        supabaseAnonKey,
        "api_config",
        {
          columns: "auto_clean_threshold",
          orderBy: "id.asc",
          limit: "1",
          single: true,
        },
      );

      const thresholdDays = Math.floor(
        (configData?.auto_clean_threshold || 80000) / 10000,
      );
      const now = new Date();
      now.setDate(now.getDate() - thresholdDays);
      const autoCleanDate = now.toISOString();
      const result = await deleteLogs(
        supabaseUrl,
        supabaseAnonKey,
        `request_time=lt.${autoCleanDate}`,
      );
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({ success: true, message: "自动清理成功" }),
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

    // 手动删除：使用指定的 beforeDate
    if (!beforeDate) {
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({ success: false, error: "缺少 beforeDate 参数" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const result = await deleteLogs(
      supabaseUrl,
      supabaseAnonKey,
      `request_time=lt.${beforeDate}`,
    );
    resetServiceRoleKey();
    return new Response(
      JSON.stringify({ success: true, message: "手动删除成功" }),
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
  } catch (error) {
    resetServiceRoleKey();
    console.error("删除日志失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "删除日志失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
