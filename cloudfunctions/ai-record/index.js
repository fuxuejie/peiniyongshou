// 云函数入口文件
const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const app = tcb.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { text, image, imageUrl, fileID, recordType = 'diet' } = event; 
  
  if (!text && !fileID && !image && !imageUrl) {
    return { success: false, message: '请提供描述内容或图片' };
  }

  try {
    const ai = app.ai();
    const model = ai.createModel("hunyuan-exp");

    let systemPrompt = '';
    
    if (recordType === 'sport') {
      systemPrompt = `你是一个专业的健身教练。请根据用户提供的运动描述，识别出运动名称和时长（分钟），并估算其消耗的热量(kcal)。
必须返回严格的 JSON 格式，不要包含任何 markdown 标记，不要包含其他解释文本。
必须包含以下字段：
{
  "name": "运动名称",
  "duration": 30,
  "calorie": 200
}`;
    } else {
      systemPrompt = `你是一位拥有20年经验的顶尖临床营养师。请极其严谨地分析这张图片和用户描述：
1. 深度识别所有主要的食材及其状态（生熟、带骨带皮、含水分情况）及烹饪方式（油炸、水煮、爆炒等，油炸会大幅增加热量）；
2. 结合餐盘、杯子、手等参照物，极其精确地估算每种食材的实际可食用克重（考虑废弃部分）；
3. 结合食材种类、克重和烹饪方式，给出最符合实际的卡路里(kcal)和三大营养素估算（碳水、蛋白质、脂肪）。注意同样重量的炸鸡热量远高于水煮鸡胸肉，碳水类主食（米饭面条）重量中很大一部分是水分，请务必准确估算！

【最高指令 - 严格遵循】
绝不允许输出任何废话、问候语或说明文字！
严禁输出 Markdown 代码块符号（如 \`\`\`json ）。
你的输出必须是从 "[" 开始，到 "]" 结束的合法 JSON 数组！
JSON 的键和字符串值必须使用双引号。
JSON 数组中的每个对象必须严格使用以下英文作为键名（绝不能用中文）：
[
  {
    "name": "食物名称(例如干锅土豆片、烤吐司等)",
    "calorie": 350,
    "carbs": 40.5,
    "protein": 12.0,
    "fat": 15.5,
    "weight": 250
  }
]
警告：以上 JSON 仅为格式演示！严禁照抄里面的数值（如 350、40.5 等），你必须根据图片中真实的食物种类和预估克重进行独立计算！`;
    }

    let promptText = text || '请识别内容并估算。';
    promptText += '\n【重要：只输出 JSON 数组，不输出任何 markdown 标记如 ```json，不要输出任何解释说明！】';
    
    // 构造请求 messages
    let messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // 移除容易导致大模型照抄的静态对话示例，强制模型基于图片独立思考
    
    if (image) {
      // 传入 base64 图片数据
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
        ]
      });
    } else if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else if (fileID) {
      // 从云存储下载文件，并转为 base64 传给混元 API
      try {
        const fileRes = await app.downloadFile({
          fileID: fileID,
        });
        const base64Content = fileRes.fileContent.toString('base64');
        messages.push({
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Content}` } }
          ]
        });
      } catch (err) {
        console.error('下载图片失败:', err);
        return { success: false, message: '获取图片失败，请重试' };
      }
    } else {
      messages.push({ role: "user", content: promptText });
    }

    // 图片处理必须使用 hunyuan-vision 或者其它支持多模态的模型
    // 文本处理可用 hunyuan-2.0-instruct-20251111
    const modelName = (image || fileID || imageUrl) ? "hunyuan-vision" : "hunyuan-2.0-instruct-20251111";

    console.log('Sending request to AI model:', modelName);
    const result = await model.generateText({
      model: modelName,
      messages: messages,
    });

    let jsonStr = result.text.trim();
    console.log('AI raw response:', jsonStr);
    
    // 去除大模型可能附带的 markdown 标记
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.substring(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3);
    }
    jsonStr = jsonStr.trim();
    
    // 尝试直接截取数组或对象
    let extractedJsonStr = jsonStr;
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      extractedJsonStr = arrayMatch[0];
    } else {
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        extractedJsonStr = objectMatch[0];
      }
    }
    
    // 兼容大模型有时在 JSON 尾部漏了 } 或 ] 的情况
    if (extractedJsonStr.startsWith('[') && !extractedJsonStr.endsWith(']')) extractedJsonStr += ']';
    if (extractedJsonStr.startsWith('{') && !extractedJsonStr.endsWith('}')) extractedJsonStr += '}';

    let aiData;
    let parseSuccess = false;
    
    try {
      aiData = JSON.parse(extractedJsonStr);
      
      // 容错处理1：如果大模型返回了对象而不是数组
      if (!Array.isArray(aiData) && typeof aiData === 'object') {
        let foundArray = null;
        for (let key in aiData) {
          if (Array.isArray(aiData[key]) && aiData[key].length > 0 && typeof aiData[key][0] === 'object') {
            foundArray = aiData[key];
            break;
          }
        }
        aiData = foundArray ? foundArray : [aiData];
      }
      
      // 检查解析出的 JSON 是否存在严重的字段缺失（比如只有名字，完全没有热量）
      const hasCalorie = aiData.some(item => {
        let str = JSON.stringify(item).toLowerCase();
        return str.includes('calorie') || str.includes('热量') || str.includes('kcal') || str.includes('卡路里') || str.includes('能量');
      });
      
      if (!hasCalorie) {
        throw new Error('Parsed JSON is semantically incomplete (missing calories)');
      }
      
      parseSuccess = true;
    } catch (parseError) {
      console.error('JSON parse or validation failed:', parseError);
    }
    
    if (!parseSuccess) {
      // 暴力正则兜底方案：无视 JSON 语法，直接从原始字符串里提取所有的键值对
      let rawText = result.text.replace(/[\r\n]/g, ' ');
      
      let name = '未知食物';
      let nameMatch = rawText.match(/"(?:name|食物名称|foodName|食物|名称)"\s*:\s*"([^"]+)"/i);
      if (nameMatch) {
        name = nameMatch[1];
      } else {
        let cnMatch = rawText.match(/(这是一[碗盘杯份]?|识别到)[的]?([一-龥]{2,10})/);
        if (cnMatch) {
          name = cnMatch[2];
        } else {
          // 找第一个看起来像食物名词的词
          let foodNameMatch = rawText.match(/(?:名称|食物|品名)[:：]\s*([一-龥]{2,10})/);
          if (foodNameMatch) name = foodNameMatch[1];
        }
      }
      
      const extractNum = (regexList) => {
        for (let r of regexList) {
          let m = rawText.match(r);
          if (m) return parseFloat(m[1]);
        }
        return 0;
      };

      aiData = [{
        name: name,
        calorie: extractNum([/"(?:calorie|热量|卡路里|calories|kcal|能量)"\s*:\s*"?(\d+(\.\d+)?)/i, /(?:热量|卡路里|calorie|kcal|能量).*?(\d+(\.\d+)?)/i]),
        carbs: extractNum([/"(?:carbs|碳水化合物|碳水)"\s*:\s*"?(\d+(\.\d+)?)/i, /(?:碳水|carbs).*?(\d+(\.\d+)?)/i]),
        protein: extractNum([/"(?:protein|蛋白质|蛋白)"\s*:\s*"?(\d+(\.\d+)?)/i, /(?:蛋白|protein).*?(\d+(\.\d+)?)/i]),
        fat: extractNum([/"(?:fat|脂肪)"\s*:\s*"?(\d+(\.\d+)?)/i, /(?:脂肪|fat).*?(\d+(\.\d+)?)/i]),
        weight: extractNum([/"(?:weight|重量|预估重量|g|份量)"\s*:\s*"?(\d+(\.\d+)?)/i, /(?:重量|weight|份量).*?(\d+(\.\d+)?)/i])
      }];
    }
    
    // 确保 aiData 是数组
    if (!Array.isArray(aiData)) {
      aiData = [aiData];
    }
    
    // 提取数字的工具函数
    const parseNum = (val) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const match = val.match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
      }
      return 0;
    };

    // 从对象中寻找匹配的键的值
    const findValue = (obj, keys) => {
      const lowerObj = {};
      for (let k in obj) {
        lowerObj[k.toLowerCase()] = obj[k];
      }
      for (let k of keys) {
        if (lowerObj[k] !== undefined && lowerObj[k] !== null && lowerObj[k] !== '') {
          return lowerObj[k];
        }
      }
      return 0;
    };

    // 过滤并格式化返回结果
    let formattedData = aiData.map(item => {
      if (recordType === 'sport') {
        return {
          name: item.name || item.运动名称 || item.sport || item.运动 || '未知运动',
          duration: Math.round(parseNum(findValue(item, ['duration', '时长', 'time', '运动时长', '分钟']))),
          calorie: Math.round(parseNum(findValue(item, ['calorie', 'calories', '热量', '消耗', 'kcal', '卡路里'])))
        };
      } else {
        // 容错处理2：大模型经常乱造 key，所以进行地毯式搜索
        let foodName = item.name || item.食物名称 || item.foodName || item.食物 || item.饮料名称 || item.饮品名称 || item.名称 || item.品名 || item.菜品 || '未知食物';
        
        // 如果还没找到，尝试找对象里第一个短字符串作为名字
        if (foodName === '未知食物') {
          for (let k in item) {
            if (typeof item[k] === 'string' && !k.includes('热量') && !k.includes('成分') && item[k].length > 0 && item[k].length < 20) {
              foodName = item[k];
              break;
            }
          }
        }
        
        return {
          name: foodName,
          calorie: Math.round(parseNum(findValue(item, ['calorie', 'calories', '热量', '热量估算', 'kcal', '卡路里', '能量', '估算热量']))),
          carbs: Math.round(parseNum(findValue(item, ['carbs', 'carbohydrate', '碳水化合物', '碳水']))),
          protein: Math.round(parseNum(findValue(item, ['protein', '蛋白质', '蛋白']))),
          fat: Math.round(parseNum(findValue(item, ['fat', '脂肪']))),
          weight: Math.round(parseNum(findValue(item, ['weight', '重量', '克重', 'g', '预估重量', '份量', '估算重量', '克'])))
        };
      }
    });

    // 自动聚合逻辑：如果大模型返回了多个食材，自动汇总一个“整份”选项
    if (recordType !== 'sport' && formattedData.length > 1) {
      const hasSummary = formattedData.some(item => 
        item.name.includes('总计') || 
        item.name.includes('一整') || 
        item.name.includes('全部') ||
        item.name.includes('整份')
      );
      
      if (!hasSummary) {
        let totalCal = 0, totalCarbs = 0, totalProtein = 0, totalFat = 0, totalWeight = 0;
        formattedData.forEach(item => {
          totalCal += item.calorie || 0;
          totalCarbs += item.carbs || 0;
          totalProtein += item.protein || 0;
          totalFat += item.fat || 0;
          totalWeight += item.weight || 0;
        });
        
        const foodNames = formattedData.slice(0, 3).map(item => item.name).join('、');
        const suffix = formattedData.length > 3 ? '等' : '';

        // 把汇总项放在数组的第 0 位，这样前端默认选中的就是它！
        formattedData.unshift({
          name: `🍱 一整份 (${foodNames}${suffix})`,
          calorie: totalCal,
          carbs: totalCarbs,
          protein: totalProtein,
          fat: totalFat,
          weight: totalWeight
        });
      }
    }

    return {
      success: true,
      data: formattedData,
      message: '识别成功'
    };
  } catch (err) {
    console.error('AI 识别失败', err);
    return {
      success: false,
      message: '识别失败: ' + (err.message || '未知错误'),
      errorDetail: err.stack || err
    };
  }
};
