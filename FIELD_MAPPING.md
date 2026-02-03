# 源 API 字段 vs 转换后字段对比

## 已使用的字段（✅）

| 源字段 | 转换后字段 | 说明 |
|--------|-----------|------|
| vod_id | vod_id | 视频ID |
| vod_name | name | 片名 |
| vod_class | tags | 标签数组（逗号分隔） |
| vod_total | episode_count | 集数 |
| vod_pic | cover | 海报图片 |
| vod_blurb | description | 简介（短） |
| vod_actor | actor | 演员 |
| vod_director | director | 导演 |
| vod_writer | writer | 编剧 |
| vod_area | area | 地区 |
| vod_lang | lang | 语言 |
| vod_year | year | 年份 |
| vod_remarks | remarks | 集数备注（如"全69集"） |
| vod_score | score | 评分 |
| vod_score_num | score_num | 评分人数 |
| vod_hits | hits | 点击数 |
| vod_hits_day | hits_day | 日点击 |
| vod_hits_week | hits_week | 周点击 |
| vod_hits_month | hits_month | 月点击 |
| vod_up | up | 点赞数 |
| vod_down | down | 下载数 |
| vod_time | updated_at | 更新时间（字符串格式） |
| vod_time_add | added_at | 添加时间戳（Unix时间戳） |
| vod_play_url | play_urls | 播放链接 |

## 未使用的字段（❌）

| 源字段 | 值示例 | 原因 |
|--------|---------|------|
| type_id | 1 | API内部分类，我们用自定义分类 |
| type_id_1 | 0 | 扩展分类ID |
| group_id | 0 | 分组ID |
| vod_sub | 美女总裁... | 副标题（可考虑添加） |
| vod_en | meinvzongcai... | 英文标题（可考虑添加） |
| vod_status | 1 | 状态 |
| vod_letter | M | 首字母 |
| vod_color | "" | 颜色 |
| vod_tag | "" | 标签（与vod_class重复） |
| vod_pic_thumb | "" | 缩略图（可考虑添加） |
| vod_pic_slide | "" | 轮播图 |
| vod vod_pic_screenshot | "" | 截图 |
| vod_behind | "" | 幕后 |
| vod_pubdate | "" | 发布日期（通常是空的） |
| vod_serial | "69" | 序列号 |
| vod_tv | "" | 电视台 |
| vod_weekday | "" | 星期 |
| vod_version | "" | 版本 |
| vod_state | "" | 状态 |
| vod_author | "" | 作者 |
| vod_jumpurl | "" | 跳转URL |
| vod_tpl | "" | 模板 |
| vod_tpl_play | "" | 播放模板 |
| vod_tpl_down | "" | 下载模板 |
| vod_isend | 1 | 是否完结 |
| vod_lock | 0 | 锁定 |
| vod_level | 0 | 等级 |
| vod_copyright | 0 | 版权 |
| vod_points | 0 | 积分 |
| vod_points_play | 0 | 播放积分 |
| vod_points_down | 0 | 下载积分 |
| vod_duration | "" | 时长 |
| vod_time_hits | 1770073692 | 最后点击时间 |
| vod_time_make | 0 | 制作时间 |
| vod_trysee | 0 | 试看 |
| vod_douban_id | 0 | 豆瓣ID |
| vod_douban_score | "0.0" | 豆瓣评分（都是0，暂无用） |
| vod_reurl | "" | 转发URL |
| vod_rel_vod | "" | 关联视频 |
| vod_rel_art | "" | 关联演员 |
| vod_pwd | "" | 密码 |
| vod_pwd_url | "" | 密码URL |
| vod_pwd_play | "" | 播放密码 |
| vod_pwd_play_url | "" | 播放密码URL |
| vod_pwd_down | "" | 下载密码 |
| vod_pwd_down_url | "" | 下载密码URL |
| vod_content | "<p>...</p>" | 详细简介（已用 vod_blurb） |
| vod_play_from | "wwm3u8" | 播放源（都是wwm3u8） |
| vod_play_server | "no" | 播放服务器 |
| vod_play_note | "" | 播放备注 |
| vod_down_from | "" | 下载源 |
| vod_down_server | "" | 下载服务器 |
| vod_down_note | "" | 下载备注 |
| vod_down_url | "" | 下载URL |
| vod_plot | 0 | 剧情数 |
| vod_plot_name | "" | 剧情名称 |
| vod_plot_detail | "" | 剧情详情 |
| type_name | "短剧" | 类型名称（都是"短剧"） |

## 时间戳说明

- **updated_at** (字符串): `2026-02-02 20:12:32` - API 返回的更新时间
- **added_at** (时间戳): `1769884300` - Unix 时间戳，视频添加到源站的时间

## 评分说明

- **score**: 源站评分（2.0, 4.0, 9.0 等）
- **score_num**: 评分人数（37, 568, 905 等）
- **douban_score**: 豆瓣评分（都是 0.0，暂不使用）

## 新增字段说明

### 1. 热度数据
- **hits**: 总点击数
- **hits_day**: 日点击数
- **hits_week**: 周点击数
- **hits_month**: 月点击数
- **up**: 点赞数
- **down**: 下载数

### 2. 评分数据
- **score**: 评分（0-10分，一位小数）
- **score_num**: 评分人数

### 3. 元数据
- **director**: 导演
- **writer**: 编剧
- **lang**: 语言
- **remarks**: 集数备注（如"全69集"）

## 项目必需字段（✅）

- ✅ 分类（自定义一级分类 + 自动二级分类）
- ✅ 片名
- ✅ 集数
- ✅ 海报
- ✅ 简介
- ✅ 播放URL

## 新增字段（可增强功能）- 灵活调用

- ✅ 演员、导演、编剧
- ✅ 地区、语言、年份
- ✅ 评分、评分人数
- ✅ 点击数、点赞数、下载数
- ✅ 集数备注
- ✅ 添加时间戳

这些新增字段可以作为元数据供前端灵活调用，增强用户体验。