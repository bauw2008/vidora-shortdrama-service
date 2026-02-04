// WWZY 原始接口类型
export interface WWZYCategory {
  type_id: number;
  type_pid: number;
  type_name: string;
}

export interface WWZYVideoItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_from?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
  type_id?: number;
  vod_en?: string;
  vod_time?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_score?: string;
  vod_blurb?: string;
  vod_total?: number;
  vod_serial?: string;
}

export interface WWZYListResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: WWZYVideoItem[];
  class: WWZYCategory[];
}

export interface WWZYDetailResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: WWZYVideoItem[];
}

// 本服务接口类型（适配 Vidora 项目）
export interface ShortDramaCategory {
  type_id: number;
  type_name: string;
}

export interface ShortDramaItem {
  id: number | string;
  name: string;
  cover: string;
  update_time: string;
  score: number;
  episode_count: number;
  description: string;
  author: string;
  backdrop: string;
  vote_average: number;
  tmdb_id?: number;
  type_id?: number;
  type_name?: string;
  year?: string;
  area?: string;
  lang?: string;
  actor?: string;
  director?: string;
  class?: string;
}

export interface ShortDramaDetail extends ShortDramaItem {
  episodes: Episode[];
  vod_play_from?: string;
}

export interface Episode {
  index: number;
  label: string;
  url: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  ksize: number;
  vsize: number;
}

// API 源配置类型
export interface ApiSource {
  id: string;
  name: string;
  url: string;
  backupUrl?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}
