import type { RequestClientOptions } from '@vben/request';

import { preferences } from '@vben/preferences';
import {
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

/**
 * zsagent 后端 API 基础路径。
 * 开发环境由 vite proxy 将 `/api/v1` 转发到 zsagent 后端（8080，不重写路径）；
 * 生产环境可通过 `VITE_ZSAGENT_API_URL` 覆盖为真实后端地址。
 */
export const ZSAGENT_API_URL =
  import.meta.env.VITE_ZSAGENT_API_URL || '/api/v1';

/**
 * 创建 zsagent 业务请求客户端。
 *
 * 与 vben mock 客户端（dataField=data、successCode=0）不同，
 * zsagent 后端统一返回 `RespData`：`{ code, message, body, traceId }`，成功码为 200。
 */
function createZsagentRequestClient(options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL: ZSAGENT_API_URL,
  });

  // 请求头处理：附加上下文 token（当前无真实权限，可忽略）与语言
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = accessStore.accessToken
        ? `Bearer ${accessStore.accessToken}`
        : undefined;
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 处理返回的响应数据格式：RespData 的 data 字段为 body，成功码为 200
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'body',
      successCode: 200,
    }),
  );

  // 通用错误处理：后端错误信息在 message 字段
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.message ?? '';
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

/** zsagent 业务请求客户端，返回已解包的 body（RespData.body） */
export const zsagentRequestClient = createZsagentRequestClient({
  responseReturn: 'data',
});
