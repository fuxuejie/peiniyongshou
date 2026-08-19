// app.js
const ENV_ID = 'cloudbase-7gd5buxj2de5a644'

App({
  onLaunch: function() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: ENV_ID,
        traceUser: true,
      });
    }
  },
  
  globalData: {
    envId: ENV_ID  // 统一管理环境ID，所有页面通过 getApp().globalData.envId 获取
  }
}); 