const app = getApp()
const { getDB, formatTime, fetchUserStats } = require('../../utils/common')

Page({
  data: {
    statusBarHeight: 20,
    joinDays: 1,
    dietRecords: [],
    todayIntake: 0,
    targetCalorie: 1600,
    sportBurned: 0,
    waterCount: 0,
    waterTarget: 8,
    currentWeight: 62.5,
    targetWeight: 60.0,
    activeHabits: [],
    recommendDeficit: 0,
    totalCarbs: 0,
    totalProtein: 0,
    totalFat: 0,
    swipeRightOptions: [
      { text: '编辑', className: 'swipe-btn-edit' },
      { text: '删除', className: 'swipe-btn-delete' }
    ]
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight
    })
    
    // 加载本地存储的习惯数据和列表
    let waterCount = wx.getStorageSync('waterCount') || 0
    const waterTarget = wx.getStorageSync('waterTarget') || 8
    const currentWeight = wx.getStorageSync('currentWeight') || 62.5
    const targetWeight = wx.getStorageSync('targetWeight') || 60.0
    let activeHabits = wx.getStorageSync('activeHabits')
    
    // 过滤掉废弃的习惯（睡眠、生理期）
    if (activeHabits && activeHabits.length > 0) {
      activeHabits = activeHabits.filter(h => h.id !== 'sleep' && h.id !== 'period')
    }

    if (!activeHabits || activeHabits.length === 0) {
      activeHabits = [
        { id: 'water', icon: '💧', title: '喝水打卡', color: 'blue' },
        { id: 'weight', icon: '⚖️', title: '体重管理', color: 'purple' }
      ]
    }
    // 强制保存一次清理后的状态
    wx.setStorageSync('activeHabits', activeHabits)

    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({ waterCount, waterTarget, currentWeight, targetWeight, activeHabits, userInfo })
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    if (userInfo.targetCalorie) {
      this.setData({ targetCalorie: userInfo.targetCalorie })
    }
    
    // 每次展示时，全量拉取可能被改变的核心状态
    const targetWeight = wx.getStorageSync('targetWeight') || 60.0
    const currentWeight = wx.getStorageSync('currentWeight') || 62.5
    const waterTarget = wx.getStorageSync('waterTarget') || 8
    const activeHabits = wx.getStorageSync('activeHabits') || [
      { id: 'water', icon: '💧', title: '喝水打卡', color: 'blue' },
      { id: 'weight', icon: '⚖️', title: '体重管理', color: 'purple' }
    ]
    const recommendDeficit = wx.getStorageSync('recommendDeficit') || 0
    
    this.setData({ 
      targetWeight,
      currentWeight,
      waterTarget,
      activeHabits,
      recommendDeficit,
      userInfo 
    })
    
    // 检查喝水打卡是否跨天，若是则重置
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    let waterCount = wx.getStorageSync('waterCount') || 0
    const waterDate = wx.getStorageSync('waterDate')
    if (waterDate !== todayStr) {
      waterCount = 0
      wx.setStorageSync('waterCount', 0)
      wx.setStorageSync('waterDate', todayStr)
    }
    this.setData({ waterCount })

    this.fetchTodayRecords()
    this.fetchUserStats()
  },

  async fetchUserStats() {
    await fetchUserStats(this)
  },

  fetchTodayRecords() {
    const db = getDB()
    const _ = db.command
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 取今日饮食记录
    const dietPromise = db.collection('DietRecord')
      .where({
        createTime: _.gte(today)
      })
      .orderBy('createTime', 'asc')
      .get();

    // 获取今日运动消耗
    const sportPromise = db.collection('SportRecord')
      .where({
        createTime: _.gte(today)
      })
      .get();

    Promise.all([dietPromise, sportPromise]).then(results => {
      const dietRes = results[0];
      const sportRes = results[1];

      let todayIntake = 0;
      let totalCarbs = 0;
      let totalProtein = 0;
      let totalFat = 0;
      
      const records = dietRes.data.map(item => {
        todayIntake += item.calorie || 0;
        totalCarbs += item.carbs || 0;
        totalProtein += item.protein || 0;
        totalFat += item.fat || 0;
        
        return {
          ...item,
          timeStr: item.createTime ? formatTime(item.createTime) : ''
        };
      });

      let sportBurned = 0;
      sportRes.data.forEach(item => {
        sportBurned += item.calorie || 0;
      });

      let targetCal = this.data.targetCalorie || 1600;
      let totalAllowed = targetCal + sportBurned;
      let percent = totalAllowed > 0 ? Math.min(100, Math.round((todayIntake / totalAllowed) * 100)) : 0;
      
      this.setData({
        dietRecords: records,
        todayIntake: Math.round(todayIntake),
        totalCarbs: Math.round(totalCarbs),
        totalProtein: Math.round(totalProtein),
        totalFat: Math.round(totalFat),
        sportBurned: Math.round(sportBurned),
        progressPercent: percent
      });
    }).catch(err => {
      console.error('获取今日数据失败', err);
    });
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  },

  onRecordTap() {
    const modal = this.selectComponent('#aiModal')
    if (modal) {
      modal.show()
    }
  },

  onSwipeClick(e) {
    const item = e.currentTarget.dataset.item;
    const action = e.detail.text;
    if (action === '编辑') {
      this.onEditRecord({ currentTarget: { dataset: { item } } });
    } else if (action === '删除') {
      this.onDeleteRecord({ currentTarget: { dataset: { item } } });
    }
  },

  onEditRecord(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditRecordModal: true,
      editRecordData: {
        _id: item._id,
        name: item.name || item.foodName || '',
        calorie: item.calorie || 0
      }
    });
  },

  onDeleteRecord(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '提示',
      content: '确定要删除这条记录吗？',
      success: (modalRes) => {
        if (modalRes.confirm) {
          wx.cloud.database({ env: 'cloudbase-7gd5buxj2de5a644' }).collection('DietRecord').doc(item._id).remove().then(() => {
            wx.showToast({ title: '删除成功' });
            this.fetchTodayRecords();
          });
        }
      }
    });
  },

  onEditRecordNameInput(e) {
    this.setData({
      'editRecordData.name': e.detail.value
    });
  },

  onEditRecordCalorieInput(e) {
    this.setData({
      'editRecordData.calorie': Number(e.detail.value) || 0
    });
  },

  cancelEditRecord() {
    this.setData({ showEditRecordModal: false });
  },

  confirmEditRecord() {
    const { _id, name, calorie } = this.data.editRecordData;
    if (!name) {
      wx.showToast({ title: '食物名称不能为空', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中' });
    wx.cloud.database({ env: app.globalData.envId })
      .collection('DietRecord')
      .doc(_id)
      .update({
        data: {
          name: name,
          foodName: name, // 兼容旧字段
          calorie: calorie
        }
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.setData({ showEditRecordModal: false });
        this.fetchTodayRecords();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('更新饮食记录失败', err);
        wx.showToast({ title: '修改失败', icon: 'none' });
      });
  },

  onDrinkWater() {
    wx.showActionSheet({
      itemList: ['喝一杯水 (+1)', '撤销刚才的记录 (-1)', '设置喝水目标'],
      success: (res) => {
        const todayStr = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
        
        if (res.tapIndex === 0) {
          const newCount = this.data.waterCount + 1
          this.setData({ waterCount: newCount })
          wx.setStorageSync('waterCount', newCount)
          wx.setStorageSync('waterDate', todayStr)
          wx.showToast({ title: `打卡成功，第${newCount}杯`, icon: 'none' })
          if (newCount === this.data.waterTarget) {
            wx.showToast({ title: '今日喝水目标已完成！', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          if (this.data.waterCount > 0) {
            const newCount = this.data.waterCount - 1
            this.setData({ waterCount: newCount })
            wx.setStorageSync('waterCount', newCount)
            wx.setStorageSync('waterDate', todayStr)
            wx.showToast({ title: '已撤回', icon: 'none' })
          }
        } else if (res.tapIndex === 2) {
          this.setData({
            showWaterTargetModal: true,
            tempWaterTarget: this.data.waterTarget
          });
        }
      }
    })
  },
  
  onWaterTargetInput(e) {
    this.setData({ tempWaterTarget: Number(e.detail.value) || 8 })
  },
  
  confirmWaterTarget() {
    const newTarget = this.data.tempWaterTarget || 8;
    this.setData({ 
      waterTarget: newTarget,
      showWaterTargetModal: false 
    });
    wx.setStorageSync('waterTarget', newTarget);
    wx.showToast({ title: '目标已更新', icon: 'success' });
  },
  
  cancelWaterTarget() {
    this.setData({ showWaterTargetModal: false });
  },

  onRecordWeight() {
    this.setData({
      showWeightModal: true,
      tempCurrentWeight: this.data.currentWeight,
      tempTargetWeight: this.data.targetWeight
    });
  },
  
  onCurrentWeightInput(e) {
    this.setData({ tempCurrentWeight: parseFloat(e.detail.value) || 0 })
  },
  
  onTargetWeightInput(e) {
    this.setData({ tempTargetWeight: parseFloat(e.detail.value) || 0 })
  },
  
  confirmWeight() {
    const cw = this.data.tempCurrentWeight;
    const tw = this.data.tempTargetWeight;
    if (!cw || !tw) {
      wx.showToast({ title: '请输入有效的数字', icon: 'none' });
      return;
    }
    
    const userInfo = wx.getStorageSync('userInfo') || {};
    userInfo.targetWeight = tw;
    wx.setStorageSync('userInfo', userInfo);

    const targetDays = userInfo.targetDays || 30;
    const weightDiff = cw - tw;
    let deficit = 0;
    if (weightDiff > 0) {
      deficit = Math.round((weightDiff * 7700) / targetDays);
    }

    this.setData({ 
      currentWeight: cw,
      targetWeight: tw,
      userInfo,
      recommendDeficit: deficit,
      showWeightModal: false 
    });
    
    wx.setStorageSync('currentWeight', cw);
    wx.setStorageSync('targetWeight', tw);
    wx.setStorageSync('recommendDeficit', deficit);
    
    wx.showToast({ title: '体重已更新', icon: 'success' });
  },
  
  cancelWeight() {
    this.setData({ showWeightModal: false });
  },

  onEditHabits() {
    const allHabits = [
      { id: 'water', icon: '💧', title: '喝水打卡', color: 'blue' },
      { id: 'weight', icon: '⚖️', title: '体重管理', color: 'purple' },
      { id: 'poop', icon: '💩', title: '便便打卡', color: 'amber' }
    ]

    const itemList = allHabits.map(h => {
      const isExist = this.data.activeHabits.find(a => a.id === h.id)
      return `${isExist ? '移除' : '添加'}：${h.icon} ${h.title}`
    })

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selected = allHabits[res.tapIndex]
        let currentActive = [...this.data.activeHabits]
        
        const existIndex = currentActive.findIndex(a => a.id === selected.id)
        if (existIndex > -1) {
          currentActive.splice(existIndex, 1)
        } else {
          currentActive.push(selected)
        }

        this.setData({ activeHabits: currentActive })
        wx.setStorageSync('activeHabits', currentActive)
      }
    })
  },

  onHabitTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === 'water') {
      this.onDrinkWater()
    } else if (id === 'weight') {
      this.onRecordWeight()
    } else if (id === 'poop') {
      wx.navigateTo({ url: '/pages/poop/poop' })
    } else {
      wx.showToast({ title: '记录已保存', icon: 'success' })
    }
  },

  onShareAppMessage() {
    const deficit = this.data.targetCalorie + this.data.sportBurned - this.data.todayIntake;
    return {
      title: deficit > 0 ? `我今天制造了 ${deficit} kcal的热量缺口，快来一起打卡！` : 'AI 极简陪你永瘦，拍照就能算热量！',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    const deficit = this.data.targetCalorie + this.data.sportBurned - this.data.todayIntake;
    return {
      title: deficit > 0 ? `我今天制造了 ${deficit} kcal的热量缺口，快来一起打卡！` : 'AI 极简陪你永瘦，拍照就能算热量！'
    }
  }
})