Component({
  data: {
    visible: false,
    inputText: '',
    meal: 'lunch',
    amount: 1.0,
    aiResult: null,
    candidateList: [],
    selectedIndex: 0,
    isLoading: false,
    tempImagePath: '',
    tempImageUrl: '',
    tempFileID: ''
  },

  methods: {
    show() {
      const hour = new Date().getHours()
      let meal = 'lunch'
      if (hour >= 5 && hour < 10) meal = 'breakfast'
      else if (hour >= 10 && hour < 14) meal = 'lunch'
      else if (hour >= 14 && hour < 19) meal = 'dinner'
      else meal = 'snack'
      
      this.setData({ visible: true, meal })
    },
    
    close() {
      this.setData({ 
        visible: false,
        inputText: '',
        amount: 1.0,
        aiResult: null,
        candidateList: [],
        selectedIndex: 0,
        tempImagePath: '',
        tempImageUrl: '',
        tempFileID: ''
      })
    },

    onVisibleChange(e) {
      if (!e.detail.visible) {
        this.close();
      } else {
        this.setData({ visible: true });
      }
    },

    onInput(e) {
      this.setData({ inputText: e.detail.value })
    },

    selectMeal(e) {
      const meal = e.currentTarget.dataset.meal
      this.setData({ meal })
    },

    decreaseAmount() {
      if (this.data.amount > 0.5) {
        this.setData({ amount: (this.data.amount - 0.5).toFixed(1) })
      }
    },

    increaseAmount() {
      this.setData({ amount: (Number(this.data.amount) + 0.5).toFixed(1) })
    },

    chooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath
          // 只把图片存到本地，不立刻请求
          this.setData({ 
            tempImagePath: tempFilePath,
            tempImageUrl: '',
            tempFileID: '',
            aiResult: null,
            candidateList: [],
            selectedIndex: 0
          })
        }
      })
    },

    removeImage() {
      this.setData({
        tempImagePath: '',
        tempImageUrl: '',
        tempFileID: ''
      })
    },

    async sendText() {
      if (!this.data.inputText.trim() && !this.data.tempImagePath) {
        wx.showToast({ title: '请输入内容或选择照片', icon: 'none' })
        return
      }
      
      this.setData({ isLoading: true, aiResult: null, candidateList: [] })
      
      // 如果有图片，转为 base64 发送，避免依赖云存储上传
      if (this.data.tempImagePath && !this.data.tempImageUrl) {
        wx.showLoading({ title: '处理图片中...' })
        
        // 动态梯级压缩机制：为了彻底适配微信 callFunction 严格的 256KB 隐形传输限制
        const tiers = [
          { width: 600, quality: 50 },
          { width: 400, quality: 30 },
          { width: 300, quality: 20 },
          { width: 250, quality: 10 }
        ];
        
        let finalBase64 = null;
        const MAX_SAFE_SIZE = 100000; // 核心修复：JS字符串为UTF-16，100,000 字符=200KB内存，刚好低于微信 256KB 传输红线
        
        // Promise 封装的单次压缩读取函数
        const compressAndRead = (src, width, quality) => {
          return new Promise((resolve) => {
            wx.compressImage({
              src: src,
              quality: quality,
              compressedWidth: width,
              success: (res) => {
                const fs = wx.getFileSystemManager()
                try {
                  const base64Str = fs.readFileSync(res.tempFilePath, 'base64')
                  resolve({ success: true, base64: base64Str })
                } catch (e) {
                  console.error('读取压缩图片失败', e)
                  resolve({ success: false, base64: null })
                }
              },
              fail: (err) => {
                console.error(`压缩失败(w:${width}, q:${quality})`, err);
                resolve({ success: false, base64: null })
              }
            })
          })
        }

        // 尝试各个档位
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          const result = await compressAndRead(this.data.tempImagePath, tier.width, tier.quality);
          
          if (result.success && result.base64) {
            // 判断是否在安全线以内
            if (result.base64.length < MAX_SAFE_SIZE) {
              finalBase64 = result.base64;
              console.log(`采用第 ${i + 1} 档压缩成功，长度: ${finalBase64.length}`);
              break;
            } else {
              console.warn(`第 ${i + 1} 档压缩后依然过大 (${result.base64.length})，尝试降级`);
            }
          }
        }

        // 极限兜底：如果四档压缩依然失败或者过大，则尝试读取原图并判断
        if (!finalBase64) {
          const fs = wx.getFileSystemManager()
          try {
            const rawBase64 = fs.readFileSync(this.data.tempImagePath, 'base64')
            if (rawBase64.length < MAX_SAFE_SIZE) {
              finalBase64 = rawBase64;
              console.log(`压缩流程全部失败，采用原图兜底，长度: ${finalBase64.length}`);
            }
          } catch (e) {
            console.error('读取原图失败', e)
          }
        }

        // 最终判断
        if (finalBase64) {
          this.doRecognizeWithBase64(finalBase64);
        } else {
          wx.hideLoading()
          wx.showToast({ title: '图片过大无法处理，请裁剪后重试', icon: 'none' })
          this.setData({ isLoading: false })
        }

      } else {
        // 没有图片或已上传过，直接识别
        this.doRecognizeWithBase64(null)
      }
    },

    doRecognizeWithBase64(base64Image) {
      wx.showLoading({ title: 'AI 思考中...' })
      wx.cloud.callFunction({
        name: 'ai-record',
        config: { env: 'cloudbase-7gd5buxj2de5a644' },
        data: {
          text: this.data.inputText || '请帮我识别图片中的食物并估算热量。',
          image: base64Image || undefined
        },
        success: res => {
          wx.hideLoading()
          if (res.result && res.result.success) {
            const candidates = res.result.data || []
            if (candidates.length > 0) {
              this.setData({
                isLoading: false,
                candidateList: candidates,
                selectedIndex: 0,
                aiResult: candidates[0]
              })
            } else {
              wx.showModal({ title: '识别失败', content: '未识别到结果，请换个描述', showCancel: false })
              this.setData({ isLoading: false })
            }
          } else {
            wx.showModal({ title: '识别失败', content: (res.result && res.result.message) || '内容识别失败，请重试', showCancel: false })
            this.setData({ isLoading: false })
          }
        },
        fail: err => {
          wx.hideLoading()
          wx.showModal({ title: '识别异常', content: err.message || '网络连接失败', showCancel: false })
          this.setData({ isLoading: false })
          console.error('[云函数] [ai-record] 调用失败', err)
        }
      })
    },

    selectCandidate(e) {
      const index = e.currentTarget.dataset.index
      this.setData({
        selectedIndex: index,
        aiResult: this.data.candidateList[index]
      })
    },

    confirmRecord() {
      if (!this.data.aiResult) {
        wx.showToast({ title: '请先进行记录', icon: 'none' })
        return
      }
      
      wx.showLoading({ title: '保存中' })
      const db = wx.cloud.database({ env: 'cloudbase-7gd5buxj2de5a644' })
      db.collection('DietRecord').add({
        data: {
          meal: this.data.meal,
          foodName: this.data.aiResult.name,
          amount: Number(this.data.amount),
          calorie: this.data.aiResult.calorie * Number(this.data.amount),
          carbs: this.data.aiResult.carbs * Number(this.data.amount),
          protein: this.data.aiResult.protein * Number(this.data.amount),
          fat: this.data.aiResult.fat * Number(this.data.amount),
          createTime: db.serverDate()
        },
        success: res => {
          wx.hideLoading()
          wx.showToast({ title: '记录成功' })
          this.close()
          this.setData({
            aiResult: null,
            inputText: '',
            amount: 1.0
          })
          // 触发刷新事件
          this.triggerEvent('refresh')
        },
        fail: err => {
          wx.hideLoading()
          wx.showToast({ title: '保存失败', icon: 'none' })
          console.error('[数据库] [DietRecord] 保存失败', err)
        }
      })
    }
  }
})