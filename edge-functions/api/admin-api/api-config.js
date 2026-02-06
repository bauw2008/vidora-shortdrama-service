// Supabase REST API helpers (from shared)
import {
  select,
  insert,
  supabaseUpdate,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey
} from "./shared/helpers.js";

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
    const data = await select(supabaseUrl, supabaseAnonKey, "api_config", {
      columns: "*",
      orderBy: "id.asc",
      limit: "1",
      single: true
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("获取 API 配置失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取 API 配置失败",
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

  // 设置 service_role key 用于写入操作
  setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await context.request.json();
    console.log("DEBUG [api-config POST]: body =", body);
    const existing = await select(supabaseUrl, supabaseAnonKey, "api_config", {
      columns: "id",
      orderBy: "id.asc",
      limit: "1",
      single: true
    });
    console.log("DEBUG [api-config POST]: existing =", existing);

    let data;
    if (!existing || !existing.id) {
      console.log("DEBUG [api-config POST]: Inserting new config");
      data = await insert(supabaseUrl, supabaseAnonKey, "api_config", body);
    } else {
      console.log("DEBUG [api-config POST]: Updating existing config, id =", existing.id);
      data = await supabaseUpdate(supabaseUrl, supabaseAnonKey, "api_config", body, `id=eq.${existing.id}`);
      // 如果更新返回 null，使用传入的 body 作为返回数据
      if (!data) {
        data = { ...body, id: existing.id };
      }
    }

    // 重置 service_role key
    resetServiceRoleKey();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    // 重置 service_role key
    resetServiceRoleKey();
    console.error("更新 API 配置失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "更新 API 配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}