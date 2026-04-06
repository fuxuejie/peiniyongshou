const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({ env: 'cloudbase-7gd5buxj2de5a644' });

async function test() {
  try {
    const ai = app.ai();
    const model = ai.createModel("hunyuan-exp");
    
    let systemPrompt = `你是一位拥有10年经验的临床营养师。请仔细分析这张图片和用户描述：
1. 识别出所有主要的食材及烹饪方式；
2. 结合餐盘/参照物估算大致的克重；
3. 给出最精确的卡路里和三大营养素估算。
如果食物有伪装性（如素肉），或图片不清晰，请基于常规情况给出现实中最可能的判断。
必须返回严格的 JSON 数组格式（返回 1 到 3 个最可能的食物结果，按可能性从高到低排序），不要包含任何 markdown 标记或其他解释文本。
每个对象必须包含以下字段：
[
  {
    "name": "食物名称",
    "calorie": 100,
    "carbs": 20,
    "protein": 5,
    "fat": 2,
    "weight": 150
  }
]`;

    let promptText = "中午吃了半碗面条";
    let imageUrl = "https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=1000&auto=format&fit=crop"; // noodles

    const result = await model.generateText({
      model: "hunyuan-vision",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
    });
    
    let rawText = result.text;
    console.log("=== Raw Response ===\n", rawText);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

test();