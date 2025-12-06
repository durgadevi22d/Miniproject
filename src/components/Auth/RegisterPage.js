// src/components/Auth/RegisterPage.js
import React, { useState } from "react";
import { auth, db } from "../../firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import "../../index.css";

export default function RegisterPage({ onGoToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [extra, setExtra] = useState(""); // seat/regno/contact depending on role
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Build minimal user doc depending on role
      const base = {
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      if (role === "student") {
        base.regno = extra || "";
        base.busNumber = "";
        base.route = "";
      } else if (role === "parent") {
        base.contact = extra || "";
        base.childRegNoInput = "";
      } else if (role === "driver") {
        base.driverId = extra || "";
        base.busNumber = "";
        base.route = "";
      } else if (role === "admin") {
        // nothing extra
      }

      // write to users/<uid>
      await setDoc(doc(db, "users", uid), base);

      alert("Account created — please sign in.");
      onGoToLogin && onGoToLogin();
    } catch (err) {
      console.error("Registration error:", err);
      alert(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 520, margin: "12px auto", background: "#fff", padding: 18, borderRadius: 8 }}>
      <h2>Create account</h2>
      <input className="input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required />
      <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <label style={{ display: "block", margin: "8px 0" }}>
        Role:
        <select value={role} onChange={e=>setRole(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="student">Student</option>
          <option value="parent">Parent</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <div style={{ marginBottom: 8 }}>
        {role === "student" && <input className="input" placeholder="Registration number" value={extra} onChange={e=>setExtra(e.target.value)} />}
        {role === "parent" && <input className="input" placeholder="Contact number" value={extra} onChange={e=>setExtra(e.target.value)} />}
        {role === "driver" && <input className="input" placeholder="Driver ID (or leave blank)" value={extra} onChange={e=>setExtra(e.target.value)} />}
      </div>

      <button className="btn" type="submit" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="link" onClick={() => onGoToLogin && onGoToLogin()}>Back to Login</button>
      </div>
    </form>
  );
}