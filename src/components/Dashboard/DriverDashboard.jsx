import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * DriverDashboard.jsx
 *
 * Improvements in this version:
 * - Layout centered and responsive (scanner + attendance sit in a centered card).
 * - Scanner region centered and sized consistently.
 * - QR parsing is tolerant to a few common key names (bus/busNumber/assignedBus, route/routeName).
 * - Speed calculation ignores tiny timestamp differences and clamps unrealistic speeds.
 * - Better user messages and QR preview for debugging.
 *
 * Requirements:
 * - html5-qrcode package installed (npm i html5-qrcode)
 * - This component uses plain CSS classes; if you use Tailwind that's fine, otherwise the inline styles will work.
 */

 // --- Helper: Haversine distance (km) ---
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function movingAverage(arr, N) {
  if (arr.length === 0) return 0;
  const len = Math.min(N, arr.length);
  return arr.slice(-len).reduce((sum, v) => sum + v, 0) / len;
}

// --- Mock data (replace with real APIs) ---
const MOCK_DRIVER = {
  name: "Ramesh Kumar",
  driverId: "DRV-100563",
  busNumber: "Bus 12",
  route: "Velachery → OMR → College"
};

const MOCK_BUSES = [
  { busNumber: "Bus 10", route: "Velachery → OMR → College", currentOccupancy: 48, capacity: 60, eta: 3 },
  { busNumber: "Bus 11", route: "Velachery → GST → College", currentOccupancy: 55, capacity: 60, eta: 8 },
  { busNumber: "Bus 12", route: "Velachery → OMR → College", currentOccupancy: 0, capacity: 60, eta: 0 }, // This bus
  { busNumber: "Bus 16", route: "Velachery → OMR → College", currentOccupancy: 30, capacity: 60, eta: 7 },
  { busNumber: "Bus 18", route: "Adyar → OMR → College", currentOccupancy: 59, capacity: 60, eta: 5 }
];

// Simple fleet helpers
function getFleetSnapshot(route, excludeBus = null) {
  return MOCK_BUSES.filter(b => b.route === route && b.busNumber !== excludeBus);
}
function getBestAlternativeBus(route, excludeBus = null) {
  const candidates = getFleetSnapshot(route, excludeBus)
    .filter(bus => bus.currentOccupancy < bus.capacity);
  if (!candidates.length) return null;
  candidates.sort((a, b) =>
    (b.capacity - b.currentOccupancy) - (a.capacity - a.currentOccupancy)
    || a.eta - b.eta
  );
  return candidates[0];
}

// Mock GPS path (replace with real GPS updates)
const MOCK_GPS_POINTS = [
  { lat: 12.917, lng: 80.225 },
  { lat: 12.919, lng: 80.229 },
  { lat: 12.922, lng: 80.241 },
  { lat: 12.926, lng: 80.247 },
  { lat: 12.929, lng: 80.258 },
  { lat: 12.933, lng: 80.262 },
];

export default function DriverDashboard() {
  const [attendance, setAttendance] = useState([]);
  const [scannerMsg, setScannerMsg] = useState("");
  const capacity = MOCK_BUSES.find(b => b.busNumber === MOCK_DRIVER.busNumber)?.capacity ?? 60;
  const [occupancy, setOccupancy] = useState(0);
  const [manualQR, setManualQR] = useState("");
  const [scanning, setScanning] = useState(false);
  const html5QrCodeRef = useRef(null);
  const isRunningRef = useRef(false);
  const qrRegionId = "qr-reader-region";

  // GPS & speed
  const [gpsPoints, setGpsPoints] = useState([]); // {lat,lng,timestamp}
  const [busSpeed, setBusSpeed] = useState(null);

  // QR preview for debugging
  const [lastParsed, setLastParsed] = useState(null);

  // tolerant parsing helpers - check multiple common key names
  function getField(obj, names) {
    for (const n of names) {
      if (Object.prototype.hasOwnProperty.call(obj, n)) return obj[n];
      // also check case-insensitive
      const key = Object.keys(obj).find(k => k.toLowerCase() === n.toLowerCase());
      if (key) return obj[key];
    }
    return undefined;
  }

  function tryAddStudent(qrString) {
    let student;
    try {
      student = JSON.parse(qrString);
    } catch (err) {
      setScannerMsg("⚠️ Invalid QR JSON");
      setLastParsed(null);
      return;
    }
    setLastParsed(student);

    // support multiple field names
    const busVal = getField(student, ["bus", "busNumber", "assignedBus"]);
    const routeVal = getField(student, ["route", "routeName"]);
    const regnoVal = getField(student, ["regno", "regNo", "reg_number", "registration"]);
    const nameVal = getField(student, ["name", "studentName", "fullName"]);

    if (!regnoVal || !nameVal) {
      setScannerMsg("⚠️ QR JSON missing regno or name");
      return;
    }

    if ((busVal && busVal !== MOCK_DRIVER.busNumber) || (routeVal && routeVal !== MOCK_DRIVER.route)) {
      setScannerMsg(`⚠️ This student assigned to ${busVal ?? "unknown"} (${routeVal ?? "unknown"})`);
      return;
    }

    if (attendance.find(a => a.regno === regnoVal)) {
      setScannerMsg(`Already scanned: ${nameVal} (${regnoVal})`);
      return;
    }

    if (occupancy >= capacity) {
      const bestBus = getBestAlternativeBus(MOCK_DRIVER.route, MOCK_DRIVER.busNumber);
      if (bestBus) {
        setScannerMsg(`Bus full. Try ${bestBus.busNumber} — ${bestBus.capacity - bestBus.currentOccupancy} seats free — ETA ${bestBus.eta} min`);
      } else {
        setScannerMsg("Bus full. No alternatives available.");
      }
      return;
    }

    const newEntry = {
      name: nameVal,
      regno: regnoVal,
      boardingPoint: getField(student, ["boardingPoint", "boarding_point", "stop"]) || "Unknown",
      time: new Date().toLocaleTimeString()
    };
    setAttendance(prev => [...prev, newEntry]);
    setOccupancy(prev => prev + 1);
    setScannerMsg(`✅ ${nameVal} boarded — seats left: ${capacity - (occupancy + 1)}`);
  }

  // Start/stop QR scanner
  useEffect(() => {
    if (!scanning) {
      if (html5QrCodeRef.current && isRunningRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => { isRunningRef.current = false; })
          .catch(() => {});
      }
      html5QrCodeRef.current = null;
      return;
    }

    const qr = new Html5Qrcode(qrRegionId);
    html5QrCodeRef.current = qr;
    isRunningRef.current = false;

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 260 } },
      qrString => {
        tryAddStudent(qrString);
        // stop briefly to avoid repeated scans of same QR
        if (html5QrCodeRef.current && isRunningRef.current) {
          html5QrCodeRef.current.pause(true);
          setTimeout(() => {
            try { html5QrCodeRef.current?.resume(); } catch {}
          }, 1200);
        }
      },
      error => {
        // ignore frame decode errors
      }
    )
      .then(() => { isRunningRef.current = true; })
      .catch(err => {
        setScannerMsg("Camera error or permission denied");
        setScanning(false);
      });

    return () => {
      if (html5QrCodeRef.current && isRunningRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => { isRunningRef.current = false; })
          .catch(() => {});
      }
      html5QrCodeRef.current = null;
    };
    // eslint-disable-next-line
  }, [scanning]);

  // Mock GPS updates (replace with real location listener in production)
  useEffect(() => {
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % MOCK_GPS_POINTS.length;
      setGpsPoints(prev => {
        const next = [...prev.slice(-2), { ...MOCK_GPS_POINTS[idx], timestamp: Date.now() }];
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Calculate speed: only when delta >= 3 sec and clamp unrealistic
  useEffect(() => {
    if (gpsPoints.length < 2) {
      setBusSpeed(null);
      return;
    }
    const speeds = [];
    for (let i = 1; i < gpsPoints.length; i++) {
      const p1 = gpsPoints[i - 1], p2 = gpsPoints[i];
      if (!p1 || !p2 || !p1.timestamp || !p2.timestamp) continue;
      const deltaSec = (p2.timestamp - p1.timestamp) / 1000;
      if (deltaSec < 2) continue; // ignore too-frequent samples
      const deltaT = deltaSec / 3600; // hours
      if (!deltaT) continue;
      const dist = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng); // km
      let spd = dist / deltaT; // km/h
      if (!isFinite(spd) || isNaN(spd)) continue;
      // clamp extreme values ( > 200 km/h considered noise )
      if (spd > 200) spd = 200;
      speeds.push(spd);
    }
    if (!speeds.length) {
      setBusSpeed(null);
      return;
    }
    const avg = movingAverage(speeds, 3);
    // final clamp and rounding
    const final = Math.max(0, Math.min(200, avg));
    setBusSpeed(Number(final.toFixed(1)));
  }, [gpsPoints]);

  const latestPoint = gpsPoints.length ? gpsPoints[gpsPoints.length - 1] : null;
  let speedText = "--";
  if (!latestPoint) speedText = "No GPS data yet";
  else if (busSpeed === null) speedText = "Calculating…";
  else speedText = busSpeed < 1 ? "<1 km/h" : `${busSpeed} km/h`;

  // manual submit handler
  function handleManualSubmit() {
    tryAddStudent(manualQR);
    setManualQR("");
  }

  // small responsive wrapper styles (keeps content centered)
  const wrapperStyle = {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#ecfdf5 0%, #eff6ff 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box"
  };
  const containerStyle = {
    width: "100%",
    maxWidth: 1100,
    display: "flex",
    flexDirection: "column",
    gap: 18
  };
  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(90deg,#059669,#10b981)",
    color: "white",
    padding: "14px 18px",
    borderRadius: 12,
    boxShadow: "0 6px 24px rgba(2,6,23,0.08)"
  };
  const cardRowStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 18
  };
  const cardStyle = {
    background: "white",
    padding: 18,
    borderRadius: 12,
    boxShadow: "0 6px 18px rgba(10,20,40,0.05)"
  };
  const qrBoxStyle = { width: 300, height: 300, margin: "0 auto", borderRadius: 12, overflow: "hidden", background: "#f3faf7", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div style={wrapperStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{MOCK_DRIVER.name}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Driver ID: <strong>{MOCK_DRIVER.driverId}</strong></div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Bus: <strong>{MOCK_DRIVER.busNumber}</strong> • Route: <strong>{MOCK_DRIVER.route}</strong></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ background: "#ffffffcc", color: "#065f46", padding: "6px 10px", borderRadius: 10, fontWeight: 700 }}>Speed: {speedText}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.95)" }}>Seats: <strong>{capacity - occupancy}</strong> / {capacity}</div>
          </div>
        </header>

        {/* Main row: Scanner + Attendance */}
        <div style={cardRowStyle}>
          <div style={cardStyle}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>QR Scanner</h3>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <button
                onClick={() => setScanning(s => !s)}
                style={{
                  background: scanning ? "#ef4444" : "#059669",
                  color: "#fff",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {scanning ? "Stop Scanning" : "Start Scanning"}
              </button>

              <div style={{ fontSize: 13, color: "#0f172a" }}>
                {scannerMsg || "Ready"}
              </div>
            </div>

            <div id={qrRegionId} style={qrBoxStyle}>
              {/* Html5Qrcode renders into this div */}
              {!scanning && (
                <div style={{ textAlign: "center", color: "#475569" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Scanner paused</div>
                  <div style={{ fontSize: 12 }}>Click Start Scanning</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Paste QR JSON (manual)</label>
              <textarea value={manualQR} onChange={e => setManualQR(e.target.value)} rows={3} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #e6eef6" }} />
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={handleManualSubmit} style={{ padding: "8px 12px", background: "#059669", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>Submit</button>
                <button onClick={() => { setManualQR(""); setScannerMsg(""); setLastParsed(null); }} style={{ padding: "8px 12px", background: "#f3f4f6", border: "none", borderRadius: 8 }}>Clear</button>
              </div>
              {lastParsed && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a", background: "#f8fafc", padding: 8, borderRadius: 8 }}>
                  <strong>Last parsed QR JSON:</strong>
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{JSON.stringify(lastParsed, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Attendance</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #eef2f7" }}>
                    <th style={{ padding: "8px 6px", color: "#065f46", fontWeight: 700 }}>Time</th>
                    <th style={{ padding: "8px 6px", color: "#065f46", fontWeight: 700 }}>Name</th>
                    <th style={{ padding: "8px 6px", color: "#065f46", fontWeight: 700 }}>Reg No</th>
                    <th style={{ padding: "8px 6px", color: "#065f46", fontWeight: 700 }}>Boarding Point</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: 16, color: "#94a3b8" }}>No attendance yet</td>
                    </tr>
                  )}
                  {attendance.map((a, idx) => (
                    <tr key={a.regno + idx} style={{ background: idx % 2 ? "#fbfdfb" : "transparent" }}>
                      <td style={{ padding: "8px 6px" }}>{a.time}</td>
                      <td style={{ padding: "8px 6px" }}>{a.name}</td>
                      <td style={{ padding: "8px 6px" }}>{a.regno}</td>
                      <td style={{ padding: "8px 6px" }}>{a.boardingPoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Fleet Snapshot (same route)</strong>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {getFleetSnapshot(MOCK_DRIVER.route, MOCK_DRIVER.busNumber).map(bus => (
                  <div key={bus.busNumber} style={{ borderRadius: 8, padding: 10, background: "#f8fafc", minWidth: 160 }}>
                    <div style={{ fontWeight: 800, color: "#065f46" }}>{bus.busNumber}</div>
                    <div style={{ fontSize: 13, color: "#334155" }}>ETA: <strong>{bus.eta} min</strong></div>
                    <div style={{ fontSize: 13, color: bus.currentOccupancy < bus.capacity ? "#065f46" : "#b91c1c", marginTop: 6 }}>
                      {bus.capacity - bus.currentOccupancy} seats free
                    </div>
                  </div>
                ))}
                {getFleetSnapshot(MOCK_DRIVER.route, MOCK_DRIVER.busNumber).length === 0 && <div style={{ color: "#94a3b8" }}>No other buses on route</div>}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}