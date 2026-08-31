import type {
  DocumentStatus,
  EtlStatus,
  Visibility,
} from '#/api/zsagent/knowledge';

import dayjs from 'dayjs';

/** 文档状态中文映射 */
export const DOCUMENT_STATUS_MAP: Record<DocumentStatus, string> = {
  archived: '已归档',
  deleted: '已删除',
  draft: '草稿',
  published: '已发布',
};

/** ETL 处理状态中文映射 */
export const ETL_STATUS_MAP: Record<EtlStatus, string> = {
  chunking: '分块中',
  completed: '已完成',
  embedding: '向量化',
  enriching: '增强中',
  failed: '失败',
  indexing: '索引中',
  parsing: '解析中',
  pending: '等待中',
};

/** 可见范围中文映射 */
export const VISIBILITY_MAP: Record<Visibility, string> = {
  department: '部门可见',
  public: '公开',
  specific: '指定可见',
};

/** 文档状态标签颜色（antd Tag color） */
export const DOCUMENT_STATUS_COLOR: Record<DocumentStatus, string> = {
  archived: 'default',
  deleted: 'default',
  draft: 'orange',
  published: 'green',
};

/** ETL 处理状态标签颜色 */
export const ETL_STATUS_COLOR: Record<EtlStatus, string> = {
  chunking: 'processing',
  completed: 'success',
  embedding: 'processing',
  enriching: 'processing',
  failed: 'error',
  indexing: 'processing',
  parsing: 'processing',
  pending: 'default',
};

/** 可见范围标签颜色 */
export const VISIBILITY_COLOR: Record<Visibility, string> = {
  department: 'blue',
  public: 'cyan',
  specific: 'purple',
};

/** 文档状态 → 中文 */
export function documentStatusText(status?: DocumentStatus): string {
  return status ? (DOCUMENT_STATUS_MAP[status] ?? status) : '-';
}

/** ETL 状态 → 中文 */
export function etlStatusText(status?: EtlStatus): string {
  return status ? (ETL_STATUS_MAP[status] ?? status) : '-';
}

/** 可见范围 → 中文 */
export function visibilityText(visibility?: Visibility): string {
  return visibility ? (VISIBILITY_MAP[visibility] ?? visibility) : '-';
}

/** 文件大小格式化（字节 → 可读字符串） */
export function formatFileSize(size?: number): string {
  if (size === undefined || size === null) {
    return '-';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

/** 日期时间格式化（无值时返回 -） */
export function formatDateTime(time?: string): string {
  if (!time) {
    return '-';
  }
  const value = dayjs(time);
  return value.isValid() ? value.format('YYYY-MM-DD HH:mm') : time;
}

/** 日期格式化（无值时返回 -） */
export function formatDate(time?: string): string {
  if (!time) {
    return '-';
  }
  const value = dayjs(time);
  return value.isValid() ? value.format('YYYY-MM-DD') : time;
}
