import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截：附加设备指纹 + JWT
api.interceptors.request.use(cfg => {
  cfg.headers['X-Device-FP'] = getDeviceFingerprint();
  const token = localStorage.getItem('token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

// 响应拦截：统一错误处理
api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.msg || err.message || '网络错误';
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject({ msg, code: err.response?.data?.code, needCaptcha: err.response?.data?.needCaptcha });
  }
);

// 设备指纹：Canvas哈希 + UA + 屏幕 + 时区
function getDeviceFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('vote-fp-2026', 2, 2);
    const canvasHash = canvas.toDataURL().slice(-32);
    const fp = `${navigator.userAgent}|${screen.width}x${screen.height}|${canvasHash}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    return btoa(fp).slice(0, 48);
  } catch (e) {
    return btoa(navigator.userAgent).slice(0, 48);
  }
}

export default {
  // 认证
  register: (username, password, nickname, phone, email) => api.post('/auth/register', { username, password, nickname, phone, email }),
  login: (username, password) => api.post('/auth/login', { username, password }),
  getProfile: () => api.get('/auth/profile'),
  // 手机号+验证码
  sendSms: (phone, purpose = 'login') => api.post('/auth/sms/send', { phone, purpose }),
  loginBySms: (phone, code) => api.post('/auth/sms/login', { phone, code }),
  // 邮箱+验证码
  sendMail: (email, purpose = 'login') => api.post('/auth/mail/send', { email, purpose }),
  loginByMail: (email, code) => api.post('/auth/mail/login', { email, code }),
  // 微信扫码
  getWechatQrcode: () => api.get('/auth/wechat/qrcode'),
  mockWechatScan: (ticket) => api.post('/auth/wechat/mock-scan', { ticket }),
  pollWechatScan: (ticket) => api.get('/auth/wechat/poll', { params: { ticket } }),
  loginByWechat: (ticket) => api.post('/auth/wechat/login', { ticket }),
  // QQ
  getQqAuthorize: () => api.get('/auth/qq/authorize'),
  loginByQq: (ticket) => api.post('/auth/qq/login', { ticket }),
  // 投票
  listVotes: (params) => api.get('/votes', { params }),
  getVote: (id) => api.get(`/votes/${id}`),
  createVote: (data) => api.post('/votes', data),
  updateVote: (id, data) => api.put(`/votes/${id}`, data),
  duplicateVote: (id) => api.post(`/votes/${id}/duplicate`),
  manageVote: (id, action) => api.post(`/votes/${id}/manage`, { action }),
  submitVote: (id, answers) => api.post(`/votes/${id}/submit`, { answers }),
  favorite: (id) => api.post(`/votes/${id}/favorite`),
  share: (id) => api.get(`/votes/${id}/share`),
  getComments: (optionId) => api.get(`/votes/options/${optionId}/comments`),
  addComment: (optionId, content) => api.post(`/votes/options/${optionId}/comments`, { content }),
  reportComment: (commentId) => api.post(`/votes/comments/${commentId}/report`),
  // 统计
  getStats: (id) => api.get(`/stats/votes/${id}`),
  getLeaderboard: (id) => api.get(`/stats/votes/${id}/leaderboard`, { params: { limit: 50 } }),
  exportRecords: (id) => api.get(`/stats/votes/${id}/export`, { responseType: 'blob' }),
  exportStats: (id) => api.get(`/stats/votes/${id}/export-stats`, { responseType: 'blob' }),
  // 验证码
  getCaptcha: () => api.get('/captcha/json'),
  verifyCaptcha: (token, input) => api.post('/captcha/verify', { token, input }),
  // 用户中心
  myVotes: (page = 1) => api.get('/user/my-votes', { params: { page, size: 10 } }),
  participated: (page = 1) => api.get('/user/participated', { params: { page, size: 10 } }),
  favorites: (page = 1) => api.get('/user/favorites', { params: { page, size: 10 } }),
  updateProfile: (data) => api.put('/user/profile', data),
  changePassword: (oldPassword, newPassword) => api.put('/user/password', { oldPassword, newPassword }),
  // 后台
  adminUsers: (params) => api.get('/admin/users', { params }),
  adminUserStatus: (id, field, value) => api.post(`/admin/users/${id}/status`, { field, value }),
  adminVoteAction: (id, action) => api.post(`/admin/votes/${id}/action`, { action }),
  adminDashboard: () => api.get('/admin/dashboard'),
  adminLogs: (params) => api.get('/admin/logs', { params }),
  adminBlacklist: () => api.get('/admin/blacklist'),
  adminAddBlacklist: (type, value, reason) => api.post('/admin/blacklist', { type, value, reason }),
  adminRemoveBlacklist: (type, id) => api.delete('/admin/blacklist', { params: { type, id } }),
  adminConfig: () => api.get('/admin/config'),
  adminUpdateConfig: (data) => api.put('/admin/config', data),
  adminTemplates: (category) => api.get('/admin/templates', { params: { category } }),
  adminAddTemplate: (data) => api.post('/admin/templates', data)
};
