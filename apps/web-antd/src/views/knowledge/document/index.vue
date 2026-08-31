<script lang="ts" setup>
import type {
  DirectoryNode,
  Document,
  DocumentStatus,
  DocumentVersion,
  EtlStatus,
  PageData,
  Visibility,
} from '#/api/zsagent/knowledge';

import { computed, onMounted, reactive, ref } from 'vue';

import { Plus, RotateCw, Search } from '@vben/icons';

import {
  Button as AButton,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Drawer as ADrawer,
  Empty as AEmpty,
  Input as AInput,
  Modal as AModal,
  message as antdMessage,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Spin as ASpin,
  Table as ATable,
  Tag as ATag,
  Tooltip as ATooltip,
  Upload as AUpload,
} from 'ant-design-vue';

import {
  createDocumentApi,
  deleteDocumentApi,
  getDocumentApi,
  listDirectoryTreeApi,
  listDocumentsApi,
  listDocumentVersionsApi,
  restoreDocumentApi,
  rollbackDocumentApi,
  updateDocumentContentApi,
  updateDocumentMetadataApi,
  uploadFileApi,
} from '#/api/zsagent/knowledge';

import {
  DOCUMENT_STATUS_COLOR,
  DOCUMENT_STATUS_MAP,
  ETL_STATUS_COLOR,
  ETL_STATUS_MAP,
  formatDateTime,
  formatFileSize,
  VISIBILITY_COLOR,
  VISIBILITY_MAP,
} from '../utils';

defineOptions({ name: 'KnowledgeDocument' });

/** 目录下拉选项 */
interface DirectoryOption {
  label: string;
  value: string;
}

/** 弹窗类型 */
type ModalType = 'create' | 'update-content' | 'update-metadata' | null;

const loading = ref(false);
const documents = ref<Document[]>([]);
const total = ref(0);

/** 筛选条件 */
const filters = reactive({
  directoryId: undefined as string | undefined,
  keyword: '',
  page: 1,
  size: 20,
  status: undefined as DocumentStatus | undefined,
});

/** 目录树（用于目录筛选与新建选择） */
const directoryOptions = ref<DirectoryOption[]>([]);

/** 新建/编辑文档 */
const modalType = ref<ModalType>(null);
const modalVisible = ref(false);
const modalTitle = ref('');
const modalSaving = ref(false);
const modalForm = reactive<{
  changeLog: string;
  directoryId: string | undefined;
  summary: string;
  tags: string[];
  title: string;
  visibility: Visibility;
  visibleTo: string[];
}>({
  changeLog: '',
  directoryId: undefined,
  summary: '',
  tags: [],
  title: '',
  visibleTo: [],
  visibility: 'public',
});
const uploadFilePath = ref('');
const uploadFileName = ref('');
const uploadUploading = ref(false);

/** 当前操作的目标文档（编辑元数据 / 更新内容） */
const currentRecord = ref<Document | null>(null);

/** 详情抽屉 */
const drawerVisible = ref(false);
const drawerLoading = ref(false);
const detailDocument = ref<Document | null>(null);
const versions = ref<DocumentVersion[]>([]);
const versionsLoading = ref(false);

/** 表格列定义 */
const columns = [
  { dataIndex: 'title', key: 'title', title: '标题', width: 280 },
  {
    dataIndex: 'directoryName',
    key: 'directoryName',
    title: '目录',
    width: 140,
  },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'etlStatus', key: 'etlStatus', title: 'ETL 状态', width: 110 },
  { dataIndex: 'visibility', key: 'visibility', title: '可见范围', width: 110 },
  { dataIndex: 'fileSize', key: 'fileSize', title: '大小', width: 100 },
  {
    dataIndex: 'currentVersion',
    key: 'currentVersion',
    title: '版本',
    width: 80,
  },
  { dataIndex: 'updateTime', key: 'updateTime', title: '更新时间', width: 150 },
  { key: 'action', title: '操作', width: 220, fixed: 'right' as const },
];

/** 状态筛选选项 */
const statusOptions: { label: string; value: DocumentStatus }[] = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
  { label: '已删除', value: 'deleted' },
];

/** 可见范围选项 */
const visibilityOptions: { label: string; value: Visibility }[] = [
  { label: '公开', value: 'public' },
  { label: '部门可见', value: 'department' },
  { label: '指定可见', value: 'specific' },
];

/** 表格分页配置 */
const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.size,
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
  total: total.value,
}));

/** 加载目录树（生成下拉选项） */
async function loadDirectoryOptions() {
  try {
    const data = await listDirectoryTreeApi();
    const options: DirectoryOption[] = [];
    const walk = (items: DirectoryNode[], depth: number) => {
      for (const item of items) {
        options.push({
          label: `${'　'.repeat(depth)}${item.name}`,
          value: item.directoryId,
        });
        if (item.children?.length) {
          walk(item.children, depth + 1);
        }
      }
    };
    walk(data.directories ?? [], 0);
    directoryOptions.value = options;
  } catch {
    // 目录加载失败不影响文档列表
  }
}

/** 查询文档列表 */
async function loadDocuments() {
  loading.value = true;
  try {
    const data: PageData<Document> = await listDocumentsApi({
      directoryId: filters.directoryId,
      keyword: filters.keyword || undefined,
      page: filters.page,
      size: filters.size,
      status: filters.status,
    });
    documents.value = data.data ?? [];
    total.value = data.count ?? 0;
  } finally {
    loading.value = false;
  }
}

/** 重置筛选并刷新 */
function handleSearch() {
  filters.page = 1;
  void loadDocuments();
}

/** 表格变化（翻页/改页大小） */
function handleTableChange(pag: { current?: number; pageSize?: number }) {
  filters.page = pag.current ?? 1;
  filters.size = pag.pageSize ?? 20;
  void loadDocuments();
}

/** 打开新建文档弹窗 */
function openCreate() {
  modalType.value = 'create';
  modalTitle.value = '新建文档';
  modalForm.title = '';
  modalForm.directoryId = filters.directoryId;
  modalForm.summary = '';
  modalForm.tags = [];
  modalForm.visibility = 'public';
  modalForm.visibleTo = [];
  modalForm.changeLog = '';
  uploadFilePath.value = '';
  uploadFileName.value = '';
  modalVisible.value = true;
}

/** 打开编辑元数据弹窗 */
function openEditMetadata(record: Document) {
  currentRecord.value = record;
  modalType.value = 'update-metadata';
  modalTitle.value = '编辑文档元数据';
  modalForm.title = record.title;
  modalForm.directoryId = record.directoryId;
  modalForm.summary = record.summary ?? '';
  modalForm.tags = record.tags ?? [];
  modalForm.visibility = record.visibility ?? 'public';
  modalForm.visibleTo = [];
  uploadFilePath.value = '';
  uploadFileName.value = '';
  modalVisible.value = true;
}

/** 打开更新内容弹窗 */
function openUpdateContent(record: Document) {
  currentRecord.value = record;
  modalType.value = 'update-content';
  modalTitle.value = `更新内容：${record.title}`;
  modalForm.changeLog = '';
  uploadFilePath.value = '';
  uploadFileName.value = '';
  modalVisible.value = true;
}

/** 文件上传（Upload 组件拦截，调用后端接口） */
async function handleBeforeUpload(file: File) {
  uploadUploading.value = true;
  uploadFileName.value = file.name;
  try {
    const data = await uploadFileApi(file);
    uploadFilePath.value = data.filePath;
    antdMessage.success('文件上传成功');
  } catch {
    uploadFilePath.value = '';
    uploadFileName.value = '';
  } finally {
    uploadUploading.value = false;
  }
  return false;
}

/** 确认弹窗提交 */
async function handleModalOk() {
  if (modalType.value === 'create') {
    await handleCreate();
  } else if (modalType.value === 'update-metadata') {
    await handleUpdateMetadata();
  } else if (modalType.value === 'update-content') {
    await handleUpdateContent();
  }
}

/** 新建文档 */
async function handleCreate() {
  if (!modalForm.title.trim()) {
    antdMessage.warning('请输入文档标题');
    return;
  }
  if (!uploadFilePath.value) {
    antdMessage.warning('请先上传文档文件');
    return;
  }
  modalSaving.value = true;
  try {
    await createDocumentApi({
      directoryId: modalForm.directoryId,
      filePath: uploadFilePath.value,
      tags: modalForm.tags.length > 0 ? modalForm.tags : undefined,
      title: modalForm.title.trim(),
      visibleTo:
        modalForm.visibility === 'specific' && modalForm.visibleTo.length > 0
          ? modalForm.visibleTo
          : undefined,
      visibility: modalForm.visibility,
    });
    antdMessage.success('文档创建成功');
    modalVisible.value = false;
    await loadDocuments();
  } finally {
    modalSaving.value = false;
  }
}

/** 编辑元数据 */
async function handleUpdateMetadata() {
  if (!modalForm.title.trim()) {
    antdMessage.warning('请输入文档标题');
    return;
  }
  modalSaving.value = true;
  try {
    await updateDocumentMetadataApi({
      directoryId: modalForm.directoryId,
      documentId: currentRecord.value?.documentId ?? '',
      summary: modalForm.summary || undefined,
      tags: modalForm.tags.length > 0 ? modalForm.tags : undefined,
      title: modalForm.title.trim(),
      visibility: modalForm.visibility,
    });
    antdMessage.success('文档信息已更新');
    modalVisible.value = false;
    await loadDocuments();
  } finally {
    modalSaving.value = false;
  }
}

/** 更新内容（产生新版本并触发 ETL） */
async function handleUpdateContent() {
  if (!uploadFilePath.value) {
    antdMessage.warning('请先上传新版本文件');
    return;
  }
  modalSaving.value = true;
  try {
    await updateDocumentContentApi({
      changeLog: modalForm.changeLog || undefined,
      documentId: currentRecord.value?.documentId ?? '',
      filePath: uploadFilePath.value,
    });
    antdMessage.success('文档内容更新成功');
    modalVisible.value = false;
    await loadDocuments();
  } finally {
    modalSaving.value = false;
  }
}

/** 删除文档（移入回收站） */
async function handleDelete(record: Document) {
  try {
    await deleteDocumentApi(record.documentId);
    antdMessage.success('文档已移入回收站');
    await loadDocuments();
  } catch {
    // 错误提示已由拦截器统一处理
  }
}

/** 恢复文档 */
async function handleRestore(record: Document) {
  try {
    await restoreDocumentApi(record.documentId);
    antdMessage.success('文档已恢复');
    await loadDocuments();
  } catch {
    // 错误提示已由拦截器统一处理
  }
}

/** 打开详情抽屉 */
async function openDetail(documentId: string) {
  drawerVisible.value = true;
  drawerLoading.value = true;
  detailDocument.value = null;
  versions.value = [];
  try {
    const data = await getDocumentApi(documentId);
    detailDocument.value = data.document;
  } finally {
    drawerLoading.value = false;
  }
  await loadVersions(documentId);
}

/** 加载版本历史 */
async function loadVersions(documentId: string) {
  versionsLoading.value = true;
  try {
    const data = await listDocumentVersionsApi(documentId);
    versions.value = data.versions ?? [];
  } finally {
    versionsLoading.value = false;
  }
}

/** 回滚版本 */
async function handleRollback(version: DocumentVersion) {
  if (!detailDocument.value) {
    return;
  }
  try {
    await rollbackDocumentApi({
      documentId: detailDocument.value.documentId,
      targetVersionId: version.versionId,
    });
    antdMessage.success(`已回滚到版本 v${version.versionNumber}`);
    await loadVersions(detailDocument.value.documentId);
    await loadDocuments();
  } catch {
    // 错误提示已由拦截器统一处理
  }
}

onMounted(() => {
  void loadDirectoryOptions();
  void loadDocuments();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden p-4">
    <!-- 筛选栏 -->
    <div class="mb-3 flex shrink-0 flex-wrap items-center gap-3">
      <AInput
        v-model:value="filters.keyword"
        class="w-64"
        placeholder="搜索标题 / 标签"
        allow-clear
        @press-enter="handleSearch"
      >
        <template #prefix>
          <Search class="h-4 w-4 text-muted-foreground" />
        </template>
      </AInput>
      <ASelect
        v-model:value="filters.directoryId"
        class="w-56"
        placeholder="全部目录"
        allow-clear
        :options="directoryOptions"
        @change="handleSearch"
      />
      <ASelect
        v-model:value="filters.status"
        class="w-32"
        placeholder="全部状态"
        allow-clear
        :options="statusOptions"
        @change="handleSearch"
      />
      <AButton @click="handleSearch">
        <template #icon>
          <RotateCw class="h-4 w-4" />
        </template>
        查询
      </AButton>
      <div class="flex-1"></div>
      <AButton type="primary" @click="openCreate">
        <template #icon>
          <Plus class="h-4 w-4" />
        </template>
        新建文档
      </AButton>
    </div>

    <!-- 文档表格 -->
    <div
      class="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card"
    >
      <ATable
        :columns="columns"
        :data-source="documents"
        :loading="loading"
        :pagination="pagination"
        row-key="documentId"
        :scroll="{ x: 1240 }"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <!-- 标题 + 标签 -->
          <template v-if="column.key === 'title'">
            <div class="truncate font-medium">{{ record.title }}</div>
            <div v-if="record.tags?.length" class="mt-0.5">
              <ATag v-for="tag in record.tags" :key="tag" class="mr-1">
                {{ tag }}
              </ATag>
            </div>
          </template>

          <template v-else-if="column.key === 'directoryName'">
            <span class="text-muted-foreground">
              {{ record.directoryName || '-' }}
            </span>
          </template>

          <template v-else-if="column.key === 'status'">
            <ATag
              :color="DOCUMENT_STATUS_COLOR[record.status as DocumentStatus]"
            >
              {{
                DOCUMENT_STATUS_MAP[record.status as DocumentStatus] ||
                record.status
              }}
            </ATag>
          </template>

          <template v-else-if="column.key === 'etlStatus'">
            <ATooltip
              v-if="record.etlStatus === 'failed'"
              :title="record.etlErrorMessage || 'ETL 处理失败'"
            >
              <ATag :color="ETL_STATUS_COLOR[record.etlStatus as EtlStatus]">
                {{
                  ETL_STATUS_MAP[record.etlStatus as EtlStatus] ||
                  record.etlStatus
                }}
              </ATag>
            </ATooltip>
            <ATag
              v-else
              :color="ETL_STATUS_COLOR[record.etlStatus as EtlStatus]"
            >
              {{
                ETL_STATUS_MAP[record.etlStatus as EtlStatus] ||
                record.etlStatus
              }}
            </ATag>
          </template>

          <template v-else-if="column.key === 'visibility'">
            <ATag :color="VISIBILITY_COLOR[record.visibility as Visibility]">
              {{
                VISIBILITY_MAP[record.visibility as Visibility] ||
                record.visibility
              }}
            </ATag>
          </template>

          <template v-else-if="column.key === 'fileSize'">
            <span class="text-muted-foreground">
              {{ formatFileSize(record.fileSize) }}
            </span>
          </template>

          <template v-else-if="column.key === 'currentVersion'">
            <span class="text-muted-foreground">v{{ record.currentVersion ?? '-' }}</span>
          </template>

          <template v-else-if="column.key === 'updateTime'">
            <span class="text-muted-foreground">
              {{ formatDateTime(record.updateTime) }}
            </span>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="flex items-center gap-2">
              <a
                class="text-xs text-primary hover:underline"
                @click="openDetail(record.documentId)"
                >详情</a>
              <a
                v-if="record.status !== 'deleted'"
                class="text-xs text-primary hover:underline"
                @click="openEditMetadata(record as Document)"
                >编辑</a>
              <a
                v-if="record.status !== 'deleted'"
                class="text-xs text-primary hover:underline"
                @click="openUpdateContent(record as Document)"
                >更新</a>
              <APopconfirm
                v-if="record.status === 'deleted'"
                title="确定恢复该文档？"
                ok-text="恢复"
                cancel-text="取消"
                @confirm="handleRestore(record as Document)"
              >
                <a class="text-xs text-primary hover:underline">恢复</a>
              </APopconfirm>
              <APopconfirm
                v-else
                title="确定删除该文档？（移入回收站）"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete(record as Document)"
              >
                <a class="text-xs text-destructive hover:underline">删除</a>
              </APopconfirm>
            </div>
          </template>
        </template>

        <template #emptyText>
          <AEmpty description="暂无文档" />
        </template>
      </ATable>
    </div>

    <!-- 新建 / 编辑元数据 / 更新内容 -->
    <AModal
      v-model:open="modalVisible"
      :title="modalTitle"
      :ok-text="modalType === 'update-content' ? '提交更新' : '保存'"
      cancel-text="取消"
      :confirm-loading="modalSaving"
      :width="520"
      @ok="handleModalOk"
    >
      <!-- 新建 -->
      <template v-if="modalType === 'create'">
        <div class="space-y-3">
          <AInput
            v-model:value="modalForm.title"
            placeholder="文档标题"
            allow-clear
          />
          <ASelect
            v-model:value="modalForm.directoryId"
            placeholder="所属目录（可空）"
            allow-clear
            :options="directoryOptions"
          />
          <ASelect
            v-model:value="modalForm.tags"
            mode="tags"
            placeholder="标签（回车添加）"
            :open="false"
          />
          <ASelect
            v-model:value="modalForm.visibility"
            placeholder="可见范围"
            :options="visibilityOptions"
          />
          <ASelect
            v-if="modalForm.visibility === 'specific'"
            v-model:value="modalForm.visibleTo"
            mode="tags"
            placeholder="指定可见用户/部门（回车添加）"
            :open="false"
          />
          <div class="flex items-center gap-3">
            <AUpload
              accept=".md,.txt,.pdf,.doc,.docx,.xls,.pptx"
              :show-upload-list="false"
              :before-upload="handleBeforeUpload"
            >
              <AButton :loading="uploadUploading">选择文件</AButton>
            </AUpload>
            <span
              v-if="uploadFileName"
              class="max-w-56 truncate text-xs text-muted-foreground"
            >
              {{ uploadFileName }}
            </span>
          </div>
        </div>
      </template>

      <!-- 编辑元数据 -->
      <template v-else-if="modalType === 'update-metadata'">
        <div class="space-y-3">
          <AInput
            v-model:value="modalForm.title"
            placeholder="文档标题"
            allow-clear
          />
          <AInput
            v-model:value="modalForm.summary"
            placeholder="文档摘要"
            allow-clear
          />
          <ASelect
            v-model:value="modalForm.directoryId"
            placeholder="所属目录（可空）"
            allow-clear
            :options="directoryOptions"
          />
          <ASelect
            v-model:value="modalForm.tags"
            mode="tags"
            placeholder="标签（回车添加）"
            :open="false"
          />
          <ASelect
            v-model:value="modalForm.visibility"
            placeholder="可见范围"
            :options="visibilityOptions"
          />
        </div>
      </template>

      <!-- 更新内容 -->
      <template v-else-if="modalType === 'update-content'">
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <AUpload
              accept=".md,.txt,.pdf,.doc,.docx,.xls,.pptx"
              :show-upload-list="false"
              :before-upload="handleBeforeUpload"
            >
              <AButton :loading="uploadUploading">选择新版本文件</AButton>
            </AUpload>
            <span
              v-if="uploadFileName"
              class="max-w-56 truncate text-xs text-muted-foreground"
            >
              {{ uploadFileName }}
            </span>
          </div>
          <AInput
            v-model:value="modalForm.changeLog"
            placeholder="变更说明（可空）"
            allow-clear
          />
        </div>
      </template>
    </AModal>

    <!-- 详情抽屉 -->
    <ADrawer v-model:open="drawerVisible" title="文档详情" :width="520">
      <ASpin :spinning="drawerLoading">
        <template v-if="detailDocument">
          <ADescriptions :column="1" size="small" bordered>
            <ADescriptionsItem label="标题">
              {{ detailDocument.title }}
            </ADescriptionsItem>
            <ADescriptionsItem label="摘要">
              {{ detailDocument.summary || '-' }}
            </ADescriptionsItem>
            <ADescriptionsItem label="目录">
              {{ detailDocument.directoryName || '-' }}
            </ADescriptionsItem>
            <ADescriptionsItem label="格式">
              {{ detailDocument.format || '-' }}
            </ADescriptionsItem>
            <ADescriptionsItem label="大小">
              {{ formatFileSize(detailDocument.fileSize) }}
            </ADescriptionsItem>
            <ADescriptionsItem label="状态">
              <ATag
                :color="
                  DOCUMENT_STATUS_COLOR[detailDocument.status as DocumentStatus]
                "
              >
                {{
                  DOCUMENT_STATUS_MAP[
                    detailDocument.status as DocumentStatus
                  ] || detailDocument.status
                }}
              </ATag>
            </ADescriptionsItem>
            <ADescriptionsItem label="ETL 状态">
              <ATag
                :color="ETL_STATUS_COLOR[detailDocument.etlStatus as EtlStatus]"
              >
                {{
                  ETL_STATUS_MAP[detailDocument.etlStatus as EtlStatus] ||
                  detailDocument.etlStatus
                }}
              </ATag>
            </ADescriptionsItem>
            <ADescriptionsItem
              v-if="detailDocument.etlStatus === 'failed'"
              label="ETL 错误"
            >
              <span class="text-destructive">
                {{ detailDocument.etlErrorMessage || '-' }}
              </span>
            </ADescriptionsItem>
            <ADescriptionsItem label="可见范围">
              <ATag
                :color="
                  VISIBILITY_COLOR[detailDocument.visibility as Visibility]
                "
              >
                {{
                  VISIBILITY_MAP[detailDocument.visibility as Visibility] ||
                  detailDocument.visibility
                }}
              </ATag>
            </ADescriptionsItem>
            <ADescriptionsItem label="当前版本">
              v{{ detailDocument.currentVersion ?? '-' }}
            </ADescriptionsItem>
            <ADescriptionsItem label="创建人">
              {{ detailDocument.creator || '-' }}
            </ADescriptionsItem>
            <ADescriptionsItem label="创建时间">
              {{ formatDateTime(detailDocument.createTime) }}
            </ADescriptionsItem>
            <ADescriptionsItem label="更新时间">
              {{ formatDateTime(detailDocument.updateTime) }}
            </ADescriptionsItem>
          </ADescriptions>
        </template>
      </ASpin>

      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm font-medium">版本历史</span>
        <AButton
          size="small"
          @click="detailDocument && loadVersions(detailDocument.documentId)"
        >
          <template #icon>
            <RotateCw class="h-3.5 w-3.5" />
          </template>
          刷新
        </AButton>
      </div>
      <div class="mt-2 space-y-2">
        <ASpin :spinning="versionsLoading">
          <div
            v-for="version in versions"
            :key="version.versionId"
            class="rounded-md border border-border bg-card px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium">
                v{{ version.versionNumber }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ formatDateTime(version.createTime) }}
              </span>
            </div>
            <div
              v-if="version.changeLog"
              class="mt-1 truncate text-xs text-muted-foreground"
            >
              {{ version.changeLog }}
            </div>
            <div class="mt-1 flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                {{ version.creator || '-' }} ·
                {{ formatFileSize(version.fileSize) }}
              </span>
              <APopconfirm
                title="确定回滚到该版本？（会新增一个版本）"
                ok-text="回滚"
                cancel-text="取消"
                @confirm="handleRollback(version)"
              >
                <a class="text-xs text-primary hover:underline">回滚</a>
              </APopconfirm>
            </div>
          </div>
          <div
            v-if="!versionsLoading && versions.length === 0"
            class="py-6 text-center text-xs text-muted-foreground"
          >
            暂无版本记录
          </div>
        </ASpin>
      </div>
    </ADrawer>
  </div>
</template>
