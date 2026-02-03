/**
 * API Key 验证
 */
export async function verifyApiKey(request: Request): Promise<boolean> {
  const { getApiConfig } = await import('./db/operations');
  
  // 获取 API 配置
  try {
    const config = await getApiConfig();
    
    // 如果认证已关闭，直接允许访问
    if (!config.auth_enabled) {
      return true;
    }
    
    // 如果认证已开启，验证 API Key
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;

    const providedKey = authHeader.replace('Bearer ', '');
    
    // 如果没有配置 API Key，允许所有请求
    if (!config.api_key) {
      return true;
    }

    return providedKey === config.api_key;
  } catch (error) {
    // 如果获取配置失败，默认允许访问（避免服务不可用）
    console.error('获取 API 配置失败:', error);
    return true;
  }
}

/**
 * 管理员认证验证
 */
export function verifyAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const providedKey = authHeader?.replace('Bearer ', '');

  // 验证 ADMIN_API_KEY（用于 API 调用）
  const apiKey = process.env.ADMIN_API_KEY;
  if (apiKey && providedKey === apiKey) {
    return true;
  }

  // 验证登录 Token（用于管理后台）
  try {
    const decoded = Buffer.from(providedKey, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    return username === adminUsername && password === adminPassword;
  } catch {
    return false;
  }
}