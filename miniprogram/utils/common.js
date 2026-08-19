/**
 * 公共工具函数 - 统一管理环境ID和公共方法
 * 避免各页面硬编码环境ID，便于统一维护和切换环境
 */

/**
 * 获取云开发数据库实例（使用全局环境ID）
 * @returns {Database} 数据库实例
 */
function getDB() {
  const app = getApp()
  const envId = (app && app.globalData && app.globalData.envId) || 'cloudbase-7gd5buxj2de5a644'
  return wx.cloud.database({ env: envId })
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|String} d 日期对象或日期字符串
 * @returns {String} 格式化后的日期字符串
 */
function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 格式化时间为 HH:mm
 * @param {Date|String} d 时间对象或时间字符串
 * @returns {String} 格式化后的时间字符串
 */
function formatTime(d) {
  if (!d) return ''
  const date = new Date(d)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * 获取用户统计数据（首次记录时间、坚持天数等）
 * 各页面共用此方法，避免重复代码
 * @param {Object} pageContext 页面上下文（this）
 */
async function fetchUserStats(pageContext) {
  try {
    let firstTime = wx.getStorageSync('firstRecordTime')
    
    if (!firstTime) {
      const db = getDB()
      const [dietRes, sportRes] = await Promise.all([
        db.collection('DietRecord').orderBy('createTime', 'asc').limit(1).get(),
        db.collection('SportRecord').orderBy('createTime', 'asc').limit(1).get()
      ])
      
      firstTime = new Date().getTime()
      let hasRecord = false
      
      if (dietRes.data.length > 0) {
        firstTime = Math.min(firstTime, new Date(dietRes.data[0].createTime).getTime())
        hasRecord = true
      }
      if (sportRes.data.length > 0) {
        firstTime = Math.min(firstTime, new Date(sportRes.data[0].createTime).getTime())
        hasRecord = true
      }
      
      // 只有在真正有记录的情况下，才缓存首次记录时间，避免过早锁定无记录时间
      if (hasRecord) {
        wx.setStorageSync('firstRecordTime', firstTime)
      }
    }
    
    const now = new Date().getTime()
    const diff = now - firstTime
    const joinDays = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
    
    if (pageContext) {
      pageContext.setData({ joinDays })
    }
    return { joinDays, firstTime }
  } catch (err) {
    console.error('[common] 获取统计数据失败', err)
    if (pageContext && (!pageContext.data.joinDays || pageContext.data.joinDays <= 1)) {
      pageContext.setData({ joinDays: 1 })
    }
    return { joinDays: 1 }
  }
}

module.exports = {
  getDB,
  formatDate,
  formatTime,
  fetchUserStats
}
