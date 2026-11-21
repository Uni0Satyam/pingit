(function () {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute("data-user-id");
  const chatbotId = scriptTag.getAttribute("data-chatbot-id");
  const supportEmail = scriptTag.getAttribute("data-business-email") || "";
  const businessName = scriptTag.getAttribute("data-business-name") || "Customer Support";
  const primaryColor = scriptTag.getAttribute("data-primary-color") || "#000000";
  const welcomeMessage = scriptTag.getAttribute("data-welcome-message") || "Hello! How can we help you today?";
  const hideBranding = scriptTag.getAttribute("data-hide-branding") === "true";
  const widgetUrl = new URL("/", scriptTag.src);
  const apiUrl = new URL("/api/chat", widgetUrl).href;
  const brandUrl = widgetUrl.href;
  const visitorStorageKey = `pingit:visitor:${chatbotId}`;

  if (!userId || !chatbotId) {
    console.error("Pingit: Both 'data-user-id' and 'data-chatbot-id' are required on the script tag.");
    return;
  }

  let messageHistory = [];
  let visitorId;
  try {
    visitorId =
      sessionStorage.getItem(visitorStorageKey) ||
      (typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem(visitorStorageKey, visitorId);
  } catch (error) {
    console.warn("Pingit: Could not persist visitor session ID.", error);
    visitorId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // 1. Create Floating Toggle Button
  const button = document.createElement("div");
  button.id = "pingit-chat-toggle";
  button.innerHTML = "💬";

  Object.assign(button.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: primaryColor,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "24px",
    boxShadow: "0 15px 40px rgba(0, 0, 0, 0.35)",
    zIndex: "2147483647", // Max safe standard z-index value to stay on top
    transition: "transform 0.2s ease-in-out",
    boxSizing: "border-box"
  });

  document.body.appendChild(button);

  // 2. Create Main Chat Box Popup Window Container
  const box = document.createElement("div");
  box.id = "pingit-chat-box";
  Object.assign(box.style, {
    position: "fixed",
    bottom: "94px",
    right: "24px",
    width: "340px",
    height: "460px",
    borderRadius: "14px",
    background: "#ffffff",
    display: "none", // Starts hidden safely
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 15px 40px rgba(0, 0, 0, 0.25)",
    zIndex: "2147483647",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    border: "1px solid #e4e4e7",
    boxSizing: "border-box"
  });

  const responsiveStyles = document.createElement("style");
  responsiveStyles.textContent = `
    @media (max-width: 480px) {
      #pingit-chat-toggle {
        right: 16px !important;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
      }

      #pingit-chat-box {
        right: 12px !important;
        bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important;
        width: calc(100vw - 24px) !important;
        height: min(520px, calc(100dvh - 108px - env(safe-area-inset-bottom, 0px))) !important;
        max-height: calc(100dvh - 108px - env(safe-area-inset-bottom, 0px)) !important;
        min-height: min(220px, calc(100dvh - 108px - env(safe-area-inset-bottom, 0px))) !important;
      }

      #pingit-chat-box #chat-input {
        font-size: 16px !important;
      }
    }

    @media (max-width: 480px) and (max-height: 500px) {
      #pingit-chat-box {
        bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important;
        height: calc(100dvh - 84px - env(safe-area-inset-bottom, 0px)) !important;
        max-height: calc(100dvh - 84px - env(safe-area-inset-bottom, 0px)) !important;
        min-height: min(220px, calc(100dvh - 84px - env(safe-area-inset-bottom, 0px))) !important;
      }
    }
  `;
  document.head.appendChild(responsiveStyles);

  // Inject structural template HTML layouts
  box.innerHTML = `
    <div id="chat-header" style="background:#000000; color:#ffffff; padding:14px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; box-sizing:border-box; width:100%; border-bottom:1px solid #27272a;">
      <div style="display:flex; align-items:center; gap:8px; box-sizing:border-box;">
        <span style="width:8px; height:8px; background:#22c55e; border-radius:50%; display:inline-block;"></span>
        <span id="chat-title" style="color:#ffffff; font-family:inherit;"></span>
      </div>
      <span id="chat-close" style="cursor:pointer; font-size:16px; font-weight:normal; opacity:0.8; padding:2px 6px; user-select:none; color:#ffffff;">✕</span>
    </div>
    
    <div id="chat-messages" style="flex:1; min-height:0; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:#f9f9f9; font-size:13.5px; line-height:1.4; box-sizing:border-box; width:100%;">
      <div id="chat-welcome" style="align-self:flex-start; background:#f4f4f5; color:#09090b; padding:8px 12px; border-radius:12px 12px 12px 2px; max-width:80%; box-sizing:border-box; font-family:inherit; word-break:break-word; clear:both;">
      </div>
    </div>

    <form id="chat-form" style="display:flex; padding:12px; border-top:1px solid #e4e4e7; background:#ffffff; gap:8px; margin:0; box-sizing:border-box; width:100%; align-items:center;">
      <input type="text" id="chat-input" placeholder="Type a message..." required style="flex:1; padding:8px 12px; border:1px solid #e4e4e7; border-radius:8px; font-size:13.5px; outline:none; background:#ffffff; color:#000000; font-family:inherit; box-sizing:border-box; height:36px; min-width:0;" />
      <button id="chat-send" type="submit" style="background:#000000; color:#ffffff; border:none; padding:0 16px; border-radius:8px; font-size:13.5px; cursor:pointer; font-weight:500; font-family:inherit; box-sizing:border-box; height:36px; display:inline-flex; align-items:center; justify-content:center;">Send</button>
    </form>

    <div id="pingit-brand-footer" style="padding:6px 12px 8px; border-top:1px solid #f4f4f5; background:#ffffff; text-align:center; color:#71717a; font-size:10px; line-height:1.4; box-sizing:border-box;">
      Powered by <a href="${brandUrl}" target="_blank" rel="noopener noreferrer" style="color:#18181b; font-weight:600; text-decoration:none;">pingit</a>
    </div>
  `;

  document.body.appendChild(box);
  const brandFooter = box.querySelector("#pingit-brand-footer");
  if (hideBranding) brandFooter.style.display = "none";

  // 3. Cache Element References
  const chatMessages = box.querySelector("#chat-messages");
  const chatForm = box.querySelector("#chat-form");
  const chatInput = box.querySelector("#chat-input");
  const chatClose = box.querySelector("#chat-close");
  const chatHeader = box.querySelector("#chat-header");
  const chatTitle = box.querySelector("#chat-title");
  const chatWelcome = box.querySelector("#chat-welcome");
  const chatSend = box.querySelector("#chat-send");
  chatHeader.style.backgroundColor = primaryColor;
  chatSend.style.backgroundColor = primaryColor;
  chatTitle.textContent = businessName;
  chatWelcome.textContent = welcomeMessage;

  function appendMessage(text, isUser = false) {
    const msgDiv = document.createElement("div");
    Object.assign(msgDiv.style, {
      alignSelf: isUser ? "flex-end" : "flex-start",
      background: isUser ? primaryColor : "#efefef",
      color: isUser ? "#ffffff" : "#000000",
      padding: "8px 12px",
      borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
      maxWidth: "80%",
      wordBreak: "break-word",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      boxSizing: "border-box",
      fontFamily: "inherit",
      clear: "both"
    });
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }

  // 4. Open / Close Layout Actions Pipeline
  button.addEventListener("click", () => {
    if (box.style.display === "none") {
      box.style.display = "flex";
      button.style.transform = "scale(0)"; 
      setTimeout(() => chatInput.focus(), 100);
    }
  });

  chatClose.addEventListener("click", () => {
    box.style.display = "none";
    button.style.transform = "scale(1)"; 
  });

  // 5. Inbound Form Submit Engine Execution Pipeline
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    appendMessage(text, true);

    messageHistory.push({
      role: "user",
      parts: [{ text: text }],
    });

    const loadingDiv = document.createElement("div");
    loadingDiv.innerText = "Typing...";
    Object.assign(loadingDiv.style, {
      alignSelf: "flex-start",
      color: "#71717a",
      fontSize: "12px",
      fontStyle: "italic",
      padding: "4px 12px",
      boxSizing: "border-box",
      fontFamily: "inherit"
    });
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId, 
          chatbotId: chatbotId,
          visitorId: visitorId,
          messageHistory: messageHistory,
        }),
      });

      chatMessages.removeChild(loadingDiv);

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const fallbackMessage =
          response.status === 402
            ? supportEmail
              ? `This assistant is temporarily unable to answer. Please contact support at ${supportEmail}.`
              : "This assistant is temporarily unable to answer. Please contact the website owner for help."
            : result.message || "Sorry, I am having trouble connecting to the system right now.";
        appendMessage(fallbackMessage, false);
        return;
      }

      if (!response.body) throw new Error("The chat response could not be streamed.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessage = appendMessage("", false);
      let pending = "";
      let botReply = "";
      let streamCompleted = false;
      let streamFailed = false;

      function handleStreamFrame(frame) {
        const dataLine = frame
          .replaceAll("\r", "")
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) return;
        let event;
        try {
          event = JSON.parse(dataLine.slice(5).trim());
        } catch {
          return;
        }

        if (event.type === "delta" && typeof event.text === "string") {
          botReply += event.text;
          assistantMessage.innerText = botReply;
        } else if (event.type === "replace" && typeof event.text === "string") {
          botReply = event.text;
          assistantMessage.innerText = botReply;
        } else if (event.type === "error") {
          streamFailed = true;
        } else if (event.type === "done") {
          streamCompleted = true;
          if (event.brandingRemovalActive && brandFooter) {
            brandFooter.style.display = "none";
          }
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        let frameBoundary = pending.indexOf("\n\n");
        while (frameBoundary !== -1) {
          handleStreamFrame(pending.slice(0, frameBoundary));
          pending = pending.slice(frameBoundary + 2);
          frameBoundary = pending.indexOf("\n\n");
        }
        if (done) {
          if (pending.trim()) handleStreamFrame(pending);
          break;
        }
      }

      if (!streamCompleted || streamFailed) {
        assistantMessage.innerText =
          "Sorry, I am having trouble connecting to the system right now. Please try again.";
        return;
      }
      if (botReply) {
        messageHistory.push({
          role: "model",
          parts: [{ text: botReply }],
        });
      }
    } catch (error) {
      console.error("Widget Network Error:", error);
      if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
      appendMessage("Connection error. Please check your network connection.", false);
    }
  });
})();
