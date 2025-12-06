import React, { useState } from "react";
import { auth, db } from "../../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import "../../main.css";

export default function LoginPage({ onLogin, onRegisterLink }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      console.log("Signed in uid:", uid);

      // 1) Try doc by uid
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      let data = null;
      if (snap.exists()) {
        data = snap.data();
        console.log("Found user doc by uid:", data);
      } else {
        // 2) Not found: try to find a doc by email (older/mismatched doc)
        const q = query(collection(db, "users"), where("email", "==", email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const oldDoc = qSnap.docs[0];
          const oldData = oldDoc.data();
          console.log("Found user doc by email (migrating):", oldDoc.id, oldData);

          // Copy into users/<uid>
          await setDoc(userRef, oldData);

          // Optional: delete old doc to avoid duplicates (uncomment if you want)
          // await deleteDoc(doc(db, "users", oldDoc.id));

          data = oldData;
          console.log("Migration complete — user doc copied to users/" + uid);
        } else {
          console.warn("No user doc found by uid or email. Falling back to email inference.");
        }
      }

      // 3) Resolve role
      let role = data?.role;
      if (!role) {
        // fallback inference
        const lower = (email || "").toLowerCase();
        if (lower.includes("driver")) role = "Driver";
        else if (lower.includes("parent")) role = "Parent";
        else if (lower.includes("admin")) role = "Admin";
        else role = "Student";
        console.warn("Using fallback role:", role);
      }

      // Normalize role string
      role = String(role).trim();
      role = role.length ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : role;

      console.log("Resolved role:", role);
      onLogin && onLogin(role);
    } catch (err) {
      console.error("Login failed:", err);
      alert(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Sign in</h1>
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
      <button className="btn" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      <div style={{marginTop:12}}>
        <button type="button" className="link" onClick={() => onRegisterLink && onRegisterLink()}>Create one</button>
      </div>
    </form>
  );
}