import { ZSAGENT_API_URL, zsagentRequestClient } from './request';

/** 当前阶段无真实权限体系，统一使用默认管理员账号 */
export const DEFAULT_USER_ID = 'admin';

/** 消息角色（对齐后端 MessageRole.code） */
export type MessageRole = 'assistant' | 'system' | 'user';

/** 反馈类型（对齐后端 FeedbackType.code；submit-feedback 后端会转大写解析） */
export type FeedbackType = 'not_useful' | 'useful';

/** 来源引用（对齐后端 SourceReferenceDTO） */
export interface SourceReference {
  documentId: string;
  documentTitle: string;
  contentSnippet: string;
  score?: number;
}

/** 消息（对齐后端 MessageDTO） */
export interface Message {
  messageId: string;
  role: MessageRole;
  content: string;
  sources?: SourceReference[];
  feedback?: FeedbackType | null;
  createTime?: string;
}

/** 对话（对齐后端 ConversationDTO） */
export interface Conversation {
  conversationId: string;
  title: string;
  messages?: Message[];
  createTime?: string;
  updatedAt?: string;
}

/** 对话列表结果（对齐后端 ConversationListResult） */
export interface ConversationListResult {
  list: Conversation[];
  total: number;
  page: number;
  size: number;
}

/** 对话详情结果（对齐后端 ConversationResult） */
export interface ConversationResult {
  conversation: Conversation;
}

/**
 * 分页查询当前用户的对话列表。
 */
export async function listConversationsApi(page = 1, size = 20) {
  return zsagentRequestClient.get<ConversationListResult>(
    '/agent/list-conversations',
    {
      params: {
        page,
        size,
        userId: DEFAULT_USER_ID,
      },
    },
  );
}

/**
 * 查询单个对话详情（含全部消息与来源引用）。
 */
export async function getConversationApi(conversationId: string) {
  return zsagentRequestClient.get<ConversationResult>(
    '/agent/get-conversation',
    {
      params: {
        conversationId,
        userId: DEFAULT_USER_ID,
      },
    },
  );
}

/**
 * 提交消息反馈。
 */
export async function submitFeedbackApi(params: {
  conversationId: string;
  messageId: string;
  reason?: string;
  type: FeedbackType;
}) {
  return zsagentRequestClient.post('/agent/submit-feedback', {
    conversationId: params.conversationId,
    messageId: params.messageId,
    reason: params.reason,
    type: params.type,
    userId: DEFAULT_USER_ID,
  });
}

/** SSE 流式问答处理器 */
export interface AskQuestionHandlers {
  /** 每个内容分块回调 */
  onChunk: (chunk: string) => void;
  /** 流结束（含 [DONE] 标记或异常终止）回调 */
  onDone: () => void;
  /** 非中止性错误回调 */
  onError?: (error: unknown) => void;
}

/**
 * 流式提问 — 基于 fetch 消费 SSE（后端返回 `text/event-stream;charset=UTF-8`）。
 *
 * 事件格式：默认事件携带 `data: <答案分块>`，结束时发送 `event: done` + `data: [DONE]`。
 * 支持通过 `signal` 中止（用户停止生成）。
 */
export async function askQuestionStream(
  params: { conversationId: string; question: string },
  handlers: AskQuestionHandlers,
  signal?: AbortSignal,
) {
  const res = await fetch(`${ZSAGENT_API_URL}/agent/ask-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: params.conversationId,
      question: params.question,
      userId: DEFAULT_USER_ID,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`流式提问请求失败: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;

  const flushEvent = (rawEvent: string) => {
    if (!rawEvent.trim() || finished) {
      return;
    }
    const event = parseSseEvent(rawEvent);
    // 默认事件为答案内容分块；结束标记为 done 事件或 [DONE]
    if (event.name === 'done' || event.data === '[DONE]') {
      finished = true;
      handlers.onDone();
    } else {
      handlers.onChunk(event.data);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // SSE 事件以空行（\n\n）分隔
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        flushEvent(rawEvent);
      }
    }
    if (buffer.trim()) {
      flushEvent(buffer);
    }
  } catch (error) {
    // 用户主动中止时静默处理，由视图层统一收尾
    if (signal?.aborted) {
      handlers.onDone();
      return;
    }
    handlers.onError?.(error);
    handlers.onDone();
    return;
  }

  if (!finished) {
    handlers.onDone();
  }
}

/** 解析单条 SSE 事件（event/data 字段） */
function parseSseEvent(rawEvent: string): { data: string; name: string } {
  const dataLines: string[] = [];
  let name = 'message';
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('event:')) {
      name = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return { data: dataLines.join('\n'), name };
}
