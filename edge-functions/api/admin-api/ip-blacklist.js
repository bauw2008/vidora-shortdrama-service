// Supabase REST API helpers (from shared)
import {
  select,
  selectCount,
  insert,
  remove,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey,
} from "./shared/helpers.js";

export async function onRequestGet(context) {
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

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      select(supabaseUrl, supabaseAnonKey, "ip_blacklist", {
        orderBy: "created_at.desc",
        limit: pageSize.toString(),
        offset: offset.toString(),
      }),
      selectCount(supabaseUrl, supabaseAnonKey, "ip_blacklist"),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return new Response(
      JSON.stringify({
        success: true,
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取黑名单失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPost(context) {
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
    const data = await insert(
      supabaseUrl,
      supabaseAnonKey,
      "ip_blacklist",
      body,
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
        error: error instanceof Error ? error.message : "添加黑名单失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestDelete(context) {
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
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    await remove(supabaseUrl, supabaseAnonKey, "ip_blacklist", `id=eq.${id}`);

    resetServiceRoleKey();

    return new Response(
      JSON.stringify({ success: true, message: "IP 已从黑名单移除" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    resetServiceRoleKey();
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "删除黑名单失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
