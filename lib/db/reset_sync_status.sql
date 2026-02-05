-- 重置同步状态
-- ============================================

UPDATE sync_status
SET is_syncing = false,
    current_page = 0,
    total_pages = 0,
    synced_count = 0
WHERE id = 1;