// Placeholder for a Netlify serverless function.
// This function would receive the plan data from the frontend
// and could perform additional processing, like generating a PDF.

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    
    // In a real app, you would process the data here.
    // For now, we'll just return it.
    console.log("Received data:", data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Data received successfully", receivedData: data }),
    };
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
};
