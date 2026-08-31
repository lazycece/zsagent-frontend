import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          // zsagent 后端业务接口（agent / knowledge / file）
          '/api/v1': {
            changeOrigin: true,
            target: 'http://localhost:8080',
          },
          // vben 登录 Mock（Nitro Mock Server，admin / 123456）
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
    },
  };
});
