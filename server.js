import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  // FAKE AI RESPONSE (works for demo)
  let reply = "";

  if (message.toLowerCase().includes("repo rate")) {
    reply = "📌 Loans become expensive. 📉 Market may slow. 💡 Avoid loans.";
  } else if (message.toLowerCase().includes("sip")) {
    reply = "💰 Good for long-term investing. ⚠️ Medium risk.";
  } else {
    reply = "🤖 Smart financial advice: diversify your investments.";
  }

  res.json({ reply });
});

app.listen(3000, () => console.log("Server running"));
