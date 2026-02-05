import { supabase } from "./supabase";

interface RateLimitConfig {
  rate_limit_minute: number;
  rate_limit_hourly: number;
  rate_limit_daily: number;
  auth_enabled: boolean;
}

interface RateLimitCheck {
  success: boolean;
  error?: string;
  remaining_minute?: number;
  remaining_hourly?: number;
  remaining_daily?: number;
}

// 获取 IP 地址
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const remoteAddr = request.headers.get("remote-addr");

  if (forwarded) {
    // 取第一个 IP（客户端真实 IP）
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  if (remoteAddr) {
    return remoteAddr;
  }
  return "unknown";
}

// 检查 IP 黑名单
export async function checkIpBlacklist(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("ip_blacklist")
      .select("id")
      .eq("ip_address", ip)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("检查 IP 黑名单失败:", error);
    }

    return !!data;
  } catch {
    return false;
  }
}

// 添加 IP 到黑名单
export async function addToBlacklist(
  ip: string,
  reason: string = "",
): Promise<void> {
  await supabase
    .from("ip_blacklist")
    .upsert({ ip_address: ip, reason }, { onConflict: "ip_address" });
}

// 获取速率限制配置
export async function getRateLimitConfig(): Promise<RateLimitConfig | null> {
  try {
    const { data, error } = await supabase
      .from("api_config")
      .select(
        "rate_limit_minute, rate_limit_hourly, rate_limit_daily, auth_enabled",
      )
      .order("id", { ascending: true })
      .limit(1)
      .single();

    if (error) {
      console.error("获取速率限制配置失败:", error);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// 检查并记录速率限制
export async function checkAndRecordRateLimit(
  identifier: string,
  type: "ip" | "apikey",
  config: RateLimitConfig,
): Promise<RateLimitCheck> {
  const now = new Date();
  const minuteWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  );
  const hourWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0,
  );
  const dayWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );

  try {
    // 检查现有记录
    const { data: existing } = await supabase
      .from("api_rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("type", type)
      .single();

    let minuteCount = 0;
    let hourlyCount = 0;
    let dailyCount = 0;

    if (existing) {
      // 如果时间窗口已过，重置计数
      const isNewMinute = existing.minute_window < minuteWindow;
      const isNewHour = existing.hour_window < hourWindow;
      const isNewDay = existing.day_window < dayWindow;

      minuteCount = isNewMinute ? 0 : existing.minute_count;
      hourlyCount = isNewHour ? 0 : existing.hourly_count;
      dailyCount = isNewDay ? 0 : existing.daily_count;

      // 更新记录
      await supabase
        .from("api_rate_limits")
        .update({
          minute_count: minuteCount + 1,
          hourly_count: hourlyCount + 1,
          daily_count: dailyCount + 1,
          minute_window: minuteWindow.toISOString(),
          hour_window: hourWindow.toISOString(),
          day_window: dayWindow.toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // 创建新记录
      await supabase.from("api_rate_limits").insert({
        identifier,
        type,
        minute_count: 1,
        hourly_count: 1,
        daily_count: 1,
        minute_window: minuteWindow.toISOString(),
        hour_window: hourWindow.toISOString(),
        day_window: dayWindow.toISOString(),
      });

      minuteCount = 1;
      hourlyCount = 1;
      dailyCount = 1;
    }

    // 检查限制（按优先级：每分钟 > 每小时 > 每天）
    if (minuteCount > config.rate_limit_minute) {
      return {
        success: false,
        error: `超过每分钟限制 (${config.rate_limit_minute} 次/分钟)`,
        remaining_minute: 0,
      };
    }

    if (hourlyCount > config.rate_limit_hourly) {
      return {
        success: false,
        error: `超过每小时限制 (${config.rate_limit_hourly} 次/小时)`,
        remaining_hourly: 0,
      };
    }

    if (dailyCount > config.rate_limit_daily) {
      return {
        success: false,
        error: `超过每天限制 (${config.rate_limit_daily} 次/天)`,
        remaining_daily: 0,
      };
    }

    return {
      success: true,
      remaining_minute: config.rate_limit_minute - minuteCount,
      remaining_hourly: config.rate_limit_hourly - hourlyCount,
      remaining_daily: config.rate_limit_daily - dailyCount,
    };
  } catch (error) {
    console.error("速率限制检查失败:", error);
    // 检查失败时，允许访问（避免服务不可用）
    return {
      success: true,
      remaining_minute: config.rate_limit_minute,
      remaining_hourly: config.rate_limit_hourly,
      remaining_daily: config.rate_limit_daily,
    };
  }
}

// 主检查函数
export async function checkRateLimit(
  request: Request,
): Promise<RateLimitCheck> {
  const config = await getRateLimitConfig();

  // 如果配置无效，允许所有请求（避免服务不可用）
  if (!config) {
    return { success: true };
  }

  const ip = getClientIp(request);

  // 检查 IP 黑名单（始终生效，不受认证开关影响）
  if (await checkIpBlacklist(ip)) {
    return {
      success: false,
      error: "IP 地址已被封禁",
    };
  }

  // 检查 IP 速率限制（始终生效，不受认证开关影响）
  return await checkAndRecordRateLimit(ip, "ip", config);
}
