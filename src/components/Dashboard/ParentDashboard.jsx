import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * ParentDashboard.jsx
 *
 * - Shows full student details for the parent's children (supports multiple children).
 * - Shows live bus GPS on a Leaflet map, a route polyline, and the student's boarding point marker.
 * - Computes ETA from bus to boarding point (uses haversine distance + assumed speed).
 * - Uses mock data and a mock updater for live demo (replace with Firestore listeners in production).
 *
 * How to integrate:
 * - Save to src/components/ParentDashboard.jsx
 * - Ensure react-leaflet and leaflet are installed:
 *    npm install react-leaflet leaflet
 * - The component uses inline CSS for layout and is responsive.
 */

/* ---------------- Helpers ------------------- */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function estimateEtaMinutes(distanceKm, speedKmh = 25) {
  if (distanceKm <= 0) return 0;
  return Math.max(0, Math.round((distanceKm / speedKmh) * 60));
}
function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString();
}

/* -------------- Mock data (DEV) -------------- */
/* Replace with your Firestore data and listeners in production */
const MOCK_PARENT = {
  uid: "parent001",
  name: "Priya Anand",
  contact: "priya.anand@email.com",
  children: ["student001", "student002"],
};

const MOCK_CHILDREN = [
  {
    uid: "student001",
    name: "Aarav Anand",
    regno: "STU2025002",
    class: "5A",
    assignedBusNumber: "BUS23",
    boardingPoint: { lat: 12.9012, lng: 80.2313 },
    boardingTime: Date.now() + 60 * 1000 * 2, // 2 min from now
    deboardingTime: null,
    status: "Not on board",
    lastUpdated: Date.now(),
  },
  {
    uid: "student002",
    name: "Diya Verma",
    regno: "STU2025005",
    class: "3B",
    assignedBusNumber: "BUS23",
    boardingPoint: { lat: 12.9021, lng: 80.2320 },
    boardingTime: Date.now() + 60 * 1000 * 5, // 5 min
    deboardingTime: null,
    status: "Not on board",
    lastUpdated: Date.now(),
  },
];

const BUS_ROUTE = [
  [12.9005, 80.2306],
  [12.9012, 80.2313],
  [12.9021, 80.2320],
  [12.9032, 80.2324],
  [12.9040, 80.2330],
];

const INITIAL_BUS = {
  busNumber: "BUS23",
  routeName: "Morning Route A",
  driverName: "Suresh Kumar",
  driverId: "DRV102",
  driverContact: "+91 9876543210",
  occupancy: 12,
  capacity: 30,
  // start at first point
  location: { lat: BUS_ROUTE[0][0], lng: BUS_ROUTE[0][1], timestamp: Date.now() },
  history: [],
};

/* --------------- Map icon fix ---------------- */
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  shadowSize: [41, 41],
});

/* --------------- Map recenter component --------------- */
function MapRecenter({ position, onReady }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 15, { animate: true });
      if (typeof onReady === "function") onReady(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);
  return null;
}

/* --------------- ParentDashboard --------------- */
export default function ParentDashboard() {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const [bus, setBus] = useState(null);
  const [eta, setEta] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(null);
  const mapRef = useRef(null);

  // Mock bus movement index
  const idxRef = useRef(0);
  const speedAssumption = 25; // km/h used for ETA computation if needed

  // Load mock initial data (replace this with Firestore subscriptions)
  useEffect(() => {
    setParent(MOCK_PARENT);
    setChildren(MOCK_CHILDREN);
    setBus(INITIAL_BUS);
    setSelectedChildIdx(0);
  }, []);

  // Simulate live bus movement along BUS_ROUTE every 3s
  useEffect(() => {
    if (!bus) return;
    const t = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % BUS_ROUTE.length;
      const [lat, lng] = BUS_ROUTE[idxRef.current];
      const newLoc = { lat, lng, timestamp: Date.now() };
      setBus(prev => {
        const h = prev.history ? [...prev.history, newLoc] : [newLoc];
        return { ...prev, location: newLoc, history: h, occupancy: prev.occupancy + (Math.random() < 0.3 ? 1 : 0) };
      });
      // compute rough speed based on last segment
      setSpeedKmh(prev => {
        try {
          const p1Idx = (idxRef.current - 1 + BUS_ROUTE.length) % BUS_ROUTE.length;
          const p1 = BUS_ROUTE[p1Idx];
          const p2 = BUS_ROUTE[idxRef.current];
          const distKm = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
          // interval is 3s -> convert to km/h
          const v = (distKm / (3 / 3600));
          // clamp to reasonable range
          return Math.min(80, Math.max(1, Number(v.toFixed(1))));
        } catch {
          return prev || speedAssumption;
        }
      });
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus]);

  // Update ETA when bus or selected child changes
  useEffect(() => {
    if (!bus || !children || children.length === 0) {
      setEta(null);
      return;
    }
    const child = children[selectedChildIdx];
    if (!child || !child.boardingPoint || !bus.location) {
      setEta(null);
      return;
    }
    const distKm = haversineDistance(bus.location.lat, bus.location.lng, child.boardingPoint.lat, child.boardingPoint.lng);
    const speedToUse = speedKmh || speedAssumption;
    const minutes = estimateEtaMinutes(distKm, speedToUse);
    setEta(minutes);
  }, [bus, children, selectedChildIdx, speedKmh]);

  // If parent has multiple children show selector
  function handleSelectChild(idx) {
    setSelectedChildIdx(idx);
    // center map on child boarding point when selecting
    const child = children[idx];
    if (child && child.boardingPoint && mapRef.current) {
      mapRef.current.setView([child.boardingPoint.lat, child.boardingPoint.lng], 15);
    }
  }

  // Copy or share ETA
  const handleShareEta = () => {
    const child = children[selectedChildIdx];
    const text = eta != null
      ? `ETA for ${child.name} pickup: ${eta} min (bus ${bus.busNumber})`
      : `ETA for ${child.name} not available`;
    if (navigator.share) {
      navigator.share({ title: "Bus ETA", text });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert("ETA copied to clipboard");
    } else {
      alert(text);
    }
  };

  // If still loading
  if (!parent || children.length === 0 || !bus) {
    return <div style={pageStyles.container}><div style={pageStyles.card}>Loading dashboard…</div></div>;
  }

  const selectedChild = children[selectedChildIdx];

  return (
    <div style={pageStyles.container}>
      <div style={pageStyles.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Parent Dashboard</div>
        </div>
        <div style={{ color: "#fff", fontWeight: 600 }}>
          {parent.name} • {parent.contact}
        </div>
      </div>

      <div style={pageStyles.content}>
        {/* Left column: student details + history */}
        <div style={pageStyles.left}>
          <div style={pageStyles.card}>
            <h3 style={pageStyles.h3}>Children</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {children.map((c, i) => (
                <button
                  key={c.uid}
                  onClick={() => handleSelectChild(i)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 20,
                    border: selectedChildIdx === i ? "2px solid #0366d6" : "1px solid #e5e7eb",
                    background: selectedChildIdx === i ? "#e6f0ff" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <strong>{selectedChild.name}</strong> <br />
              Reg No: {selectedChild.regno} • Class: {selectedChild.class} <br />
              Assigned bus: <strong>{selectedChild.assignedBusNumber}</strong>
            </div>

            <div style={{ marginBottom: 8 }}>
              <b>Boarding point:</b> {selectedChild.boardingPoint.lat.toFixed(4)}, {selectedChild.boardingPoint.lng.toFixed(4)}
            </div>

            <div style={{ marginBottom: 8 }}>
              <b>Boarding time:</b> {selectedChild.boardingTime ? formatTime(selectedChild.boardingTime) : "Not set"}
            </div>

            <div style={{ marginBottom: 8 }}>
              <b>Status:</b> <span style={{ marginLeft: 8, fontWeight: 700 }}>{selectedChild.status}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={handleShareEta} style={pageStyles.actionBtn}>Share ETA</button>
            </div>
          </div>

          <div style={pageStyles.card}>
            <h3 style={pageStyles.h3}>Pickup ETA</h3>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0b5cff" }}>
              {eta != null ? `${eta} min` : "N/A"}
            </div>
            <div style={{ marginTop: 8, color: "#6b7280" }}>
              Bus: {bus.busNumber} • Speed: {speedKmh ? `${speedKmh} km/h` : "estimating..."}
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Last seen:</b> {bus.location ? formatTime(bus.location.timestamp) : "Unknown"}
            </div>
          </div>

          <div style={pageStyles.card}>
            <h3 style={pageStyles.h3}>Bus Details</h3>
            <div><b>Driver:</b> {bus.driverName} ({bus.driverId})</div>
            <div><b>Contact:</b> {bus.driverContact}</div>
            <div><b>Occupancy:</b> {bus.occupancy} / {bus.capacity}</div>
            <div style={{ marginTop: 8 }}>
              <b>Recent bus history</b>
              <ol style={{ paddingLeft: 18 }}>
                {bus.history.slice(-6).reverse().map((p, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#374151" }}>
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)} • {formatTime(p.timestamp)}
                  </li>
                ))}
                {bus.history.length === 0 && <li style={{ color: "#777" }}>No history yet</li>}
              </ol>
            </div>
          </div>
        </div>

        {/* Right column: live map */}
        <div style={pageStyles.right}>
          <div style={pageStyles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={pageStyles.h3}>Live Bus Map</h3>
              <div>
                <button
                  onClick={() => {
                    if (mapRef.current && bus.location) mapRef.current.setView([bus.location.lat, bus.location.lng], 15);
                  }}
                  style={pageStyles.smallBtn}
                >
                  Center bus
                </button>
                <button
                  onClick={() => {
                    if (mapRef.current && selectedChild.boardingPoint) mapRef.current.setView([selectedChild.boardingPoint.lat, selectedChild.boardingPoint.lng], 15);
                  }}
                  style={{ ...pageStyles.smallBtn, marginLeft: 8 }}
                >
                  Center pickup
                </button>
              </div>
            </div>

            <div style={{ height: 360, borderRadius: 8, overflow: "hidden" }}>
              <MapContainer
                center={bus.location ? [bus.location.lat, bus.location.lng] : [BUS_ROUTE[0][0], BUS_ROUTE[0][1]]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                whenCreated={mapInstance => { mapRef.current = mapInstance; }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {/* Bus marker */}
                {bus.location && (
                  <Marker position={[bus.location.lat, bus.location.lng]} icon={markerIcon}>
                    <Popup>
                      <div style={{ fontWeight: 800 }}>{bus.busNumber}</div>
                      <div>Driver: {bus.driverName}</div>
                      <div>Last: {formatTime(bus.location.timestamp)}</div>
                      <div>ETA to pickup: {eta != null ? `${eta} min` : "N/A"}</div>
                    </Popup>
                  </Marker>
                )}

                {/* Boarding point marker */}
                {selectedChild && selectedChild.boardingPoint && (
                  <Marker position={[selectedChild.boardingPoint.lat, selectedChild.boardingPoint.lng]} icon={markerIcon}>
                    <Popup>
                      <div style={{ fontWeight: 800 }}>{selectedChild.name} pickup</div>
                      <div>Reg: {selectedChild.regno}</div>
                      <div>Boarding time: {formatTime(selectedChild.boardingTime)}</div>
                    </Popup>
                  </Marker>
                )}

                {/* Route polyline */}
                <Polyline positions={BUS_ROUTE.map(p => [p[0], p[1]])} color="#0b5cff" />

                {/* Recenter helper */}
                <MapRecenter position={bus.location ? [bus.location.lat, bus.location.lng] : null} />
              </MapContainer>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={pageStyles.card}>
            <h3 style={pageStyles.h3}>ETA / Actions</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{eta != null ? `${eta} min` : "—"}</div>
              <div style={{ color: "#6b7280" }}>to pickup for {selectedChild.name}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={handleShareEta} style={pageStyles.actionBtn}>Share ETA</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Styles ------------------ */
const pageStyles = {
  container: {
    minHeight: "100vh",
    background: "#f6f7fa",
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    padding: "18px 28px",
    background: "#0366d6",
    color: "#fff",
    alignItems: "center",
  },
  content: {
    display: "flex",
    gap: 24,
    maxWidth: 1200,
    margin: "26px auto",
    padding: "0 18px",
    boxSizing: "border-box",
    alignItems: "flex-start",
  },
  left: {
    width: 350,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  right: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  card: {
    background: "#fff",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 8px 30px rgba(2,6,23,0.06)",
  },
  h3: { margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 800 },
  actionBtn: {
    padding: "8px 12px",
    background: "#0b5cff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  smallBtn: {
    padding: "6px 10px",
    background: "#eef2ff",
    border: "1px solid #dfe7ff",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
  },
};

/* ---------------- Responsive adjustments ---------------- */
const responsiveStyle = `
  @media (max-width: 900px) {
    .leaflet-container { height: 320px !important; }
  }
`;

/* Append responsive style to document head (once) */
if (typeof document !== "undefined") {
  const id = "parent-dashboard-responsive";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = responsiveStyle;
    document.head.appendChild(style);
  }
}