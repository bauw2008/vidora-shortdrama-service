import { getOrCreateSubCategory } from './db/operations';
import type { VideoData, PlayUrl } from './db/operations';

// ============================================
// API 数据类型定义
// ============================================

export interface ApiListResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: ApiVideoItem[];
  class: ApiCategory[];
}

export interface ApiVideoItem {
  vod_id: number;
  vod_name: string;
  type_id: number;
  type_name: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
}

export interface ApiDetailResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: ApiVideoDetail[];
}

export interface ApiVideoDetail {
  vod_id: number;
  type_id: number;
  vod_name: string;
  vod_class: string;
  vod_total: number;
  vod_pic: string;
  vod_blurb: string;
  vod_content: string;
  vod_play_url: string;
  vod_actor?: string;
  vod_director?: string;
  vod_writer?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_year?: string;
  vod_time: string;
  vod_time_add?: string;
  vod_remarks: string;
  vod_hits?: number;
  vod_hits_day?: number;
  vod_hits_week?: number;
  vod_hits_month?: number;
  vod_up?: number;
  vod_down?: number;
  vod_score?: number;
  vod_score_num?: number;
  vod_douban_id?: number;
  vod_douban_score?: number;
  vod_pubdate?: string;
}

export interface ApiCategory {
  type_id: number;
  type_pid: number;
  type_name: string;
}

// ============================================
// 分类解析
// ============================================

export interface ParsedCategory {
  type_id: number;
  type_name: string;
}

export function parseCategories(apiCategories: ApiCategory[]): ParsedCategory[] {
  return apiCategories
    .filter((cat) => cat.type_pid === 0)
    .map((cat) => ({
      type_id: cat.type_id,
      type_name: cat.type_name,
    }));
}

// ============================================
// 视频详情解析
// ============================================

export async function parseVideoDetail(
  apiData: ApiVideoDetail,
  defaultCategoryId: number | null = null
): Promise<VideoData> {
  // 1. 解析标签（vod_class 可能包含多个标签，逗号分隔）
  // 处理 vod_class 为空、null、undefined 的情况
  const vodClass = apiData.vod_class || '';
  const tags = vodClass
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // 2. 第一个标签作为二级分类，如果没有则使用"其他"
  const primaryTag = tags[0] || '其他';
  const subCategory = await getOrCreateSubCategory(primaryTag);

  // 3. 解析播放URL
  const playUrls = parsePlayUrls(apiData.vod_play_url);

  // 4. 清理简介（优先使用 vod_blurb，如果没有则使用 vod_content）
  const description = stripHtmlTags(
    apiData.vod_blurb || apiData.vod_content || ''
  );

  return {
    vod_id: apiData.vod_id,
    name: apiData.vod_name,
    category_id: defaultCategoryId, // 默认为 null，表示未分配一级分类
    sub_category_id: subCategory.id,
    tags: tags,
    episode_count: apiData.vod_total || 0,
    cover: apiData.vod_pic,
    description: description,
    play_urls: playUrls,
    
    // 元数据字段
    actor: apiData.vod_actor || '',
    director: apiData.vod_director || '',
    writer: apiData.vod_writer || '',
    area: apiData.vod_area || '',
    lang: apiData.vod_lang || '',
    year: apiData.vod_year || '',
    remarks: apiData.vod_remarks || '',
    
    // 热度数据
    hits: apiData.vod_hits || 0,
    hits_day: apiData.vod_hits_day || 0,
    hits_week: apiData.vod_hits_week || 0,
    hits_month: apiData.vod_hits_month || 0,
    up: apiData.vod_up || 0,
    down: apiData.vod_down || 0,
    
    // 评分数据
    score: apiData.vod_score || 0,
    score_num: apiData.vod_score_num || 0,
    
    // 时间戳
    updated_at: apiData.vod_time,
    added_at: apiData.vod_time_add ? parseInt(apiData.vod_time_add) : 0,
  };
}

// ============================================
// 播放URL解析
// ============================================

export function parsePlayUrls(vodPlayUrl: string): PlayUrl[] {
  if (!vodPlayUrl || vodPlayUrl.trim().length === 0) {
    return [];
  }

  // 格式: "01$url#02$url#03$url"
  return vodPlayUrl
    .split('#')
    .map((item) => {
      const parts = item.split('$');
      if (parts.length >= 2) {
        const episode = parseInt(parts[0]) || 0;
        const url = parts[1] || '';
        if (url.length > 0) {
          return { episode, url };
        }
      }
      return null;
    })
    .filter((item): item is PlayUrl => item !== null);
}

// ============================================
// HTML 标签清理
// ============================================

export function stripHtmlTags(html: string): string {
  let result = html;
  
  // 移除所有 HTML 标签
  result = result.replace(/<[^>]*>/g, '');
  
  // 循环解码 HTML 实体，直到没有 &amp; 为止（处理多重编码）
  while (result.includes('&amp;')) {
    result = result.replace(/&amp;/g, '&');
  }
  
  // 解码其他 HTML 实体
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
  
  // 压缩空白字符并去除首尾空白
  return result.replace(/\s+/g, ' ').trim();
}

// ============================================
// 批量解析
// ============================================

export async function parseVideoDetails(
  apiDetails: ApiVideoDetail[],
  defaultCategoryId: number | null = null
): Promise<VideoData[]> {
  const promises = apiDetails.map((detail) =>
    parseVideoDetail(detail, defaultCategoryId)
  );
  return Promise.all(promises);
}

// ============================================
// 验证数据
// ============================================

export function validateVideoData(data: VideoData): boolean {
  return !!(
    data.vod_id &&
    data.name &&
    data.cover &&
    data.episode_count > 0 &&
    data.play_urls.length > 0
  );
}

export function filterValidVideos(videos: VideoData[]): VideoData[] {
  return videos.filter(validateVideoData);
}