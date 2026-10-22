const { api } = require('../../utils/api.js');

Page({
  data: {
    mode: 'login',
    nickname: '',
    email: '',
    password: '',
    loading: false
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  bind(e) {
    this.setData({ [e.currentTarget.dataset.f]: e.detail.value });
  },

  submit() {
    const { mode, nickname, email, password } = this.data;
    if (mode === 'register' && !nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (!email || !password) {
      wx.showToast({ title: '请输入邮箱和密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    const p = mode === 'login'
      ? api.login({ email, password })
      : api.register({ nickname, email, password });
    p.then((r) => {
      const token = (r && r.token) || (r && r.data && r.data.token);
      const user = (r && r.user) || (r && r.data && r.data.user) || { email };
      if (token) try { wx.setStorageSync('yjt_token', token); } catch (e) {}
      if (user) try { wx.setStorageSync('yjt_user', user); } catch (e) {}
      this.setData({ loading: false });
      wx.showToast({ title: mode === 'login' ? '登录成功' : '注册成功', icon: 'none' });
      setTimeout(() => { wx.navigateBack(); }, 800);
    }).catch((e) => {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    });
  }
});
