
import React, { useMemo, useState } from "react";

const crewColors = {
  MIGUEL: "#635bff",
  NALDI: "#ef4444",
  YOYI: "#f59e0b",
  FRANK: "#22c55e",
  DEFAULT: "#94a3b8",
};

const emptyProjectForm = {
  name: "test",
  client: "HOTWIRE",
  trackingType: "Station based",
  totalFootage: 1100,
  startStation: "00+00",
  endStation: "11+00",
  status: "Active",
  comment: "",
};

const emptyProductionForm = {
  crew: "",
  date: "",
  start: "",
  end: "",
  comments: "",
};

function stationToFeet(station) {
  if (!station) return 0;
  const cleaned = String(station).trim();
  const [a = "0", b = "0"] = cleaned.split("+");
  return Number(a) * 100 + Number(b);
}

function formatFeet(value) {
  return `${Number(value || 0).toLocaleString()} ft`;
}

function formatStation(feet) {
  const major = Math.floor(feet / 100);
  const minor = feet % 100;
  return `${String(major).padStart(2, "0")}+${String(minor).padStart(2, "0")}`;
}

function getCrewColor(crew) {
  return crewColors[crew] || crewColors.DEFAULT;
}

function getProductionFootage(start, end) {
  return Math.max(stationToFeet(end) - stationToFeet(start), 0);
}

function getProjectProgress(project, records) {
  const total = Number(project?.totalFootage || 0);
  const finished = records.reduce((sum, r) => sum + Number(r.footage || 0), 0);
  const remaining = Math.max(total - finished, 0);
  const percent = total ? Math.round((finished / total) * 100) : 0;
  return { finished, remaining, percent, total };
}

function getCrewSummary(records) {
  const summary = {};
  records.forEach((record) => {
    if (!summary[record.crew]) summary[record.crew] = 0;
    summary[record.crew] += Number(record.footage || 0);
  });
  return summary;
}

function getGaps(project, records) {
  const start = stationToFeet(project.startStation);
  const end = stationToFeet(project.endStation);

  const ranges = records
    .map((r) => ({
      start: stationToFeet(r.start),
      end: stationToFeet(r.end),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of ranges) {
    if (!merged.length || range.start > merged[merged.length - 1].end) {
      merged.push({ ...range });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, range.end);
    }
  }

  const gaps = [];
  let cursor = start;

  for (const range of merged) {
    if (range.start > cursor) {
      gaps.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }

  if (cursor < end) {
    gaps.push({ start: cursor, end });
  }

  return gaps;
}

function ProductionLine({ project, records, selectedRecordId, onSelectRecord }) {
  const start = stationToFeet(project.startStation);
  const end = stationToFeet(project.endStation);
  const total = Math.max(end - start, 1);

  return (
    <div>
      <div style={lineLabelRow}>
        <span>{project.startStation}</span>
        <span>{project.endStation}</span>
      </div>

      <div style={lineTrack}>
        {records.map((record) => {
          const left = ((stationToFeet(record.start) - start) / total) * 100;
          const width = (getProductionFootage(record.start, record.end) / total) * 100;
          const selected = selectedRecordId === record.id;

          return (
            <button
              key={record.id}
              type="button"
              title={`${record.crew}: ${record.start} to ${record.end}`}
              onClick={() => onSelectRecord(record)}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${Math.max(width, 1)}%`,
                top: 0,
                bottom: 0,
                border: selected ? "2px solid #111827" : "none",
                background: getCrewColor(record.crew),
                borderRadius: 999,
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>

      <div style={legendRow}>
        {Object.keys(getCrewSummary(records)).map((crew) => (
          <div key={crew} style={legendPill}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: getCrewColor(crew),
                display: "inline-block",
              }}
            />
            {crew}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState([
    {
      id: 1,
      ...emptyProjectForm,
      name: "test",
      comment: "Project paused. Do not renew tickets until permits are approved.",
    },
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState(1);

  const [projectForm, setProjectForm] = useState(projects[0]);
  const [productionRecords, setProductionRecords] = useState([
    {
      id: 101,
      crew: "MIGUEL",
      date: "2026-04-14",
      start: "00+00",
      end: "01+00",
      footage: 100,
      comments: "No comments added.",
      attachments: [],
    },
    {
      id: 102,
      crew: "NALDI",
      date: "2026-04-14",
      start: "01+00",
      end: "02+00",
      footage: 100,
      comments: "No comments added.",
      attachments: [],
    },
  ]);

  const [productionForm, setProductionForm] = useState(emptyProductionForm);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(102);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) || projects[0];

  const selectedRecord =
    productionRecords.find((record) => record.id === selectedRecordId) || null;

  const progress = useMemo(
    () => getProjectProgress(selectedProject, productionRecords),
    [selectedProject, productionRecords]
  );

  const crewSummary = useMemo(
    () => getCrewSummary(productionRecords),
    [productionRecords]
  );

  const gaps = useMemo(
    () => getGaps(selectedProject, productionRecords),
    [selectedProject, productionRecords]
  );

  const saveProject = () => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === selectedProjectId ? { ...projectForm, id: selectedProjectId } : project
      )
    );
  };

  const deleteProject = () => {
    const ok = window.confirm("Delete this project?");
    if (!ok) return;

    setProjects((prev) => prev.filter((project) => project.id !== selectedProjectId));
    setSelectedProjectId(null);
  };

  const newProject = () => {
    const id = Date.now();
    const project = {
      id,
      ...emptyProjectForm,
      name: "New Project",
      client: "",
      totalFootage: 0,
      startStation: "00+00",
      endStation: "00+00",
      comment: "",
    };
    setProjects((prev) => [project, ...prev]);
    setSelectedProjectId(id);
    setProjectForm(project);
  };

  const handleSaveProduction = () => {
    if (!productionForm.crew || !productionForm.date || !productionForm.start || !productionForm.end) {
      alert("Fill crew, date, start station, and end station.");
      return;
    }

    const payload = {
      id: editingRecordId || Date.now(),
      ...productionForm,
      footage: getProductionFootage(productionForm.start, productionForm.end),
      attachments:
        productionRecords.find((record) => record.id === editingRecordId)?.attachments || [],
    };

    if (editingRecordId) {
      setProductionRecords((prev) =>
        prev.map((record) => (record.id === editingRecordId ? payload : record))
      );
      setSelectedRecordId(editingRecordId);
    } else {
      setProductionRecords((prev) => [...prev, payload]);
      setSelectedRecordId(payload.id);
    }

    setProductionForm(emptyProductionForm);
    setEditingRecordId(null);
  };

  const handleEditProduction = (record) => {
    setEditingRecordId(record.id);
    setSelectedRecordId(record.id);
    setProductionForm({
      crew: record.crew,
      date: record.date,
      start: record.start,
      end: record.end,
      comments: record.comments || "",
    });
  };

  const handleDeleteProduction = (id) => {
    const ok = window.confirm("Delete this production row?");
    if (!ok) return;

    setProductionRecords((prev) => prev.filter((record) => record.id !== id));
    if (selectedRecordId === id) {
      setSelectedRecordId("");
    }
    if (editingRecordId === id) {
      setEditingRecordId(null);
      setProductionForm(emptyProductionForm);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={topGrid}>
        <div>
          <div style={headerCard}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Production Control Tracker</h1>
            <p style={{ marginTop: 8, color: "#4b5563", fontSize: 14 }}>
              Phase 6.5. Production tracking plus 811 ticket readiness, project hold notes,
              pending utilities, multi project storage, and full project backup.
            </p>

            <div style={actionRow}>
              <button style={darkBtn}>Save Current Project</button>
              <button style={lightBtn}>Reset All Local Data</button>
            </div>

            <div style={{ ...actionRow, marginTop: 18 }}>
              <button style={primaryBtn} onClick={newProject}>New Project</button>
              <button style={lightBtn}>Duplicate Current</button>
              <button style={lightBtn}>Export Project</button>
              <button style={lightBtn}>Import Project</button>
              <button style={lightBtn}>Export All Projects</button>
              <button style={lightBtn}>Import All Projects</button>
              <button style={dangerBtn} onClick={deleteProject}>Delete Project</button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={smallLabel}>Saved projects</div>
              <select
                style={inputStyle}
                value={selectedProjectId || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const found = projects.find((project) => project.id === id);
                  setSelectedProjectId(id);
                  if (found) setProjectForm(found);
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.client || "No client"}
                  </option>
                ))}
              </select>
            </div>

            <div style={metaPillRow}>
              <span style={metaPill}>Project: {selectedProject?.name || "No project"}</span>
              <span style={metaPill}>Type: {selectedProject?.trackingType}</span>
              <span style={metaPill}>Status: {selectedProject?.status}</span>
              <span style={metaPill}>
                Stations: {selectedProject?.startStation} to {selectedProject?.endStation}
              </span>
              <span style={metaPill}>{formatFeet(selectedProject?.totalFootage)}</span>
            </div>

            <div style={statsRow}>
              <div style={statBox}>
                <div style={statLabel}>Finished footage</div>
                <div style={statValue}>{progress.finished} ft</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>Remaining footage</div>
                <div style={statValue}>{progress.remaining} ft</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>Project progress</div>
                <div style={statValue}>{progress.percent}%</div>
              </div>
            </div>

            <div style={statusNoteBox}>
              <strong>Status note:</strong> {selectedProject?.comment || "No project comment added."}
            </div>

            <div style={{ marginTop: 16 }}>
              <ProductionLine
                project={selectedProject}
                records={productionRecords}
                selectedRecordId={selectedRecordId}
                onSelectRecord={(record) => setSelectedRecordId(record.id)}
              />
            </div>
          </div>
        </div>

        <div style={reviewPanel}>
          <h2 style={{ marginTop: 0 }}>Supervisor Review</h2>

          <div style={reviewCard}>
            <div style={reviewTitle}>Project Overview</div>

            <div style={reviewSection}>
              <div style={smallLabel}>Project status</div>
              <span style={metaPill}>{selectedProject?.status || "Active"}</span>
            </div>

            <div style={reviewSection}>
              <div style={smallLabel}>Project comment</div>
              <div>{selectedProject?.comment || "No project comment added."}</div>
            </div>

            <div style={reviewSection}>
              <div style={{ fontWeight: 700, fontSize: 28 }}>{selectedRecord?.crew || "No crew selected"}</div>
              <div>
                {selectedRecord
                  ? `${selectedRecord.start} to ${selectedRecord.end}`
                  : "No production selected yet."}
              </div>
              <div>{selectedRecord?.date || ""}</div>
              <div>{selectedRecord ? `${selectedRecord.footage} ft` : ""}</div>
              <div>Status: Finished</div>
            </div>

            <div style={reviewSection}>
              <div style={smallLabel}>Reference</div>
              <div>No reference added.</div>
            </div>

            <div style={reviewSection}>
              <div style={smallLabel}>Comments</div>
              <div>{selectedRecord?.comments || "No comments added."}</div>
            </div>

            <div style={reviewSection}>
              <div style={smallLabel}>Attachments</div>
              <div>
                {selectedRecord?.attachments?.length
                  ? selectedRecord.attachments.join(", ")
                  : "No attachments."}
              </div>
            </div>
          </div>

          <div style={reviewCard}>
            <div style={reviewTitle}>Production by Crew</div>
            {Object.entries(crewSummary).map(([crew, feet]) => (
              <div key={crew} style={summaryRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: getCrewColor(crew),
                      display: "inline-block",
                    }}
                  />
                  <strong>{crew}</strong>
                </div>
                <span>{feet} ft</span>
              </div>
            ))}
          </div>

          <div style={reviewCard}>
            <div style={reviewTitle}>Open Gaps</div>
            {gaps.length ? (
              gaps.map((gap, index) => (
                <div key={index} style={gapRow}>
                  <strong>
                    {formatStation(gap.start)} to {formatStation(gap.end)}
                  </strong>
                  <div>{gap.end - gap.start} ft unfinished</div>
                </div>
              ))
            ) : (
              <div>No gaps found.</div>
            )}
          </div>

          <div style={reviewCard}>
            <div style={reviewTitle}>Ticket Readiness</div>
            <div>No ticket records yet.</div>
          </div>

          <div style={reviewCard}>
            <div style={reviewTitle}>Ticket Review</div>
            <div>No ticket selected yet.</div>
          </div>
        </div>
      </div>

      <div style={bottomGrid}>
        <div style={mainBottom}>
          <div style={sectionCard}>
            <h2 style={{ marginTop: 0 }}>Project Setup</h2>

            <div style={formGrid2}>
              <div>
                <div style={smallLabel}>Project name</div>
                <input
                  style={inputStyle}
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                />
              </div>
              <div>
                <div style={smallLabel}>Client</div>
                <input
                  style={inputStyle}
                  value={projectForm.client}
                  onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })}
                />
              </div>
              <div>
                <div style={smallLabel}>Tracking type</div>
                <select
                  style={inputStyle}
                  value={projectForm.trackingType}
                  onChange={(e) => setProjectForm({ ...projectForm, trackingType: e.target.value })}
                >
                  <option>Station based</option>
                  <option>Footage based</option>
                </select>
              </div>
              <div>
                <div style={smallLabel}>Total footage</div>
                <input
                  style={inputStyle}
                  value={projectForm.totalFootage}
                  onChange={(e) => setProjectForm({ ...projectForm, totalFootage: Number(e.target.value || 0) })}
                />
              </div>
              <div>
                <div style={smallLabel}>Project start station</div>
                <input
                  style={inputStyle}
                  value={projectForm.startStation}
                  onChange={(e) => setProjectForm({ ...projectForm, startStation: e.target.value })}
                />
              </div>
              <div>
                <div style={smallLabel}>Project end station</div>
                <input
                  style={inputStyle}
                  value={projectForm.endStation}
                  onChange={(e) => setProjectForm({ ...projectForm, endStation: e.target.value })}
                />
              </div>
              <div>
                <div style={smallLabel}>Project status</div>
                <select
                  style={inputStyle}
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                >
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Waiting on Permits</option>
                  <option>Completed</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={smallLabel}>Project comment / hold note</div>
              <textarea
                style={{ ...inputStyle, minHeight: 100 }}
                value={projectForm.comment}
                onChange={(e) => setProjectForm({ ...projectForm, comment: e.target.value })}
              />
            </div>

            <div style={{ ...actionRow, marginTop: 14 }}>
              <button style={primaryBtn} onClick={saveProject}>Save Current Project</button>
            </div>
          </div>

          <div style={sectionCard}>
            <h2 style={{ marginTop: 0 }}>Add Section Record</h2>
            <p style={{ marginTop: 0, color: "#4b5563", fontSize: 14 }}>
              Use this for your control only. Crew colors are automatic and stay consistent inside the project.
            </p>

            <div style={formGrid2}>
              <div>
                <div style={smallLabel}>Crew</div>
                <select
                  style={inputStyle}
                  value={productionForm.crew}
                  onChange={(e) => setProductionForm({ ...productionForm, crew: e.target.value })}
                >
                  <option value="">Select crew</option>
                  <option>MIGUEL</option>
                  <option>NALDI</option>
                  <option>YOYI</option>
                  <option>FRANK</option>
                </select>
              </div>

              <div>
                <div style={smallLabel}>Date</div>
                <input
                  type="date"
                  style={inputStyle}
                  value={productionForm.date}
                  onChange={(e) => setProductionForm({ ...productionForm, date: e.target.value })}
                />
              </div>

              <div>
                <div style={smallLabel}>Start station</div>
                <input
                  style={inputStyle}
                  value={productionForm.start}
                  onChange={(e) => setProductionForm({ ...productionForm, start: e.target.value })}
                />
              </div>

              <div>
                <div style={smallLabel}>End station</div>
                <input
                  style={inputStyle}
                  value={productionForm.end}
                  onChange={(e) => setProductionForm({ ...productionForm, end: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={smallLabel}>Comments</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 90 }}
                  value={productionForm.comments}
                  onChange={(e) => setProductionForm({ ...productionForm, comments: e.target.value })}
                />
              </div>
            </div>

            <div style={{ ...actionRow, marginTop: 14 }}>
              <button style={primaryBtn} onClick={handleSaveProduction}>
                {editingRecordId ? "Update Section" : "Save Section"}
              </button>
              <button
                style={lightBtn}
                onClick={() => {
                  setProductionForm(emptyProductionForm);
                  setEditingRecordId(null);
                }}
              >
                Clear
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={smallLabel}>Saved Section Records</div>

              <div style={tableCard}>
                <div style={tableHeader}>
                  <div>Crew</div>
                  <div>Range</div>
                  <div>Date</div>
                  <div>Feet</div>
                  <div>Actions</div>
                </div>

                {productionRecords.map((record) => (
                  <div
                    key={record.id}
                    onClick={() => setSelectedRecordId(record.id)}
                    style={{
                      ...tableRow,
                      background: selectedRecordId === record.id ? "#f8fafc" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: getCrewColor(record.crew),
                          display: "inline-block",
                        }}
                      />
                      {record.crew}
                    </div>
                    <div>{record.start} to {record.end}</div>
                    <div>{record.date}</div>
                    <div>{record.footage}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={tableButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduction(record);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        style={tableButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduction(record.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div />
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#111827",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const topGrid = {
  display: "grid",
  gridTemplateColumns: "1.8fr 1fr",
  gap: 20,
  alignItems: "start",
};

const bottomGrid = {
  display: "grid",
  gridTemplateColumns: "1.8fr 1fr",
  gap: 20,
  marginTop: 20,
  alignItems: "start",
};

const mainBottom = {
  display: "grid",
  gap: 20,
};

const headerCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
};

const sectionCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
};

const reviewPanel = {
  display: "grid",
  gap: 16,
  position: "sticky",
  top: 20,
};

const reviewCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
};

const reviewTitle = {
  fontWeight: 700,
  fontSize: 16,
  marginBottom: 10,
};

const reviewSection = {
  padding: "12px 0",
  borderTop: "1px solid #e5e7eb",
};

const actionRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const formGrid2 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const metaPillRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 16,
};

const metaPill = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  fontSize: 13,
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
  marginTop: 18,
};

const statBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};

const statLabel = {
  fontSize: 13,
  color: "#6b7280",
};

const statValue = {
  fontSize: 20,
  fontWeight: 700,
  marginTop: 6,
};

const statusNoteBox = {
  marginTop: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const lineLabelRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  color: "#6b7280",
  marginBottom: 8,
};

const lineTrack = {
  position: "relative",
  height: 34,
  borderRadius: 999,
  background: "#dbe4ef",
  overflow: "hidden",
};

const legendRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
};

const legendPill = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const darkBtn = {
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryBtn = {
  background: "#22c55e",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const lightBtn = {
  background: "#f3f4f6",
  color: "#111827",
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const smallLabel = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderTop: "1px solid #e5e7eb",
};

const gapRow = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: 10,
  marginTop: 10,
};

const tableCard = {
  marginTop: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 1.3fr 1fr 0.6fr 1fr",
  gap: 12,
  padding: 14,
  background: "#f8fafc",
  fontWeight: 700,
  fontSize: 13,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1.3fr 1fr 0.6fr 1fr",
  gap: 12,
  padding: 14,
  borderTop: "1px solid #e5e7eb",
  alignItems: "center",
};

const tableButton = {
  background: "#f3f4f6",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
}
