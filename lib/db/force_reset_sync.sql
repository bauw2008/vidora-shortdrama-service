-- 强制重置同步状态（用于调试）
-- ============================================

UPDATE sync_status
SET is_syncing = false,
    current_page = 0,
    total_pages = 0,
    synced_count = 0,
    sync_type = ''
WHERE id = 1;

SELECT '同步状态已重置' as result;