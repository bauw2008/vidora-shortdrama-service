-- ============================================
-- Vidora 短剧中转服务 - Supabase 数据库 Schema
-- ============================================

-- ============================================
-- 清理旧表（避免冲突）
-- ============================================

DROP TABLE IF EXISTS public.sync_schedules CASCADE;
DROP TABLE IF EXISTS public.api_sources CASCADE;
DROP TABLE IF EXISTS public.sync_status CASCADE;
DROP TABLE IF EXISTS public.videos CASCADE;
DROP TABLE IF EXISTS public.sub_categories CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================
-- 表结构
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分类全局版本表（任意分类变化都更新此版本号）
CREATE TABLE IF NOT EXISTS category_version (
  id SERIAL PRIMARY KEY,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 二级分类表（API 的 vod_class 拆分）
CREATE TABLE IF NOT EXISTS sub_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 视频表
CREATE TABLE IF NOT EXISTS videos (
  vod_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]',
  episode_count INTEGER NOT NULL,
  cover TEXT NOT NULL,
  description TEXT NOT NULL,
  play_urls JSONB NOT NULL,
  
  -- 元数据字段
  actor TEXT DEFAULT '',
  director TEXT DEFAULT '',
  writer TEXT DEFAULT '',
  area TEXT DEFAULT '',
  lang TEXT DEFAULT '',
  year TEXT DEFAULT '',
  remarks TEXT DEFAULT '',  -- 集数备注（如"全69集"）
  
  -- 热度数据
  hits INTEGER DEFAULT 0,
  hits_day INTEGER DEFAULT 0,
  hits_week INTEGER DEFAULT 0,
  hits_month INTEGER DEFAULT 0,
  up INTEGER DEFAULT 0,
  down INTEGER DEFAULT 0,
  
  -- 评分数据
  score DECIMAL(3, 1) DEFAULT 0,
  score_num INTEGER DEFAULT 0,
  
  -- 时间戳
  updated_at TEXT NOT NULL,
  added_at BIGINT DEFAULT 0,  -- 添加时间戳
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API 源配置表
CREATE TABLE IF NOT EXISTS api_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 同步状态表、定时同步配置表、Cron 配置表、Cron Job 配置表已删除
-- 同步功能现在通过 GitHub Actions 实现

-- API 字段配置表
CREATE TABLE IF NOT EXISTS api_field_config (
  id SERIAL PRIMARY KEY,
  api_endpoint TEXT NOT NULL, -- 'list' 或 'detail'
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(api_endpoint, field_name)
);

-- API 配置表（用于管理 API Key 和认证开关）
CREATE TABLE IF NOT EXISTS api_config (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL DEFAULT '',
  auth_enabled BOOLEAN DEFAULT false,
  rate_limit_minute INTEGER DEFAULT 60, -- 每分钟限制
  rate_limit_hourly INTEGER DEFAULT 1000, -- 每小时限制
  rate_limit_daily INTEGER DEFAULT 10000, -- 每天限制
  timezone TEXT DEFAULT 'Asia/Shanghai', -- 系统时区
  auto_clean_threshold INTEGER DEFAULT 80000, -- 自动清理阈值
  max_log_count INTEGER DEFAULT 100000, -- 最大日志数量
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API 速率限制记录表
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP 地址或 API Key
  type TEXT NOT NULL, -- 'ip' 或 'apikey'
  minute_count INTEGER DEFAULT 0,
  hourly_count INTEGER DEFAULT 0,
  daily_count INTEGER DEFAULT 0,
  minute_window TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hour_window TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  day_window TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IP 黑名单表
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API 调用日志表
CREATE TABLE IF NOT EXISTS api_logs (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL,
  request_params TEXT,
  response_status INTEGER,
  auth_validated BOOLEAN DEFAULT false,
  error_message TEXT,
  request_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  remaining_minute INTEGER,
  remaining_hourly INTEGER,
  remaining_daily INTEGER,
  response_time_ms INTEGER,
  is_rate_limit_warning BOOLEAN DEFAULT false
);

-- ============================================
-- 索引优化
-- ============================================

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_synced_at ON videos(synced_at DESC);

-- 全文搜索索引（中文支持）
CREATE INDEX IF NOT EXISTS idx_videos_name_gin ON videos USING GIN(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_videos_description_gin ON videos USING GIN(to_tsvector('simple', description));

CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_name ON sub_categories(name);

CREATE INDEX IF NOT EXISTS idx_api_sources_active ON api_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON api_rate_limits(identifier, type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_minute_window ON api_rate_limits(minute_window);
CREATE INDEX IF NOT EXISTS idx_rate_limits_hour_window ON api_rate_limits(hour_window);
CREATE INDEX IF NOT EXISTS idx_rate_limits_day_window ON api_rate_limits(day_window);

CREATE INDEX IF NOT EXISTS idx_api_logs_ip ON api_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_time ON api_logs(request_time DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_api_logs_rate_limit_warning ON api_logs(is_rate_limit_warning);
CREATE INDEX IF NOT EXISTS idx_api_logs_ip_status ON api_logs(ip_address, response_status);

-- 注意：sync_status 和 sync_schedules 表的索引已删除（表已删除）

-- ============================================
-- 默认数据
-- ============================================

-- 不插入任何默认数据，项目为空壳，所有数据由用户自定义

-- 插入默认分类版本（全局版本号）
INSERT INTO category_version (version)
VALUES (1)
ON CONFLICT DO NOTHING;

-- 插入默认字段配置
INSERT INTO api_field_config (api_endpoint, field_name, field_label, is_enabled, is_required, display_order) VALUES
-- /list 接口字段
('list', 'vod_id', '视频ID', true, true, 1),
('list', 'name', '名称', true, true, 2),
('list', 'cover', '封面', true, false, 3),
('list', 'episode_count', '集数', true, false, 4),
('list', 'description', '简介', true, false, 5),
('list', 'tags', '标签', false, false, 6),
('list', 'category_id', '一级分类ID', true, false, 7),
('list', 'actor', '演员', false, false, 8),
('list', 'director', '导演', false, false, 10),
('list', 'writer', '编剧', false, false, 11),
('list', 'area', '地区', false, false, 12),
('list', 'lang', '语言', false, false, 13),
('list', 'year', '年份', false, false, 14),
('list', 'remarks', '备注', false, false, 15),
('list', 'hits', '热度', false, false, 16),
('list', 'score', '评分', false, false, 17),
('list', 'updated_at', '更新时间', false, false, 18),
-- /detail 接口字段
('detail', 'vod_id', '视频ID', true, true, 1),
('detail', 'name', '名称', true, true, 2),
('detail', 'cover', '封面', true, false, 3),
('detail', 'episode_count', '集数', true, false, 4),
('detail', 'description', '简介', true, false, 5),
('detail', 'tags', '标签', true, false, 6),
('detail', 'play_urls', '播放链接', true, true, 7),
('detail', 'category_id', '一级分类ID', true, false, 8),
('detail', 'actor', '演员', true, false, 9),
('detail', 'director', '导演', true, false, 11),
('detail', 'writer', '编剧', true, false, 12),
('detail', 'area', '地区', true, false, 13),
('detail', 'lang', '语言', true, false, 14),
('detail', 'year', '年份', true, false, 15),
('detail', 'remarks', '备注', true, false, 16),
('detail', 'hits', '热度', true, false, 17),
('detail', 'hits_day', '日热度', false, false, 18),
('detail', 'hits_week', '周热度', false, false, 19),
('detail', 'hits_month', '月热度', false, false, 20),
('detail', 'up', '点赞', false, false, 21),
('detail', 'down', '踩', false, false, 22),
('detail', 'score', '评分', true, false, 23),
('detail', 'score_num', '评分人数', false, false, 24),
('detail', 'updated_at', '更新时间', true, false, 25),
('detail', 'added_at', '添加时间', false, false, 26)
ON CONFLICT (api_endpoint, field_name) DO NOTHING;

-- 插入默认 API 配置（认证关闭，API Key 为空，设置速率限制，时区为上海）
INSERT INTO api_config (api_key, auth_enabled, rate_limit_minute, rate_limit_hourly, rate_limit_daily, timezone, auto_clean_threshold, max_log_count)
VALUES ('', false, 60, 1000, 10000, 'Asia/Shanghai', 80000, 100000)
ON CONFLICT DO UPDATE SET
  api_key = EXCLUDED.api_key,
  auth_enabled = EXCLUDED.auth_enabled,
  rate_limit_minute = EXCLUDED.rate_limit_minute,
  rate_limit_hourly = EXCLUDED.rate_limit_hourly,
  rate_limit_daily = EXCLUDED.rate_limit_daily,
  timezone = EXCLUDED.timezone,
  auto_clean_threshold = EXCLUDED.auto_clean_threshold,
  max_log_count = EXCLUDED.max_log_count;

-- ============================================
-- 清理函数
-- ============================================

-- 清理过期的速率限制记录（每小时和每天窗口）
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM api_rate_limits
  WHERE hour_window < NOW() - INTERVAL '2 hours'
     OR day_window < NOW() - INTERVAL '2 days';
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

-- ============================================
-- 行级安全策略 (RLS)
-- ============================================

-- 启用 RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_field_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_version ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY "Public read categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Public read sub_categories" ON sub_categories
  FOR SELECT USING (true);

CREATE POLICY "Public read videos" ON videos
  FOR SELECT USING (true);

CREATE POLICY "Public read api_sources" ON api_sources
  FOR SELECT USING (true);

CREATE POLICY "Public read api_field_config" ON api_field_config
  FOR SELECT USING (true);

CREATE POLICY "Public read api_config" ON api_config
  FOR SELECT USING (true);

CREATE POLICY "Public read api_rate_limits" ON api_rate_limits
  FOR SELECT USING (true);

CREATE POLICY "Public read ip_blacklist" ON ip_blacklist
  FOR SELECT USING (true);

CREATE POLICY "Public read api_logs" ON api_logs
  FOR SELECT USING (true);

CREATE POLICY "Public read category_version" ON category_version
  FOR SELECT USING (true);

-- 写入策略（需要通过 API Key 验证，并使用 service_role 检查）
-- 注意：使用 auth.role() = 'service_role' 确保只有使用 service_role key 的写入操作才被允许
CREATE POLICY "Admin write categories" ON categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write sub_categories" ON sub_categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write videos" ON videos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_sources" ON api_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_field_config" ON api_field_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_config" ON api_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_rate_limits" ON api_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write ip_blacklist" ON ip_blacklist
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_logs" ON api_logs
  FOR ALL USING (auth.role() = 'service_role');

-- 允许匿名写入日志（只允许插入，不允许修改和删除）
CREATE POLICY "Public insert api_logs" ON api_logs
  FOR INSERT WITH CHECK (
    -- 只允许插入基本字段，不允许修改敏感字段
    ip_address IS NOT NULL AND
    api_endpoint IS NOT NULL AND
    http_method IS NOT NULL AND
    request_time IS NOT NULL
  );

CREATE POLICY "Admin write category_version" ON category_version
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

-- 创建触发器
CREATE TRIGGER update_api_sources_updated_at
  BEFORE UPDATE ON api_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_field_config_updated_at
  BEFORE UPDATE ON api_field_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_config_updated_at
  BEFORE UPDATE ON api_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_rate_limits_updated_at
  BEFORE UPDATE ON api_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ip_blacklist_updated_at
  BEFORE UPDATE ON ip_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_version_updated_at
  BEFORE UPDATE ON category_version
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 统计函数
-- ============================================

-- 创建获取表记录总数的通用函数
CREATE OR REPLACE FUNCTION get_table_count(table_name TEXT, filter TEXT DEFAULT '')
RETURNS INTEGER AS $$
DECLARE
  query TEXT;
  result INTEGER;
BEGIN
  query := 'SELECT COUNT(*) FROM ' || quote_ident(table_name);
  
  IF filter IS NOT NULL AND filter != '' THEN
    query := query || ' WHERE ' || filter;
  END IF;
  
  EXECUTE query INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 创建获取视频总数的函数
CREATE OR REPLACE FUNCTION get_videos_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM videos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 创建获取今日更新数量的函数
CREATE OR REPLACE FUNCTION get_today_updated_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM videos WHERE DATE(synced_at) = CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 创建获取过滤后视频数量的函数（用于分页）
CREATE OR REPLACE FUNCTION get_filtered_videos_count(p_category_id INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM videos
    WHERE
      (p_category_id IS NULL OR category_id = p_category_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- RPC 函数：用于 EdgeOne Edge Functions 获取数据总数
-- 避免使用 Content-Range 响应头，防止 EdgeOne 解析错误
-- ============================================

-- 获取过滤后的视频总数（支持 category_id 过滤）
-- 注意：重命名为 get_videos_count_by_category 避免与 get_videos_count() 冲突
CREATE OR REPLACE FUNCTION get_videos_count_by_category(p_category_id INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM videos
    WHERE (p_category_id IS NULL OR category_id = p_category_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 获取过滤后的视频总数（支持 category_id 和 tags 过滤）
CREATE OR REPLACE FUNCTION get_videos_count_with_tags(
  p_category_id INTEGER DEFAULT NULL,
  p_tags JSONB DEFAULT '[]'::jsonb
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM videos
    WHERE
      (p_category_id IS NULL OR category_id = p_category_id)
      AND (p_tags = '[]'::jsonb OR tags @> p_tags)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 获取过滤后的视频总数（支持 category_id、keyword 搜索、tag 过滤）
CREATE OR REPLACE FUNCTION get_videos_count_with_search(
  p_category_id INTEGER DEFAULT NULL,
  p_keyword TEXT DEFAULT NULL,
  p_tag JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM videos
    WHERE
      (p_category_id IS NULL OR category_id = p_category_id)
      AND (p_keyword IS NULL OR name ILIKE '%' || p_keyword || '%')
      AND (p_tag IS NULL OR tags @> p_tag)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 定时同步说明
-- ============================================
-- 同步功能现在通过 GitHub Actions 实现
-- 请参考 .github/workflows/ 目录下的工作流配置