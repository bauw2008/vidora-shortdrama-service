// Supabase REST API helpers (from shared)
import {
  select,
  insert,
  supabaseUpdate,
  remove,
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
    const data = await select(supabaseUrl, supabaseAnonKey, "categories", {
      orderBy: "sort.asc",
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取分类失败",
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
    const data = await insert(supabaseUrl, supabaseAnonKey, "categories", body);

    // 更新全局版本号
    await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "category_version",
      {
        version:
          (
            await select(supabaseUrl, supabaseAnonKey, "category_version", {
              orderBy: "id.desc",
              limit: "1",
              single: true,
            })
          ).version + 1,
      },
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
        error: error instanceof Error ? error.message : "创建分类失败",
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
    const { id, ...updateData } = body;

    const data = await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "categories",
      updateData,
      `id=eq.${id}`,
    );

    // 更新全局版本号
    await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "category_version",
      {
        version:
          (
            await select(supabaseUrl, supabaseAnonKey, "category_version", {
              orderBy: "id.desc",
              limit: "1",
              single: true,
            })
          ).version + 1,
      },
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
        error: error instanceof Error ? error.message : "更新分类失败",
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

    await remove(supabaseUrl, supabaseAnonKey, "categories", `id=eq.${id}`);

    // 更新全局版本号
    await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "category_version",
      {
        version:
          (
            await select(supabaseUrl, supabaseAnonKey, "category_version", {
              orderBy: "id.desc",
              limit: "1",
              single: true,
            })
          ).version + 1,
      },
      "id=eq.1",
    );

    resetServiceRoleKey();

    return new Response(
      JSON.stringify({ success: true, message: "分类已删除" }),
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
        error: error instanceof Error ? error.message : "删除分类失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
