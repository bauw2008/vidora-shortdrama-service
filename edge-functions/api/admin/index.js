/**
 * Edge Function - 处理 /api/admin 路径
 * 返回 404，因为没有默认的管理首页
 */
export async function onRequest(context) {
  return new Response(
    JSON.stringify({ success: false, error: "请访问具体的管理端点" }),
    {
      headers: { "Content-Type": "application/json" },
      status: 404,
    }
  );
}