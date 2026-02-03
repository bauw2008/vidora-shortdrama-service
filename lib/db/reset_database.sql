-- ============================================
-- 完全清空数据库 - 重新开始
-- ============================================

-- 删除所有表（包括结构和数据）
DROP TABLE IF EXISTS public.api_logs CASCADE;
DROP TABLE IF EXISTS public.ip_blacklist CASCADE;
DROP TABLE IF EXISTS public.api_rate_limits CASCADE;
DROP TABLE IF EXISTS public.videos CASCADE;
DROP TABLE IF EXISTS public.sub_categories CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.api_config CASCADE;
DROP TABLE IF EXISTS public.sync_schedules CASCADE;
DROP TABLE IF EXISTS public.api_sources CASCADE;
DROP TABLE IF EXISTS public.sync_status CASCADE;
DROP TABLE IF EXISTS public.api_field_config CASCADE;

-- 删除触发器函数
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- 删除清理函数
DROP FUNCTION IF EXISTS public.cleanup_rate_limits() CASCADE;

-- 完成
SELECT '数据库已完全清空，可以执行 schema.sql 重建！' as status;