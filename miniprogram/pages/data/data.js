const app = getApp()
const { getDB, formatDate } = require('../../utils/common')

Page({
  data: {
    statusBarHeight: 20,
    intakeChartData: [],
    sportChartData: [],
    currentTab: 'day',
    calendarVisible: false,
    minDate: new Date(2023, 0, 1).getTime(),
    maxDate: new Date().getTime(),
    customDateRange: [],
    customDateStr: '',
    targetCalorie: 1600,
    summary: {
      avgIntake: 0,
      avgDeficit: 0,
      successDays: 0
    }
  },
  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()
    const todayStr = `${today.getMonth()+1}/${today.getDate()} - ${today.getMonth()+1}/${today.getDate()}`
    
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      customDateRange: [todayTime, todayTime],
      customDateStr: todayStr
    })
  },
  onShow() {
    this.fetchActualData(this.data.currentTab)
  },
  
  onTabChange(e) {
    const tab = e.detail.value
    this.setData({ currentTab: tab })
    if (tab === 'custom') {
      this.setData({ calendarVisible: true })
    } else {
      this.fetchActualData(tab)
    }
  },

  showCalendar() {
    this.setData({ calendarVisible: true })
  },

  hideCalendar() {
    this.setData({ calendarVisible: false })
  },

  onCalendarConfirm(e) {
    const { value } = e.detail
    if (value && value.length === 2) {
      const d1 = new Date(value[0])
      const d2 = new Date(value[1])
      const str = `${d1.getMonth()+1}/${d1.getDate()} - ${d2.getMonth()+1}/${d2.getDate()}`
      this.setData({
        calendarVisible: false,
        customDateRange: value,
        customDateStr: str
      })
      this.fetchActualData('custom')
    } else {
      this.setData({ calendarVisible: false })
    }
  },

  // formatDate 已从 utils/common 导入

  async fetchActualData(tab) {
    wx.showLoading({ title: '加载中' })
    const db = getDB()
    const _ = db.command

    let startDate = new Date()
    let endDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    let labels = []
    let grouping = 'day' // 'meal', 'date', 'week'
    let dayCount = 1

    if (tab === 'day') {
      grouping = 'meal'
      labels = [
        { key: 'breakfast', label: '早餐' },
        { key: 'lunch', label: '午餐' },
        { key: 'dinner', label: '晚餐' },
        { key: 'snack', label: '加餐' }
      ]
      dayCount = 1
    } else if (tab === 'week') {
      grouping = 'date'
      startDate.setDate(endDate.getDate() - 6)
      dayCount = 7
      for (let i = 0; i < 7; i++) {
        let d = new Date(startDate)
        d.setDate(d.getDate() + i)
        let label = i === 6 ? '今日' : `${d.getMonth()+1}/${d.getDate()}`
        labels.push({ key: this.formatDate(d), label })
      }
    } else if (tab === 'month') {
      grouping = 'week'
      startDate.setDate(endDate.getDate() - 27)
      dayCount = 28
      labels = [
        { key: 'w1', label: '前三周' },
        { key: 'w2', label: '前两周' },
        { key: 'w3', label: '上周' },
        { key: 'w4', label: '本周' }
      ]
    } else if (tab === 'custom') {
      grouping = 'date'
      if (this.data.customDateRange.length === 2) {
        startDate = new Date(this.data.customDateRange[0])
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(this.data.customDateRange[1])
        endDate.setHours(23, 59, 59, 999)
        
        let diffTime = Math.abs(endDate - startDate);
        dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i < dayCount; i++) {
          let d = new Date(startDate)
          d.setDate(d.getDate() + i)
          labels.push({ key: this.formatDate(d), label: `${d.getMonth()+1}/${d.getDate()}` })
        }
      } else {
        // Fallback to week if not selected
        this.setData({ currentTab: 'week' })
        return this.fetchActualData('week')
      }
    }

    try {
      const MAX_LIMIT = 100 // 云开发单次最多查100条
      let allDietRecords = []
      let totalCountRes = await db.collection('DietRecord').where({
        createTime: _.gte(startDate).and(_.lte(endDate))
      }).count()
      
      const totalCount = totalCountRes.total
      const batchTimes = Math.ceil(totalCount / MAX_LIMIT)
      
      for (let i = 0; i < batchTimes; i++) {
        let res = await db.collection('DietRecord').where({
          createTime: _.gte(startDate).and(_.lte(endDate))
        }).skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
        allDietRecords = allDietRecords.concat(res.data)
      }

      let allSportRecords = []
      let sportTotalCountRes = await db.collection('SportRecord').where({
        createTime: _.gte(startDate).and(_.lte(endDate))
      }).count()
      
      const sportTotalCount = sportTotalCountRes.total
      const sportBatchTimes = Math.ceil(sportTotalCount / MAX_LIMIT)
      
      for (let i = 0; i < sportBatchTimes; i++) {
        let res = await db.collection('SportRecord').where({
          createTime: _.gte(startDate).and(_.lte(endDate))
        }).skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
        allSportRecords = allSportRecords.concat(res.data)
      }

      let buckets = {}
      let burnBuckets = {} // 新增消耗柱状图数据
      labels.forEach(l => {
        buckets[l.key] = 0
        burnBuckets[l.key] = 0
      })
      
      let dailyIntake = {}
      let dailyBurn = {}

      for (let i = 0; i < dayCount; i++) {
        let d = new Date(startDate)
        d.setDate(d.getDate() + i)
        dailyIntake[this.formatDate(d)] = 0
        dailyBurn[this.formatDate(d)] = 0
      }

      allDietRecords.forEach(item => {
        let dStr = this.formatDate(new Date(item.createTime))
        dailyIntake[dStr] = (dailyIntake[dStr] || 0) + (item.calorie || 0)
        
        if (grouping === 'meal') {
          if (buckets[item.meal] !== undefined) {
            buckets[item.meal] += (item.calorie || 0)
          }
        } else if (grouping === 'date') {
          if (buckets[dStr] !== undefined) {
            buckets[dStr] += (item.calorie || 0)
          }
        } else if (grouping === 'week') {
          let diffDays = Math.floor((new Date(item.createTime) - startDate) / (1000*60*60*24))
          let wIndex = Math.floor(diffDays / 7)
          if (wIndex >= 0 && wIndex < 4) {
            buckets[`w${wIndex+1}`] += (item.calorie || 0)
          }
        }
      })

      allSportRecords.forEach(item => {
        let dStr = this.formatDate(new Date(item.createTime))
        dailyBurn[dStr] = (dailyBurn[dStr] || 0) + (item.calorie || 0)
        
        if (grouping === 'meal') {
          // 运动没有严格的餐段，根据时间映射到早中晚加餐，以便在日视图也能看到柱状图
          let hour = new Date(item.createTime).getHours()
          let mealKey = 'snack'
          if (hour >= 5 && hour < 10) mealKey = 'breakfast'
          else if (hour >= 10 && hour < 14) mealKey = 'lunch'
          else if (hour >= 14 && hour < 19) mealKey = 'dinner'
          
          if (burnBuckets[mealKey] !== undefined) {
            burnBuckets[mealKey] += (item.calorie || 0)
          }
        } else if (grouping === 'date') {
          if (burnBuckets[dStr] !== undefined) {
            burnBuckets[dStr] += (item.calorie || 0)
          }
        } else if (grouping === 'week') {
          let diffDays = Math.floor((new Date(item.createTime) - startDate) / (1000*60*60*24))
          let wIndex = Math.floor(diffDays / 7)
          if (wIndex >= 0 && wIndex < 4) {
            burnBuckets[`w${wIndex+1}`] += (item.calorie || 0)
          }
        }
      })

      let intakeChartData = labels.map(l => ({
        day: l.label,
        calorie: Math.round(buckets[l.key] || 0)
      }))

      let sportChartData = []

      if (tab === 'day') {
        allSportRecords.sort((a, b) => new Date(a.createTime) - new Date(b.createTime))
        if (allSportRecords.length > 0) {
          sportChartData = allSportRecords.map(item => {
            let name = item.sportName || item.name || '运动'
            if (name.length > 4) name = name.substring(0, 4)
            return {
              day: name,
              burn: Math.round(item.calorie || 0)
            }
          })
          if (sportChartData.length > 7) {
            sportChartData = sportChartData.slice(-7)
          }
        } else {
          sportChartData = [{ day: '无运动', burn: 0 }]
        }
      } else {
        sportChartData = labels.map(l => ({
          day: l.label,
          burn: Math.round(burnBuckets[l.key] || 0)
        }))
      }

      // 按月显示时，计算周均日摄入以保证图表 Y 轴合理
      if (tab === 'month') {
        intakeChartData = intakeChartData.map(d => ({
          ...d,
          calorie: Math.round(d.calorie / 7)
        }))
        sportChartData = sportChartData.map(d => ({
          ...d,
          burn: Math.round(d.burn / 7)
        }))
      }
      
      if (tab === 'custom') {
        if (intakeChartData.length > 7) {
          let step = Math.ceil(intakeChartData.length / 7)
          intakeChartData = intakeChartData.filter((_, i) => i % step === 0 || i === intakeChartData.length - 1)
        }
        if (sportChartData.length > 7) {
          let step = Math.ceil(sportChartData.length / 7)
          sportChartData = sportChartData.filter((_, i) => i % step === 0 || i === sportChartData.length - 1)
        }
      }

      // 卡片统计
      const userInfo = wx.getStorageSync('userInfo') || {}
      let targetCalorie = userInfo.targetCalorie || wx.getStorageSync('targetCalorie') || 1600
      let totalIntake = 0
      let totalDeficit = 0
      let successDays = 0
      let periodIntake = 0
      let periodBurn = 0
      
      let validDaysCount = 0
      Object.keys(dailyIntake).forEach(d => {
        let intake = dailyIntake[d]
        let burn = dailyBurn[d] || 0
        validDaysCount++
        totalIntake += intake
        
        // 汇总总摄入和总消耗，计算总缺口
        periodIntake += intake
        periodBurn += burn

        let deficit = targetCalorie + burn - intake
        if (deficit > 0) {
          totalDeficit += deficit
        }
        
        if (intake > 0 && intake <= targetCalorie) {
          successDays++
        }
      })

      const avgIntake = validDaysCount > 0 ? Math.round(totalIntake / validDaysCount) : 0
      const avgDeficit = validDaysCount > 0 ? Math.round(totalDeficit / validDaysCount) : 0
      const periodDeficit = Math.round(periodIntake - periodBurn)

      this.setData({ 
        intakeChartData,
        sportChartData,
        targetCalorie,
        summary: {
          avgIntake,
          avgDeficit,
          successDays,
          periodDeficit,
          periodIntake,
          periodBurn
        }
      })
      wx.hideLoading()
    } catch (e) {
      wx.hideLoading()
      console.error(e)
      wx.showToast({ title: '加载数据失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    return {
      title: '看看我的近期减脂数据报表，快来和我一起记录吧！',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '看看我的近期减脂数据报表，快来和我一起记录吧！'
    }
  }
})