let chart;
let isSending = false;

function appendMessage(className, text) {
  const messages = document.getElementById("messages");
  const bubble = document.createElement("div");
  bubble.className = className;
  // Use textContent so user prompts and model output cannot inject HTML.
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function sendMessage() {
  const input = document.getElementById("input");
  const sendButton = document.querySelector(".input-area button");
  const userText = input.value.trim();

  if (!userText || isSending) return;

  appendMessage("user", userText);
  input.value = "";

  const typingDiv = appendMessage("ai", "FinWise is analysing your question...");
  isSending = true;
  if (sendButton) sendButton.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    const data = await res.json().catch(() => ({}));
    typingDiv.remove();

    if (!res.ok || !data.success || !data.reply) {
      throw new Error(data.error || "FinWise could not process this request. Please try again.");
    }

    appendMessage("ai", data.reply);

    const calculation = data.data?.investment?.calculation;
    if (calculation) {
      showChart(calculation);
    }
  } catch (err) {
    typingDiv.remove();
    appendMessage(
      "ai",
      "Sorry, I couldn't get a response. Please check that the server is awake and its Gemini API key is configured, then try again."
    );
    console.error("FinWise request failed:", err);
  } finally {
    isSending = false;
    if (sendButton) sendButton.disabled = false;
    input.focus();
  }
}

function showChart(calculation) {
  const canvas = document.getElementById("chart");
  if (!canvas || typeof Chart === "undefined") return;

  const monthlyInvestment = Number(calculation.monthlyInvestment);
  const annualReturn = Number(calculation.annualReturn);
  const months = Number(calculation.months);

  if (
    !Number.isFinite(monthlyInvestment) || monthlyInvestment <= 0 ||
    !Number.isFinite(annualReturn) || annualReturn < 0 ||
    !Number.isFinite(months) || months <= 0
  ) return;

  const monthlyRate = annualReturn / 100 / 12;
  const labels = [];
  const values = [];

  // Calculate each point using the same beginning-of-month SIP formula
  // as the backend. These are illustrative values, not guaranteed returns.
  for (let month = 1; month <= months; month += 1) {
    const value = monthlyRate === 0
      ? monthlyInvestment * month
      : monthlyInvestment *
        (((1 + monthlyRate) ** month - 1) / monthlyRate) *
        (1 + monthlyRate);

    labels.push(month % 12 === 0 ? `Year ${month / 12}` : `Month ${month}`);
    values.push(Math.round(value));
  }

  if (chart) chart.destroy();

  chart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `Illustrative SIP value (₹; assumed ${annualReturn}% annual return)`,
        data: values,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: months > 24 ? 0 : 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: "white" },
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ₹${Number(context.parsed.y).toLocaleString("en-IN")}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "white",
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "white",
            callback: (value) => `₹${Number(value).toLocaleString("en-IN")}`,
          },
        },
      },
    },
  });
}
