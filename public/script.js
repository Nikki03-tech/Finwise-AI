async function sendMessage() {
  const input = document.getElementById("input");
  const messages = document.getElementById("messages");

  const userText = input.value;

  messages.innerHTML += `<div class="user">${userText}</div>`;

  const res = await fetch("https://your-backend-url/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText }),
  });

  const data = await res.json();

  messages.innerHTML += `<div class="ai">${data.reply}</div>`;

  input.value = "";
}
