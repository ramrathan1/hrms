import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { hydrate, onSignedOut } from "./lib/api";
import { ToastProvider } from "./lib/store";
import { TimerProvider } from "./lib/timer";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

const render = () =>
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <TimerProvider>
            <App />
          </TimerProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
  );

/* If the refresh token is rejected mid-session there is nothing left to render
   against, so send the user to sign in rather than leaving stale rows on screen
   that every subsequent write will fail against. */
onSignedOut(() => {
  try {
    localStorage.removeItem("ws.auth");
  } catch {
    /* storage unavailable */
  }
  if (window.location.pathname !== "/login") window.location.assign("/login");
});

/* The first paint waits on the initial load so pages don't flash seed data and
   then swap it for the real thing. The boot markup in index.html covers the gap. */
void hydrate().finally(render);
