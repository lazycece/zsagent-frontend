<script lang="ts" setup>
import type { Conversation, FeedbackType, Message } from '#/api/zsagent/agent';

import { computed, nextTick, onMounted, ref } from 'vue';

import { ArrowUp, LoaderCircle, Plus, Square } from '@vben/icons';

import {
  Modal as AModal,
  message as antdMessage,
  Textarea as ATextarea,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  askQuestionStream,
  getConversationApi,
  listConversationsApi,
  submitFeedbackApi,
} from '#/api/zsagent/agent';

import MarkdownContent from './components/markdown-content.vue';

defineOptions({ name: 'AgentChat' });

/** 生成客户端侧对话/消息 ID */
function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const conversations = ref<Conversation[]>([]);
const activeConversationId = ref('');
const messages = ref<Message[]>([]);
const input = ref('');
const streaming = ref(false);
const loadingList = ref(false);
const loadingMessages = ref(false);

/** 来源引用展开状态（按消息 ID） */
const expandedSources = ref(new Set<string>());

/** 拒绝反馈原因弹窗状态 */
const feedbackModalVisible = ref(false);
const feedbackMessage = ref<Message | null>(null);
const feedbackReason = ref('');

const scrollRef = ref<HTMLElement>();
const inputRef = ref<{ focus: () => void }>();
let abortController: AbortController | null = null;

/** 当前激活对话 */
const activeConversation = computed(() =>
  conversations.value.find(
    (item) => item.conversationId === activeConversationId.value,
  ),
);

/** 滚动到底部 */
async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

/** 拉取对话列表 */
async function loadConversations() {
  loadingList.value = true;
  try {
    const data = await listConversationsApi(1, 100);
    conversations.value = data.list ?? [];
  } finally {
    loadingList.value = false;
  }
}

/** 选择对话并加载消息 */
async function selectConversation(conversationId: string) {
  if (streaming.value) {
    abortController?.abort();
  }
  activeConversationId.value = conversationId;
  messages.value = [];
  loadingMessages.value = true;
  try {
    const data = await getConversationApi(conversationId);
    messages.value = data.conversation.messages ?? [];
  } finally {
    loadingMessages.value = false;
    await scrollToBottom();
  }
}

/** 新建对话 */
function newConversation() {
  if (streaming.value) {
    abortController?.abort();
  }
  const conversationId = genId();
  activeConversationId.value = conversationId;
  messages.value = [];
  input.value = '';
  // 立即在左侧列表展示新对话，便于感知状态
  conversations.value.unshift({
    conversationId,
    title: '未命名对话',
  });
  inputRef.value?.focus();
}

/** 发送提问（流式） */
async function send() {
  if (streaming.value) {
    return;
  }
  const question = input.value.trim();
  if (!question) {
    return;
  }
  if (!activeConversationId.value) {
    activeConversationId.value = genId();
  }
  const conversationId = activeConversationId.value;

  messages.value.push({
    content: question,
    messageId: genId(),
    role: 'user',
  });
  const assistantMessage: Message = {
    content: '',
    messageId: genId(),
    role: 'assistant',
  };
  messages.value.push(assistantMessage);
  input.value = '';
  await scrollToBottom();

  streaming.value = true;
  abortController = new AbortController();
  try {
    await askQuestionStream(
      { conversationId, question },
      {
        onChunk: (chunk) => {
          assistantMessage.content += chunk;
          void scrollToBottom();
        },
        onDone: async () => {
          // 流结束后刷新对话（获取来源引用与反馈状态），并刷新会话列表（标题可能已生成）
          await refreshConversation(conversationId);
          await loadConversations();
        },
        onError: () => {
          antdMessage.error('回答生成失败，请稍后重试');
        },
      },
      abortController.signal,
    );
  } finally {
    streaming.value = false;
    abortController = null;
  }
}

/** 刷新单个对话（拉取来源引用等） */
async function refreshConversation(conversationId: string) {
  try {
    const data = await getConversationApi(conversationId);
    messages.value = data.conversation.messages ?? [];
    await scrollToBottom();
  } catch {
    // 刷新失败不影响已有流式内容
  }
}

/** 停止生成 */
function stopGenerate() {
  abortController?.abort();
}

/** 输入框回车发送 */
function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
}

/** 打开拒绝反馈弹窗 */
function openFeedbackModal(assistantMessage: Message) {
  if (streaming.value || assistantMessage.role !== 'assistant') {
    return;
  }
  feedbackMessage.value = assistantMessage;
  feedbackReason.value = '';
  feedbackModalVisible.value = true;
}

/** 提交反馈 */
async function handleFeedback(
  assistantMessage: Message,
  type: FeedbackType,
  reason?: string,
) {
  if (streaming.value || !activeConversationId.value) {
    return;
  }
  try {
    await submitFeedbackApi({
      conversationId: activeConversationId.value,
      messageId: assistantMessage.messageId,
      reason,
      type,
    });
    assistantMessage.feedback = type;
    antdMessage.success(type === 'useful' ? '已标记为有用' : '已标记为无用');
  } catch {
    antdMessage.error('反馈提交失败');
  }
}

/** 确认拒绝反馈 */
async function confirmNotUseful() {
  const target = feedbackMessage.value;
  feedbackModalVisible.value = false;
  if (!target) {
    return;
  }
  await handleFeedback(target, 'not_useful', feedbackReason.value.trim());
}

/** 不填原因直接提交 */
function submitWithoutReason() {
  const target = feedbackMessage.value;
  feedbackModalVisible.value = false;
  if (!target) {
    return;
  }
  void handleFeedback(target, 'not_useful');
}

/** 切换来源引用展开 */
function toggleSources(messageId: string) {
  const next = new Set(expandedSources.value);
  if (next.has(messageId)) {
    next.delete(messageId);
  } else {
    next.add(messageId);
  }
  expandedSources.value = next;
}

onMounted(() => {
  void loadConversations();
});
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 左侧：会话列表 -->
    <aside class="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      <div class="flex items-center justify-between p-3">
        <span class="text-base font-semibold">对话列表</span>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="新建对话"
          type="button"
          @click="newConversation"
        >
          <Plus class="h-4 w-4" />
        </button>
      </div>

      <div v-if="loadingList" class="flex flex-1 items-center justify-center">
        <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <ul v-else class="flex-1 overflow-y-auto px-2 pb-2">
        <li
          v-for="item in conversations"
          :key="item.conversationId"
          class="mb-1 cursor-pointer rounded-md px-2 py-2 text-sm transition-colors"
          :class="
            item.conversationId === activeConversationId
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-muted'
          "
          @click="selectConversation(item.conversationId)"
        >
          <div class="truncate">
            {{ item.title || '未命名对话' }}
          </div>
          <div
            class="mt-0.5 text-xs"
            :class="
              item.conversationId === activeConversationId
                ? 'text-primary'
                : 'text-muted-foreground'
            "
          >
            {{
              item.updatedAt ? dayjs(item.updatedAt).format('MM-DD HH:mm') : ''
            }}
          </div>
        </li>
        <li
          v-if="!loadingList && conversations.length === 0"
          class="py-8 text-center text-xs text-muted-foreground"
        >
          暂无对话，点击右上角新建
        </li>
      </ul>
    </aside>

    <!-- 右侧：聊天区域 -->
    <main class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"
      >
        <span class="truncate text-sm font-medium">
          {{
            activeConversation
              ? activeConversation.title || '未命名对话'
              : '智能问答'
          }}
        </span>
        <span v-if="activeConversation" class="text-xs text-muted-foreground">
          {{
            activeConversation.updatedAt
              ? dayjs(activeConversation.updatedAt).format('YYYY-MM-DD HH:mm')
              : ''
          }}
        </span>
      </header>

      <!-- 消息流 -->
      <div ref="scrollRef" class="flex-1 overflow-y-auto px-6 py-4">
        <div
          v-if="messages.length === 0"
          class="flex h-full items-center justify-center"
        >
          <div class="text-center">
            <div class="text-lg text-foreground">智能知识问答</div>
            <div class="mt-2 text-sm text-muted-foreground">
              输入问题开始对话，答案基于知识库内容生成
            </div>
          </div>
        </div>

        <div v-else class="mx-auto max-w-3xl space-y-5">
          <div
            v-for="item in messages"
            :key="item.messageId"
            class="flex gap-3"
            :class="item.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
          >
            <!-- 头像 -->
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium"
              :class="
                item.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              "
            >
              {{ item.role === 'user' ? '我' : 'AI' }}
            </div>

            <!-- 气泡 -->
            <div
              class="min-w-0 max-w-[78%] rounded-lg px-3 py-2"
              :class="
                item.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              "
            >
              <!-- 用户消息：纯文本 -->
              <template v-if="item.role === 'user'">
                <div class="whitespace-pre-wrap break-words text-sm leading-6">
                  {{ item.content }}
                </div>
              </template>

              <!-- 助手消息：markdown -->
              <template v-else>
                <div v-if="item.content" class="text-foreground">
                  <MarkdownContent :content="item.content" />
                </div>
                <div
                  v-else-if="streaming"
                  class="flex items-center gap-2 text-muted-foreground"
                >
                  <LoaderCircle class="h-4 w-4 animate-spin" />
                  <span class="text-sm">思考中...</span>
                </div>

                <!-- 来源引用 -->
                <div
                  v-if="item.sources && item.sources.length > 0"
                  class="mt-3"
                >
                  <button
                    type="button"
                    class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    @click="toggleSources(item.messageId)"
                  >
                    引用来源 ({{ item.sources.length }})
                    <span>{{
                      expandedSources.has(item.messageId) ? '▾' : '▸'
                    }}</span>
                  </button>
                  <div
                    v-if="expandedSources.has(item.messageId)"
                    class="mt-2 space-y-1"
                  >
                    <div
                      v-for="(source, index) in item.sources"
                      :key="`${item.messageId}-${index}`"
                      class="rounded-md border border-border bg-card px-2 py-1.5"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="truncate text-xs font-medium">
                          {{ source.documentTitle }}
                        </span>
                        <span
                          v-if="typeof source.score === 'number'"
                          class="shrink-0 text-xs text-muted-foreground"
                        >
                          {{ (source.score * 100).toFixed(1) }}%
                        </span>
                      </div>
                      <div
                        class="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground"
                      >
                        {{ source.contentSnippet }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 反馈 -->
                <div
                  v-if="!streaming && item.role === 'assistant'"
                  class="mt-2 flex items-center gap-1"
                >
                  <button
                    type="button"
                    class="rounded px-2 py-0.5 text-xs transition-colors"
                    :class="
                      item.feedback === 'useful'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="handleFeedback(item, 'useful')"
                  >
                    有用
                  </button>
                  <button
                    type="button"
                    class="rounded px-2 py-0.5 text-xs transition-colors"
                    :class="
                      item.feedback === 'not_useful'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="openFeedbackModal(item)"
                  >
                    无用
                  </button>
                </div>
              </template>
            </div>
          </div>

          <div v-if="loadingMessages" class="flex justify-center">
            <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="shrink-0 border-t border-border bg-card px-6 py-3">
        <div class="mx-auto max-w-3xl">
          <div
            class="flex items-end gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary"
          >
            <ATextarea
              ref="inputRef"
              v-model:value="input"
              :auto-size="{ minRows: 1, maxRows: 6 }"
              :bordered="false"
              placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
              class="max-h-40 flex-1 resize-none !bg-transparent"
              @keydown="handleInputKeydown"
            />
            <button
              v-if="streaming"
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-muted"
              title="停止生成"
              @click="stopGenerate"
            >
              <Square class="h-3.5 w-3.5" />
            </button>
            <button
              v-else
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!input.trim()"
              title="发送"
              @click="send"
            >
              <ArrowUp class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 拒绝反馈原因弹窗 -->
    <AModal
      v-model:open="feedbackModalVisible"
      title="反馈：答案无用"
      ok-text="提交"
      cancel-text="取消"
      @ok="confirmNotUseful"
    >
      <ATextarea
        v-model:value="feedbackReason"
        :auto-size="{ minRows: 3, maxRows: 5 }"
        placeholder="可填写反馈原因（选填）"
      />
      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="text-xs text-muted-foreground transition-colors hover:text-foreground"
          @click="submitWithoutReason"
        >
          直接提交，不填原因
        </button>
      </div>
    </AModal>
  </div>
</template>
