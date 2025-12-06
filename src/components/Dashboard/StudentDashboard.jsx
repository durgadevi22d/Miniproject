import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * StudentDashboard
 *
 * - Shows a centered dashboard with student's name at the top.
 * - Displays a horizontal list of student names (visible for multi-user / family view).
 * - Clicking a name selects that student and shows their transport details.
 * - Shows boarding and deboarding times (formatted).
 * - Renders a QR code containing the student's transport payload.
 *
 * Usage:
 * - <StudentDashboard /> -> uses builtin mock data
 * - <StudentDashboard students={myStudentsArray} /> -> uses provided students array
 *
 * Student object shape (example):
 * {
 *   uid: "s1",
 *   name: "Aarav Anand",
 *   regno: "STU101",
 *   busNumber: "Bus 12",
 *   route: "Velachery → OMR → College",
 *   boardingPoint: "Velachery Signal",
 *   feeStatus: "paid" | "unpaid",
 *   boardingTime: "2025-11-28T07:45:00.000Z",
 *   deboardingTime: "2025-11-28T09:15:00.000Z"
 * }
 */

const MOCK_STUDENTS = [
  {
    uid: "s1",
    name: "Durgadevi P",
    regno: "RA22123456789",
    busNumber: "Bus 12",
    route: "Velachery → OMR → College",
    boardingPoint: "Velachery Signal",
    feeStatus: "paid",
    boardingTime: new Date().toISOString().replace(/\.\d+Z$/, "Z"), // now-ish
    deboardingTime: new Date(Date.now() + 90 * 60000).toISOString().replace(/\.\d+Z$/, "Z"), // +90m
  },
  {
    uid: "s2",
    name: "Aarav Anand",
    regno: "STU101",
    busNumber: "Bus 12",
    route: "Velachery → OMR → College",
    boardingPoint: "Velachery Signal",
    feeStatus: "paid",
    boardingTime: new Date(Date.now() - 30 * 60000).toISOString().replace(/\.\d+Z$/, "Z"), // -30m
    deboardingTime: new Date(Date.now() + 60 * 60000).toISOString().replace(/\.\d+Z$/, "Z"), // +60m
  },
  {
    uid: "s3",
    name: "Diya Verma",
    regno: "STU102",
    busNumber: "Bus 14",
    route: "Tambaram → OMR → College",
    boardingPoint: "Tambaram Bus Stop",
    feeStatus: "unpaid",
    boardingTime: new Date(Date.now() - 5 * 60000).toISOString().replace(/\.\d+Z$/, "Z"),
    deboardingTime: new Date(Date.now() + 80 * 60000).toISOString().replace(/\.\d+Z$/, "Z"),
  },
];

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    // Format: 28 Nov 2025, 08:00 AM
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function StudentDashboard({ students: propStudents, onLogout }) {
  const [students, setStudents] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    // Priority: propStudents -> try fetch /api/students -> fallback to MOCK
    if (Array.isArray(propStudents) && propStudents.length > 0) {
      setStudents(propStudents);
      setSelectedIdx(0);
      return;
    }

    let mounted = true;

    async function tryFetch() {
      try {
        const resp = await fetch("/api/students");
        if (!resp.ok) throw new Error("no api");
        const json = await resp.json();
        if (mounted && Array.isArray(json) && json.length > 0) {
          setStudents(json);
          setSelectedIdx(0);
          return;
        }
      } catch {
        // ignore, fallback to mock
      }
      if (mounted) {
        setStudents(MOCK_STUDENTS);
        setSelectedIdx(0);
      }
    }

    tryFetch();

    return () => {
      mounted = false;
    };
  }, [propStudents]);

  if (!students || students.length === 0) return null;

  const student = students[selectedIdx];

  const qrPayload = {
    uid: student.uid,
    name: student.name,
    regno: student.regno,
    busNumber: student.busNumber,
    route: student.route,
    boardingPoint: student.boardingPoint,
    boardingTime: student.boardingTime,
    deboardingTime: student.deboardingTime,
    feeStatus: student.feeStatus,
  };

  function handleLogoutClick() {
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      // default: clear mock local storage and reload
      localStorage.removeItem("userName");
      window.location.reload();
    }
  }

  return (
    <div style={styles.bg}>
      {/* Top header: name centered, logout on right */}
      <header style={styles.header}>
        <div style={styles.headerLeft}></div>
        <div style={styles.headerCenter}>
          <div style={styles.appTitle}>Student Transport Dashboard</div>
          <div style={styles.selectedName}>{student.name}</div>
          <div style={styles.selectedReg}>Reg No: <strong>{student.regno}</strong></div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.logoutBtn} onClick={handleLogoutClick}>Logout</button>
        </div>
      </header>

      {/* Student selector chips centered */}
      <div style={styles.chipsWrap}>
        <div style={styles.chips}>
          {students.map((s, i) => (
            <button
              key={s.uid}
              onClick={() => setSelectedIdx(i)}
              style={{
                ...styles.chip,
                ...(i === selectedIdx ? styles.chipActive : {}),
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main card area centered */}
      <main style={styles.mainCardWrap}>
        <div style={styles.card}>
          <div style={styles.cardRow}>
            <div style={styles.cardCol}>
              <div style={styles.detailRow}><span style={styles.key}>Assigned Bus:</span><span style={styles.value}>{student.busNumber}</span></div>
              <div style={styles.detailRow}><span style={styles.key}>Route:</span><span style={styles.value}>{student.route}</span></div>
              <div style={styles.detailRow}><span style={styles.key}>Boarding Point:</span><span style={styles.value}>{student.boardingPoint}</span></div>
              <div style={styles.detailRow}><span style={styles.key}>Transport Fee:</span>
                <span style={{...styles.feeBadge, ...(student.feeStatus === "paid" ? styles.feePaid : styles.feeUnpaid)}}>
                  {student.feeStatus?.toUpperCase() || "—"}
                </span>
              </div>
              <div style={styles.detailRow}><span style={styles.key}>Boarding Time:</span><span style={styles.value}>{formatDateTime(student.boardingTime)}</span></div>
              <div style={styles.detailRow}><span style={styles.key}>Deboarding Time:</span><span style={styles.value}>{formatDateTime(student.deboardingTime)}</span></div>
            </div>

            <div style={styles.qrCol}>
              <div style={styles.qrTitle}>Scan this QR for Boarding</div>
              <div style={styles.qrBox}>
                <QRCodeSVG
                  value={JSON.stringify(qrPayload)}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0b5cff"
                />
              </div>
              <div style={styles.qrNote}>Show this to the driver/staff while boarding</div>
            </div>
          </div>
        </div>
      </main>
      <style>{responsiveCss}</style>
    </div>
  );
}

/* Inline styles */
const styles = {
  bg: {
    minHeight: "100vh",
    background: "#f6f7fa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    padding: "18px 12px 40px 12px",
    boxSizing: "border-box",
  },
  header: {
    width: "100%",
    maxWidth: 980,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    boxSizing: "border-box",
  },
  headerLeft: { flex: 1 },
  headerCenter: {
    flex: 2,
    textAlign: "center",
  },
  headerRight: {
    flex: 1,
    display: "flex",
    justifyContent: "flex-end",
  },
  appTitle: {
    fontSize: 14,
    color: "#4b5563",
    fontWeight: 600,
  },
  selectedName: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0b3f7a",
    marginTop: 4,
  },
  selectedReg: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  logoutBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  chipsWrap: {
    width: "100%",
    maxWidth: 980,
    display: "flex",
    justifyContent: "center",
    marginBottom: 18,
  },
  chips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    padding: "8px 12px",
    borderRadius: 20,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    color: "#374151",
  },
  chipActive: {
    background: "#e6f0ff",
    borderColor: "#60a5fa",
    color: "#0b4ea2",
  },
  mainCardWrap: {
    width: "100%",
    maxWidth: 980,
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    borderRadius: 12,
    padding: 20,
    background: "#fff",
    boxShadow: "0 8px 30px rgba(8, 39, 79, 0.06)",
    boxSizing: "border-box",
  },
  cardRow: {
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardCol: { flex: 1, minWidth: 260 },
  qrCol: {
    width: 260,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  qrTitle: { fontWeight: 700, marginBottom: 8, color: "#0b3f7a", textAlign: "center" },
  qrBox: {
    background: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  qrNote: { fontSize: 12, color: "#6b7280", textAlign: "center" },
  detailRow: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  key: { color: "#6b7280", fontWeight: 600, marginRight: 8 },
  value: { color: "#111827", fontWeight: 700 },
  feeBadge: {
    padding: "6px 10px",
    borderRadius: 8,
    display: "inline-block",
    marginLeft: 8,
    fontWeight: 800,
  },
  feePaid: { background: "#d1fae5", color: "#065f46" },
  feeUnpaid: { background: "#fee2e2", color: "#9f1239" },
};

/* small responsive CSS string for media queries */
const responsiveCss = `
  @media (max-width: 880px) {
    .student-dashboard-hide-on-mobile { display: none; }
  }
  @media (max-width: 720px) {
    /* stack card columns */
    div[style*="display: flex"][style*="gap: 20px"] {
      flex-direction: column !important;
    }
    /* center header text a bit smaller */
    .student-dashboard-small-header { font-size: 16px !important; }
  }
`;