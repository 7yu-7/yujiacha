import { createSSRApp } from 'vue';
import App from './App.vue';
import { applyTheme } from './utils/api';

export function createApp() {
  const app = createSSRApp(App);
  // 启动时应用已保存的主题偏好（F9）
  applyTheme();
  return { app };
}
