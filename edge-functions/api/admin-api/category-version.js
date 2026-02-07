// Supabase REST API helpers (from shared)
import {
  select,
  supabaseUpdate,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey,
} from "./shared/helpers.js";

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const data = await select(
      supabaseUrl,
      supabaseAnonKey,
      "category_version",
      {
        orderBy: "id.desc",
        limit: "1",
        single: true,
      },
    );

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取版本号失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPut(context) {
  const { request } = context;
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // 设置 service_role key 用于写入操作
  setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await request.json();
    const { version } = body;

    if (typeof version !== "number" || version < 1) {
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({
          success: false,
          error: "版本号必须是大于等于 1 的整数",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const data = await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "category_version",
      { version },
      "id=eq.1",
    );

    resetServiceRoleKey();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    resetServiceRoleKey();
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "更新版本号失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
