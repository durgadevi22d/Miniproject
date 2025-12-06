import React, { useEffect } from "react";
import "../../main.css";

export default function Splash({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof onComplete === "function") onComplete();
    }, 2000); // keep splash for 2s then call onComplete

    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="card" style={{ textAlign: "center", maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>AI Enabled Smart Bus System</h1>
      <p className="muted">Loading — you will be taken to the login screen shortly.</p>
      <button
        className="btn"
        style={{ maxWidth: 240, margin: "12px auto 0" }}
        onClick={() => typeof onComplete === "function" && onComplete()}
      >
        Enter now
      </button>
    </div>
  );
}