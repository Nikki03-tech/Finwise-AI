let chartInstances = [];
let isSending = false;
let supabaseClient = null;
let currentUser = null;
let conversations = [];
let activeConversationId = null;

const $ = (id) => document.getElementById(id);

function setAuthMode(mode) {
  const signup = mode === "signup";
  $("auth-form").dataset.mode = mode;
  $("name-field").hidden = !signup;
  $("auth-eyebrow").textContent = signup ? "CREATE YOUR PRIVATE SPACE" : "WELCOME BACK";
  $("auth-title").textContent = signup ? "Create your account" : "Sign in to FinWise";
  $("auth-subtitle").textContent = signup
    ? "Your chats and financial learning history, together."
    : "Pick up where you left off.";
  $("auth-submit").textContent = signup ? "Create account" : "Sign in";
  $("auth-switch-label").textContent = signup ? "Already have an account?" : "New to FinWise?";
  $("auth-mode-toggle").textContent = signup ? "Sign in" : "Create an account";
  $("auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("auth-feedback").textContent = "";
  $("auth-feedback").classList.remove("error");
}

function showAuth(message = "") {
  currentUser = null;
  $("auth-screen").hidden = false;
  $("app-shell").hidden = true;
  $("auth-feedback").textContent = message;
}

function showWorkspace(user) {
  currentUser = user;
  $("auth-screen").hidden = true;
  $("app-shell").hidden = false;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "FinWise member";
  $("profile-name").textContent = displayName;
  $("profile-email").textContent = user.email || "Signed in";
  $("user-avatar").textContent = displayName.trim().charAt(0).toUpperCase() || "F";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function relativeGroup(value) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7 && diff >= 0) return "Previous 7 days";
  return "Earlier";
}

function renderHistory() {
  const list = $("history-list");
  list.replaceChildren();
  $("history-count").textContent = String(conversations.length);
  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Your saved conversations will appear here.";
    list.append(empty);
    return;
  }

  const groups = new Map();
  for (const conversation of conversations) {
    const group = relativeGroup(conversation.updated_at || conversation.created_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(conversation);
  }

  for (const [groupName, items] of groups) {
    const label = document.createElement("div");
    label.className = "history-group-label";
    label.textContent = groupName;
    list.append(label);

    for (const conversation of items) {
      const row = document.createElement("div");
      row.className = "history-item-wrap";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item" + (conversation.id === activeConversationId ? " active" : "");
      button.title = conversation.title || "Untitled conversation";
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "◌";
      const title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = conversation.title || "New conversation";
      button.append(icon, title);
      button.addEventListener("click", () => openConversation(conversation.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-delete";
      remove.textContent = "×";
      remove.title = "Delete conversation";
      remove.setAttribute("aria-label", "Delete conversation");
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteConversation(conversation.id);
      });
      row.append(button, remove);
      list.append(row);
    }
  }
}

function clearChartInstances() {
  for (const instance of chartInstances) {
    try { instance.destroy(); } catch { /* ignore stale canvas */ }
  }
  chartInstances = [];
}

function showWelcome() {
  $("welcome-screen").hidden = false;
  $("messages").hidden = true;
  $("messages").replaceChildren();
  $("conversation-title").textContent = "A clearer view of your money";
  clearChartInstances();
}

function showMessageArea() {
  $("welcome-screen").hidden = true;
  $("messages").hidden = false;
}

function renderMarkdown(content, container) {
  const raw = window.marked
    ? window.marked.parse(String(content || ""), { breaks: true, gfm: true })
    : String(content || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
  if (window.DOMPurify) {
    container.innerHTML = window.DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel"],
    });
  } else {
    container.textContent = String(content || "");
  }
  for (const link of container.querySelectorAll("a")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderNewsCards(articles, container) {
  if (!Array.isArray(articles) || !articles.length) return;
  const grid = document.createElement("div");
  grid.className = "news-grid";
  for (const article of articles.slice(0, 8)) {
    const href = safeUrl(article.url);
    if (!href || !article.title) continue;
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = href;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const imageUrl = safeUrl(article.image);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "news-image";
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "news-image-placeholder";
        placeholder.textContent = "✦";
        image.replaceWith(placeholder);
      }, { once: true });
      card.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "news-image-placeholder";
      placeholder.textContent = "✦";
      card.append(placeholder);
    }

    const copy = document.createElement("div");
    copy.className = "news-card-copy";
    const title = document.createElement("div");
    title.className = "news-card-title";
    title.textContent = article.title;
    copy.append(title);
    if (article.description) {
      const description = document.createElement("div");
      description.className = "news-card-description";
      description.textContent = article.description;
      copy.append(description);
    }
    const meta = document.createElement("div");
    meta.className = "news-card-meta";
    const publisher = document.createElement("span");
    publisher.className = "news-card-source";
    publisher.textContent = article.source || "News source";
    const date = document.createElement("span");
    date.textContent = article.publishedAt ? formatDate(article.publishedAt) : "Date unavailable";
    meta.append(publisher, date);
    copy.append(meta);
    const open = document.createElement("div");
    open.className = "news-card-open";
    open.textContent = "Read article ↗";
    copy.append(open);
    card.append(copy);
    grid.append(card);
  }
  if (grid.children.length) container.append(grid);
}

function createMessageElement(message) {
  const role = message.role === "user" ? "user" : "assistant";
  const row = document.createElement("article");
  row.className = "message-row " + (role === "user" ? "user-message" : "assistant-message");

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "F";
    avatar.setAttribute("aria-hidden", "true");
    row.append(avatar);
  }

  const body = document.createElement("div");
  body.className = "message-body";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = role === "user" ? "You" : "FINWISE AI";
  body.append(meta);

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (message.typing) {
    bubble.classList.add("typing-bubble");
    bubble.textContent = "FinWise is working through your question…";
  } else if (role === "user") {
    bubble.textContent = message.content || "";
  } else {
    renderMarkdown(message.content || "", bubble);
  }
  body.append(bubble);

  if (role === "assistant" && !message.typing) {
    renderNewsCards(message.articles, body);
    if (message.calculation) renderChart(message.calculation, body);
  }
  row.append(body);
  return row;
}

function appendMessage(message) {
  showMessageArea();
  const node = createMessageElement(message);
  $("messages").append(node);
  $("messages").scrollTop = $("messages").scrollHeight;
  return node;
}

function renderMessages(messages) {
  clearChartInstances();
  const area = $("messages");
  area.replaceChildren();
  showMessageArea();
  for (const message of messages || []) area.append(createMessageElement(message));
  area.scrollTop = area.scrollHeight;
}

function renderChart(calculation, container) {
  if (typeof Chart === "undefined") return;
  const monthlyInvestment = Number(calculation.monthlyInvestment);
  const annualReturn = Number(calculation.annualReturn);
  const months = Number(calculation.months);
  if (!Number.isFinite(monthlyInvestment) || monthlyInvestment <= 0 ||
      !Number.isFinite(annualReturn) || annualReturn < 0 ||
      !Number.isFinite(months) || months <= 0) return;

  const card = document.createElement("div");
  card.className = "chart-card";
  const title = document.createElement("div");
  title.className = "chart-card-title";
  title.textContent = "Illustrative SIP growth · assumed " + annualReturn + "% annual return";
  const canvas = document.createElement("canvas");
  canvas.height = 170;
  card.append(title, canvas);
  container.append(card);

  const rate = annualReturn / 100 / 12;
  const labels = [];
  const values = [];
  for (let month = 1; month <= months; month += 1) {
    const value = rate === 0
      ? monthlyInvestment * month
      : monthlyInvestment * (((1 + rate) ** month - 1) / rate) * (1 + rate);
    labels.push(month % 12 === 0 ? "Year " + month / 12 : "Month " + month);
    values.push(Math.round(value));
  }
  const instance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Estimated value (₹)",
        data: values,
        borderColor: "#7566e8",
        backgroundColor: "rgba(117,102,232,.10)",
        fill: true,
        borderWidth: 2,
        tension: .3,
        pointRadius: months > 24 ? 0 : 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9697aa", maxTicksLimit: 7 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: {
          color: "#9697aa",
          callback: (value) => "₹" + Number(value).toLocaleString("en-IN"),
        }, grid: { color: "#f0eff7" } },
      },
    },
  });
  card.style.height = "260px";
  chartInstances.push(instance);
}

async function loadConversations() {
  const { data, error } = await supabaseClient
    .from("conversations")
    .select("id,title,messages,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Could not load chat history:", error);
    const list = $("history-list");
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = error.code === "42P01"
      ? "Run the Supabase database setup SQL to enable history."
      : "Chat history is temporarily unavailable.";
    list.append(empty);
    $("history-count").textContent = "0";
    return;
  }
  conversations = data || [];
  renderHistory();
}

async function openConversation(id) {
  const conversation = conversations.find((item) => item.id === id);
  if (!conversation) return;
  activeConversationId = id;
  $("conversation-title").textContent = conversation.title || "Your conversation";
  renderMessages(conversation.messages || []);
  renderHistory();
}

async function deleteConversation(id) {
  if (!window.confirm("Delete this conversation from your history?")) return;
  const { error } = await supabaseClient.from("conversations").delete().eq("id", id);
  if (error) {
    window.alert("Could not delete this conversation. Please try again.");
    console.error("Delete conversation failed:", error);
    return;
  }
  conversations = conversations.filter((item) => item.id !== id);
  if (activeConversationId === id) {
    activeConversationId = null;
    showWelcome();
  }
  renderHistory();
}

function startNewChat() {
  activeConversationId = null;
  showWelcome();
  renderHistory();
  $("input").focus();
}

async function persistMessage(message) {
  if (!currentUser) return false;
  if (!activeConversationId) {
    const title = message.content.replace(/\s+/g, " ").trim().slice(0, 58) || "New conversation";
    const { data, error } = await supabaseClient
      .from("conversations")
      .insert({
        user_id: currentUser.id,
        title,
        messages: [message],
      })
      .select("id,title,messages,created_at,updated_at")
      .single();
    if (error) {
      console.error("Could not create conversation:", error);
      showPersistenceWarning(error);
      return false;
    }
    conversations.unshift(data);
    activeConversationId = data.id;
    $("conversation-title").textContent = title;
    renderHistory();
    return true;
  }

  const existing = conversations.find((item) => item.id === activeConversationId);
  if (!existing) return false;
  const messages = [...(existing.messages || []), message];
  const { data, error } = await supabaseClient
    .from("conversations")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", activeConversationId)
    .select("id,title,messages,created_at,updated_at")
    .single();
  if (error) {
    console.error("Could not save conversation message:", error);
    showPersistenceWarning(error);
    return false;
  }
  Object.assign(existing, data);
  conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  renderHistory();
  return true;
}

function showPersistenceWarning(error) {
  const notice = document.createElement("div");
  notice.className = "inline-notice";
  notice.textContent = error.code === "42P01" || error.code === "PGRST205"
    ? "Chat history is not connected yet. Run the Supabase setup SQL, then refresh."
    : "This message could not be saved to your history. Your current answer can still be viewed.";
  $("messages").append(notice);
}

async function sendMessage(textOverride) {
  const input = $("input");
  const userText = (textOverride || input.value).trim();
  if (!userText || isSending || !currentUser) return;
  isSending = true;
  $("send-button").disabled = true;
  input.value = "";
  input.style.height = "auto";

  const userMessage = { role: "user", content: userText, created_at: new Date().toISOString() };
  appendMessage(userMessage);
  await persistMessage(userMessage);

  const typingNode = appendMessage({ role: "assistant", typing: true });
  $("agent-status").hidden = false;

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.reply) {
      throw new Error(data.error || "FinWise could not process this request. Please try again.");
    }

    const news = data.data?.financialContext?.news;
    const articles = news?.status === "available" && Array.isArray(news.articles) ? news.articles : [];
    const calculation = data.data?.investment?.calculation || null;
    const assistantMessage = {
      role: "assistant",
      content: data.reply,
      articles,
      calculation,
      created_at: new Date().toISOString(),
    };
    typingNode.remove();
    appendMessage(assistantMessage);
    await persistMessage(assistantMessage);
  } catch (error) {
    console.error("FinWise request failed:", error);
    typingNode.remove();
    const errorMessage = {
      role: "assistant",
      content: "I couldn't complete that request. " + (error?.message || "Please try again."),
      created_at: new Date().toISOString(),
    };
    appendMessage(errorMessage);
    await persistMessage(errorMessage);
  } finally {
    $("agent-status").hidden = true;
    isSending = false;
    $("send-button").disabled = false;
    input.focus();
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) return;
  const mode = $("auth-form").dataset.mode;
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const name = $("auth-name").value.trim();
  const submit = $("auth-submit");
  const feedback = $("auth-feedback");
  submit.disabled = true;
  feedback.classList.remove("error");
  feedback.textContent = mode === "signup" ? "Creating your account…" : "Signing you in…";
  try {
    if (mode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      if (data.session) {
        feedback.textContent = "Account created. Opening your workspace…";
        await initializeWorkspace(data.user);
      } else {
        feedback.textContent = "Account created. Check your email to confirm your address, then sign in.";
        setAuthMode("signin");
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await initializeWorkspace(data.user);
    }
  } catch (error) {
    feedback.classList.add("error");
    feedback.textContent = error.message || "Authentication failed. Please try again.";
  } finally {
    submit.disabled = false;
  }
}

async function initializeWorkspace(user) {
  if (!user) return;
  showWorkspace(user);
  conversations = [];
  activeConversationId = null;
  showWelcome();
  await loadConversations();
}

async function initialize() {
  $("auth-mode-toggle").addEventListener("click", () => {
    setAuthMode($("auth-form").dataset.mode === "signup" ? "signin" : "signup");
  });
  $("auth-form").addEventListener("submit", handleAuthSubmit);
  $("new-chat").addEventListener("click", startNewChat);
  $("sign-out").addEventListener("click", async () => {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("Sign out failed:", error);
    showAuth("You have been signed out.");
    setAuthMode("signin");
  });
  $("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  $("input").addEventListener("input", () => {
    const input = $("input");
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  });
  $("input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("chat-form").requestSubmit();
    }
  });
  for (const button of document.querySelectorAll("[data-prompt]")) {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  }

  try {
    const configResponse = await fetch("/config");
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      $("supabase-setup-note").hidden = false;
      throw new Error("Supabase is not connected yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to Render, then redeploy.");
    }
    if (!window.supabase?.createClient) throw new Error("The secure sign-in library could not load. Refresh and try again.");
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data.session?.user) {
      await initializeWorkspace(data.session.user);
    } else {
      showAuth();
    }
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        showAuth();
        return;
      }
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
          session?.user && currentUser?.id !== session.user.id) {
        queueMicrotask(() => initializeWorkspace(session.user));
      }
    });
  } catch (error) {
    showAuth(error.message || "Could not connect to secure sign-in.");
    $("supabase-setup-note").hidden = false;
    $("supabase-setup-note").querySelector("span").textContent =
      "In Render, add SUPABASE_URL and SUPABASE_ANON_KEY. Then run supabase/schema.sql in the Supabase SQL Editor to enable private chat history.";
  }
}

document.addEventListener("DOMContentLoaded", initialize);
