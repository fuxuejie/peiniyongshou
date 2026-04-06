Page({
  data: {
    currentYear: 2026,
    currentMonth: 4,
    calendarDays: [],
    poopRecords: {}, // { '2026-04-03': 1 }
    today: ''
  },
  onLoad() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const poopRecords = wx.getStorageSync('poopRecords') || {}
    
    this.setData({ 
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      today,
      poopRecords
    })
    this.generateCalendar()
  },
  generateCalendar() {
    const { currentYear, currentMonth, poopRecords, today } = this.data
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    
    const calendarDays = []
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({ empty: true })
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      calendarDays.push({
        day: i,
        dateStr,
        count: poopRecords[dateStr] || 0,
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
  onDayTap(e) {
    const { date } = e.currentTarget.dataset
    if (!date) return
    let { poopRecords } = this.data
    
    wx.showActionSheet({
      itemList: ['记录一次 💩', '撤销一次'],
      success: (res) => {
        const count = poopRecords[date] || 0
        if (res.tapIndex === 0) {
          poopRecords[date] = count + 1
          wx.showToast({ title: '记录成功' })
        } else if (res.tapIndex === 1) {
          if (count > 0) {
            poopRecords[date] = count - 1
            wx.showToast({ title: '已撤销', icon: 'none' })
          }
        }
        wx.setStorageSync('poopRecords', poopRecords)
        this.setData({ poopRecords })
        this.generateCalendar()
      }
    })
  }
})