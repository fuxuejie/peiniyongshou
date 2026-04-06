const jsonStr = `图片显示的是一个汉堡。
估算的热量如下：
\`\`\`json
[
  {
    "name": "汉堡",
    "calorie": 300,
    "carbs": 30,
    "protein": 15,
    "fat": 15,
    "weight": 200
  }
]
\`\`\`
`;

let matchArray = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
let matchObject = jsonStr.match(/\{[\s\S]*\}/);

let extracted = jsonStr;
if (matchArray) {
  extracted = matchArray[0];
} else if (matchObject) {
  extracted = matchObject[0];
}

console.log("Extracted:", extracted);
try {
  JSON.parse(extracted);
  console.log("Parsed ok!");
} catch (e) {
  console.error("Parse error:", e.message);
}