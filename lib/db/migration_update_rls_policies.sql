-- ============================================
-- 修改 RLS 策略：使用 admin role 检查
-- ============================================

-- 删除旧的 Service write 策略
DROP POLICY IF EXISTS "Service write categories" ON categories;
DROP POLICY IF EXISTS "Service write sub_categories" ON sub_categories;
DROP POLICY IF EXISTS "Service write videos" ON videos;
DROP POLICY IF EXISTS "Service write sync_status" ON sync_status;
DROP POLICY IF EXISTS "Service write api_sources" ON api_sources;
DROP POLICY IF EXISTS "Service write sync_schedules" ON sync_schedules;
DROP POLICY IF EXISTS "Service write api_field_config" ON api_field_config;
DROP POLICY IF EXISTS "Service write api_config" ON api_config;
DROP POLICY IF EXISTS "Service write api_rate_limits" ON api_rate_limits;
DROP POLICY IF EXISTS "Service write ip_blacklist" ON ip_blacklist;
DROP POLICY IF EXISTS "Service write api_logs" ON api_logs;
DROP POLICY IF EXISTS "Service write category_version" ON category_version;

-- 创建新的 Admin write 策略（检查 service_role）
CREATE POLICY "Admin write categories" ON categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write sub_categories" ON sub_categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write videos" ON videos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write sync_status" ON sync_status
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write api_sources" ON api_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin write sync_schedules" ON sync_schedules
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

CREATE POLICY "Admin write category_version" ON category_version
  FOR ALL USING (auth.role() = 'service_role');