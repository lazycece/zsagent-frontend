import { DEFAULT_USER_ID } from './agent';
import { zsagentRequestClient } from './request';

/** 文档状态（对齐后端 DocumentStatus.code） */
export type DocumentStatus = 'archived' | 'deleted' | 'draft' | 'published';

/** ETL 处理状态（对齐后端 EtlStatus.code） */
export type EtlStatus =
  | 'chunking'
  | 'completed'
  | 'embedding'
  | 'enriching'
  | 'failed'
  | 'indexing'
  | 'parsing'
  | 'pending';

/** 文档可见范围（对齐后端 Visibility.code） */
export type Visibility = 'department' | 'public' | 'specific';

/** 目录节点（对齐后端 DirectoryDTO） */
export interface DirectoryNode {
  directoryId: string;
  parentId?: string;
  name: string;
  sortOrder?: number;
  children?: DirectoryNode[];
  documentCount?: number;
  creator?: string;
  updater?: string;
  createTime?: string;
  updateTime?: string;
}

/** 文档（对齐后端 DocumentDTO） */
export interface Document {
  documentId: string;
  title: string;
  summary?: string;
  format?: string;
  fileSize?: number;
  directoryId?: string;
  directoryName?: string;
  tags?: string[];
  visibility?: Visibility;
  status?: DocumentStatus;
  etlStatus?: EtlStatus;
  etlErrorMessage?: string;
  currentVersion?: number;
  creator?: string;
  createTime?: string;
  updateTime?: string;
}

/** 文档版本（对齐后端 DocumentVersionDTO） */
export interface DocumentVersion {
  versionId: string;
  versionNumber: number;
  fileSize?: number;
  changeLog?: string;
  creator?: string;
  createTime?: string;
}

/** 分页数据（对齐后端 rapidf PageData） */
export interface PageData<T> {
  data: T[];
  count: number;
  page: number;
  size?: number;
}

/** 目录列表结果（对齐后端 DirectoryListResult） */
export interface DirectoryListResult {
  directories: DirectoryNode[];
}

/** 文档详情结果（对齐后端 DocumentDetailResult） */
export interface DocumentDetailResult {
  document: Document;
}

/** 文档版本列表结果（对齐后端 DocumentVersionListResult） */
export interface DocumentVersionListResult {
  versions: DocumentVersion[];
}

/** ETL 状态结果（对齐后端 EtlStatusResult） */
export interface EtlStatusResult {
  documentId: string;
  etlStatus: EtlStatus;
  errorMessage?: string;
  documentStatus?: DocumentStatus;
}

// ---------------- 目录 ----------------

/** 查询完整目录树 */
export async function listDirectoryTreeApi() {
  return zsagentRequestClient.get<DirectoryListResult>('/directory/tree');
}

/** 查询子目录列表 */
export async function listDirectoryChildrenApi(parentId?: string) {
  return zsagentRequestClient.get<DirectoryListResult>(
    '/directory/list-children',
    {
      params: { parentId },
    },
  );
}

/** 创建目录 */
export async function createDirectoryApi(params: {
  name: string;
  parentId?: string;
}) {
  return zsagentRequestClient.post('/directory/create', {
    name: params.name,
    parentId: params.parentId,
    userId: DEFAULT_USER_ID,
  });
}

/** 重命名目录 */
export async function renameDirectoryApi(params: {
  directoryId: string;
  newName: string;
}) {
  return zsagentRequestClient.post('/directory/rename', {
    directoryId: params.directoryId,
    newName: params.newName,
    userId: DEFAULT_USER_ID,
  });
}

/** 移动目录 */
export async function moveDirectoryApi(params: {
  directoryId: string;
  newParentId?: string;
}) {
  return zsagentRequestClient.post('/directory/move', {
    directoryId: params.directoryId,
    newParentId: params.newParentId,
    userId: DEFAULT_USER_ID,
  });
}

/** 删除目录 */
export async function deleteDirectoryApi(directoryId: string) {
  return zsagentRequestClient.post('/directory/delete', {
    directoryId,
    userId: DEFAULT_USER_ID,
  });
}

// ---------------- 文档 ----------------

/** 分页查询文档列表 */
export async function listDocumentsApi(params: {
  directoryId?: string;
  keyword?: string;
  page?: number;
  size?: number;
  status?: DocumentStatus;
}) {
  return zsagentRequestClient.get<PageData<Document>>(
    '/document/list-documents',
    {
      params: {
        directoryId: params.directoryId,
        keyword: params.keyword,
        page: params.page ?? 1,
        size: params.size ?? 20,
        status: params.status,
        userId: DEFAULT_USER_ID,
      },
    },
  );
}

/** 查询文档详情 */
export async function getDocumentApi(documentId: string) {
  return zsagentRequestClient.get<DocumentDetailResult>(
    '/document/get-document',
    {
      params: {
        documentId,
        userId: DEFAULT_USER_ID,
      },
    },
  );
}

/** 创建文档（文件需先经 uploadFileApi 获取 filePath） */
export async function createDocumentApi(params: {
  directoryId?: string;
  filePath: string;
  tags?: string[];
  title: string;
  visibility?: Visibility;
  visibleTo?: string[];
}) {
  return zsagentRequestClient.post('/document/create', {
    directoryId: params.directoryId,
    filePath: params.filePath,
    tags: params.tags,
    title: params.title,
    userId: DEFAULT_USER_ID,
    visibility: params.visibility,
    visibleTo: params.visibleTo,
  });
}

/** 更新文档元数据（不产生新版本） */
export async function updateDocumentMetadataApi(params: {
  directoryId?: string;
  documentId: string;
  summary?: string;
  tags?: string[];
  title?: string;
  visibility?: Visibility;
  visibleTo?: string[];
}) {
  return zsagentRequestClient.post('/document/update-metadata', {
    directoryId: params.directoryId,
    documentId: params.documentId,
    summary: params.summary,
    tags: params.tags,
    title: params.title,
    userId: DEFAULT_USER_ID,
    visibility: params.visibility,
    visibleTo: params.visibleTo,
  });
}

/** 更新文档内容（产生新版本并触发 ETL） */
export async function updateDocumentContentApi(params: {
  changeLog?: string;
  documentId: string;
  filePath: string;
}) {
  return zsagentRequestClient.post('/document/update-content', {
    changeLog: params.changeLog,
    documentId: params.documentId,
    filePath: params.filePath,
    userId: DEFAULT_USER_ID,
  });
}

/** 删除文档（移入回收站） */
export async function deleteDocumentApi(documentId: string) {
  return zsagentRequestClient.post('/document/delete', {
    documentId,
    userId: DEFAULT_USER_ID,
  });
}

/** 恢复文档 */
export async function restoreDocumentApi(documentId: string) {
  return zsagentRequestClient.post('/document/restore', {
    documentId,
    userId: DEFAULT_USER_ID,
  });
}

/** 回滚到指定历史版本 */
export async function rollbackDocumentApi(params: {
  documentId: string;
  targetVersionId: string;
}) {
  return zsagentRequestClient.post('/document/rollback', {
    documentId: params.documentId,
    targetVersionId: params.targetVersionId,
    userId: DEFAULT_USER_ID,
  });
}

/** 查询文档版本历史 */
export async function listDocumentVersionsApi(documentId: string) {
  return zsagentRequestClient.get<DocumentVersionListResult>(
    '/document/list-versions',
    {
      params: {
        documentId,
        userId: DEFAULT_USER_ID,
      },
    },
  );
}

/** 查询 ETL 处理状态 */
export async function getDocumentEtlStatusApi(documentId: string) {
  return zsagentRequestClient.get<EtlStatusResult>('/document/get-etl-status', {
    params: {
      documentId,
      userId: DEFAULT_USER_ID,
    },
  });
}

// ---------------- 文件 ----------------

/**
 * 上传文件（multipart，表单字段名 file），返回文件相对路径。
 *
 * 必须显式使用 vben 的 upload 方法：vben 的 axios 实例默认
 * `Content-Type: application/json`，axios 1.19 会据此把 FormData 序列化成 JSON
 * 发送，导致后端拒绝（要求 multipart/form-data）。upload 内部会显式设置
 * `multipart/form-data`，浏览器再附加 boundary。
 */
export async function uploadFileApi(file: File) {
  return zsagentRequestClient.upload<{ filePath: string }>('/file/upload', {
    file,
  });
}
