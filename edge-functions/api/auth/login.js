export async function onRequestPost(context) {
  const { request, env } = context;

  const adminUsername = env.ADMIN_USERNAME;
  const adminPassword = env.ADMIN_PASSWORD;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [login]: env.ADMIN_USERNAME =", adminUsername);
  console.log("DEBUG [login]: env.ADMIN_API_KEY =", adminApiKey);

  if (!adminUsername || !adminPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "未配置管理员凭据",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    console.log("DEBUG: received username =", username);
    console.log("DEBUG: received password =", password ? "***" : "undefined");

    if (username === adminUsername && password === adminPassword) {
      // 返回 ADMIN_API_KEY 作为 token
      return new Response(
        JSON.stringify({
          success: true,
          token: adminApiKey,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "用户名或密码错误",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "服务器错误",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
