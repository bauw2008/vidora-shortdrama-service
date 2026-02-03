import { supabase } from '../supabase';

// ============================================
// 类型定义
// ============================================

export interface Category {
  id: number;
  name: string;
  sort: number;
  is_active: boolean;
  created_at: string;
}

export interface SubCategory {
  id: number;
  name: string;
  category_id: number | null;
  created_at: string;
}

export interface ApiSource {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncSchedule {
  id: number;
  name: string;
  hour: number;
  minute: number;
  is_active: boolean;
  last_run_time: string | null;
  next_run_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayUrl {
  episode: number;
  url: string;
}

export interface ApiFieldConfig {
  id: number;
  api_endpoint: string; // 'list' 或 'detail'
  field_name: string;
  field_label: string;
  is_enabled: boolean;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface VideoData {
  id?: number;
  vod_id: number;
  name: string;
  category_id: number | null;
  sub_category_id?: number;
  tags: string[];
  episode_count: number;
  cover: string;
  description: string;
  play_urls: PlayUrl[];
  
  // 元数据字段
  actor: string;
  director: string;
  writer: string;
  area: string;
  lang: string;
  year: string;
  remarks: string;  // 集数备注
  
  // 热度数据
  hits: number;
  hits_day: number;
  hits_week: number;
  hits_month: number;
  up: number;
  down: number;
  
  // 评分数据
  score: number;
  score_num: number;
  
  // 时间戳
  updated_at: string;  // 更新时间（字符串格式）
  added_at: number;    // 添加时间戳
  synced_at?: string;
}

export interface SyncStatus {
  id: number;
  is_syncing: boolean;
  sync_type: string;
  last_sync_time: string | null;
  total_videos: number;
  total_categories: number;
  current_page: number;
  total_pages: number;
  synced_count: number;
  updated_at: string;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// 分类操作
// ============================================

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort', { ascending: true });

  if (error) {
    console.error('获取分类失败:', error);
    throw new Error('获取分类失败');
  }

  return data || [];
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('获取分类失败:', error);
    return null;
  }

  return data;
}

export async function createCategory(category: {
  name: string;
  sort: number;
  is_active: boolean;
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single();

  if (error) {
    console.error('创建分类失败:', error);
    throw new Error('创建分类失败');
  }

  return data;
}

export async function updateCategory(
  id: number,
  updates: Partial<{ name: string; sort: number; is_active: boolean }>
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新分类失败:', error);
    return null;
  }

  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除分类失败:', error);
    throw new Error('删除分类失败');
  }
}

// ============================================
// 二级分类操作
// ============================================

export async function getSubCategories(categoryId?: number): Promise<SubCategory[]> {
  let query = supabase
    .from('sub_categories')
    .select('*');

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query.order('name');

  if (error) {
    console.error('获取二级分类失败:', error);
    throw new Error('获取二级分类失败');
  }

  return data || [];
}

export async function getOrCreateSubCategory(name: string): Promise<SubCategory> {
  // 先尝试查询
  const { data: existing, error: fetchError } = await supabase
    .from('sub_categories')
    .select('*')
    .eq('name', name)
    .single();

  if (existing) {
    return existing;
  }

  // 尝试插入
  const { data, error } = await supabase
    .from('sub_categories')
    .insert({ name })
    .select()
    .single();

  // 如果插入失败（可能是并发冲突），再次查询
  if (error) {
    const { data: retryData, error: retryError } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('name', name)
      .single();

    if (retryData) {
      return retryData;
    }

    console.error('创建二级分类失败:', error);
    throw new Error('创建二级分类失败');
  }

  return data;
}

export async function updateSubCategoryCategory(
  subCategoryId: number,
  categoryId: number
): Promise<void> {
  const { error } = await supabase
    .from('sub_categories')
    .update({ category_id: categoryId })
    .eq('id', subCategoryId);

  if (error) {
    console.error('更新二级分类失败:', error);
    throw new Error('更新二级分类失败');
  }
}

// ============================================
// 视频操作
// ============================================

export async function getVideos(
  page: number = 1,
  pageSize: number = 20,
  categoryId?: number,
  subCategoryId?: number
): Promise<PaginatedResult<VideoData>> {
  let query = supabase
    .from('videos')
    .select('*', { count: 'exact' });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  if (subCategoryId) {
    query = query.eq('sub_category_id', subCategoryId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('synced_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('获取视频列表失败:', error);
    throw new Error('获取视频列表失败');
  }

  return {
    list: data || [],
    total: count || 0,
    page,
    pageSize,
  };
}

export async function getVideoByVodId(vodId: number): Promise<VideoData | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('vod_id', vodId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('获取视频详情失败:', error);
    throw new Error('获取视频详情失败');
  }

  return data;
}

export async function getVideoUpdateTimeByVodId(vodId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('updated_at')
    .eq('vod_id', vodId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 记录不存在
      return null;
    }
    console.error('获取视频更新时间失败:', error);
    throw new Error('获取视频更新时间失败');
  }

  return data?.updated_at || null;
}

export async function getVideosUpdateTimeMap(vodIds: number[]): Promise<Map<number, string>> {
  if (vodIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('videos')
    .select('vod_id, updated_at')
    .in('vod_id', vodIds);

  if (error) {
    console.error('批量获取视频更新时间失败:', error);
    throw new Error('批量获取视频更新时间失败');
  }

  const map = new Map<number, string>();
  data?.forEach((v: any) => {
    map.set(v.vod_id, v.updated_at);
  });

  return map;
}

export async function searchVideos(
  keyword: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResult<VideoData>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('videos')
    .select('*', { count: 'exact' })
    .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    .order('synced_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('搜索视频失败:', error);
    throw new Error('搜索视频失败');
  }

  return {
    list: data || [],
    total: count || 0,
    page,
    pageSize,
  };
}

export async function saveVideos(videos: VideoData[]): Promise<{ added: number; updated: number }> {
  if (videos.length === 0) {
    return { added: 0, updated: 0 };
  }

  let added = 0;
  let updated = 0;

  for (const video of videos) {
    const { data: existing } = await supabase
      .from('videos')
      .select('vod_id')
      .eq('vod_id', video.vod_id)
      .single();

    if (existing) {
      updated++;
    } else {
      added++;
    }
  }

  const { error } = await supabase
    .from('videos')
    .upsert(videos, {
      onConflict: 'vod_id',
    });

  if (error) {
    console.error('保存视频失败:', error);
    throw new Error('保存视频失败');
  }

  return { added, updated };
}

export async function updateVideoCategory(
  vodId: number,
  categoryId: number
): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({ category_id: categoryId })
    .eq('vod_id', vodId);

  if (error) {
    console.error('更新视频分类失败:', error);
    throw new Error('更新视频分类失败');
  }
}

export async function batchUpdateVideoCategory(
  categoryId: number,
  subCategoryId?: number
): Promise<number> {
  let query = supabase
    .from('videos')
    .update({ category_id: categoryId });

  if (subCategoryId) {
    // 更新指定二级分类的视频
    query = query.eq('sub_category_id', subCategoryId);
  } else {
    // 更新该一级分类下所有已映射的二级分类的视频
    const { data: subCategories } = await supabase
      .from('sub_categories')
      .select('id')
      .eq('category_id', categoryId);

    const subCategoryIds = subCategories?.map(sc => sc.id) || [];
    if (subCategoryIds.length > 0) {
      query = query.in('sub_category_id', subCategoryIds);
    } else {
      // 如果没有二级分类，返回0
      return 0;
    }
  }

  const { data, error } = await query.select('id');

  if (error) {
    console.error('批量更新视频分类失败:', error);
    throw new Error('批量更新视频分类失败');
  }

  return data?.length || 0;
}

// ============================================
// 同步状态操作
// ============================================

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const { data, error } = await supabase
    .from('sync_status')
    .select('*')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('获取同步状态失败:', error);
    return null;
  }

  return data;
}

export async function updateSyncStatus(
  status: Partial<SyncStatus>
): Promise<void> {
  const { data: existing } = await supabase
    .from('sync_status')
    .select('id')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (!existing) {
    const { error } = await supabase
      .from('sync_status')
      .insert({
        is_syncing: status.is_syncing ?? false,
        sync_type: status.sync_type ?? '',
        last_sync_time: status.last_sync_time,
        total_videos: status.total_videos ?? 0,
        total_categories: status.total_categories ?? 0,
        current_page: status.current_page ?? 0,
        total_pages: status.total_pages ?? 0,
        synced_count: status.synced_count ?? 0,
      });

    if (error) {
      console.error('创建同步状态失败:', error);
      throw new Error('创建同步状态失败');
    }
    return;
  }

  const { error } = await supabase
    .from('sync_status')
    .update({
      is_syncing: status.is_syncing,
      sync_type: status.sync_type,
      last_sync_time: status.last_sync_time,
      total_videos: status.total_videos,
      total_categories: status.total_categories,
      current_page: status.current_page,
      total_pages: status.total_pages,
      synced_count: status.synced_count,
    })
    .eq('id', existing.id);

  if (error) {
    console.error('更新同步状态失败:', error);
    throw new Error('更新同步状态失败');
  }
}

export async function resetSyncStatus(): Promise<void> {
  const { data: existing } = await supabase
    .from('sync_status')
    .select('id')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('sync_status')
      .update({
        is_syncing: false,
        sync_type: '',
        last_sync_time: null,
        total_videos: 0,
        total_categories: 0,
        current_page: 0,
        total_pages: 0,
        synced_count: 0,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('重置同步状态失败:', error);
      throw new Error('重置同步状态失败');
    }
  }
}

// ============================================
// 统计操作
// ============================================

export async function getDatabaseStats(): Promise<{
  totalVideos: number;
  totalCategories: number;
  totalSubCategories: number;
  todayUpdated: number;
}> {
  // 获取今日开始时间（北京时间 UTC+8）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [videosResult, categoriesResult, subCategoriesResult, todayResult] = await Promise.all([
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('sub_categories').select('*', { count: 'exact', head: true }),
    supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .gte('synced_at', todayStart.toISOString()),
  ]);

  return {
    totalVideos: videosResult.count || 0,
    totalCategories: categoriesResult.count || 0,
    totalSubCategories: subCategoriesResult.count || 0,
    todayUpdated: todayResult.count || 0,
  };
}

// ============================================
// 清理操作
// ============================================

export async function clearVideos(): Promise<number> {
  const { data, error } = await supabase
    .from('videos')
    .delete()
    .neq('vod_id', -1) // RLS 要求必须有 WHERE 条件，使用不存在的 ID
    .select('id');

  if (error) {
    console.error('清空视频失败:', error);
    throw new Error('清空视频失败');
  }

  return data?.length || 0;
}

export async function clearSubCategories(): Promise<number> {
  const { data, error } = await supabase
    .from('sub_categories')
    .delete()
    .neq('id', -1) // RLS 要求必须有 WHERE 条件，使用不存在的 ID
    .select('id');

  if (error) {
    console.error('清空二级分类失败:', error);
    throw new Error('清空二级分类失败');
  }

  return data?.length || 0;
}

// ============================================
// API 源操作
// ============================================

export async function getApiSources(): Promise<ApiSource[]> {
  const { data, error } = await supabase
    .from('api_sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取 API 源失败:', error);
    throw new Error('获取 API 源失败');
  }

  return data || [];
}

export async function getActiveApiSource(): Promise<ApiSource | null> {
  const { data, error } = await supabase
    .from('api_sources')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('获取激活的 API 源失败:', error);
    return null;
  }

  return data;
}

export async function createApiSource(
  source: Omit<ApiSource, 'id' | 'created_at' | 'updated_at'>
): Promise<ApiSource> {
  // 生成唯一 ID
  const id = `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { data, error } = await supabase
    .from('api_sources')
    .insert({
      id,
      name: source.name,
      url: source.url,
      is_active: source.is_active,
    })
    .select()
    .single();

  if (error) {
    console.error('创建 API 源失败:', error);
    throw new Error(`创建 API 源失败: ${error.message}`);
  }

  return data;
}

export async function updateApiSource(
  id: string,
  updates: Partial<Omit<ApiSource, 'id' | 'created_at' | 'updated_at'>>
): Promise<ApiSource | null> {
  const { data, error } = await supabase
    .from('api_sources')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新 API 源失败:', error);
    throw new Error('更新 API 源失败');
  }

  return data;
}

export async function deleteApiSource(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('api_sources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除 API 源失败:', error);
    throw new Error('删除 API 源失败');
  }

  return true;
}

export async function activateApiSource(id: string): Promise<void> {
  // 先停用所有 API 源
  await supabase.from('api_sources').update({ is_active: false });

  // 激活指定的 API 源
  const { error } = await supabase
    .from('api_sources')
    .update({ is_active: true })
    .eq('id', id);

  if (error) {
    console.error('激活 API 源失败:', error);
    throw new Error('激活 API 源失败');
  }
}

// ============================================
// 定时同步配置操作
// ============================================

export async function getSyncSchedules(): Promise<SyncSchedule[]> {
  const { data, error } = await supabase
    .from('sync_schedules')
    .select('*')
    .order('hour', { ascending: true })
    .order('minute', { ascending: true });

  if (error) {
    console.error('获取定时同步配置失败:', error);
    throw new Error('获取定时同步配置失败');
  }

  return data || [];
}

export async function createSyncSchedule(
  name: string,
  hour: number,
  minute: number
): Promise<SyncSchedule> {
  // 计算下次运行时间
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(hour, minute, 0, 0);
  
  // 如果今天的时间已经过了，设置为明天
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const { data, error } = await supabase
    .from('sync_schedules')
    .insert({
      name,
      hour,
      minute,
      next_run_time: nextRun.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('创建定时同步配置失败:', error);
    throw new Error('创建定时同步配置失败');
  }

  return data;
}

export async function updateSyncSchedule(
  id: number,
  updates: Partial<Pick<SyncSchedule, 'name' | 'hour' | 'minute' | 'is_active' | 'next_run_time'>>
): Promise<SyncSchedule> {
  // 如果更新了时间，需要重新计算下次运行时间
  let updateData = { ...updates };
  
  if (updates.hour !== undefined || updates.minute !== undefined) {
    const { data: existing } = await supabase
      .from('sync_schedules')
      .select('hour, minute')
      .eq('id', id)
      .single();

    if (existing) {
      const hour = updates.hour ?? existing.hour;
      const minute = updates.minute ?? existing.minute;
      
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setHours(hour, minute, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      updateData = { ...updateData, next_run_time: nextRun.toISOString() };
    }
  }

  const { data, error } = await supabase
    .from('sync_schedules')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新定时同步配置失败:', error);
    throw new Error('更新定时同步配置失败');
  }

  return data;
}

export async function deleteSyncSchedule(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('sync_schedules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除定时同步配置失败:', error);
    throw new Error('删除定时同步配置失败');
  }

  return true;
}

export async function updateSyncScheduleRunTime(id: number): Promise<void> {
  const { data: existing } = await supabase
    .from('sync_schedules')
    .select('hour, minute')
    .eq('id', id)
    .single();

  if (!existing) return;

  // 计算下次运行时间
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(existing.hour, existing.minute, 0, 0);
  
  // 设置为明天的这个时间
  nextRun.setDate(nextRun.getDate() + 1);

  const { error } = await supabase
    .from('sync_schedules')
    .update({
      last_run_time: now.toISOString(),
      next_run_time: nextRun.toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('更新定时同步运行时间失败:', error);
  }
}

// ============================================
// API 字段配置操作
// ============================================

export async function getFieldConfigs(
  apiEndpoint: 'list' | 'detail'
): Promise<ApiFieldConfig[]> {
  const { data, error } = await supabase
    .from('api_field_config')
    .select('*')
    .eq('api_endpoint', apiEndpoint)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('获取字段配置失败:', error);
    throw new Error('获取字段配置失败');
  }

  return data || [];
}

export async function updateFieldConfig(
  id: number,
  updates: Partial<Pick<ApiFieldConfig, 'is_enabled' | 'is_required' | 'display_order'>>
): Promise<ApiFieldConfig> {
  const { data, error } = await supabase
    .from('api_field_config')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新字段配置失败:', error);
    throw new Error('更新字段配置失败');
  }

  return data;
}

export async function getEnabledFields(
  apiEndpoint: 'list' | 'detail'
): Promise<string[]> {
  const configs = await getFieldConfigs(apiEndpoint);
  return configs
    .filter(config => config.is_enabled)
    .sort((a, b) => a.display_order - b.display_order)
    .map(config => config.field_name);
}

// ============================================
// API 配置操作
// ============================================

export interface ApiConfig {
  id: number;
  api_key: string;
  auth_enabled: boolean;
  rate_limit_minute: number;
  rate_limit_hourly: number;
  rate_limit_daily: number;
  updated_at: string;
}

export async function getApiConfig(): Promise<ApiConfig> {
  const { data, error } = await supabase
    .from('api_config')
    .select('*')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('获取 API 配置失败:', error);
    throw new Error('获取 API 配置失败');
  }

  return data;
}

export async function updateApiConfig(updates: {
  api_key?: string;
  auth_enabled?: boolean;
  rate_limit_minute?: number;
  rate_limit_hourly?: number;
  rate_limit_daily?: number;
}): Promise<ApiConfig> {
  const { data: existing } = await supabase
    .from('api_config')
    .select('id')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  if (!existing) {
    // 插入新配置
    const { data, error } = await supabase
      .from('api_config')
      .insert(updates)
      .select()
      .single();

    if (error) {
      console.error('创建 API 配置失败:', error);
      throw new Error('创建 API 配置失败');
    }

    return data;
  }

  // 更新现有配置
  const { data, error } = await supabase
    .from('api_config')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('更新 API 配置失败:', error);
    throw new Error('更新 API 配置失败');
  }

  return data;
}