const tcb = require('@cloudbase/node-sdk');
const fs = require('fs');

const app = tcb.init({ env: 'cloudbase-7gd5buxj2de5a644' });

async function test() {
  const ai = app.ai();
  const model = ai.createModel("hunyuan-vision");

  const systemPrompt = `你是一位拥有10年经验的临床营养师。请仔细分析这张图片和用户描述：
1. 识别出所有主要的食材及烹饪方式；
2. 结合餐盘/参照物估算大致的克重；
3. 给出最精确的卡路里和三大营养素估算。
如果食物有伪装性（如素肉），或图片不清晰，请基于常规情况给出现实中最可能的判断。

【最高指令】
你必须且只能返回纯粹的 JSON 数组格式，不要说“好的”、“根据图片”等任何废话！不要包含任何 markdown 标记。
JSON 数组中的每个对象必须严格使用以下英文作为键名（key），绝不能自己发明中文 key（例如绝不能用“饮料名称”）：
[
  {
    "name": "食物名称或饮品名称",
    "calorie": 100,
    "carbs": 20,
    "protein": 5,
    "fat": 2,
    "weight": 150
  }
]`;

  let promptText = '请帮我识别图片中的食物并估算热量。';
  promptText += '\n【重要提示：只输出合法的 JSON 数组，绝不能包含任何其他说明文字或 Markdown 标记！】';

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: promptText },
        // using some random food image or a placeholder online image
        { type: "image_url", image_url: { url: "https://www.w3schools.com/w3images/sandwich.jpg" } }
      ]
    }
  ];

  console.log('Sending to hunyuan-vision...');
  try {
    const result = await model.generateText({
      model: "hunyuan-vision",
      messages: messages,
    });
    console.log('RAW RESPONSE:');
    console.log(result.text);
  } catch (err) {
    console.error(err);
  }
}

test();