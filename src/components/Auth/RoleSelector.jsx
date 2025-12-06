import React from "react";
const ROLES = ["Student", "Parent", "Driver", "Admin"];

export default function RoleSelector({ value, onChange, disabled }) {
  return (
    <div style={{marginBottom: 14}}>
      <label className="label">Role:</label>
      <select disabled={disabled} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select role</option>
        {ROLES.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </div>
  );
}