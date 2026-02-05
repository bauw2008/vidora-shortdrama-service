const API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || "";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private adminApiKey: string;

  constructor(baseUrl: string, adminApiKey: string) {
    this.baseUrl = baseUrl;
    this.adminApiKey = adminApiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.adminApiKey) {
      headers["X-API-Key"] = this.adminApiKey;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `请求失败: ${response.statusText}`,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "网络请求失败",
      };
    }
  }

  // 公共 API
  async healthCheck() {
    return this.request("health");
  }

  async getList(params: {
    page?: number;
    pageSize?: number;
    categoryId?: number;
    subCategoryId?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.pageSize)
      queryParams.set("pageSize", params.pageSize.toString());
    if (params.categoryId)
      queryParams.set("categoryId", params.categoryId.toString());
    if (params.subCategoryId)
      queryParams.set("subCategoryId", params.subCategoryId.toString());

    return this.request(`list?${queryParams.toString()}`);
  }

  async getDetail(vodId: number) {
    return this.request(`detail/${vodId}`);
  }

  async search(params: { keyword: string; page?: number; pageSize?: number }) {
    const queryParams = new URLSearchParams();
    queryParams.set("keyword", params.keyword);
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.pageSize)
      queryParams.set("pageSize", params.pageSize.toString());

    return this.request(`search?${queryParams.toString()}`);
  }

  async getPlay(vodId: number, episode?: number) {
    const query = episode
      ? `?vodId=${vodId}&episode=${episode}`
      : `?vodId=${vodId}`;
    return this.request(`play${query}`);
  }

  async getCategories() {
    return this.request("categories");
  }

  // 管理 API
  async getStats() {
    return this.request("admin/stats");
  }

  async startSync(type: string = "incremental", hours: number = 24) {
    return this.request("admin/sync", {
      method: "POST",
      body: JSON.stringify({ type, hours }),
    });
  }

  async backupExport() {
    return this.request("admin/backup", {
      method: "POST",
      body: JSON.stringify({ action: "export" }),
    });
  }

  async backupImport(data: any) {
    return this.request("admin/backup", {
      method: "POST",
      body: JSON.stringify({ action: "import", ...data }),
    });
  }

  async getApiConfig() {
    return this.request("admin/api-config");
  }

  async updateApiConfig(config: any) {
    return this.request("admin/api-config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getApiLogs(params: {
    page?: number;
    pageSize?: number;
    ip?: string;
    endpoint?: string;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.pageSize)
      queryParams.set("pageSize", params.pageSize.toString());
    if (params.ip) queryParams.set("ip", params.ip);
    if (params.endpoint) queryParams.set("endpoint", params.endpoint);
    if (params.status) queryParams.set("status", params.status);

    return this.request(`admin/api-logs?${queryParams.toString()}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL, ADMIN_API_KEY);
