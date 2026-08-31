<script lang="ts" setup>
import type { DirectoryNode } from '#/api/zsagent/knowledge';

import { computed, onMounted, ref } from 'vue';

import { Plus } from '@vben/icons';

import {
  Button as AButton,
  Empty as AEmpty,
  Input as AInput,
  Modal as AModal,
  message as antdMessage,
  Popconfirm as APopconfirm,
  Spin as ASpin,
  Tree as ATree,
} from 'ant-design-vue';

import {
  createDirectoryApi,
  deleteDirectoryApi,
  listDirectoryTreeApi,
  moveDirectoryApi,
  renameDirectoryApi,
} from '#/api/zsagent/knowledge';

defineOptions({ name: 'KnowledgeDirectory' });

/** antd Tree 节点（挂载原始目录节点便于渲染操作按钮） */
interface TreeItem {
  children?: TreeItem[];
  directory: DirectoryNode;
  disabled?: boolean;
  key: string;
  title: string;
}

/** 弹窗类型 */
type ModalType = 'create' | 'move' | 'rename' | null;

const loading = ref(false);
const treeData = ref<TreeItem[]>([]);

const modalVisible = ref(false);
const modalType = ref<ModalType>(null);
const modalTitle = ref('');
const nameInput = ref('');
const nameSaving = ref(false);

/** 当前操作的目标目录 */
const targetDirectory = ref<DirectoryNode | null>(null);
/** 新建目录的父节点 */
const createParent = ref<DirectoryNode | null>(null);

/** 移动目标选择 */
const moveSelectedKeys = ref<string[]>([]);

/** 目录 → 展开树节点 */
function toTreeItem(node: DirectoryNode): TreeItem {
  return {
    children: node.children?.map(toTreeItem),
    directory: node,
    key: node.directoryId,
    title: node.name,
  };
}

/** 加载目录树 */
async function loadTree() {
  loading.value = true;
  try {
    const data = await listDirectoryTreeApi();
    treeData.value = (data.directories ?? []).map((item) => toTreeItem(item));
  } finally {
    loading.value = false;
  }
}

/** 将节点及其全部后代 key 加入集合 */
function addSubtreeKeys(items: TreeItem[], keys: Set<string>) {
  for (const item of items) {
    keys.add(item.key);
    if (item.children?.length) {
      addSubtreeKeys(item.children, keys);
    }
  }
}

/** 打开新建目录弹窗 */
function openCreate(parent?: DirectoryNode) {
  createParent.value = parent ?? null;
  modalType.value = 'create';
  modalTitle.value = parent ? `在「${parent.name}」下新建目录` : '新建根目录';
  nameInput.value = '';
  modalVisible.value = true;
}

/** 打开重命名弹窗 */
function openRename(directory: DirectoryNode) {
  targetDirectory.value = directory;
  modalType.value = 'rename';
  modalTitle.value = '重命名目录';
  nameInput.value = directory.name;
  modalVisible.value = true;
}

/** 打开移动弹窗 */
function openMove(directory: DirectoryNode) {
  targetDirectory.value = directory;
  modalType.value = 'move';
  modalTitle.value = `移动「${directory.name}」到`;
  moveSelectedKeys.value = [];
  modalVisible.value = true;
}

/** 确认创建/重命名 */
async function handleSaveName() {
  const name = nameInput.value.trim();
  if (!name) {
    antdMessage.warning('请输入目录名称');
    return;
  }
  nameSaving.value = true;
  try {
    if (modalType.value === 'create') {
      await createDirectoryApi({
        name,
        parentId: createParent.value?.directoryId,
      });
      antdMessage.success('目录创建成功');
    } else if (modalType.value === 'rename' && targetDirectory.value) {
      await renameDirectoryApi({
        directoryId: targetDirectory.value.directoryId,
        newName: name,
      });
      antdMessage.success('目录重命名成功');
    }
    modalVisible.value = false;
    await loadTree();
  } finally {
    nameSaving.value = false;
  }
}

/** 确认移动 */
async function handleMove() {
  if (!targetDirectory.value) {
    return;
  }
  const newParentId = moveSelectedKeys.value[0];
  if (newParentId && newParentId === targetDirectory.value.directoryId) {
    antdMessage.warning('不能移动到自身');
    return;
  }
  nameSaving.value = true;
  try {
    await moveDirectoryApi({
      directoryId: targetDirectory.value.directoryId,
      newParentId,
    });
    antdMessage.success('目录移动成功');
    modalVisible.value = false;
    await loadTree();
  } finally {
    nameSaving.value = false;
  }
}

/** 确认删除 */
async function handleDelete(directory: DirectoryNode) {
  try {
    await deleteDirectoryApi(directory.directoryId);
    antdMessage.success('目录已删除');
    await loadTree();
  } catch {
    // 错误提示已由拦截器统一处理
  }
}

/** 弹窗确认回调 */
function handleModalOk() {
  if (modalType.value === 'move') {
    void handleMove();
  } else {
    void handleSaveName();
  }
}

/** 移动目标树：自身及后代节点禁用，避免移动到自身内部 */
const moveTreeData = computed<TreeItem[]>(() => {
  const target = targetDirectory.value;
  if (!target || treeData.value.length === 0) {
    return treeData.value;
  }
  const disabledSet = new Set<string>();
  const visit = (items: TreeItem[]) => {
    for (const item of items) {
      if (item.directory.directoryId === target.directoryId) {
        addSubtreeKeys([item], disabledSet);
      } else if (item.children?.length) {
        visit(item.children);
      }
    }
  };
  visit(treeData.value);
  const mark = (items: TreeItem[]): TreeItem[] =>
    items.map((item) => ({
      ...item,
      children: item.children ? mark(item.children) : undefined,
      disabled: disabledSet.has(item.key),
    }));
  return mark(treeData.value);
});

onMounted(() => {
  void loadTree();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden p-4">
    <!-- 顶栏 -->
    <div class="mb-3 flex shrink-0 items-center justify-between">
      <span class="text-base font-semibold">目录管理</span>
      <AButton type="primary" @click="openCreate()">
        <template #icon>
          <Plus class="h-4 w-4" />
        </template>
        新建根目录
      </AButton>
    </div>

    <!-- 目录树 -->
    <div
      class="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card p-3"
    >
      <ASpin :spinning="loading">
        <ATree
          v-if="treeData.length > 0"
          :tree-data="treeData"
          block-node
          :default-expand-all="true"
        >
          <template #title="{ data: node, title }">
            <div class="group flex items-center gap-1 pr-1">
              <span class="truncate">{{ title }}</span>
              <span
                v-if="node?.directory?.documentCount"
                class="shrink-0 text-xs text-muted-foreground"
              >
                ({{ node.directory.documentCount }})
              </span>
              <span
                class="hidden shrink-0 items-center gap-1 group-hover:inline-flex"
              >
                <a
                  class="text-xs text-primary hover:underline"
                  @click.stop="openCreate(node.directory)"
                  >新建</a>
                <a
                  class="text-xs text-primary hover:underline"
                  @click.stop="openRename(node.directory)"
                  >重命名</a>
                <a
                  class="text-xs text-primary hover:underline"
                  @click.stop="openMove(node.directory)"
                  >移动</a>
                <APopconfirm
                  title="确定删除该目录？其下文档可能一并受影响"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="handleDelete(node.directory)"
                >
                  <a
                    class="text-xs text-destructive hover:underline"
                    @click.stop
                    >删除</a>
                </APopconfirm>
              </span>
            </div>
          </template>
        </ATree>
        <div v-else-if="!loading" class="flex h-40 items-center justify-center">
          <AEmpty description="暂无目录" />
        </div>
      </ASpin>
    </div>

    <!-- 新建 / 重命名 -->
    <AModal
      v-model:open="modalVisible"
      :title="modalTitle"
      :ok-text="modalType === 'create' ? '创建' : '保存'"
      cancel-text="取消"
      :confirm-loading="nameSaving"
      :width="420"
      @ok="handleModalOk"
    >
      <AInput
        v-model:value="nameInput"
        placeholder="请输入目录名称"
        allow-clear
        @press-enter="handleModalOk"
      />
    </AModal>

    <!-- 移动目标选择 -->
    <AModal
      :open="modalVisible && modalType === 'move'"
      :title="modalTitle"
      ok-text="移动"
      cancel-text="取消"
      :confirm-loading="nameSaving"
      :width="420"
      @ok="handleModalOk"
      @cancel="modalVisible = false"
    >
      <div
        class="max-h-72 overflow-auto rounded-md border border-border bg-card p-2"
      >
        <ATree
          :tree-data="moveTreeData"
          block-node
          :default-expand-all="true"
          :selected-keys="moveSelectedKeys"
          @select="
            (keys: (string | number)[]) => {
              moveSelectedKeys = keys as string[];
            }
          "
        />
      </div>
      <div class="mt-2 text-xs text-muted-foreground">
        选择目标目录，留空表示移动到根目录
      </div>
    </AModal>
  </div>
</template>
