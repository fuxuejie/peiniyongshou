const app = getApp()
const { getDB, formatTime } = require('../../utils/common')

Page({
  data: {
    statusBarHeight: 20,
    sportInput: '',
    sportRecords: [],
    totalBurned: 0,
    totalDuration: 0,
    totalSteps: 0,
    isAiCalculating: false,
    calendarVisible: false,
    selectedDate: new Date().getTime(),
    minDate: new Date(2023, 0, 1).getTime(),
    maxDate: new Date().getTime(),
    isToday: true,
    swipeRightOptions: [
      { text: '编辑', className: 'swipe-btn-edit' },
      { text: '删除', className: 'swipe-btn-delete' }
    ]
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      selectedDate: today.getTime()
    })
  },

  onShow() {
    this.fetchSportRecords()
    this.fetchWeRunSteps()
  },

  fetchWeRunSteps() {
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.werun'] === undefined) {
          // 未授权过，尝试获取（如果是首次进入会弹窗）
          this.getRealSteps()
        } else if (res.authSetting['scope.werun'] === true) {
          // 已经授权
          this.getRealSteps()
        } else {
          // 拒绝了授权，暂时不处理或者提示用户去设置开启
          this.setData({ totalSteps: 0 })
        }
      }
    })
  },

  getRealSteps() {
    wx.getWeRunData({
      success: (res) => {
        wx.cloud.callFunction({
          name: 'getOpenId',
          config: {
            env: app.globalData.envId
          },
          data: {
            weRunData: wx.cloud.CloudID(res.cloudID)
          },
          success: (cloudRes) => {
            const stepInfoList = cloudRes.result && cloudRes.result.weRunData && cloudRes.result.weRunData.stepInfoList;
            if (stepInfoList) {
              const targetDateObj = new Date(this.data.selectedDate);
              targetDateObj.setHours(0,0,0,0);
              
              const matchedData = stepInfoList.find(item => {
                const itemDate = new Date(item.timestamp * 1000);
                itemDate.setHours(0,0,0,0);
                return itemDate.getTime() === targetDateObj.getTime();
              });

              this.setData({
                totalSteps: matchedData ? matchedData.step : 0
              });
            }
          },
          fail: err => {
            console.error('获取步数解密失败', err)
          }
        })
      },
      fail: (err) => {
        console.log('获取微信运动数据失败', err)
        // 用户拒绝授权或获取失败
        this.setData({ totalSteps: 0 })
      }
    })
  },

  onSportInput(e) {
    this.setData({ sportInput: e.detail.value })
  },

  fetchSportRecords() {
    const db = getDB()
    const _ = db.command
    const targetDate = new Date(this.data.selectedDate)
    
    // 获取当天的起止时间
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    db.collection('SportRecord')
      .where({
        createTime: _.gte(startOfDay).and(_.lte(endOfDay))
      })
      .orderBy('createTime', 'asc')
      .get()
      .then(res => {
        let totalBurned = 0
        let totalDuration = 0
        const records = res.data.map(item => {
          totalBurned += item.calorie || 0
          totalDuration += item.duration || 0
          return {
            ...item,
            timeStr: item.createTime ? this.formatTime(item.createTime) : ''
          }
        })
        
        this.setData({
          sportRecords: records,
          totalBurned: Math.round(totalBurned),
          totalDuration: Math.round(totalDuration)
        })
      })
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  },

  addSportRecord() {
    const input = this.data.sportInput.trim()
    if (!input) {
      wx.showToast({ title: '请输入运动内容', icon: 'none' })
      return
    }

    this.setData({ isAiCalculating: true })

    wx.cloud.callFunction({
      name: 'ai-record',
      config: {
        env: 'cloudbase-7gd5buxj2de5a644'
      },
      data: {
        recordType: 'sport',
        text: input
      },
      success: res => {
        if (res.result && res.result.success) {
          // ai-record 统一返回了数组格式
          const aiDataList = res.result.data;
          const aiData = Array.isArray(aiDataList) ? aiDataList[0] : aiDataList;
          
          if (!aiData) {
            this.setData({ isAiCalculating: false })
            wx.showToast({ title: '识别返回数据为空', icon: 'none' })
            return
          }

          const db = getDB()
          
          // 如果选择的不是今天，就把 createTime 设置为选择的日期
          const recordDate = new Date(this.data.selectedDate)
          if (!this.data.isToday) {
            recordDate.setHours(12, 0, 0, 0) // 默认存到中午12点
          }

          db.collection('SportRecord').add({
            data: {
              sportName: aiData.name || aiData.sportName || '未知运动',
              duration: aiData.duration || 0,
              calorie: aiData.calorie || 0,
              originalInput: input,
              createTime: this.data.isToday ? db.serverDate() : recordDate
            }
          }).then(() => {
            this.setData({ isAiCalculating: false, sportInput: '' })
            wx.showToast({ title: '记录成功' })
            this.fetchSportRecords()
          }).catch(err => {
            this.setData({ isAiCalculating: false })
            wx.showToast({ title: '保存失败', icon: 'none' })
          })
        } else {
          this.setData({ isAiCalculating: false })
          wx.showToast({ title: (res.result && res.result.message) || '识别失败', icon: 'none' })
        }
      },
      fail: err => {
        this.setData({ isAiCalculating: false })
        wx.showModal({ title: 'AI 识别异常', content: err.message || '网络连接失败或超时', showCancel: false })
        console.error('[云函数] 调用失败', err)
      }
    })
  },

  onSwipeClick(e) {
    const item = e.currentTarget.dataset.item;
    const action = e.detail.text;
    if (action === '编辑') {
      this.onEditSport({ currentTarget: { dataset: { item } } });
    } else if (action === '删除') {
      this.onDeleteSport({ currentTarget: { dataset: { id: item._id } } });
    }
  },

  onDeleteSport(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要删除这条运动记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.database({ env: app.globalData.envId }).collection('SportRecord').doc(id).remove().then(() => {
            wx.showToast({ title: '删除成功' })
            this.fetchSportRecords()
          })
        }
      }
    })
  },

  onEditSport(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showEditSportModal: true,
      editSportData: {
        _id: item._id,
        sportName: item.sportName || '',
        duration: item.duration || 0,
        calorie: item.calorie || 0
      }
    })
  },

  onEditSportNameInput(e) {
    this.setData({
      'editSportData.sportName': e.detail.value
    })
  },

  onEditSportDurationInput(e) {
    this.setData({
      'editSportData.duration': Number(e.detail.value) || 0
    })
  },

  onEditSportCalorieInput(e) {
    this.setData({
      'editSportData.calorie': Number(e.detail.value) || 0
    })
  },

  cancelEditSport() {
    this.setData({
      showEditSportModal: false,
      editSportData: null
    })
  },

  confirmEditSport() {
    const { _id, sportName, duration, calorie } = this.data.editSportData
    if (!sportName) {
      wx.showToast({ title: '请输入运动名称', icon: 'none' })
      return
    }
    
    wx.cloud.database({ env: app.globalData.envId })
      .collection('SportRecord')
      .doc(_id)
      .update({
        data: {
          sportName,
          duration,
          calorie
        }
      }).then(() => {
        wx.showToast({ title: '修改成功' })
        this.setData({ showEditSportModal: false })
        this.fetchSportRecords()
      }).catch(err => {
        wx.showToast({ title: '修改失败', icon: 'none' })
      })
  },

  showCalendar() {
    this.setData({ calendarVisible: true })
  },
  
  hideCalendar() {
    this.setData({ calendarVisible: false })
  },

  onCalendarConfirm(e) {
    const { value } = e.detail
    const selectedDate = new Date(value).getTime()
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedObj = new Date(value)
    selectedObj.setHours(0, 0, 0, 0)
    
    this.setData({ 
      calendarVisible: false,
      selectedDate,
      isToday: today.getTime() === selectedObj.getTime()
    })
    
    this.fetchSportRecords()
    this.fetchWeRunSteps()
  },

  onShareAppMessage() {
    const burned = this.data.totalBurned;
    return {
      title: burned > 0 ? `我今天运动消耗了 ${burned} kcal，快来跟练！` : '坚持运动，遇见更好的自己，快来和我一起打卡~',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    const burned = this.data.totalBurned;
    return {
      title: burned > 0 ? `我今天运动消耗了 ${burned} kcal，快来跟练！` : '坚持运动，遇见更好的自己，快来和我一起打卡~'
    }
  }
})