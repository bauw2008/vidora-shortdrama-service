import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";

console.log("DEBUG supabase.ts:");
console.log("  SUPABASE_URL:", supabaseUrl ? "已设置" : "未设置");
console.log("  SUPABASE_ANON_KEY:", supabaseAnonKey ? "已设置" : "未设置");
console.log(
  "  SUPABASE_SERVICE_ROLE_KEY:",
  supabaseServiceRoleKey ? "已设置" : "未设置",
);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// 用于 Node.js 服务端环境（普通 API 路由）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { Connection: "keep-alive" },
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      return fetch(url, {
        ...options,
        signal: controller.signal,
      })
        .finally(() => clearTimeout(timeoutId))
        .catch((error) => {
          console.error("Supabase fetch error:", error);
          throw error;
        });
    },
  },
});

// 用于 Node.js 服务端环境的写入操作（使用 service_role key 绕过 RLS）
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: { Connection: "keep-alive" },
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

          return fetch(url, {
            ...options,
            signal: controller.signal,
          })
            .finally(() => clearTimeout(timeoutId))
            .catch((error) => {
              console.error("Supabase admin fetch error:", error);
              throw error;
            });
        },
      },
    })
  : supabase; // 如果没有 service_role key，回退到普通客户端

// 用于 Edge Runtime 环境
export function createEdgeClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Connection: "keep-alive" },
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // Edge 环境 20秒超时

        return fetch(url, {
          ...options,
          signal: controller.signal,
        })
          .finally(() => clearTimeout(timeoutId))
          .catch((error) => {
            console.error("Supabase Edge fetch error:", error);
            throw error;
          });
      },
    },
    db: {
      schema: "public",
    },
  });
}
