-- 添加获取过滤后视频数量的 RPC 函数
-- ============================================

-- 创建获取过滤后视频数量的函数（用于分页）
CREATE OR REPLACE FUNCTION get_filtered_videos_count(p_category_id INTEGER DEFAULT NULL, p_sub_category_id INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM videos
    WHERE
      (p_category_id IS NULL OR category_id = p_category_id)
      AND
      (p_sub_category_id IS NULL OR sub_category_id = p_sub_category_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;