let chart;

async function sendMessage() {
  const input = document.getElementById("input");
  const messages = document.getElementById("messages");

  const userText = input.value.trim();
  if (!userText) return;

  // 👉 Show user message
  messages.innerHTML += `<div class="user">${userText}</div>`;

  // 👉 Add typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai";
  typingDiv.innerText = "Typing...";
  messages.appendChild(typingDiv);

  // 👉 Scroll down
  messages.scrollTop = messages.scrollHeight;

  try {
    const res = await fetch("https://finwise-ai-0753.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    const data = await res.json();

    // 👉 Remove typing indicator
    typingDiv.remove();

    // 👉 Show AI response
    messages.innerHTML += `<div class="ai">${data.reply}</div>`;

    // 📊 Show chart ONLY for investment-related queries
    if (
      userText.toLowerCase().includes("sip") ||
      userText.toLowerCase().includes("investment")
    ) {
      showChart();
    }

  } catch (err) {
    typingDiv.remove();
    messages.innerHTML += `<div class="ai">⚠️ Error connecting to server</div>`;
  }

  input.value = "";

  // 👉 Auto scroll
  messages.scrollTop = messages.scrollHeight;
}

function showChart() {
  const ctx = document.getElementById("chart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5"],
      datasets: [
        {
          label: "Investment Growth (₹)",
          data: [1000, 1800, 2600, 3500, 5000],
          borderWidth: 2,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "white" }
        }
      },
      scales: {
        x: {
          ticks: { color: "white" }
        },
        y: {
          ticks: { color: "white" }
        }
      }
    }
  });
}
