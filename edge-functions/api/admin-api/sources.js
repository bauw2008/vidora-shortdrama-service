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
  const { request } = context;
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [sources GET]: env.ADMIN_API_KEY =", adminApiKey);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      // 获取单个 API 源
      const data = await select(supabaseUrl, supabaseAnonKey, "api_sources", {
        filter: `id=eq.${id}`,
        single: true,
      });

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // 获取所有 API 源
      const data = await select(supabaseUrl, supabaseAnonKey, "api_sources", {
        orderBy: "created_at.desc",
      });

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    console.error("获取 API 源失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取 API 源失败",
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

  console.log("DEBUG [sources POST]: env.ADMIN_API_KEY =", adminApiKey);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop();

    if (action === "test") {
      // 测试 API 源 - 不需要 serviceRoleKey
      const { url: apiUrl } = body;
      const testUrl = `${apiUrl}?ac=list&pagesize=1`;

      const response = await fetch(testUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "API 源不可用" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          },
        );
      }

      const data = await response.json();

      if (data && data.code === 1 && data.list) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { total: data.total || data.list.length },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "API 源返回格式不正确" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          },
        );
      }
    } else if (action === "activate") {
      // 激活 API 源 - 需要 serviceRoleKey
      const { id } = body;

      // 设置 service_role key 用于写入操作
      setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

      try {
        // 先禁用所有源
        await supabaseUpdate(supabaseUrl, supabaseAnonKey, "api_sources", {
          is_active: false,
        });

        // 启用指定源
        await supabaseUpdate(
          supabaseUrl,
          supabaseAnonKey,
          "api_sources",
          { is_active: true },
          `id=eq.${id}`,
        );

        resetServiceRoleKey();

        return new Response(
          JSON.stringify({ success: true, message: "API 源已激活" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      } catch (error) {
        resetServiceRoleKey();
        throw error;
      }
    } else {
      // 创建新 API 源 - 需要 serviceRoleKey
      const { name, url } = body;

      // 设置 service_role key 用于写入操作
      setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

      try {
        const data = await insert(supabaseUrl, supabaseAnonKey, "api_sources", {
          name,
          url,
          is_active: false,
        });

        resetServiceRoleKey();

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } catch (error) {
        resetServiceRoleKey();
        throw error;
      }
    }
  } catch (error) {
    console.error("操作失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "操作失败",
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

  console.log("DEBUG [sources DELETE]: env.ADMIN_API_KEY =", adminApiKey);

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

    if (!id) {
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({ success: false, error: "缺少 id 参数" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    await remove(supabaseUrl, supabaseAnonKey, "api_sources", `id=eq.${id}`);

    resetServiceRoleKey();

    return new Response(
      JSON.stringify({ success: true, message: "API 源已删除" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    resetServiceRoleKey();
    console.error("删除失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "删除失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
