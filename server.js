import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ THIS LINE FIXES YOUR ERROR
app.use(express.static("public"));

app.post("/chat", async (req, res) => {
  const { message } = req.body;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
