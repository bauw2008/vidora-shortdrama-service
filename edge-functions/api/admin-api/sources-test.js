// Supabase REST API helpers (from shared)
import { verifyAdminApiKey } from "./shared/helpers.js";

export async function onRequestPost(context) {
  const { request } = context;
  const { env } = context;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [sources-test POST]: env.ADMIN_API_KEY =", adminApiKey);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const { url: apiUrl } = body;
    const testUrl = `${apiUrl}?ac=list&pagesize=1`;

    console.log("DEBUG [sources-test]: Testing URL =", testUrl);

    const response = await fetch(testUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.log(
        "DEBUG [sources-test]: Response not OK, status =",
        response.status,
      );
      return new Response(
        JSON.stringify({ success: false, error: "API 源不可用" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const data = await response.json();
    console.log("DEBUG [sources-test]: Response data =", data);

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
  } catch (error) {
    console.error("测试 API 源失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "测试 API 源失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
