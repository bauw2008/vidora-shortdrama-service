import axios, { AxiosError } from 'axios';
import { getActiveApiSource } from './db/operations';
import type {
  ApiListResponse,
  ApiDetailResponse,
  ApiVideoDetail,
} from './parser';

// ============================================
// 配置
// ============================================

const TIMEOUT = 15000;
const MIN_REQUEST_INTERVAL = 800; // 最小请求间隔（毫秒）- 稍微增加安全性
const DEFAULT_API_URL = 'https://api.wwzy.tv/api.php/provide/vod/';

// 随机 User-Agent 列表（增加更多真实浏览器 UA）
const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  // Firefox Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  // Edge Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

// ============================================
// 客户端类
// ============================================

class ApiClient {
  private lastRequestTime: number = 0;
  private minRequestInterval: number = MIN_REQUEST_INTERVAL;
  private cachedApiUrl: string | null = null;
  private apiUrl: string = DEFAULT_API_URL;

  constructor() {
    // 初始化时尝试从环境变量读取（向后兼容）
    if (process.env.API_SOURCE_URL) {
      this.apiUrl = process.env.API_SOURCE_URL;
      this.cachedApiUrl = this.apiUrl;
    }
  }

  // 获取随机 User-Agent
  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  // 限流：确保请求间隔不小于最小值（添加随机抖动）
private async rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - this.lastRequestTime;

  if (elapsed < this.minRequestInterval) {
    const waitTime = this.minRequestInterval - elapsed;
    // 添加随机抖动（0-200ms）使请求更自然
    const jitter = Math.random() * 200;
    await new Promise((resolve) => setTimeout(resolve, waitTime + jitter));
  }

  this.lastRequestTime = Date.now();
}

  // 获取 API URL（优先从数据库读取）
  private async getApiUrl(): Promise<string> {
    // 如果有缓存的 URL，直接返回
    if (this.cachedApiUrl) {
      return this.cachedApiUrl;
    }

    // 尝试从数据库获取激活的 API 源
    try {
      const activeSource = await getActiveApiSource();
      if (activeSource) {
        this.apiUrl = activeSource.url;
        this.cachedApiUrl = activeSource.url;
        console.log(`[API] 使用数据库配置的 API 源: ${activeSource.name} (${activeSource.url})`);
        return this.apiUrl;
      }
    } catch (error) {
      console.warn('[API] 从数据库获取 API 源失败，使用默认 URL');
    }

    // 如果数据库获取失败，使用默认 URL
    console.log(`[API] 使用默认 API 源: ${this.apiUrl}`);
    return this.apiUrl;
  }

  // 清除缓存的 API URL（用于切换 API 源时）
  clearApiUrlCache(): void {
    this.cachedApiUrl = null;
  }

  // HTTP 请求
  private async fetch<T>(url: string): Promise<T> {
    await this.rateLimit();

    try {
      const response = await axios.get<T>(url, {
        timeout: TIMEOUT,
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://api.wwzy.tv/',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        throw new Error(
          `API 请求失败: ${axiosError.response.status} - ${axiosError.response.statusText}`
        );
      } else if (axiosError.request) {
        throw new Error(`API 请求超时或网络错误: ${axiosError.message}`);
      } else {
        throw new Error(`API 请求错误: ${axiosError.message}`);
      }
    }
  }

  // 设置最小请求间隔
  setMinRequestInterval(interval: number): void {
    this.minRequestInterval = Math.max(100, interval);
  }

  // ============================================
  // API 方法
  // ============================================

  /**
   * 获取分类列表
   */
  async getCategories(): Promise<ApiListResponse> {
    const apiUrl = await this.getApiUrl();
    const url = `${apiUrl}?ac=list`;
    console.log(`[API] 获取分类列表: ${url}`);
    return this.fetch<ApiListResponse>(url);
  }

  /**
   * 获取视频列表
   * @param page 页码
   * @param size 每页数量
   * @param categoryId 分类ID（可选）
   */
  async getList(
    page: number = 1,
    size: number = 20,
    categoryId?: number
  ): Promise<ApiListResponse> {
    const apiUrl = await this.getApiUrl();
    const params = new URLSearchParams({
      ac: 'videolist',
      pg: page.toString(),
      pagesize: size.toString(),
    });

    if (categoryId) {
      params.append('t', categoryId.toString());
    }

    const url = `${apiUrl}?${params.toString()}`;
    console.log(`[API] 获取视频列表: ${url}`);
    return this.fetch<ApiListResponse>(url);
  }

  /**
   * 获取视频详情（单个）
   * @param id 视频ID
   */
  async getDetail(id: number | string): Promise<ApiDetailResponse> {
    const apiUrl = await this.getApiUrl();
    const url = `${apiUrl}?ac=detail&ids=${id}`;
    console.log(`[API] 获取视频详情: ${url}`);
    return this.fetch<ApiDetailResponse>(url);
  }

  /**
   * 批量获取视频详情
   * @param ids 视频ID数组
   */
  async getBatchDetails(ids: number[]): Promise<ApiVideoDetail[]> {
    if (ids.length === 0) {
      return [];
    }

    const apiUrl = await this.getApiUrl();

    // 每次最多请求 30 个视频的详情（提高效率）
    const batchSize = 30;
    const results: ApiVideoDetail[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const url = `${apiUrl}?ac=detail&ids=${batchIds.join(',')}`;
      console.log(`[API] 批量获取视频详情: ${url} (${batchIds.length} 个)`);

      const response = await this.fetch<ApiDetailResponse>(url);
      results.push(...response.list);

      // 批次之间添加随机延迟（300-600ms），避免被检测
      if (i + batchSize < ids.length) {
        const delay = 300 + Math.random() * 300;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * 搜索视频
   * @param keyword 关键词
   * @param page 页码
   */
  async search(keyword: string, page: number = 1): Promise<ApiListResponse> {
    const apiUrl = await this.getApiUrl();
    const params = new URLSearchParams({
      ac: 'list',
      wd: keyword,
      pg: page.toString(),
    });

    const url = `${apiUrl}?${params.toString()}`;
    console.log(`[API] 搜索视频: ${url}`);
    return this.fetch<ApiListResponse>(url);
  }
}

// ============================================
// 导出
// ============================================

export const sourceClient = new ApiClient();
export default sourceClient;