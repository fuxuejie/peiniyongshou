Page({
  data: {
    currentYear: 2026,
    currentMonth: 4,
    calendarDays: [],
    periodStartDate: '', // '2026-04-19'
    periodDays: 7,
    cycleDays: 32,
    today: ''
  },
  onLoad() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const periodStartDate = wx.getStorageSync('periodStartDate') || today
    
    this.setData({ 
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      today,
      periodStartDate
    })
    this.generateCalendar()
  },
  generateCalendar() {
    const { currentYear, currentMonth, periodStartDate, periodDays, cycleDays, today } = this.data
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    
    const calendarDays = []
    // pad empty days
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({ empty: true })
    }
    
    const startObj = new Date(periodStartDate)
    const cycleMs = cycleDays * 24 * 3600 * 1000
    const periodMs = periodDays * 24 * 3600 * 1000
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const currentObj = new Date(dateStr)
      const diffDays = Math.floor((currentObj - startObj) / (24 * 3600 * 1000))
      
      let type = ''
      if (diffDays >= 0 && diffDays < periodDays) {
        type = 'period' // 经期
      } else {
        // predict next cycle
        const nextStartMs = startObj.getTime() + cycleMs
        const diffToNext = Math.floor((currentObj.getTime() - nextStartMs) / (24 * 3600 * 1000))
        if (diffToNext >= 0 && diffToNext < periodDays) {
          type = 'predict' // 预测经期
        } else {
          // Ovulation: around 14 days before next period
          const ovulationDayMs = nextStartMs - 14 * 24 * 3600 * 1000
          const diffToOvulation = Math.floor((currentObj.getTime() - ovulationDayMs) / (24 * 3600 * 1000))
          if (diffToOvulation === 0) {
            type = 'ovulation-day'
          } else if (diffToOvulation >= -5 && diffToOvulation <= 4) {
            type = 'ovulation'
          }
        }
      }
      
      calendarDays.push({
        day: i,
        dateStr,
        type,
        isToday: dateStr === today
      })
    }
    this.setData({ calendarDays })
  },
  prevMonth() {
    let { currentYear, currentMonth } = this.data
    currentMonth--
    if (currentMonth < 1) { currentMonth = 12; currentYear-- }
    this.setData({ currentYear, currentMonth })
    this.generateCalendar()
  },
  nextMonth() {
    let { currentYear, currentMonth } = this.data
    currentMonth++
    if (currentMonth > 12) { currentMonth = 1; currentYear++ }
    this.setData({ currentYear, currentMonth })
    this.generateCalendar()
  },
  startPeriod() {
    const { today } = this.data
    this.setData({ periodStartDate: today })
    wx.setStorageSync('periodStartDate', today)
    this.generateCalendar()
    wx.showToast({ title: '已记录经期开始' })
  }
})