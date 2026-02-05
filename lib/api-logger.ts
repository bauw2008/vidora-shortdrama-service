import { supabase } from "./supabase";

interface ApiLogData {
  ip_address: string;
  api_endpoint: string;
  http_method: string;
  request_params?: string;
  response_status?: number;
  auth_validated?: boolean;
  error_message?: string;
  user_agent?: string;
  remaining_minute?: number;
  remaining_hourly?: number;
  remaining_daily?: number;
  response_time_ms?: number;
  is_rate_limit_warning?: boolean;
}

// IP 访问缓存（用于智能采样）
const ipAccessCache = new Map<
  string,
  {
    lastLogTime: number;
    successCount: number;
    errorCount: number;
  }
>();

// 清理过期缓存（每1小时清理一次）
setInterval(
  () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    for (const [ip, data] of ipAccessCache.entries()) {
      if (now - data.lastLogTime > oneHour) {
        ipAccessCache.delete(ip);
      }
    }
  },
  60 * 60 * 1000,
);

/**
 * 判断是否应该记录日志（智能采样策略）
 */
function shouldLog(data: ApiLogData): boolean {
  const now = Date.now();
  const ip = data.ip_address;
  const cache = ipAccessCache.get(ip);

  // 1. 始终记录错误和限流警告
  if (
    data.response_status &&
    (data.response_status >= 400 || data.is_rate_limit_warning)
  ) {
    return true;
  }

  // 2. 始终记录认证失败的请求
  if (!data.auth_validated) {
    return true;
  }

  // 3. 始终记录响应时间过慢的请求（> 3秒）
  if (data.response_time_ms && data.response_time_ms > 3000) {
    return true;
  }

  // 4. 新 IP：首次访问记录
  if (!cache) {
    ipAccessCache.set(ip, {
      lastLogTime: now,
      successCount: 1,
      errorCount: 0,
    });
    return true;
  }

  // 5. 智能采样策略
  const timeSinceLastLog = now - cache.lastLogTime;
  cache.successCount++;

  // 如果距离上次记录超过 10 分钟，记录一次
  if (timeSinceLastLog > 10 * 60 * 1000) {
    cache.lastLogTime = now;
    return true;
  }

  // 每 100 次成功请求记录 1 次
  if (cache.successCount >= 100) {
    cache.successCount = 0;
    cache.lastLogTime = now;
    return true;
  }

  // 随机采样（1% 概率记录）
  if (Math.random() < 0.01) {
    cache.lastLogTime = now;
    return true;
  }

  return false;
}

/**
 * 记录 API 调用日志（智能采样版本）
 */
export async function logApiCall(data: ApiLogData): Promise<void> {
  // 检查是否应该记录
  if (!shouldLog(data)) {
    return;
  }

  try {
    // 获取配置的时区
    const { data: apiConfig } = await supabase
      .from("api_config")
      .select("timezone")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    const timezone = apiConfig?.timezone || "Asia/Shanghai";

    // 使用 Intl API 获取指定时区的当前时间
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";
    const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const localTime = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;

    // 直接存储为本地时区时间（不带时区信息）
    const request_time = `${localDate} ${localTime}`;

    await supabase.from("api_logs").insert({
      ip_address: data.ip_address,
      api_endpoint: data.api_endpoint,
      http_method: data.http_method,
      request_params: data.request_params || null,
      response_status: data.response_status || null,
      auth_validated: data.auth_validated || false,
      error_message: data.error_message || null,
      user_agent: data.user_agent || null,
      remaining_minute: data.remaining_minute || null,
      remaining_hourly: data.remaining_hourly || null,
      remaining_daily: data.remaining_daily || null,
      response_time_ms: data.response_time_ms || null,
      is_rate_limit_warning: data.is_rate_limit_warning || false,
      request_time,
    });
  } catch (error) {
    // 日志记录失败不影响主业务
    console.error("API 日志记录失败:", error);
  }
}

/**
 * 获取请求参数字符串（用于日志记录）
 */
export function getRequestParams(request: Request): string {
  try {
    const url = new URL(request.url);
    const params = url.searchParams.toString();
    // 隐藏敏感信息（如 API Key）
    return params.replace(/api_key=[^&]+/g, "api_key=***");
  } catch {
    return "";
  }
}

/**
 * 获取 User-Agent
 */
export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") || "";
}

/**
 * 创建性能监控包装器
 * 自动记录响应时间和剩余配额
 */
export function createPerformanceMonitor(startTime: number) {
  return {
    getResponseTime: () => Date.now() - startTime,
  };
}

/**
 * 强制记录日志（用于重要事件）
 */
export async function forceLogApiCall(data: ApiLogData): Promise<void> {
  try {
    // 获取配置的时区
    const { data: apiConfig } = await supabase
      .from("api_config")
      .select("timezone")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    const timezone = apiConfig?.timezone || "Asia/Shanghai";

    // 使用 Intl API 获取指定时区的当前时间
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";
    const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const localTime = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;

    // 直接存储为本地时区时间（不带时区信息）
    const request_time = `${localDate} ${localTime}`;

    await supabase.from("api_logs").insert({
      ip_address: data.ip_address,
      api_endpoint: data.api_endpoint,
      http_method: data.http_method,
      request_params: data.request_params || null,
      response_status: data.response_status || null,
      auth_validated: data.auth_validated || false,
      error_message: data.error_message || null,
      user_agent: data.user_agent || null,
      remaining_minute: data.remaining_minute || null,
      remaining_hourly: data.remaining_hourly || null,
      remaining_daily: data.remaining_daily || null,
      response_time_ms: data.response_time_ms || null,
      is_rate_limit_warning: data.is_rate_limit_warning || false,
      request_time,
    });
  } catch (error) {
    console.error("API 日志记录失败:", error);
  }
}
