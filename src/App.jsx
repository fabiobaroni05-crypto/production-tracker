import React, { useMemo, useState } from "react";

const crewColors = {
  MIGUEL: "#635bff",
  NALDI: "#ef4444",
  YOYI: "#f59e0b",
  FRANK: "#22c55e",
  DEFAULT: "#94a3b8",
};

const emptyProjectForm = {
  name: "Fiber Feed to Bay Terrace",
  client: "HOTWIRE",
  trackingType: "Station based",
  totalFootage: 0,
  startStation: "00+00",
  endStation: "22+19",
  status: "Active",
  comment: "",
};

const emptyProductionForm = {
  crew: "",
  date: "",
  start: "",
  end: "",
  footage: "",
  reference: "",
  comments: "",
};

const emptyTicketForm = {
  areaSection: "",
  ticketNumber: "",
  status: "Open",
  pendingUtility: "",
  expirationDate: "",
  coverage: "",
  notes: "",
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

function normalizeCrewName(value) {
  return String(value || "").trim().toUpperCase();
}

function getCrewColor(crew) {
  return crewColors[crew] || crewColors.DEFAULT;
}

function getProductionFootage(start, end) {
  return Math.max(stationToFeet(end) - stationToFeet(start), 0);
}

function getProjectProgress(project, records) {
  const total =
    project?.trackingType === "Station based"
      ? Math.max(
          stationToFeet(project?.endStation) - stationToFeet(project?.startStation),
          0
        )
      : Number(project?.totalFootage || 0);

  const finished = records.reduce((sum, r) => sum + Number(r.footage || 0), 0);
  const remaining = Math.max(total - finished, 0);
  const percent = total > 0 ? Math.round((finished / total) * 100) : 0;

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
  if (project.trackingType !== "Station based") return [];

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
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }

  if (cursor < end) gaps.push({ start: cursor, end });

  return gaps;
}

function getDaysLeft(expirationDate) {
  if (!expirationDate) return { text: "No date", color: "#64748b" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expirationDate}T00:00:00`);
  const diff = Math.round((exp - today) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`, color: "#b91c1c" };
  if (diff === 0) return { text: "Expires today", color: "#b91c1c" };
  if (diff <= 5) return { text: `${diff} day${diff === 1 ? "" : "s"} left`, color: "#b45309" };
  return { text: `${diff} day${diff === 1 ? "" : "s"} left`, color: "#15803d" };
}

function getTicketStatusStyle(status) {
  switch (status) {
    case "Clear":
      return { background: "#dcfce7", color: "#166534" };
    case "Pending":
      return { background: "#ffedd5", color: "#9a3412" };
    case "Expired":
      return { background: "#fee2e2", color: "#991b1b" };
    case "Open":
    default:
      return { background: "#dbeafe", color: "#1d4ed8" };
  }
}

function ProductionLine({ project, records, selectedRecordId, onSelectRecord }) {
  if (project.trackingType === "Footage based") {
    const total = Math.max(Number(project.totalFootage || 0), 1);
    let cursor = 0;

    return (
      <div>
        <div style={lineLabelRow}>
          <span>0 ft</span>
          <span>{formatFeet(total)}</span>
        </div>

        <div style={lineTrack}>
          {records.map((record) => {
            const widthFeet = Number(record.footage || 0);
            const left = (cursor / total) * 100;
            const width = (widthFeet / total) * 100;
            const selected = selectedRecordId === record.id;
            const segment = (
              <button
                key={record.id}
                type="button"
                title={`${record.crew}: ${record.footage} ft`}
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
            cursor += widthFeet;
            return segment;
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
      crews: ["MIGUEL", "FRANK", "NALDI", "YOYI"],
    },
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState(1);
  const [projectForm, setProjectForm] = useState(projects[0]);

  const [productionRecords, setProductionRecords] = useState([
    { id: 101, projectId: 1, crew: "MIGUEL", date: "2026-04-06", start: "00+00", end: "03+50", footage: 350, reference: "", comments: "No comments added.", attachments: [] },
    { id: 102, projectId: 1, crew: "FRANK", date: "2026-04-15", start: "03+50", end: "06+00", footage: 250, reference: "", comments: "No comments added.", attachments: [] },
    { id: 103, projectId: 1, crew: "NALDI", date: "2026-04-05", start: "06+00", end: "07+50", footage: 150, reference: "", comments: "No comments added.", attachments: [] },
    { id: 104, projectId: 1, crew: "NALDI", date: "2026-04-08", start: "10+00", end: "12+50", footage: 250, reference: "", comments: "No comments added.", attachments: [] },
    { id: 105, projectId: 1, crew: "YOYI", date: "2026-04-14", start: "12+50", end: "18+50", footage: 600, reference: "", comments: "No comments added.", attachments: [] },
  ]);

  const [ticketRecords, setTicketRecords] = useState([
    { id: 201, projectId: 1, areaSection: "", ticketNumber: "123456789", status: "Open", pendingUtility: "", expirationDate: "", coverage: "", notes: "" },
    { id: 202, projectId: 1, areaSection: "15+00 TO 20+00", ticketNumber: "16868915", status: "Pending", pendingUtility: "", expirationDate: "", coverage: "", notes: "" },
  ]);

  const [ticketForm, setTicketForm] = useState(emptyTicketForm);
  const [editingTicketId, setEditingTicketId] = useState(null);

  const [productionForm, setProductionForm] = useState(emptyProductionForm);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(103);
  const [selectedCrews, setSelectedCrews] = useState([]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );

  const displayProject = useMemo(
    () => ({
      ...(selectedProject || {}),
      ...(projectForm || {}),
      crews: selectedProject?.crews || [],
    }),
    [selectedProject, projectForm]
  );

  const projectRecords = useMemo(
    () => productionRecords.filter((record) => record.projectId === selectedProjectId),
    [productionRecords, selectedProjectId]
  );

  const projectTickets = useMemo(
    () => ticketRecords.filter((ticket) => ticket.projectId === selectedProjectId),
    [ticketRecords, selectedProjectId]
  );

  const selectedRecord =
    projectRecords.find((record) => record.id === selectedRecordId) || null;

  const crewOptions = useMemo(() => {
    const names = new Set(selectedProject?.crews || []);
    if (productionForm.crew && productionForm.crew.trim()) {
      names.add(normalizeCrewName(productionForm.crew));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [selectedProject, productionForm.crew]);

  const progress = useMemo(
    () => getProjectProgress(displayProject, projectRecords),
    [displayProject, projectRecords]
  );

  const crewSummary = useMemo(
    () => getCrewSummary(projectRecords),
    [projectRecords]
  );

  const gaps = useMemo(
    () => getGaps(displayProject, projectRecords),
    [displayProject, projectRecords]
  );

  const filteredRecords = useMemo(() => {
    if (!selectedCrews.length) return projectRecords;
    return projectRecords.filter((record) => selectedCrews.includes(record.crew));
  }, [projectRecords, selectedCrews]);

  const autoProjectTotal =
    projectForm.trackingType === "Station based"
      ? Math.max(stationToFeet(projectForm.endStation) - stationToFeet(projectForm.startStation), 0)
      : Number(projectForm.totalFootage || 0);

  const productionPreviewFootage =
    projectForm.trackingType === "Station based"
      ? getProductionFootage(productionForm.start, productionForm.end)
      : Number(productionForm.footage || 0);

  const saveProject = () => {
    const payload = {
      ...selectedProject,
      ...projectForm,
      id: selectedProjectId,
      crews: selectedProject?.crews || [],
      totalFootage:
        projectForm.trackingType === "Station based"
          ? autoProjectTotal
          : Number(projectForm.totalFootage || 0),
      startStation:
        projectForm.trackingType === "Station based" ? projectForm.startStation : "00+00",
      endStation:
        projectForm.trackingType === "Station based" ? projectForm.endStation : "00+00",
    };

    setProjectForm(payload);
    setProjects((prev) =>
      prev.map((project) => (project.id === selectedProjectId ? payload : project))
    );
  };

  const deleteProject = () => {
    const ok = window.confirm("Delete this project?");
    if (!ok) return;

    const remainingProjects = projects.filter((project) => project.id !== selectedProjectId);

    setProductionRecords((prev) =>
      prev.filter((record) => record.projectId !== selectedProjectId)
    );
    setTicketRecords((prev) =>
      prev.filter((ticket) => ticket.projectId !== selectedProjectId)
    );
    setSelectedCrews([]);
    setSelectedRecordId(null);
    setEditingRecordId(null);
    setEditingTicketId(null);
    setProductionForm(emptyProductionForm);
    setTicketForm(emptyTicketForm);

    if (remainingProjects.length) {
      const nextProject = remainingProjects[0];
      setProjects(remainingProjects);
      setSelectedProjectId(nextProject.id);
      setProjectForm(nextProject);
    } else {
      const id = Date.now();
      const fallbackProject = {
        id,
        ...emptyProjectForm,
        name: "New Project",
        client: "",
        endStation: "00+00",
        crews: [],
      };
      setProjects([fallbackProject]);
      setSelectedProjectId(id);
      setProjectForm(fallbackProject);
    }
  };

  const newProject = () => {
    const id = Date.now();
    const project = {
      id,
      ...emptyProjectForm,
      name: "New Project",
      client: "",
      startStation: "00+00",
      endStation: "00+00",
      totalFootage: 0,
      comment: "",
      crews: [],
    };
    setProjects((prev) => [project, ...prev]);
    setSelectedProjectId(id);
    setProjectForm(project);
    setSelectedRecordId(null);
    setSelectedCrews([]);
    setEditingRecordId(null);
    setEditingTicketId(null);
    setProductionForm(emptyProductionForm);
    setTicketForm(emptyTicketForm);
  };

  const handleSaveProduction = () => {
    if (!selectedProjectId) {
      alert("Select a project first.");
      return;
    }

    if (
      !productionForm.crew ||
      !productionForm.date ||
      (projectForm.trackingType === "Station based" && (!productionForm.start || !productionForm.end)) ||
      (projectForm.trackingType === "Footage based" && !productionForm.footage)
    ) {
      alert("Fill the required fields before saving.");
      return;
    }

    const cleanCrew = normalizeCrewName(productionForm.crew);
    const existingAttachments =
      productionRecords.find((record) => record.id === editingRecordId)?.attachments || [];

    const normalizedFootage =
      projectForm.trackingType === "Station based"
        ? getProductionFootage(productionForm.start, productionForm.end)
        : Number(productionForm.footage || 0);

    const payload = {
      id: editingRecordId || Date.now(),
      projectId: selectedProjectId,
      ...productionForm,
      crew: cleanCrew,
      start: projectForm.trackingType === "Station based" ? productionForm.start : "",
      end: projectForm.trackingType === "Station based" ? productionForm.end : "",
      footage: normalizedFootage,
      attachments: existingAttachments,
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

    setProjects((prev) =>
      prev.map((project) =>
        project.id === selectedProjectId
          ? {
              ...project,
              crews: project.crews?.includes(cleanCrew)
                ? project.crews
                : [...(project.crews || []), cleanCrew].sort((a, b) => a.localeCompare(b)),
            }
          : project
      )
    );

    setProductionForm(emptyProductionForm);
    setEditingRecordId(null);
  };

  const handleEditProduction = (record) => {
    setEditingRecordId(record.id);
    setSelectedRecordId(record.id);
    setProductionForm({
      crew: record.crew,
      date: record.date,
      start: record.start || "",
      end: record.end || "",
      footage: record.footage || "",
      reference: record.reference || "",
      comments: record.comments || "",
    });
  };

  const handleDeleteProduction = (id) => {
    const ok = window.confirm("Delete this production row?");
    if (!ok) return;

    setProductionRecords((prev) => prev.filter((record) => record.id !== id));
    if (selectedRecordId === id) setSelectedRecordId(null);
    if (editingRecordId === id) {
      setEditingRecordId(null);
      setProductionForm(emptyProductionForm);
    }
  };

  const handleUploadFile = (recordId, files) => {
    const safeFiles = Array.from(files || []);
    if (!safeFiles.length) return;

    const newFiles = safeFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setProductionRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? { ...record, attachments: [...(record.attachments || []), ...newFiles] }
          : record
      )
    );
  };

  const saveTicket = () => {
    if (!selectedProjectId) {
      alert("Select a project first.");
      return;
    }

    if (!ticketForm.ticketNumber && !ticketForm.areaSection) {
      alert("Add at least ticket number or area / section.");
      return;
    }

    const payload = { id: editingTicketId || Date.now(), projectId: selectedProjectId, ...ticketForm };

    if (editingTicketId) {
      setTicketRecords((prev) =>
        prev.map((ticket) => (ticket.id === editingTicketId ? payload : ticket))
      );
    } else {
      setTicketRecords((prev) => [...prev, payload]);
    }

    setTicketForm(emptyTicketForm);
    setEditingTicketId(null);
  };

  const editTicket = (ticket) => {
    setEditingTicketId(ticket.id);
    setTicketForm({
      areaSection: ticket.areaSection || "",
      ticketNumber: ticket.ticketNumber || "",
      status: ticket.status || "Open",
      pendingUtility: ticket.pendingUtility || "",
      expirationDate: ticket.expirationDate || "",
      coverage: ticket.coverage || "",
      notes: ticket.notes || "",
    });
  };

  const deleteTicket = (id) => {
    const ok = window.confirm("Delete this ticket?");
    if (!ok) return;
    setTicketRecords((prev) => prev.filter((ticket) => ticket.id !== id));
    if (editingTicketId === id) {
      setEditingTicketId(null);
      setTicketForm(emptyTicketForm);
    }
  };

  const toggleCrewFilter = (crew) => {
    setSelectedCrews((prev) =>
      prev.includes(crew) ? prev.filter((item) => item !== crew) : [...prev, crew]
    );
  };

  return (
    <div style={pageStyle}>
      <div style={layoutGrid}>
        <div style={mainBottom}>
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
                  setSelectedCrews([]);
                  setSelectedRecordId(null);
                  setEditingRecordId(null);
                  setEditingTicketId(null);
                  setProductionForm(emptyProductionForm);
                  setTicketForm(emptyTicketForm);
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
              <span style={metaPill}>Project: {displayProject?.name || "No project"}</span>
              <span style={metaPill}>Type: {displayProject?.trackingType}</span>
              <span style={metaPill}>Status: {displayProject?.status}</span>
              {displayProject?.trackingType === "Station based" ? (
                <span style={metaPill}>
                  Stations: {displayProject?.startStation} to {displayProject?.endStation}
                </span>
              ) : (
                <span style={metaPill}>Total: {formatFeet(progress.total)}</span>
              )}
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
              <strong>Status note:</strong> {displayProject?.comment || "No project comment added."}
            </div>

            <div style={{ marginTop: 16 }}>
              <ProductionLine
                project={displayProject}
                records={projectRecords}
                selectedRecordId={selectedRecordId}
                onSelectRecord={(record) => setSelectedRecordId(record.id)}
              />
            </div>
          </div>

          <div style={sectionCard}>
            <h2 style={{ marginTop: 0 }}>Project Setup</h2>

            <div style={formGrid2}>
              <div>
                <div style={smallLabel}>Project name</div>
                <input style={inputStyle} value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              </div>
              <div>
                <div style={smallLabel}>Client</div>
                <input style={inputStyle} value={projectForm.client} onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })} />
              </div>
              <div>
                <div style={smallLabel}>Tracking type</div>
                <select
                  style={inputStyle}
                  value={projectForm.trackingType}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      trackingType: e.target.value,
                      startStation: e.target.value === "Station based" ? projectForm.startStation || "00+00" : "00+00",
                      endStation: e.target.value === "Station based" ? projectForm.endStation || "00+00" : "00+00",
                    })
                  }
                >
                  <option>Station based</option>
                  <option>Footage based</option>
                </select>
              </div>
              <div>
                <div style={smallLabel}>
                  Total footage {projectForm.trackingType === "Station based" ? "(auto)" : ""}
                </div>
                <input
                  style={{ ...inputStyle, background: projectForm.trackingType === "Station based" ? "#f8fafc" : "#fff", color: projectForm.trackingType === "Station based" ? "#475569" : "#111827" }}
                  value={projectForm.trackingType === "Station based" ? autoProjectTotal : projectForm.totalFootage}
                  readOnly={projectForm.trackingType === "Station based"}
                  onChange={(e) => setProjectForm({ ...projectForm, totalFootage: Number(e.target.value || 0) })}
                />
              </div>

              {projectForm.trackingType === "Station based" && (
                <>
                  <div>
                    <div style={smallLabel}>Project start station</div>
                    <input style={inputStyle} value={projectForm.startStation} onChange={(e) => setProjectForm({ ...projectForm, startStation: e.target.value })} />
                  </div>
                  <div>
                    <div style={smallLabel}>Project end station</div>
                    <input style={inputStyle} value={projectForm.endStation} onChange={(e) => setProjectForm({ ...projectForm, endStation: e.target.value })} />
                  </div>
                </>
              )}

              <div>
                <div style={smallLabel}>Project status</div>
                <select style={inputStyle} value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Waiting on Permits</option>
                  <option>Completed</option>
                </select>
              </div>
            </div>

            {projectForm.trackingType === "Station based" && (
              <div style={helperNote}>
                Total footage is protected and calculated automatically from start station and end station.
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={smallLabel}>Project comment / hold note</div>
              <textarea style={{ ...inputStyle, minHeight: 100 }} value={projectForm.comment} onChange={(e) => setProjectForm({ ...projectForm, comment: e.target.value })} />
            </div>

            <div style={{ ...actionRow, marginTop: 14 }}>
              <button style={primaryBtn} onClick={saveProject}>Update project</button>
              <button style={lightBtn} onClick={() => setProjectForm(selectedProject)}>Clear form</button>
            </div>
          </div>

          <div style={sectionCard}>
            <h2 style={{ marginTop: 0, textAlign: "center" }}>Add Section Record</h2>
            <p style={{ marginTop: 0, color: "#4b5563", fontSize: 14, textAlign: "center" }}>
              {projectForm.trackingType === "Station based"
                ? "Type a new crew name whenever you need. Once saved, that crew becomes available for this project."
                : "For footage based projects, enter the crew and direct footage. The production line will fill cumulatively from left to right."}
            </p>

            <div style={formGrid2}>
              <div>
                <div style={smallLabel}>Crew</div>
                <input
                  list="crew-options"
                  style={inputStyle}
                  value={productionForm.crew}
                  onChange={(e) => setProductionForm({ ...productionForm, crew: e.target.value })}
                  placeholder="Type or select crew"
                />
                <datalist id="crew-options">
                  {crewOptions.map((crew) => (
                    <option key={crew} value={crew} />
                  ))}
                </datalist>
              </div>

              <div>
                <div style={smallLabel}>Date</div>
                <input type="date" style={inputStyle} value={productionForm.date} onChange={(e) => setProductionForm({ ...productionForm, date: e.target.value })} />
              </div>

              {projectForm.trackingType === "Station based" ? (
                <>
                  <div>
                    <div style={smallLabel}>Start station</div>
                    <input style={inputStyle} value={productionForm.start} onChange={(e) => setProductionForm({ ...productionForm, start: e.target.value })} />
                  </div>

                  <div>
                    <div style={smallLabel}>End station</div>
                    <input style={inputStyle} value={productionForm.end} onChange={(e) => setProductionForm({ ...productionForm, end: e.target.value })} />
                  </div>

                  <div>
                    <div style={smallLabel}>Footage (auto)</div>
                    <input style={{ ...inputStyle, background: "#f8fafc", color: "#475569" }} value={productionPreviewFootage} readOnly />
                  </div>
                </>
              ) : (
                <div>
                  <div style={smallLabel}>Footage</div>
                  <input
                    style={inputStyle}
                    value={productionForm.footage}
                    onChange={(e) => setProductionForm({ ...productionForm, footage: e.target.value })}
                    placeholder="Enter direct footage"
                  />
                </div>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={smallLabel}>Reference</div>
                <input style={inputStyle} value={productionForm.reference} onChange={(e) => setProductionForm({ ...productionForm, reference: e.target.value })} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={smallLabel}>Comments</div>
                <textarea style={{ ...inputStyle, minHeight: 90 }} value={productionForm.comments} onChange={(e) => setProductionForm({ ...productionForm, comments: e.target.value })} />
              </div>
            </div>

            <div style={{ ...actionRow, marginTop: 14 }}>
              <button style={primaryBtn} onClick={handleSaveProduction}>
                {editingRecordId ? "Update Section" : "Save Section"}
              </button>
              <button style={lightBtn} onClick={() => { setProductionForm(emptyProductionForm); setEditingRecordId(null); }}>
                Clear
              </button>
            </div>
          </div>

          <div style={sectionCard}>
            <div style={smallLabel}>Filter production by crew</div>
            <div style={filterWrap}>
              <button
                type="button"
                style={!selectedCrews.length ? selectedFilterChip : filterChip}
                onClick={() => setSelectedCrews([])}
              >
                All crews
              </button>

              {crewOptions.map((crew) => (
                <button
                  key={crew}
                  type="button"
                  style={selectedCrews.includes(crew) ? selectedFilterChip : filterChip}
                  onClick={() => toggleCrewFilter(crew)}
                >
                  {crew}
                </button>
              ))}
            </div>

            <h2 style={{ marginTop: 24, marginBottom: 8 }}>Saved Section Records</h2>

            <div style={tableCard}>
              <div style={tableHeaderOld}>
                <div>Crew</div>
                <div>{projectForm.trackingType === "Station based" ? "Range" : "Reference"}</div>
                <div>Date</div>
                <div>Feet</div>
                <div>Attachments</div>
                <div>Actions</div>
              </div>

              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecordId(record.id)}
                  style={{
                    ...tableRowOld,
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
                  <div>{displayProject.trackingType === "Station based" ? `${record.start} to ${record.end}` : (record.reference || "—")}</div>
                  <div>{record.date}</div>
                  <div>{record.footage}</div>

                  <div>
                    {record.attachments?.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {record.attachments.map((file, index) => (
                          <div key={index} style={{ fontSize: 12, lineHeight: 1.35 }}>
                            <div style={{ color: "#334155" }}>{file.name}</div>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#2563eb", textDecoration: "none" }}
                            >
                              Open
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>No files</div>
                    )}

                    <label style={{ ...uploadButton, marginTop: 8 }}>
                      Attach bore log
                      <input
                        type="file"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUploadFile(record.id, e.target.files);
                        }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={tableButton} onClick={(e) => { e.stopPropagation(); handleEditProduction(record); }}>
                      Edit
                    </button>
                    <button style={tableButton} onClick={(e) => { e.stopPropagation(); handleDeleteProduction(record.id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {!filteredRecords.length && (
                <div style={{ padding: 18, color: "#64748b" }}>No production saved yet for this filter.</div>
              )}
            </div>

            <h2 style={{ marginTop: 28, textAlign: "left", marginBottom: 6 }}>811 Ticket Control</h2>
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 14 }}>
              Track ticket readiness, coverage, pending utilities, and what area each ticket covers for supervisor visibility.
            </div>

            <div style={formGrid2}>
              <div>
                <div style={smallLabel}>Area / Section</div>
                <input style={inputStyle} value={ticketForm.areaSection} onChange={(e) => setTicketForm({ ...ticketForm, areaSection: e.target.value })} placeholder="Area 5, North block, Section B, etc." />
              </div>

              <div>
                <div style={smallLabel}>Ticket number</div>
                <input style={inputStyle} value={ticketForm.ticketNumber} onChange={(e) => setTicketForm({ ...ticketForm, ticketNumber: e.target.value })} placeholder="Sunshine 811 ticket number" />
              </div>

              <div>
                <div style={smallLabel}>Status</div>
                <select style={inputStyle} value={ticketForm.status} onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value })}>
                  <option>Open</option>
                  <option>Pending</option>
                  <option>Clear</option>
                  <option>Expired</option>
                </select>
              </div>

              <div>
                <div style={smallLabel}>Pending utility</div>
                <input style={inputStyle} value={ticketForm.pendingUtility} onChange={(e) => setTicketForm({ ...ticketForm, pendingUtility: e.target.value })} placeholder="FPL, Water, Gas, Comcast, etc." />
              </div>

              <div>
                <div style={smallLabel}>Expiration date</div>
                <input type="date" style={inputStyle} value={ticketForm.expirationDate} onChange={(e) => setTicketForm({ ...ticketForm, expirationDate: e.target.value })} />
              </div>

              <div>
                <div style={smallLabel}>Days left</div>
                <input style={{ ...inputStyle, color: getDaysLeft(ticketForm.expirationDate).color }} value={getDaysLeft(ticketForm.expirationDate).text} readOnly />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={smallLabel}>Coverage / Description</div>
                <input style={inputStyle} value={ticketForm.coverage} onChange={(e) => setTicketForm({ ...ticketForm, coverage: e.target.value })} placeholder="Street 1 to Street 2, intersection A/B to C/D, houses 101 to 145, etc." />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={smallLabel}>Notes</div>
                <textarea style={{ ...inputStyle, minHeight: 100 }} value={ticketForm.notes} onChange={(e) => setTicketForm({ ...ticketForm, notes: e.target.value })} placeholder="Anything your supervisor should know about this ticket" />
              </div>
            </div>

            <div style={{ ...actionRow, marginTop: 14 }}>
              <button style={primaryBtn} onClick={saveTicket}>
                {editingTicketId ? "Update Ticket" : "Save Ticket"}
              </button>
              <button style={lightBtn} onClick={() => { setTicketForm(emptyTicketForm); setEditingTicketId(null); }}>
                Clear Ticket Form
              </button>
            </div>

            <h2 style={{ marginTop: 24, marginBottom: 8 }}>Saved Tickets</h2>
            <div style={tableCard}>
              <div style={tableHeaderTickets}>
                <div>Area</div>
                <div>Ticket</div>
                <div>Status</div>
                <div>Pending utility</div>
                <div>Expiration</div>
                <div>Days left</div>
                <div>Coverage</div>
                <div>Actions</div>
              </div>

              {projectTickets.map((ticket) => {
                const daysLeft = getDaysLeft(ticket.expirationDate);
                const ticketStatus = getTicketStatusStyle(ticket.status);
                return (
                  <div key={ticket.id} style={tableRowTickets}>
                    <div>{ticket.areaSection || "—"}</div>
                    <div>{ticket.ticketNumber || "—"}</div>
                    <div>
                      <span style={{ ...statusChip, background: ticketStatus.background, color: ticketStatus.color }}>
                        {ticket.status}
                      </span>
                    </div>
                    <div>{ticket.pendingUtility || "—"}</div>
                    <div>{ticket.expirationDate || "—"}</div>
                    <div style={{ color: daysLeft.color }}>{daysLeft.text}</div>
                    <div>{ticket.coverage || "—"}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={tableButton} onClick={() => editTicket(ticket)}>Edit</button>
                      <button style={tableButton} onClick={() => deleteTicket(ticket.id)}>Delete</button>
                    </div>
                  </div>
                );
              })}

              {!projectTickets.length && (
                <div style={{ padding: 18, color: "#64748b" }}>No tickets saved yet for this project.</div>
              )}
            </div>
          </div>
        </div>

        <div style={reviewPanel}>
          <div style={reviewHeaderCard}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Project Review</h2>
          </div>

          <div style={reviewCard}>
            <div style={reviewTitle}>Project Overview</div>

            <div style={reviewSection}>
              <div style={bigLabel}>Project status</div>
              <span style={statusBadge}>{displayProject?.status || "Active"}</span>
            </div>

            <div style={reviewSection}>
              <div style={bigLabel}>Project comment</div>
              <div style={smallCommentText}>{displayProject?.comment || "No project comment added."}</div>
            </div>

            <div style={reviewSection}>
              <div style={{ fontWeight: 700, fontSize: 28 }}>{selectedRecord?.crew || "No crew selected"}</div>
              <div>
                {selectedRecord
                  ? displayProject?.trackingType === "Station based"
                    ? `${selectedRecord.start} to ${selectedRecord.end}`
                    : `${selectedRecord.footage} ft recorded`
                  : "No production selected yet."}
              </div>
              <div>{selectedRecord?.date || ""}</div>
              <div>{selectedRecord ? `${selectedRecord.footage} ft` : ""}</div>
            </div>

            <div style={reviewSection}>
              <div style={bigLabel}>Reference</div>
              <div style={smallCommentText}>{selectedRecord?.reference || "No reference added."}</div>
            </div>

            <div style={reviewSection}>
              <div style={bigLabel}>Comments</div>
              <div style={smallCommentText}>{selectedRecord?.comments || "No comments added."}</div>
            </div>

            <div style={reviewSection}>
              <div style={bigLabel}>Attachments</div>
              {selectedRecord?.attachments?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedRecord.attachments.map((file, index) => (
                    <div key={index} style={{ fontSize: 13 }}>
                      <div style={{ color: "#334155" }}>{file.name}</div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", textDecoration: "none" }}
                      >
                        Open file
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={smallCommentText}>No attachments.</div>
              )}
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
            <div style={reviewTitle}>Saved crews in this project</div>
            {crewOptions.length ? crewOptions.map((crew) => (
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
              </div>
            )) : <div>No crews saved yet.</div>}
          </div>

          {displayProject?.trackingType === "Station based" && (
            <div style={reviewCard}>
              <div style={reviewTitle}>Open Gaps</div>
              {gaps.length ? gaps.map((gap, index) => (
                <div key={index} style={gapRow}>
                  <strong>{formatStation(gap.start)} to {formatStation(gap.end)}</strong>
                  <div>{gap.end - gap.start} ft unfinished</div>
                </div>
              )) : <div>No gaps found.</div>}
            </div>
          )}

          <div style={reviewCard}>
            <div style={reviewTitle}>Ticket Readiness</div>
            {projectTickets.length ? projectTickets.map((ticket) => {
              const ticketStatus = getTicketStatusStyle(ticket.status);
              return (
                <div key={ticket.id} style={gapRow}>
                  <strong>{ticket.ticketNumber || "No ticket number"}</strong>
                  <div>{ticket.areaSection || "No area / section"}</div>
                  <div>
                    <span style={{ ...statusChip, background: ticketStatus.background, color: ticketStatus.color }}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              );
            }) : <div>No ticket records yet.</div>}
          </div>
        </div>
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

const layoutGrid = {
  display: "grid",
  gridTemplateColumns: "1.8fr 1fr",
  gap: 20,
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

const reviewHeaderCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
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

const statusBadge = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  fontSize: 11,
  fontWeight: 600,
};

const statusChip = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 700,
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

const helperNote = {
  marginTop: 10,
  fontSize: 13,
  color: "#475569",
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

const uploadButton = {
  display: "inline-block",
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: 12,
  textAlign: "center",
};

const smallLabel = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const bigLabel = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 8,
};

const smallCommentText = {
  fontSize: 13,
  color: "#4b5563",
  lineHeight: 1.45,
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

const tableHeaderOld = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr 1.4fr 1fr",
  gap: 12,
  padding: 14,
  background: "#f8fafc",
  fontWeight: 700,
  fontSize: 13,
};

const tableRowOld = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr 1.4fr 1fr",
  gap: 12,
  padding: 14,
  borderTop: "1px solid #e5e7eb",
  alignItems: "center",
};

const tableHeaderTickets = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 0.9fr 1fr 1fr 1fr 1.2fr 1fr",
  gap: 12,
  padding: 14,
  background: "#f8fafc",
  fontWeight: 700,
  fontSize: 13,
};

const tableRowTickets = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 0.9fr 1fr 1fr 1fr 1.2fr 1fr",
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
};

const filterWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const filterChip = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const selectedFilterChip = {
  ...filterChip,
  background: "#e0f2fe",
  border: "1px solid #7dd3fc",
};
