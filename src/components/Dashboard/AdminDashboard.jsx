import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { saveAs } from "file-saver";

// ---- MOCK DATA & HELPERS ----
const MOCK_BUSES = [
  { busNumber: "BUS01", routeName: "Route A", driverName: "Suresh Kumar", driverId: "DRV001", capacity: 40 },
  { busNumber: "BUS02", routeName: "Route B", driverName: "Anjali Singh", driverId: "DRV002", capacity: 35 },
  { busNumber: "BUS03", routeName: "Route C", driverName: "Vinay Reddy", driverId: "DRV003", capacity: 25 }
];
const MOCK_STUDENTS = {
  s1: { uid: "s1", name: "Aarav Anand", regno: "STU101", feeStatus: "Paid", parentContact: "9888823432" },
  s2: { uid: "s2", name: "Diya Verma", regno: "STU102", feeStatus: "Paid", parentContact: "9123112121" },
  s3: { uid: "s3", name: "Roshan Ali", regno: "STU103", feeStatus: "Unpaid", parentContact: "9338303011" },
  s4: { uid: "s4", name: "Meera Chakraborty", regno: "STU104", feeStatus: "Paid", parentContact: "9555512312" },
  s5: { uid: "s5", name: "Rahul Nair", regno: "STU105", feeStatus: "Unpaid", parentContact: "9464646464" },
  s6: { uid: "s6", name: "Vidya Iyer", regno: "STU106", feeStatus: "Paid", parentContact: "9090909090" },
};
const todayStr = () => (new Date().toISOString().slice(0, 10));
const subtractDays = (d, n) => {
  const dd = new Date(d);
  dd.setDate(dd.getDate() - n);
  return dd.toISOString().slice(0, 10);
};
const generateMockBoardings = () => {
  const boardings = {};
  for (const bus of MOCK_BUSES) {
    boardings[bus.busNumber] = {};
    for (let day = 0; day < 7; ++day) {
      const dateStr = subtractDays(todayStr(), day);
      boardings[bus.busNumber][dateStr] = [];
      const numStudents = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < numStudents; ++i) {
        const student = Object.values(MOCK_STUDENTS)[i % Object.keys(MOCK_STUDENTS).length];
        const schedTime = new Date(`${dateStr}T08:00:00`).getTime();
        const delta = Math.random() < 0.8 ? Math.floor(Math.random() * 6) : 6 + Math.floor(Math.random() * 10);
        const actualArrival = schedTime + delta * 60000;
        boardings[bus.busNumber][dateStr].push({
          uid: student.uid,
          studentName: student.name,
          regno: student.regno,
          boardingTime: schedTime + (7 + Math.floor(Math.random() * 10)) * 60000,
          boardingPoint: `Stop ${(i % 8) + 1}`,
          feeStatus: student.feeStatus,
          scheduledArrival: schedTime,
          actualArrival,
          delayMinutes: delta,
        });
      }
    }
  }
  return boardings;
};
const MOCK_BOARDINGS = generateMockBoardings();

function aggregateBoardingsByDateRange(boardings, from, to) {
  let res = {};
  if (!boardings) return {};
  for (let bus in boardings) {
    for (let date in boardings[bus]) {
      if (date >= from && date <= to) {
        if (!res[date]) res[date] = [];
        res[date].push({ busNumber: bus, students: [...boardings[bus][date]] });
      }
    }
  }
  return res;
}
function computeOccupancy(busCapacity, boardingCount) {
  if (!busCapacity) return 0;
  return Math.round((boardingCount / busCapacity) * 100);
}
function computePunctuality(scheduledTime, actualTime, toleranceMinutes = 5) {
  if (!scheduledTime || !actualTime) return { onTime: false, delayMinutes: null };
  const delay = Math.round((actualTime - scheduledTime) / 60000);
  return {
    onTime: delay <= toleranceMinutes,
    delayMinutes: delay,
  };
}
function exportToCSV(dataArray, filename = "export.csv") {
  if (!dataArray || !dataArray.length) return;
  const header = Object.keys(dataArray[0]).join(",");
  const rows = dataArray.map(row => Object.values(row).join(",")).join("\n");
  const csvContent = header + "\n" + rows;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, filename);
}

//-------- Main Component ------------//
const AdminDashboard = () => {
  const [from, setFrom] = useState(subtractDays(todayStr(), 6));
  const [to, setTo] = useState(todayStr());
  const [busFilter, setBusFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedBusDate, setSelectedBusDate] = useState(todayStr());
  const [boardings] = useState(MOCK_BOARDINGS);
  const [buses] = useState(MOCK_BUSES);
  const [viewStudent, setViewStudent] = useState(null);

  // simple mock user (replace with real auth user info as needed)
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("userName") || "Admin User";
  });

  useEffect(() => {
    localStorage.setItem("userName", userName);
  }, [userName]);

  function handleLogout() {
    localStorage.removeItem("userName");
    window.location.reload();
  }

  // Data filtering & calculation
  const filteredBoardings = useMemo(() =>
    aggregateBoardingsByDateRange(boardings, from, to), [boardings, from, to]
  );
  const allBusNumbers = useMemo(() => buses.map(b => b.busNumber), [buses]);
  const todaysBoardingsFlat = useMemo(() =>
    allBusNumbers.flatMap(bus =>
      (boardings[bus]?.[to] || [])
    ), [allBusNumbers, boardings, to]
  );
  const totalStudentsToday = todaysBoardingsFlat.length;
  const avgOccupancy = useMemo(() => {
    if (!totalStudentsToday) return 0;
    let sum = 0;
    buses.forEach((bus) => {
      const stud = boardings[bus.busNumber]?.[to]?.length || 0;
      sum += computeOccupancy(bus.capacity, stud);
    });
    return (sum / buses.length).toFixed(1);
  }, [buses, boardings, to, totalStudentsToday]);
  const ontimeKPIs = useMemo(() => {
    let onTime = 0, total = 0, delays = 0;
    buses.forEach((bus) => {
      (boardings[bus.busNumber]?.[to] || []).forEach(ev => {
        const { onTime: isOn, delayMinutes } = computePunctuality(ev.scheduledArrival, ev.actualArrival);
        if (isOn) onTime++; else delays += delayMinutes > 0 ? delayMinutes : 0;
        total++;
      });
    });
    return {
      total, onTime, onTimePct: total ? Math.round((onTime / total) * 100) : 0,
      avgDelay: total ? (delays / (total - onTime)).toFixed(1) : 0,
    };
  }, [buses, boardings, to]);
  const analyticHourly = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const h = 8 + i;
      return {
        hour: `${h}:00`,
        students: todaysBoardingsFlat.filter(b =>
          new Date(b.boardingTime).getHours() === h
        ).length
      };
    });
  }, [todaysBoardingsFlat]);
  const analyticDaily = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subtractDays(to, 6 - i);
      let count = 0;
      buses.forEach(b => {
        count += (boardings[b.busNumber]?.[date]?.length || 0);
      });
      return { date, count };
    });
  }, [buses, boardings, to]);
  const filteredBuses = buses.filter(bus =>
    (!busFilter || bus.busNumber === busFilter)
      && (!routeFilter || bus.routeName.toLowerCase().includes(routeFilter.toLowerCase()))
      && (!driverFilter || bus.driverName.toLowerCase().includes(driverFilter.toLowerCase()))
  );

  return (
    <div style={styles.main}>
      {/* Top bar with user name and logout */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}></div>
        <div style={styles.topBarCenter}>AI-Enabled Smart Bus System</div>
        <div style={styles.topBarRight}>
          <span style={{ marginRight: 12, color: "#173f79", fontWeight: 600 }}>Hello, {userName}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>

      {/* Left-aligned content wrapper */}
      <div style={styles.contentWrapper}>
        {/* Header with filters */}
        <div style={styles.headerBar}>
          <div style={styles.headerTitle}>Admin Dashboard</div>
          <div style={styles.filters}>
            <div>
              <label style={styles.label}>From</label>
              <input type="date" value={from} max={to} style={styles.input}
                onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={styles.label}>To</label>
              <input type="date" value={to} min={from} style={styles.input}
                onChange={e => setTo(e.target.value)} />
            </div>
            <div>
              <input placeholder="Filter route" value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
                style={{ ...styles.input, width: 90, marginRight: 7 }} />
              <input placeholder="Filter bus" value={busFilter}
                onChange={e => setBusFilter(e.target.value)}
                style={{ ...styles.input, width: 70, marginRight: 7 }} />
              <input placeholder="Filter driver" value={driverFilter}
                onChange={e => setDriverFilter(e.target.value)}
                style={{ ...styles.input, width: 90 }} />
            </div>
          </div>
        </div>

        {/* ---- 2 Column Left-aligned Main ---- */}
        <div className="admin-dashboard-rows" style={styles.rowsLeft}>
          <div className="admin-dashboard-col" style={styles.colLeft}>
            <KPICards buses={buses} studentsToday={totalStudentsToday} avgOccupancy={avgOccupancy} ontime={ontimeKPIs} />
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Daily Analytics (Today)</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticHourly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="students" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.analyticsDesc}>Students boarding per hour today</div>
            </div>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Weekly Analytics</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticDaily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#22c55e" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.analyticsDesc}>Total boardings per day (last 7 days)</div>
            </div>
            <PunctualityPanel buses={buses} boardings={boardings} to={to} />
          </div>

          <div className="admin-dashboard-col" style={styles.colRight}>
            <BusList
              buses={filteredBuses}
              boardings={boardings}
              today={to}
              selectedBus={selectedBus}
              setSelectedBus={bus => {
                setSelectedBus(bus);
                setSelectedBusDate(to);
              }}
            />
            {selectedBus && (
              <BusDetailsModal
                bus={selectedBus}
                boardings={boardings[selectedBus.busNumber]}
                date={selectedBusDate}
                setDate={setSelectedBusDate}
                onClose={() => setSelectedBus(null)}
                onExport={rows =>
                  exportToCSV(rows, `bus_${selectedBus.busNumber}_boardings_${selectedBusDate}.csv`)
                }
                studentsMap={MOCK_STUDENTS}
                onViewStudent={suid =>
                  setViewStudent(MOCK_STUDENTS[suid])
                }
              />
            )}
            {viewStudent && (
              <StudentModal
                student={viewStudent}
                onClose={() => setViewStudent(null)}
              />
            )}
          </div>
        </div>

        {/* Responsive */}
        <style>{`
          @media (max-width: 900px) {
            .admin-dashboard-rows { flex-direction: column !important; }
            .admin-dashboard-col { width: 100% !important; max-width: unset !important; margin-bottom: 14px; }
            .topBar { padding: 10px 12px !important; }
            .topBarCenter { font-size: 16px !important; }
          }
          .admin-scroll { overflow-y: auto; max-height: 440px; }
        `}</style>
      </div>
    </div>
  );
}

// KPI CARDS
function KPICards({ buses, studentsToday, avgOccupancy, ontime }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 15, marginBottom: 20 }}>
      <CardKPI label="Total Buses" value={buses.length} color="#6366f1" />
      <CardKPI label="Students Today" value={studentsToday} color="#22c55e" />
      <CardKPI label="Avg Occupancy (%)" value={avgOccupancy} color="#2563eb" />
      <CardKPI label="On-time (%)" value={ontime.onTimePct} color="#059669" />
    </div>
  );
}
function CardKPI({ label, value, color }) {
  return (
    <div style={{
      borderRadius: 10,
      boxShadow: "0 2px 7px #1a338113",
      padding: 16,
      fontWeight: 600,
      background: color,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontSize: 16 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 7 }}>{value}</div>
    </div>
  );
}

// BUS LIST
function BusList({ buses, boardings, today, selectedBus, setSelectedBus }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Buses</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", maxHeight: 330 }}>
        {buses.map(bus => {
          const boarding = boardings[bus.busNumber]?.[today] || [];
          return (
            <button key={bus.busNumber}
              onClick={() => setSelectedBus(bus)}
              style={{
                border: '1px solid',
                borderRadius: 8,
                padding: 10,
                marginBottom: 2,
                background: selectedBus?.busNumber === bus.busNumber ? "#eaf2fe" : "#f7fafc",
                borderColor: selectedBus?.busNumber === bus.busNumber ? "#3061b6" : "#d8dceb",
                cursor: "pointer",
                textAlign: "left"
              }}>
              <div style={{ fontWeight: 700, color: "#2563eb" }}>#{bus.busNumber}</div>
              <div style={{ fontSize: 13, color: "#616b82" }}>Route: {bus.routeName}</div>
              <div style={{ fontSize: 13, color: "#888" }}>Driver: {bus.driverName}</div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Capacity: {bus.capacity}</div>
              <div style={{ fontSize: 13, marginTop: 3 }}>Boarded today: <b>{boarding.length}</b></div>
            </button>
          );
        })}
        {buses.length === 0 && <div style={{ color: "#888", textAlign: "center" }}>No buses match filter.</div>}
      </div>
    </div>
  );
}

// BUS DETAILS MODAL
function BusDetailsModal({ bus, boardings, date, setDate, onClose, onExport, studentsMap, onViewStudent }) {
  const [tablePage, setTablePage] = useState(1);
  const perPage = 10;
  const dayBoardings = boardings?.[date] || [];
  const total = dayBoardings.length;
  const studentList = dayBoardings.slice((tablePage - 1) * perPage, tablePage * perPage);
  const punctuality = dayBoardings.length
    ? computePunctuality(dayBoardings[0].scheduledArrival, dayBoardings[0].actualArrival)
    : null;
  const occupancy = computeOccupancy(bus.capacity, total);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.10)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 10000
    }}>
      <div style={{ background: "#fff", margin: "80px 0", padding: 22, borderRadius: 11,
        maxWidth: 660, width: "98%", position: "relative", boxShadow: "0 2px 24px #26336c16" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 15, background: "none", fontSize: 24, border: 0, cursor: "pointer" }}>&times;</button>
        <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Bus #{bus.busNumber}</h2>
        <div style={{ marginBottom: 7, color: "#586080" }}>Route: {bus.routeName} | Driver: {bus.driverName} ({bus.driverId})</div>
        <div style={{ display: "flex", gap: 20, fontSize: 14, marginBottom: 7, color: "#819" }}>
          <span>Capacity: <b>{bus.capacity}</b></span>
          <span>Occupancy: <b>{occupancy}%</b></span>
          <span>Seats left: <b>{bus.capacity - total}</b></span>
        </div>
        <div style={{ marginBottom: 7 }}>
          <label style={{ marginRight: 5 }}>Date:</label>
          <input type="date" value={date} max={todayStr()}
            onChange={e => { setDate(e.target.value); setTablePage(1); }} style={styles.input} />
        </div>
        <div style={{ marginBottom: 7 }}>
          <button style={{ color: "#2563eb", background: "none", border: 0, cursor: "pointer", marginRight: 10 }} onClick={() => onExport(dayBoardings)}>Export CSV</button>
          <button style={{ color: "#2563eb", background: "none", border: 0, cursor: "pointer" }} onClick={() => alert("Download full attendance (Coming soon)")}>Download Attendance (Range)</button>
        </div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          Punctuality today: {punctuality && <span style={{
            background: punctuality.delayMinutes <= 5 ? "#22c55e" : punctuality.delayMinutes <= 10 ? "#fbbf24" : "#ea3232",
            color: "#fff", padding: "2px 10px", borderRadius: 6, fontWeight: "bold", marginLeft: 7
          }}>
            {punctuality.onTime ? "On Time" : `Delayed by ${punctuality.delayMinutes} min`}
          </span>}
        </div>
        <BoardingsTable
          rows={studentList}
          studentsMap={studentsMap}
          page={tablePage}
          perPage={perPage}
          total={total}
          onPage={setTablePage}
          onViewStudent={onViewStudent}
        />
        {total === 0 && <div style={{ textAlign: "center", padding: "22px 0", color: "#bbb" }}>No boardings for selected date.</div>}
      </div>
    </div>
  );
}

// BOARDINGS TABLE
function BoardingsTable({ rows, studentsMap, page, perPage, total, onPage, onViewStudent }) {
  return (
    <div>
      <table style={{ width: "100%", fontSize: 15, margin: "12px 0" }}>
        <thead><tr style={{ background: "#eaeaff" }}>
          <th style={{ padding: "6px 8px" }}>Time</th>
          <th>Name</th>
          <th>Reg No.</th>
          <th>Point</th>
          <th>Status</th>
          <th></th>
        </tr></thead>
        <tbody>
          {rows.map((b, i) => (
            <tr style={{ borderTop: "1px solid #eee" }} key={i}>
              <td style={{ padding: "6px 8px" }}>{new Date(b.boardingTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>{b.studentName}</td>
              <td>{b.regno}</td>
              <td>{b.boardingPoint}</td>
              <td>
                <span style={{
                  padding: "2px 8px", borderRadius: 4,
                  background: b.feeStatus === "Paid" ? "#bef5cb" : "#fde2e2",
                  color: b.feeStatus === "Paid" ? "#217744" : "#b90030"
                }}>{b.feeStatus}</span>
              </td>
              <td>
                <button style={{ color: "#2563eb", background: "none", border: 0, cursor: "pointer" }}
                  onClick={() => onViewStudent(b.uid)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "0 4px" }}>
        <div>{`Page ${page} / ${Math.ceil(total / perPage)}`}</div>
        <div>
          <button disabled={page === 1} style={{ ...styles.input, marginRight: 4, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
            onClick={() => page > 1 && onPage(page - 1)}>Prev</button>
          <button disabled={page === Math.ceil(total / perPage)} style={{ ...styles.input, opacity: page === Math.ceil(total / perPage) ? 0.4 : 1, cursor: page === Math.ceil(total / perPage) ? "not-allowed" : "pointer" }}
            onClick={() => page < Math.ceil(total / perPage) && onPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

// STUDENT MODAL
function StudentModal({ student, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.10)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10500
    }}>
      <div style={{
        background: "#fff", padding: "26px 38px", borderRadius: 9, boxShadow: "0 2px 16px #1e229922", width: "96%", maxWidth: 320,
        position: "relative"
      }}>
        <button style={{ position: "absolute", top: 9, right: 13, fontSize: 22, background: "none", border: 0 }} onClick={onClose}>&times;</button>
        <h2 style={{ fontWeight: 700, fontSize: 19, marginBottom: 5 }}>{student.name}</h2>
        <div style={{ marginBottom: 8 }}>Reg No.: <b>{student.regno}</b></div>
        <div style={{ marginBottom: 8 }}>Fee Status: <b>{student.feeStatus}</b></div>
        <div style={{ marginBottom: 8 }}>Parent Contact: <b>{student.parentContact}</b></div>
      </div>
    </div>
  );
}

// PUNCTUALITY PANEL
function PunctualityPanel({ buses, boardings, to }) {
  const perBusPunctuality = buses.map(bus => {
    const dayBoard = boardings[bus.busNumber]?.[to] || [];
    const delays = dayBoard.map(b => computePunctuality(b.scheduledArrival, b.actualArrival).delayMinutes);
    const avgDelay = delays.length ? (delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
    const onTimeCount = delays.filter(d => d <= 5).length;
    return {
      busNumber: bus.busNumber,
      avgDelay: avgDelay.toFixed(1),
      onTimePct: delays.length ? Math.round(onTimeCount * 100 / delays.length) : 0,
    };
  });
  const delayedSorted = perBusPunctuality.slice().sort((a, b) => b.avgDelay - a.avgDelay);
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Punctuality Report</h3>
      <div style={{ width: "100%", height: 140, marginBottom: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perBusPunctuality}>
            <XAxis dataKey="busNumber" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="avgDelay" fill="#ea3232" name="Avg Delay (min)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 13, color: "#26336c", marginBottom: 7, fontWeight: 600 }}>
        Worst punctuality (descending):
      </div>
      <table style={{ width: "100%", fontSize: 14, marginBottom: 7 }}>
        <thead>
          <tr style={{ background: "#eaeaff" }}>
            <th style={{ padding: "5px" }}>Bus</th>
            <th>On-time %</th>
            <th>Avg Delay (min)</th>
          </tr>
        </thead>
        <tbody>
          {delayedSorted.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #f1f1fa" }}>
              <td style={{ padding: "5px" }}>{r.busNumber}</td>
              <td>{r.onTimePct}%</td>
              <td>{r.avgDelay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#f6f7fa",
    fontFamily: "'Segoe UI',Arial,sans-serif",
    paddingTop: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",   // align to left
  },
  topBar: {
    width: "100%",
    maxWidth: 1200,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    marginBottom: 12,
    boxSizing: "border-box",
  },
  topBarLeft: {
    flex: 1,
  },
  topBarCenter: {
    flex: 1,
    textAlign: "left",   // left align title
    fontWeight: 700,
    fontSize: 18,
    color: "#173f79"
  },
  topBarRight: {
    flex: 1,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center"
  },
  logoutButton: {
    background: "#e11d48",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 1200,
    marginLeft: 18,        // keep content left with a small gutter
    padding: "0 18px 48px 0",
    boxSizing: "border-box",
  },
  headerBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "2px solid #e0e0ec",
    background: "#fff",
    padding: "12px 18px",
    borderRadius: 10,
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#173f79"
  },
  rowsLeft: {
    display: "flex",
    flexDirection: "row",
    gap: 32,
    flexWrap: "nowrap",   // keep columns next to each other
    padding: "18px 0"
  },
  colLeft: {
    flex: 1,
    minWidth: 320,
    maxWidth: 760,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  colRight: {
    width: 360,
    minWidth: 260,
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  filters: {
    display: "flex", gap: 12, alignItems: "center", marginTop: 4
  },
  label: {
    marginRight: 4,
    fontSize: 14,
    color: "#576da3"
  },
  input: {
    border: "1px solid #cbcbdb",
    padding: "5px 11px",
    borderRadius: 5,
    fontSize: 14,
    background: "#fff",
    marginRight: 2,
  },
  card: {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 2px 10px #0366d61a",
    padding: "19px 24px"
  },
  cardTitle: {
    margin: 0,
    fontWeight: "bold",
    color: "#26336c",
    fontSize: 17,
    marginBottom: 11,
  },
  analyticsDesc: {
    fontSize: 13,
    color: "#6d6d6d",
    marginTop: 4
  },
};

export default AdminDashboard;