import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:message-square-text',
      order: 10,
      title: '智能问答',
    },
    name: 'Agent',
    path: '/agent',
    children: [
      {
        name: 'AgentChat',
        path: 'chat',
        component: () => import('#/views/agent/chat/index.vue'),
        meta: {
          icon: 'lucide:message-circle',
          title: '对话',
        },
      },
    ],
  },
  {
    meta: {
      icon: 'lucide:book-open',
      order: 20,
      title: '知识管理',
    },
    name: 'Knowledge',
    path: '/knowledge',
    children: [
      {
        name: 'KnowledgeDirectory',
        path: 'directory',
        component: () => import('#/views/knowledge/directory/index.vue'),
        meta: {
          icon: 'lucide:folder-tree',
          title: '目录管理',
        },
      },
      {
        name: 'KnowledgeDocument',
        path: 'document',
        component: () => import('#/views/knowledge/document/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: '文档管理',
        },
      },
    ],
  },
];

export default routes;
