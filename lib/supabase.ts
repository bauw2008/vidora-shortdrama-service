import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

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
