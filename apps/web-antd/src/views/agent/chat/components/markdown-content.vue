<script lang="ts" setup>
import { computed } from 'vue';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

defineOptions({ name: 'MarkdownContent' });

const props = defineProps<{
  /** markdown 原文，流式输出时不断追加 */
  content: string;
}>();

/** markdown 转 HTML 并做 XSS 消毒 */
const html = computed(() =>
  DOMPurify.sanitize(marked.parse(props.content || '', { async: false })),
);
</script>

<!-- html 已由 DOMPurify 消毒，故对 v-html 的 XSS 告警做豁免 -->
<!-- eslint-disable vue/no-v-html -->
<template>
  <div
    class="markdown-body text-sm leading-6 text-foreground"
    v-html="html"
  ></div>
</template>
<!-- eslint-enable vue/no-v-html -->

<style scoped>
.markdown-body :deep(> :first-child) {
  margin-top: 0;
}

.markdown-body :deep(> :last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(pre) {
  padding: 0.75em;
  margin: 0.75em 0;
  overflow-x: auto;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
}

.markdown-body :deep(blockquote) {
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: hsl(var(--muted-foreground));
  border-left: 3px solid hsl(var(--border));
}
</style>
