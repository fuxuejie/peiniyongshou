Page({
  data: {
    statusBarHeight: 20,
    userInfo: {
      avatarUrl: '',
      nickName: '',
      targetWeight: 60,
      targetDays: 30,
      targetCalorie: 1600
    },
    recommendDeficit: 500,
    joinDays: 1
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight
    })
  },
  
  onShow() {
    // 每次显示页面时，重新加载数据（因为用户可能在其他页面修改了体重等）
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
    }
    this.calculateDeficit()
    this.fetchUserStats()
  },

  async fetchUserStats() {
    try {
      let firstTime = wx.getStorageSync('firstRecordTime');
      
      if (!firstTime) {
        const db = wx.cloud.database({ env: 'cloudbase-7gd5buxj2de5a644' });
        const dietRes = await db.collection('DietRecord').orderBy('createTime', 'asc').limit(1).get();
        const sportRes = await db.collection('SportRecord').orderBy('createTime', 'asc').limit(1).get();
        
        firstTime = new Date().getTime();
        
        let hasRecord = false;
        
        if (dietRes.data.length > 0) {
          firstTime = Math.min(firstTime, new Date(dietRes.data[0].createTime).getTime());
          hasRecord = true;
        }
        if (sportRes.data.length > 0) {
          firstTime = Math.min(firstTime, new Date(sportRes.data[0].createTime).getTime());
          hasRecord = true;
        }
        
        // 只有在真正有记录的情况下，才缓存首次记录时间，避免过早锁定无记录时间
        if (hasRecord) {
          wx.setStorageSync('firstRecordTime', firstTime);
        }
      }
      
      const now = new Date().getTime();
      const diff = now - firstTime;
      const joinDays = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
      
      this.setData({ joinDays });
    } catch (err) {
      console.error('获取统计数据失败', err);
      if (!this.data.joinDays || this.data.joinDays <= 1) {
        this.setData({ joinDays: 1 });
      }
    }
  },
  
  calculateDeficit() {
    const currentWeight = wx.getStorageSync('currentWeight') || 62.5
    const targetWeight = this.data.userInfo.targetWeight || 60
    const targetDays = this.data.userInfo.targetDays || 30
    
    // 减去 1kg 脂肪大约需要消耗 7700 kcal
    const weightDiff = currentWeight - targetWeight
    let deficit = 0
    if (weightDiff > 0) {
      deficit = Math.round((weightDiff * 7700) / targetDays)
    }
    
    this.setData({ recommendDeficit: deficit })
    wx.setStorageSync('recommendDeficit', deficit)
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const newUserInfo = { ...this.data.userInfo, avatarUrl }
    this.setData({ userInfo: newUserInfo })
    wx.setStorageSync('userInfo', newUserInfo)
  },
  
  onInputNickname(e) {
    const nickName = e.detail.value
    const newUserInfo = { ...this.data.userInfo, nickName }
    this.setData({ userInfo: newUserInfo })
    wx.setStorageSync('userInfo', newUserInfo)
  },

  onEditTargetWeight() {
    wx.showModal({
      title: '目标体重',
      editable: true,
      placeholderText: '请输入目标体重(kg)',
      success: (res) => {
        if (res.confirm && res.content) {
          const weight = parseFloat(res.content)
          if (!isNaN(weight) && weight > 20 && weight < 200) {
            const newUserInfo = { ...this.data.userInfo, targetWeight: weight }
            this.setData({ userInfo: newUserInfo })
            wx.setStorageSync('userInfo', newUserInfo)
            wx.setStorageSync('targetWeight', weight)
            this.calculateDeficit()
          } else {
            wx.showToast({ title: '请输入合理的体重数值', icon: 'none' })
          }
        }
      }
    })
  },

  onEditTargetDays() {
    wx.showModal({
      title: '计划天数',
      editable: true,
      placeholderText: '期望多少天达到目标？',
      success: (res) => {
        if (res.confirm && res.content) {
          const days = parseInt(res.content)
          if (!isNaN(days) && days > 0) {
            const newUserInfo = { ...this.data.userInfo, targetDays: days }
            this.setData({ userInfo: newUserInfo })
            wx.setStorageSync('userInfo', newUserInfo)
            this.calculateDeficit()
          } else {
            wx.showToast({ title: '请输入有效天数', icon: 'none' })
          }
        }
      }
    })
  },

  onEditTargetCalorie() {
    wx.showModal({
      title: '每日目标热量',
      editable: true,
      placeholderText: '请输入每日目标摄入(kcal)',
      success: (res) => {
        if (res.confirm && res.content) {
          const cal = parseInt(res.content)
          if (!isNaN(cal) && cal > 500 && cal < 5000) {
            const newUserInfo = { ...this.data.userInfo, targetCalorie: cal }
            this.setData({ userInfo: newUserInfo })
            wx.setStorageSync('userInfo', newUserInfo)
            wx.setStorageSync('targetCalorie', cal)
          } else {
            wx.showToast({ title: '热量设置需在合理范围内', icon: 'none' })
          }
        }
      }
    })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '清除缓存将不会删除你的饮食和运动记录，确定要清除吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '清除成功', icon: 'success' });
          
          const defaultUserInfo = {
            avatarUrl: '',
            nickName: '',
            targetWeight: 60,
            targetDays: 30,
            targetCalorie: 1600
          };
          
          // 清除后重置状态并写回缓存，保证切到首页等其他页面时不同步丢失
          this.setData({
            userInfo: defaultUserInfo,
            recommendDeficit: 500
          });
          
          wx.setStorageSync('userInfo', defaultUserInfo);
          wx.setStorageSync('recommendDeficit', 500);
          wx.setStorageSync('targetWeight', 60);
          wx.setStorageSync('targetCalorie', 1600);
          wx.setStorageSync('currentWeight', 62.5); // 首页默认体重
          wx.setStorageSync('waterTarget', 8);
          wx.setStorageSync('activeHabits', [
            { id: 'water', icon: '💧', title: '喝水打卡', color: 'blue' },
            { id: 'weight', icon: '⚖️', title: '体重管理', color: 'purple' }
          ]);
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于陪你永瘦',
      content: '这是一款极简的 AI 陪你永瘦工具，通过拍照就能快速识别热量与运动消耗，助你轻松掌握热量缺口。',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#10B981'
    })
  }
})