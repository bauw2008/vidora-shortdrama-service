import { NextResponse } from 'next/server';
import { sourceClient } from '@/lib/api-client';
import { parseVideoDetail } from '@/lib/parser';
import { verifyAuth } from '@/lib/auth';

// 测试同步 - 只获取少量数据用于验证转换逻辑
export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { count = 3 } = body; // 默认获取 3 个视频

    // 1. 获取视频列表（只获取少量）
    const listResponse = await sourceClient.getList(1, count);
    
    if (!listResponse || listResponse.list.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未获取到视频数据',
      });
    }

    // 2. 获取视频详情
    const vodIds = listResponse.list.map(v => v.vod_id);
    const detailsList = await sourceClient.getBatchDetails(vodIds);

    if (!detailsList || detailsList.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未获取到视频详情',
      });
    }

    // 3. 转换数据
    const transformedData = [];
    for (const detail of detailsList) {
      const transformed = await parseVideoDetail(detail, null); // null 表示未分配一级分类
      transformedData.push({
        original: detail,
        transformed: transformed,
      });
    }

    // 打印完整信息到控制台
    console.log('='.repeat(80));
    console.log('【测试同步 - 完整数据】');
    console.log('='.repeat(80));
    console.log(`共获取 ${transformedData.length} 个视频数据\n`);
    
    transformedData.forEach((item, index) => {
      console.log(`\n【视频 ${index + 1}】`);
      console.log('-'.repeat(80));
      console.log('原始数据 (API 返回):');
      console.log(JSON.stringify(item.original, null, 2));
      console.log('\n转换后数据 (项目格式):');
      console.log(JSON.stringify(item.transformed, null, 2));
      console.log('-'.repeat(80));
    });
    console.log('='.repeat(80));
    console.log('【测试同步结束】');
    console.log('='.repeat(80));

    // 生成可下载的文本内容
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const textContent = [
      '='.repeat(80),
      '【测试同步 - 完整数据】',
      `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      `共获取 ${transformedData.length} 个视频数据`,
      '='.repeat(80),
      '',
    ];

    transformedData.forEach((item, index) => {
      textContent.push(`【视频 ${index + 1}】`);
      textContent.push('-'.repeat(80));
      textContent.push('原始数据 (API 返回):');
      textContent.push(JSON.stringify(item.original, null, 2));
      textContent.push('');
      textContent.push('转换后数据 (项目格式):');
      textContent.push(JSON.stringify(item.transformed, null, 2));
      textContent.push('-'.repeat(80));
      textContent.push('');
    });

    textContent.push('='.repeat(80));
    textContent.push('【测试同步结束】');
    textContent.push('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: `成功获取并转换 ${transformedData.length} 个视频`,
      data: {
        total: transformedData.length,
        items: transformedData,
        downloadText: textContent.join('\n'),
        filename: `test-sync-${timestamp}.txt`,
      },
    });
  } catch (error) {
    console.error('测试同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `测试同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}