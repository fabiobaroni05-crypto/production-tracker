import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ndycecqlnnmaccdozvzi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_TmjE3ZwWSDDazuOFcQHYxA_TsPMXj8C'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const crewOptions = ['MIGUEL', 'NALDI', 'YOYI', 'FRANK']
const projectStatuses = ['Active', 'On Hold', 'Waiting on Permits', 'Completed']
const ticketStatuses = ['Open', 'Pending', 'Clear', 'Expired']

function stationToFeet(station) {
  if (!station) return 0
  const cleaned = String(station).trim()
  const [a = '0', b = '0'] = cleaned.split('+')
  return Number(a) * 100 + Number(b)
}

function formatFeet(value) {
  return `${Number(value || 0).toLocaleString()} ft`
}

function formatStation(feet) {
  const safe = Math.max(0, Math.round(Number(feet) || 0))
  return `${String(Math.floor(safe / 100)).padStart(2, '0')}+${String(safe % 100).padStart(2, '0')}`
}

function getDaysLeft(expirationDate) {
  if (!expirationDate) return { text: 'No date', color: '#64748b' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expirationDate}T00:00:00`)
  const diff = Math.round((exp - today) / 86400000)
  if (diff < 0) return { text: `Expired ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`, color: '#b91c1c' }
  if (diff === 0) return { text: 'Expires today', color: '#b91c1c' }
  if (diff <= 5) return { text: `${diff} day${diff === 1 ? '' : 's'} left`, color: '#b45309' }
  return { text: `${diff} day${diff === 1 ? '' : 's'} left`, color: '#15803d' }
}

function getProjectProgress(project, records) {
  if (!project) return { finished: 0, total: 0, remaining: 0, percent: 0 }
  const total = Number(project.total_feet || 0)
  const finished = records
    .filter((r) => r.project_id === project.id)
    .reduce((sum, r) => sum + Number(r.footage || 0), 0)
  const remaining = Math.max(total - finished, 0)
  const percent = total ? Math.min(100, Math.round((finished / total) * 100)) : 0
  return { finished, total, remaining, percent }
}

function crewColor(crew) {
  const colors = {
    MIGUEL: '#22c55e',
    NALDI: '#3b82f6',
    YOYI: '#f97316',
    FRANK: '#8b5cf6',
  }
  return colors[crew] || '#94a3b8'
}

function getProjectBounds(project) {
  if (!project) return { start: 0, end: 0, length: 0 }

  if (project.mode === 'footage') {
    const total = Number(project.total_feet || 0)
    return { start: 0, end: total, length: total }
  }

  const start = stationToFeet(project.start_station)
  const end = stationToFeet(project.end_station)
  return { start, end, length: Math.max(end - start, 0) }
}

function getMergedFinished(project, records) {
  const bounds = getProjectBounds(project)

  const ranges = records
    .filter((r) => r.project_id === project?.id)
    .map((r) => {
      let start = 0
      let end = 0

      if (project?.mode === 'footage') {
        const footage = Number(r.footage || 0)
        start = Number(r.start_num || 0)
        end = start + footage
      } else {
        start = stationToFeet(r.start_value)
        end = stationToFeet(r.end_value)
      }

      return {
        start: Math.max(start, bounds.start),
        end: Math.min(end, bounds.end),
      }
    })
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  const merged = []
  for (const r of ranges) {
    if (!merged.length || r.start > merged[merged.length - 1].end) {
      merged.push({ ...r })
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end)
    }
  }

  return merged
}

function getGaps(project, records) {
  const bounds = getProjectBounds(project)
  const merged = getMergedFinished(project, records)
  const gaps = []

  let cursor = bounds.start
  for (const seg of merged) {
    if (seg.start > cursor) {
      gaps.push({ start: cursor, end: seg.start })
    }
    cursor = Math.max(cursor, seg.end)
  }

  if (cursor < bounds.end) {
    gaps.push({ start: cursor, end: bounds.end })
  }

  return gaps
}

function formatRangeLabel(project, row) {
  if (!project) return ''
  if (project.mode === 'footage') {
    const start = Number(row.start_num || 0)
    const end = start + Number(row.footage || 0)
    return `${start.toLocaleString()} ft to ${end.toLocaleString()} ft`
  }
  return `${row.start_value} to ${row.end_value}`
}

function SectionFileUpload({ projectId, productionId, onUploaded }) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !projectId || !productionId) return
    setUploading(true)
    try {
      const path = `${projectId}/${productionId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('bore-logs').upload(path, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('bore-logs').getPublicUrl(path)

      const { error: insertError } = await supabase.from('files').insert({
        project_id: projectId,
        production_id: productionId,
        file_name: file.name,
        file_url: data.publicUrl,
      })
      if (insertError) throw insertError

      onUploaded?.()
    } catch (error) {
      alert(error.message || 'Could not upload file.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <label style={{ cursor: 'pointer' }}>
      <input
        type="file"
        style={{ display: 'none' }}
        onChange={handleUpload}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
      />
      <span
        style={{
          display: 'inline-block',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          padding: '8px 12px',
          background: '#fff',
          fontSize: 14,
        }}
      >
        {uploading ? 'Uploading...' : 'Upload bore log'}
      </span>
    </label>
  )
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [production, setProduction] = useState([])
  const [tickets, setTickets] = useState([])
  const [files, setFiles] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCrew, setSelectedCrew] = useState('All')

  const [projectForm, setProjectForm] = useState({
    name: '',
    client: '',
    mode: 'station',
    total_feet: '',
    start_station: '00+00',
    end_station: '00+00',
    status: 'Active',
    comment: '',
  })

  const [productionForm, setProductionForm] = useState({
    crew: '',
    date: '',
    start_value: '',
    end_value: '',
    footage: '',
    reference: '',
    comments: '',
  })

  const [ticketForm, setTicketForm] = useState({
    ticket_number: '',
    area: '',
    status: 'Open',
    pending_utility: '',
    expiration_date: '',
    coverage: '',
    notes: '',
  })

  const loadAll = async () => {
    setLoading(true)
    try {
      const [projectsRes, prodRes, ticketsRes, filesRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('production_records').select('*').order('date', { ascending: false }),
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('files').select('*').order('created_at', { ascending: false }),
      ])

      if (projectsRes.error) throw projectsRes.error
      if (prodRes.error) throw prodRes.error
      if (ticketsRes.error) throw ticketsRes.error
      if (filesRes.error) throw filesRes.error

      setProjects(projectsRes.data || [])
      setProduction(prodRes.data || [])
      setTickets(ticketsRes.data || [])
      setFiles(filesRes.data || [])

      const firstProjectId = selectedProjectId || projectsRes.data?.[0]?.id || ''
      setSelectedProjectId(firstProjectId)
    } catch (error) {
      alert(error.message || 'Could not load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  const projectProduction = useMemo(
    () => production.filter((row) => row.project_id === selectedProjectId),
    [production, selectedProjectId]
  )

  const projectTickets = useMemo(
    () => tickets.filter((row) => row.project_id === selectedProjectId),
    [tickets, selectedProjectId]
  )

  const progress = useMemo(
    () => getProjectProgress(selectedProject, projectProduction),
    [selectedProject, projectProduction]
  )

  const bounds = useMemo(
    () => getProjectBounds(selectedProject),
    [selectedProject]
  )

  const gaps = useMemo(
    () => getGaps(selectedProject, projectProduction),
    [selectedProject, projectProduction]
  )

  const filteredProduction = useMemo(() => {
    if (selectedCrew === 'All') return projectProduction
    return projectProduction.filter((row) => row.crew === selectedCrew)
  }, [projectProduction, selectedCrew])

  const crewSummary = useMemo(() => {
    const summary = {}
    projectProduction.forEach((row) => {
      const crew = row.crew || 'Unknown'
      if (!summary[crew]) summary[crew] = 0
      summary[crew] += Number(row.footage || 0)
    })
    return summary
  }, [projectProduction])

  const createProject = async () => {
    try {
      const payload = {
        ...projectForm,
        total_feet: Number(projectForm.total_feet || 0),
      }
      const { data, error } = await supabase.from('projects').insert(payload).select().single()
      if (error) throw error

      setProjectForm({
        name: '',
        client: '',
        mode: 'station',
        total_feet: '',
        start_station: '00+00',
        end_station: '00+00',
        status: 'Active',
        comment: '',
      })

      await loadAll()
      setSelectedProjectId(data.id)
    } catch (error) {
      alert(error.message || 'Could not create project.')
    }
  }

  const createProduction = async () => {
    if (!selectedProjectId) return alert('Select a project first.')
    try {
      const footage =
        selectedProject?.mode === 'footage'
          ? Number(productionForm.footage || 0)
          : Math.max(stationToFeet(productionForm.end_value) - stationToFeet(productionForm.start_value), 0)

      let startNum = 0
      if (selectedProject?.mode === 'footage') {
        startNum = projectProduction.reduce((sum, r) => sum + Number(r.footage || 0), 0)
      }

      const payload = {
        project_id: selectedProjectId,
        crew: productionForm.crew,
        date: productionForm.date,
        start_value: productionForm.start_value,
        end_value: productionForm.end_value,
        start_num: startNum,
        footage,
        reference: productionForm.reference,
        comments: productionForm.comments,
      }

      const { error } = await supabase.from('production_records').insert(payload)
      if (error) throw error

      setProductionForm({
        crew: '',
        date: '',
        start_value: '',
        end_value: '',
        footage: '',
        reference: '',
        comments: '',
      })

      await loadAll()
    } catch (error) {
      alert(error.message || 'Could not save production record.')
    }
  }

  const createTicket = async () => {
    if (!selectedProjectId) return alert('Select a project first.')
    try {
      const payload = { ...ticketForm, project_id: selectedProjectId }
      const { error } = await supabase.from('tickets').insert(payload)
      if (error) throw error

      setTicketForm({
        ticket_number: '',
        area: '',
        status: 'Open',
        pending_utility: '',
        expiration_date: '',
        coverage: '',
        notes: '',
      })

      await loadAll()
    } catch (error) {
      alert(error.message || 'Could not save ticket.')
    }
  }

  const fileMap = useMemo(() => {
    const map = {}
    files.forEach((f) => {
      if (!map[f.production_id]) map[f.production_id] = []
      map[f.production_id].push(f)
    })
    return map
  }, [files])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 24 }}>
          Loading website...
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Projects</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Project name</div>
              <input style={inputStyle} value={projectForm.name} onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Client</div>
              <input style={inputStyle} value={projectForm.client} onChange={(e) => setProjectForm((s) => ({ ...s, client: e.target.value }))} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tracking type</div>
              <select style={inputStyle} value={projectForm.mode} onChange={(e) => setProjectForm((s) => ({ ...s, mode: e.target.value }))}>
                <option value="station">Station based</option>
                <option value="footage">Footage based</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Total footage</div>
              <input style={inputStyle} value={projectForm.total_feet} onChange={(e) => setProjectForm((s) => ({ ...s, total_feet: e.target.value }))} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Status</div>
              <select style={inputStyle} value={projectForm.status} onChange={(e) => setProjectForm((s) => ({ ...s, status: e.target.value }))}>
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {projectForm.mode === 'station' && (
              <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Start station</div>
                  <input style={inputStyle} value={projectForm.start_station} onChange={(e) => setProjectForm((s) => ({ ...s, start_station: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>End station</div>
                  <input style={inputStyle} value={projectForm.end_station} onChange={(e) => setProjectForm((s) => ({ ...s, end_station: e.target.value }))} />
                </div>
              </>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Project comment</div>
              <textarea style={{ ...inputStyle, minHeight: 90 }} value={projectForm.comment} onChange={(e) => setProjectForm((s) => ({ ...s, comment: e.target.value }))} />
            </div>

            <button style={primaryBtn} onClick={createProject}>Create project</button>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Saved projects</div>
            <div style={{ display: 'grid', gap: 10, maxHeight: 360, overflow: 'auto' }}>
              {projects.map((project) => {
                const p = getProjectProgress(project, production)
                const selected = selectedProjectId === project.id
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: 18,
                      border: selected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      background: selected ? '#0f172a' : '#fff',
                      color: selected ? '#fff' : '#0f172a',
                      padding: 16,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>{project.name || 'Untitled Project'}</strong>
                      <span style={badgeStyle}>{project.status || 'Active'}</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{project.client || 'No client'}</div>
                    <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: selected ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ width: `${p.percent}%`, height: '100%', background: '#22c55e' }} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{p.percent}% complete</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 24 }}>
            {selectedProject ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h1 style={{ margin: 0 }}>{selectedProject.name}</h1>
                    <div style={{ color: '#64748b', marginTop: 4 }}>{selectedProject.client}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={badgeStyle}>{selectedProject.mode === 'footage' ? 'Footage based' : 'Station based'}</span>
                    <span style={badgeStyle}>{selectedProject.status || 'Active'}</span>
                    <span style={badgeStyle}>{formatFeet(progress.total)}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={statCard}><div style={statLabel}>Finished footage</div><div style={statValue}>{progress.finished.toLocaleString()}</div></div>
                  <div style={statCard}><div style={statLabel}>Remaining footage</div><div style={statValue}>{progress.remaining.toLocaleString()}</div></div>
                  <div style={statCard}><div style={statLabel}>Project progress</div><div style={statValue}>{progress.percent}%</div></div>
                </div>

                <div style={{ marginTop: 18, border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, color: '#475569' }}>
                  <strong>Status note:</strong> {selectedProject.comment || 'No project comment added.'}
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                    <span>{selectedProject.mode === 'footage' ? '0 ft' : selectedProject.start_station}</span>
                    <span>{selectedProject.mode === 'footage' ? formatFeet(selectedProject.total_feet) : selectedProject.end_station}</span>
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      height: 38,
                      background: '#cbd5e1',
                      borderRadius: 999,
                      overflow: 'hidden',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    {selectedProject && bounds.length > 0 && projectProduction.map((row) => {
                      let start = 0
                      let end = 0

                      if (selectedProject.mode === 'footage') {
                        start = Number(row.start_num || 0)
                        end = start + Number(row.footage || 0)
                      } else {
                        start = stationToFeet(row.start_value)
                        end = stationToFeet(row.end_value)
                      }

                      const left = ((start - bounds.start) / bounds.length) * 100
                      const width = ((end - start) / bounds.length) * 100

                      return (
                        <div
                          key={row.id}
                          title={`${row.crew} • ${formatRangeLabel(selectedProject, row)}`}
                          style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${Math.max(width, 1)}%`,
                            top: 0,
                            bottom: 0,
                            background: crewColor(row.crew),
                            borderRight: '1px solid rgba(255,255,255,0.8)',
                          }}
                        />
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                    {crewOptions.map((crew) => (
                      <div
                        key={crew}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          border: '1px solid #e2e8f0',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 13,
                          background: '#fff',
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: crewColor(crew),
                            display: 'inline-block',
                          }}
                        />
                        {crew}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Open gaps</div>
                    {gaps.length ? (
                      gaps.map((gap, index) => (
                        <div
                          key={index}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 14,
                            padding: 12,
                            background: '#fff',
                            fontSize: 14,
                          }}
                        >
                          <strong>
                            {selectedProject.mode === 'footage'
                              ? `${gap.start.toLocaleString()} ft to ${gap.end.toLocaleString()} ft`
                              : `${formatStation(gap.start)} to ${formatStation(gap.end)}`}
                          </strong>
                          <div style={{ color: '#64748b', marginTop: 4 }}>
                            {(gap.end - gap.start).toLocaleString()} ft unfinished
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#64748b', fontSize: 14 }}>No gaps found. Entire line is finished.</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 18, padding: 32, textAlign: 'center', color: '#64748b' }}>
                Choose a project to start working.
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 24 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={tabStyle}>Production</span>
              <span style={tabStyle}>Tickets</span>
              <span style={tabStyle}>Files</span>
            </div>

            <h2>Production</h2>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              <select
                style={{ ...inputStyle, width: 220 }}
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
              >
                <option value="All">All crews</option>
                {crewOptions.map((crew) => (
                  <option key={crew} value={crew}>{crew}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20, display: 'grid', gap: 8 }}>
              <strong>Crew Production Summary</strong>
              {Object.keys(crewSummary).length ? (
                Object.entries(crewSummary).map(([crew, total]) => (
                  <div key={crew} style={{ color: '#475569' }}>
                    {crew}: {Number(total).toLocaleString()} ft
                  </div>
                ))
              ) : (
                <div style={{ color: '#64748b' }}>No production yet.</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Crew</div>
                <select style={inputStyle} value={productionForm.crew} onChange={(e) => setProductionForm((s) => ({ ...s, crew: e.target.value }))}>
                  <option value="">Select crew</option>
                  {crewOptions.map((crew) => <option key={crew} value={crew}>{crew}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Date</div>
                <input type="date" style={inputStyle} value={productionForm.date} onChange={(e) => setProductionForm((s) => ({ ...s, date: e.target.value }))} />
              </div>

              {selectedProject?.mode === 'footage' ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Footage</div>
                  <input style={inputStyle} value={productionForm.footage} onChange={(e) => setProductionForm((s) => ({ ...s, footage: e.target.value }))} />
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Start station</div>
                    <input style={inputStyle} value={productionForm.start_value} onChange={(e) => setProductionForm((s) => ({ ...s, start_value: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>End station</div>
                    <input style={inputStyle} value={productionForm.end_value} onChange={(e) => setProductionForm((s) => ({ ...s, end_value: e.target.value }))} />
                  </div>
                </>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Reference</div>
                <input style={inputStyle} value={productionForm.reference} onChange={(e) => setProductionForm((s) => ({ ...s, reference: e.target.value }))} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Comments</div>
                <textarea style={{ ...inputStyle, minHeight: 90 }} value={productionForm.comments} onChange={(e) => setProductionForm((s) => ({ ...s, comments: e.target.value }))} />
              </div>
            </div>

            <button style={{ ...primaryBtn, marginTop: 14 }} onClick={createProduction}>Save production</button>

            <div style={{ marginTop: 22, border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
              <div style={tableHeader}>
                <div>Crew</div>
                <div>Date</div>
                <div>Range</div>
                <div>Feet</div>
                <div>Reference</div>
                <div>Bore logs</div>
                <div>Upload</div>
              </div>

              {filteredProduction.map((row) => (
                <div key={row.id} style={tableRow}>
                  <div><strong>{row.crew}</strong></div>
                  <div>{row.date}</div>
                  <div>{formatRangeLabel(selectedProject, row)}</div>
                  <div>{row.footage}</div>
                  <div>{row.reference || '—'}</div>
                  <div>
                    {(fileMap[row.id] || []).length ? (
                      fileMap[row.id].map((file) => (
                        <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#2563eb' }}>
                          {file.file_name}
                        </a>
                      ))
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No files</span>
                    )}
                  </div>
                  <div>
                    <SectionFileUpload projectId={selectedProjectId} productionId={row.id} onUploaded={loadAll} />
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ marginTop: 32 }}>811 Ticket Control</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Ticket number</div>
                <input style={inputStyle} value={ticketForm.ticket_number} onChange={(e) => setTicketForm((s) => ({ ...s, ticket_number: e.target.value }))} />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Area / Section</div>
                <input style={inputStyle} value={ticketForm.area} onChange={(e) => setTicketForm((s) => ({ ...s, area: e.target.value }))} />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Status</div>
                <select style={inputStyle} value={ticketForm.status} onChange={(e) => setTicketForm((s) => ({ ...s, status: e.target.value }))}>
                  {ticketStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Pending utility</div>
                <input style={inputStyle} value={ticketForm.pending_utility} onChange={(e) => setTicketForm((s) => ({ ...s, pending_utility: e.target.value }))} />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Expiration date</div>
                <input type="date" style={inputStyle} value={ticketForm.expiration_date} onChange={(e) => setTicketForm((s) => ({ ...s, expiration_date: e.target.value }))} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Coverage</div>
                <input style={inputStyle} value={ticketForm.coverage} onChange={(e) => setTicketForm((s) => ({ ...s, coverage: e.target.value }))} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Notes</div>
                <textarea style={{ ...inputStyle, minHeight: 90 }} value={ticketForm.notes} onChange={(e) => setTicketForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
            </div>

            <button style={{ ...primaryBtn, marginTop: 14 }} onClick={createTicket}>Save ticket</button>

            <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              {projectTickets.map((ticket) => {
                const days = getDaysLeft(ticket.expiration_date)
                return (
                  <div key={ticket.id} style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong>{ticket.ticket_number}</strong>
                        <div style={{ color: '#64748b', marginTop: 4 }}>{ticket.area}</div>
                      </div>
                      <span style={badgeStyle}>{ticket.status}</span>
                    </div>
                    <div style={{ marginTop: 10, color: days.color }}>{days.text}</div>
                    <div style={{ marginTop: 8, color: '#475569' }}><strong>Pending utility:</strong> {ticket.pending_utility || 'None'}</div>
                    <div style={{ marginTop: 6, color: '#475569' }}><strong>Coverage:</strong> {ticket.coverage || 'No coverage added.'}</div>
                    <div style={{ marginTop: 6, color: '#475569' }}><strong>Notes:</strong> {ticket.notes || 'No notes added.'}</div>
                  </div>
                )
              })}
            </div>

            <h2 style={{ marginTop: 32 }}>Project Files</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {files.filter((f) => f.project_id === selectedProjectId).map((file) => (
                <div key={file.id} style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16 }}>
                  <strong>{file.file_name}</strong>
                  <div style={{ marginTop: 6 }}>
                    <a href={file.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Open file</a>
                  </div>
                </div>
              ))}
              {!files.filter((f) => f.project_id === selectedProjectId).length && (
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: 18, padding: 24, textAlign: 'center', color: '#64748b' }}>
                  No files uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
}

const primaryBtn = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
}

const badgeStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#e2e8f0',
  fontSize: 12,
}

const statCard = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 18,
  background: '#fff',
}

const statLabel = {
  fontSize: 13,
  color: '#64748b',
}

const statValue = {
  fontSize: 40,
  fontWeight: 700,
  marginTop: 6,
}

const tabStyle = {
  display: 'inline-block',
  padding: '10px 14px',
  borderRadius: 14,
  background: '#eef2ff',
  fontWeight: 700,
}

const tableHeader = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1.4fr 0.8fr 1.4fr 1.2fr 1fr',
  gap: 12,
  padding: 14,
  background: '#f8fafc',
  fontWeight: 700,
  fontSize: 13,
}

const tableRow = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1.4fr 0.8fr 1.4fr 1.2fr 1fr',
  gap: 12,
  padding: 14,
  borderTop: '1px solid #e2e8f0',
  alignItems: 'start',
}
