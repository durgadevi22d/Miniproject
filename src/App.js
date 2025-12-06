// src/App.js
import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs, setDoc } from "firebase/firestore";

import LoginPage from "./components/Auth/LoginPage";
import RegisterPage from "./components/Auth/RegisterPage";
import StudentDashboard from "./components/Dashboard/StudentDashboard";
import DriverDashboard from "./components/Dashboard/DriverDashboard";
import ParentDashboard from "./components/Dashboard/ParentDashboard";
import AdminDashboard from "./components/Dashboard/AdminDashboard";

import "./index.css";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null); // Firestore user document data
  const [authUser, setAuthUser] = useState(null); // Firebase Auth user object
  const [showRegister, setShowRegister] = useState(false);

  // listen for auth changes and load user's Firestore doc
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthUser(user);
      if (!user) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      try {
        // try to load users/<uid>
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUserDoc({ uid: user.uid, ...snap.data() });
        } else {
          // Attempt migration: find existing doc by email and copy to users/<uid>
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const old = qSnap.docs[0];
            const oldData = old.data();
            // copy to users/<uid>
            await setDoc(userRef, oldData);
            setUserDoc({ uid: user.uid, ...oldData });
            // optionally you could delete old doc, but keep it for safety
          } else {
            // no doc found — set userDoc to a minimal object so UI can proceed
            const fallback = { uid: user.uid, name: user.displayName || "", email: user.email, role: "Student" };
            setUserDoc(fallback);
            // optionally write fallback document:
            // await setDoc(userRef, fallback);
          }
        }
      } catch (err) {
        console.error("Failed to load user doc:", err);
        setUserDoc(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  function handleLogout() {
    // simple client-side logout
    auth.signOut().catch((e) => console.error("Sign out error:", e));
  }

  if (loading) return <div className="center">Loading…</div>;

  // not signed in -> show login / register UI
  if (!authUser) {
    return (
      <div className="app-root">
        {!showRegister && (
          <LoginPage onRegisterLink={() => setShowRegister(true)} />
        )}
        {showRegister && (
          <RegisterPage onGoToLogin={() => setShowRegister(false)} />
        )}
      </div>
    );
  }

  // Signed in: render role-specific dashboard and pass userDoc
  const role = (userDoc?.role || "").toString().toLowerCase();

  return (
    <div className="app-root">
      <header style={{ width: "100%", maxWidth: 900, margin: "12px auto 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>AI Enabled Smart Bus System</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "#555" }}>{userDoc?.name || userDoc?.email}</div>
          <button className="btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
        {role === "student" && <StudentDashboard user={userDoc} />}
        {role === "driver" && <DriverDashboard user={userDoc} />}
        {role === "parent" && <ParentDashboard user={userDoc} />}
        {role === "admin" && <AdminDashboard user={userDoc} />}

        {!["student","driver","parent","admin"].includes(role) && (
          <div style={{ padding: 24 }}>
            <h2>Welcome</h2>
            <pre>{JSON.stringify(userDoc, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}