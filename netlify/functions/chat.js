// netlify/functions/chat.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const { prompt } = JSON.parse(event.body);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ text: response.text() }),
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};