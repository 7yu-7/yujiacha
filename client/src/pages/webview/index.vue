<template>
  <web-view :src="url" />
</template>

<script>
export default {
  data() { return { url: '' }; },
  onLoad() {
    this.url = uni.getStorageSync('yjt_src') || 'https://pfsc.agri.cn';
  },
};
</script>
