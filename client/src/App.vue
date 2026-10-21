<script>
import { store } from './utils/api';
import { THEME_KEY } from './utils/config';

export default {
  onLaunch() {
    // 应用主题偏好
    const t = store.get(THEME_KEY) || 'light';
    // #ifdef H5
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
    // #endif
  },
  onShow() { },
  onHide() { },
};
</script>

<style>
@import './uni.scss';
</style>
