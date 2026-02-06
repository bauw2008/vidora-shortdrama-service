import { sourceClient } from "./api-client";
import { parseVideoDetails, filterValidVideos } from "./parser";
import {
  saveVideos,
  clearVideos,
  clearSubCategories,
  getDatabaseStats,
  getVideosUpdateTimeMap,
} from "./db/operations";
import type { VideoData } from "./db/operations";

// ============================================
// 同步配置
// ============================================

interface SyncConfig {
  batchSize: number; // 每批处理的视频数量
  requestInterval: number; // 请求间隔（毫秒）
  maxRetries: number; // 最大重试次数
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  batchSize: 50, // 增加批量大小，提高同步效率
  requestInterval: 1200, // 1.2秒间隔，平衡速度和安全性
  maxRetries: 3,
};

// ============================================
// 日志函数
// ============================================

const log = (message: string): void => {
  console.log(`[Sync] ${message}`);
};

const logProgress = (current: number, total: number, message: string): void => {
  const percentage = total > 0 ? ((current / total) * 100).toFixed(2) : "0.00";
  console.log(`[Sync] ${message} (${current}/${total}, ${percentage}%)`);
};

// ============================================
// 完整同步
// ============================================

export async function fullSync(
  config: SyncConfig = DEFAULT_SYNC_CONFIG,
  onProgress?: (progress: {
    current: number;
    total: number;
    message: string;
  }) => void,
  forceRestart: boolean = false,
): Promise<{ added: number; updated: number }> {
  log("========================================");
  log("开始完整数据同步");
  log("========================================");

  try {
    // 1. 判断是否需要清空数据
    let shouldClearData = false;

    if (forceRestart) {
      // 强制重启：清空数据
      shouldClearData = true;
      log("强制重启模式：将清空所有数据...");
    }

    // 如果需要清空数据，先清空
    if (shouldClearData) {
      log("清空现有数据...");
      await clearVideos();
      await clearSubCategories();
    } else {
      log("使用覆盖模式同步（不清空现有数据）...");
    }

    let startPage = 1;
    let totalAdded = 0;
    let totalUpdated = 0;

    // 2. 设置请求间隔
    sourceClient.setMinRequestInterval(config.requestInterval);

    // 3. 获取视频总数
    const firstPage = await sourceClient.getList(1, 1);
    const totalVideos = firstPage.total;
    const totalPages = Math.ceil(totalVideos / config.batchSize);
    log(`视频总数: ${totalVideos}，共 ${totalPages} 页`);

    if (totalVideos === 0) {
      log("没有视频需要同步");
      return { added: 0, updated: 0 };
    }

    // 4. 分页同步视频
    let totalProcessed = 0;

    for (let page = startPage; page <= totalPages; page++) {
      try {
        // 获取视频列表
        const listResponse = await sourceClient.getList(page, config.batchSize);
        const videoList = listResponse.list;

        if (videoList.length === 0) {
          log(`第 ${page} 页无数据，停止同步`);
          break;
        }

        // 批量获取详情
        const vodIds = videoList.map((v) => v.vod_id);
        const details = await sourceClient.getBatchDetails(vodIds);

        // 解析并过滤有效视频
        const parsedVideos = await parseVideoDetails(details);
        const validVideos = filterValidVideos(parsedVideos);

        // 保存到数据库
        const result = await saveVideos(validVideos);
        totalAdded += result.added;
        totalUpdated += result.updated;

        totalProcessed += validVideos.length;

        // 更新进度
        const message = `已同步 ${totalProcessed}/${totalVideos} 个视频 (第 ${page}/${totalPages} 页, 新增: ${totalAdded}, 更新: ${totalUpdated})`;
        logProgress(totalProcessed, totalVideos, message);

        if (onProgress) {
          onProgress({
            current: totalProcessed,
            total: totalVideos,
            message,
          });
        }

        // 批次之间添加随机延迟（避免被检测）
        if (page < totalPages) {
          const jitter = Math.random() * 500;
          await new Promise((resolve) =>
            setTimeout(resolve, config.requestInterval + jitter),
          );
        }
      } catch (error) {
        log(`第 ${page} 页同步失败: ${error}`);
        throw error;
      }
    }

    // 5. 获取最终统计
    const stats = await getDatabaseStats();

    log("========================================");
    log("完整同步完成");
    log(`  - 处理: ${totalProcessed} 个视频`);
    log(`  - 新增: ${totalAdded} 个`);
    log(`  - 更新: ${totalUpdated} 个`);
    log(`  - 总数: ${stats.totalVideos} 个视频`);
    log("========================================");

    return { added: totalAdded, updated: totalUpdated };
  } catch (error) {
    log(`同步失败: ${error}`);
    throw error;
  }
}

// ============================================
// 增量同步（按时间范围）
// ============================================

export async function incrementalSync(
  hours: number = 24,
  config: SyncConfig = DEFAULT_SYNC_CONFIG,
  onProgress?: (progress: {
    current: number;
    total: number;
    message: string;
  }) => void,
): Promise<{ added: number; updated: number }> {
  log("========================================");
  log(`开始增量数据同步 (最近 ${hours} 小时)`);
  log("========================================");

  try {
    // 1. 设置请求间隔
    sourceClient.setMinRequestInterval(config.requestInterval);

    // 2. 计算时间范围
    const now = new Date();
    const syncStartDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
    log(`同步时间: ${syncStartDate.toISOString()} 之后的数据`);

    // 3. 获取视频总数
    const firstPage = await sourceClient.getList(1, 1);
    const totalVideos = firstPage.total;
    log(`视频总数: ${totalVideos}`);

    if (totalVideos === 0) {
      log("没有视频需要同步");
      return { added: 0, updated: 0 };
    }

    // 4. 分页检查并同步更新的视频
    let page = 1;
    let totalProcessed = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    const pageSize = config.batchSize;

    while (true) {
      try {
        // 获取视频列表
        const listResponse = await sourceClient.getList(page, pageSize);
        const videoList = listResponse.list;

        if (videoList.length === 0) {
          log(`第 ${page} 页无数据，停止检查`);
          break;
        }

        // 筛选出更新时间在范围内的视频
        const filteredVideos = videoList.filter((v) => {
          if (!v.vod_time) return false;
          const videoDate = new Date(v.vod_time);
          return videoDate > syncStartDate;
        });

        if (filteredVideos.length === 0) {
          // 如果这一页的所有视频都比同步时间旧，后续视频也肯定更旧，可以停止
          const oldestVideo = videoList[videoList.length - 1];
          if (
            oldestVideo?.vod_time &&
            new Date(oldestVideo.vod_time) <= syncStartDate
          ) {
            log(`第 ${page} 页及后续数据无需更新，停止同步`);
            break;
          }
          page++;
          continue;
        }

        // 批量获取详情
        const vodIds = filteredVideos.map((v) => v.vod_id);
        const details = await sourceClient.getBatchDetails(vodIds);

        // 双重检查机制：获取数据库中这些视频的更新时间
        const dbUpdateTimeMap = await getVideosUpdateTimeMap(vodIds);

        // 只保留需要更新的视频（源API更新时间 > 数据库更新时间）
        const filteredDetails = details.filter((detail) => {
          const dbUpdateTime = dbUpdateTimeMap.get(detail.vod_id);

          // 如果数据库中没有这个视频，需要添加
          if (!dbUpdateTime) {
            return true;
          }

          // 比较更新时间，只保留源API更新的视频
          if (!detail.vod_time) {
            return false;
          }

          const apiUpdateTime = new Date(detail.vod_time);
          const dbTime = new Date(dbUpdateTime);

          return apiUpdateTime > dbTime;
        });

        if (filteredDetails.length === 0) {
          log(`第 ${page} 页没有需要更新的视频`);
          page++;
          continue;
        }

        // 解析并过滤有效视频
        const parsedVideos = await parseVideoDetails(filteredDetails);
        const validVideos = filterValidVideos(parsedVideos);

        // 保存到数据库
        const result = await saveVideos(validVideos);
        totalAdded += result.added;
        totalUpdated += result.updated;

        totalProcessed += validVideos.length;

        // 更新进度
        const message = `已检查 ${page} 页，发现 ${validVideos.length} 个更新的视频 (累计: ${totalProcessed})`;
        log(message);

        if (onProgress) {
          onProgress({
            current: totalProcessed,
            total: totalVideos,
            message,
          });
        }

        page++;

        // 批次之间添加随机延迟（避免被检测）
        const jitter = Math.random() * 500;
        await new Promise((resolve) =>
          setTimeout(resolve, config.requestInterval + jitter),
        );
      } catch (error) {
        log(`第 ${page} 页同步失败: ${error}`);
        throw error;
      }
    }

    // 5. 获取最终统计
    const stats = await getDatabaseStats();

    log("========================================");
    log("增量同步完成");
    log(`  - 发现: ${totalProcessed} 个更新的视频`);
    log(`  - 新增: ${totalAdded} 个`);
    log(`  - 更新: ${totalUpdated} 个`);
    log(`  - 总数: ${stats.totalVideos} 个视频`);
    log("========================================");

    return { added: totalAdded, updated: totalUpdated };
  } catch (error) {
    log(`增量同步失败: ${error}`);
    throw error;
  }
}

// ============================================
// 补充同步（检查并补充缺失的视频）
// ============================================

export async function resync(
  config: SyncConfig = DEFAULT_SYNC_CONFIG,
  onProgress?: (progress: {
    current: number;
    total: number;
    message: string;
  }) => void,
): Promise<{ added: number; updated: number }> {
  log("========================================");
  log("开始补充同步（检查缺失视频）");
  log("========================================");

  try {
    // 1. 设置请求间隔
    sourceClient.setMinRequestInterval(config.requestInterval);

    // 2. 获取视频总数
    const firstPage = await sourceClient.getList(1, 1);
    const totalVideos = firstPage.total;
    const totalPages = Math.ceil(totalVideos / config.batchSize);

    log(`视频总数: ${totalVideos}，共 ${totalPages} 页`);

    if (totalVideos === 0) {
      log("没有视频需要同步");
      return { added: 0, updated: 0 };
    }

    // 3. 分页检查并补充缺失的视频
    let totalChecked = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let missingCount = 0;

    for (let page = 1; page <= totalPages; page++) {
      try {
        // 获取视频列表
        const listResponse = await sourceClient.getList(page, config.batchSize);
        const videoList = listResponse.list;

        if (videoList.length === 0) {
          log(`第 ${page} 页无数据，跳过`);
          continue;
        }

        // 检查哪些视频缺失
        const vodIds = videoList.map((v) => v.vod_id);
        const existingVideos = await getVideosUpdateTimeMap(vodIds);
        const missingVodIds = vodIds.filter((id) => !existingVideos.has(id));

        if (missingVodIds.length === 0) {
          totalChecked += videoList.length;
          continue;
        }

        missingCount += missingVodIds.length;
        log(`第 ${page} 页发现 ${missingVodIds.length} 个缺失视频`);

        // 批量获取缺失视频的详情
        const details = await sourceClient.getBatchDetails(missingVodIds);

        // 解析并保存
        const parsedVideos = await parseVideoDetails(details);
        const validVideos = filterValidVideos(parsedVideos);

        const result = await saveVideos(validVideos);
        totalAdded += result.added;
        totalUpdated += result.updated;

        totalChecked += videoList.length;

        // 更新进度
        const message = `已检查 ${totalChecked}/${totalVideos} 个视频，补充 ${totalAdded} 个缺失`;
        logProgress(totalChecked, totalVideos, message);

        if (onProgress) {
          onProgress({
            current: totalChecked,
            total: totalVideos,
            message,
          });
        }

        // 批次之间添加随机延迟
        if (page < totalPages) {
          const jitter = Math.random() * 500;
          await new Promise((resolve) =>
            setTimeout(resolve, config.requestInterval + jitter),
          );
        }
      } catch (error) {
        log(`第 ${page} 页检查失败: ${error}`);
        throw error;
      }
    }

    // 4. 获取最终统计
    const stats = await getDatabaseStats();

    log("========================================");
    log("补充同步完成");
    log(`  - 已检查: ${totalChecked} 个视频`);
    log(`  - 发现缺失: ${missingCount} 个`);
    log(`  - 补充: ${totalAdded} 个`);
    log(`  - 总数: ${stats.totalVideos} 个视频`);
    log("========================================");

    return { added: totalAdded, updated: totalUpdated };
  } catch (error) {
    log(`补充同步失败: ${error}`);
    throw error;
  }
}

// ============================================
// 导出
// ============================================

export { DEFAULT_SYNC_CONFIG };