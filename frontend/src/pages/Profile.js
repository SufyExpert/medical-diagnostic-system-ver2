import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAuth } from '../App';

const CHART_COLORS = ['#0D8C9E', '#1a9e7a', '#C46B5E', '#d4861b'];

// ─── Confirm dialog ───────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 14, padding: '28px 32px',
        maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48,
          background: confirmStyle === 'danger' ? '#fdf1ef' : 'var(--teal-light)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          {confirmStyle === 'danger' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
          {title}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1, padding: '10px 0' }}>
            Cancel
          </button>
          <button
            className={confirmStyle === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px 0', fontSize: 14 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: { bg: '#e8f8f3', border: '#1a9e7a', text: '#0d5e46' },
    error:   { bg: '#fdf1ef', border: '#C46B5E', text: '#7a2e27' },
  };
  const c = colors[type] || colors.success;

  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: c.bg, border: `1.5px solid ${c.border}`, color: c.text,
      padding: '12px 22px', borderRadius: 10, fontWeight: 600, fontSize: 13.5,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400, width: '90%',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <span onClick={onClose} style={{ cursor: 'pointer', opacity: 0.5, fontSize: 18 }}>×</span>
    </div>
  );
}

// ─── Disease Detail Modal ─────────────────────────────────────────────
// Fetches and shows medicines + tests for a disease from the API.
function DiseaseDetailModal({ diseaseName, onClose }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    axios.get(`/api/disease/${encodeURIComponent(diseaseName)}`)
      .then(r => setDetail(r.data))
      .catch(() => setError('Could not load disease details.'))
      .finally(() => setLoading(false));
  }, [diseaseName]);

  // Parse medicine dosages same way as Diagnosis.js
  const parseMeds = (medicineList) => {
    if (!medicineList) return [];
    const allParsed = medicineList.flatMap(med => {
      const getSegs = (str) => {
        if (!str || typeof str !== 'string') return [];
        const clean = str.replace(/Â/g, '');
        const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
        const segs = [];
        parts.forEach(part => {
          const isCont = segs.length > 0 && (
            /^[a-z]/.test(part) || /^[\d]/.test(part) ||
            part.toLowerCase().startsWith('then')
          );
          if (isCont) segs[segs.length - 1] += `, ${part}`;
          else segs.push(part);
        });
        return segs.map(s => {
          const words = s.split(' ');
          return { name: words[0].replace(/[:;,]$/, ''), dosage: words.slice(1).join(' ') };
        });
      };
      const a = getSegs(med.adult_dosage), c = getSegs(med.child_dosage), e = getSegs(med.elderly_dosage);
      const max = Math.max(a.length, c.length, e.length);
      const res = [];
      for (let i = 0; i < max; i++) {
        res.push({
          displayName: a[i]?.name || c[i]?.name || e[i]?.name || med.name,
          adult: a[i]?.dosage || 'N/A',
          child: c[i]?.dosage || 'N/A',
          elderly: e[i]?.dosage || 'N/A',
          note: med.note,
        });
      }
      return res;
    });
    const seen = new Set(), unique = [];
    for (const m of allParsed) {
      const k = m.displayName?.toLowerCase().trim();
      if (k && !seen.has(k)) { seen.add(k); unique.push(m); }
    }
    return unique;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '16px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: '28px 28px 24px',
        maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
        animation: 'modalIn 0.2s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 4 }}>
              Disease Detail
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {diseaseName}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-page)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            }}
          >×</button>
        </div>

        {loading && <div className="spinner" style={{ margin: '32px auto' }} />}
        {error   && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}

        {detail && (
          <>
            {/* Tests */}
            {detail.tests?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="card-header-row" style={{ marginBottom: 10 }}>
                  <div className="card-header-dot" />
                  <h3 style={{ margin: 0, fontSize: 14 }}>Recommended Tests</h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detail.tests.map(t => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Medicines */}
            {detail.medicines?.length > 0 && (
              <div>
                <div className="card-header-row" style={{ marginBottom: 10 }}>
                  <div className="card-header-dot" />
                  <h3 style={{ margin: 0, fontSize: 14 }}>Recommended Medicines</h3>
                </div>
                {parseMeds(detail.medicines).map((m, idx) => (
                  <div key={`${m.displayName}-${idx}`} className="medicine-card">
                    <h4>{m.displayName}</h4>
                    <div className="medicine-card-dosage">
                      <div className="dosage-row-item"><strong>Adult: </strong>{m.adult}</div>
                      <div className="dosage-row-item"><strong>Child: </strong>{m.child}</div>
                      <div className="dosage-row-item"><strong>Elderly: </strong>{m.elderly}</div>
                    </div>
                    {m.note && <div className="medicine-note">Note: {m.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {!detail.tests?.length && !detail.medicines?.length && (
              <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
                No detailed information available for this disease.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Health Overview radial chart ─────────────────────────────────────
function HealthRadialChart({ ongoing, cured, total }) {
  const maxVal = Math.max(total, 1);
  const data = [
    { name: 'Total',   value: total,   fill: '#0D8C9E' },
    { name: 'Ongoing', value: ongoing, fill: '#C46B5E' },
    { name: 'Cured',   value: cured,   fill: '#1a9e7a' },
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 8, padding: '7px 13px', fontSize: 13,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <strong>{payload[0].name}</strong>: {payload[0].value}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={200}>
        <RadialBarChart
          cx="50%" cy="50%"
          innerRadius="30%" outerRadius="90%"
          data={data}
          startAngle={90} endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, maxVal]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: 'var(--bg-page)' }} cornerRadius={6} />
          <Tooltip content={<CustomTooltip />} />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Centre label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>conditions</div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: d.fill }} />
            {d.name}: <strong style={{ color: 'var(--text-primary)' }}>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [confirm, setConfirm]       = useState(null);
  const [detailDisease, setDetailDisease] = useState(null); // which disease to show detail for

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchProfile = () => {
    axios.get(`/api/profile/${user.username}`)
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfile(); }, []);

  const promptCure   = (disease) => setConfirm({ type: 'cure', disease });
  const promptDelete = (disease) => setConfirm({ type: 'delete', disease });

  const executeCure = async () => {
    const disease = confirm.disease;
    setConfirm(null);
    try {
      await axios.put(`/api/profile/${user.username}/disease/cure`, { disease });
      fetchProfile();
      showToast(`"${disease}" marked as cured.`, 'success');
    } catch {
      showToast('Could not update. Please try again.', 'error');
    }
  };

  const executeDelete = async () => {
    const disease = confirm.disease;
    setConfirm(null);
    try {
      await axios.delete(`/api/profile/${user.username}/disease`, { data: { disease } });
      fetchProfile();
      showToast(`"${disease}" removed from health record.`, 'success');
    } catch {
      showToast('Could not delete. Please try again.', 'error');
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!profile) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Could not load profile.</p></div>;

  const diseases = profile.diseases || [];
  const ongoing  = diseases.filter(d => !d.cured);
  const cured    = diseases.filter(d => d.cured);

  const initials = (profile.full_name || profile.username)
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="page">
      <style>{`
        .disease-item-actions { display: flex; gap: 8px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .disease-name-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          font-weight: 600; font-size: 14px; color: var(--text-primary);
          text-align: left; text-decoration: underline dotted;
          text-underline-offset: 3px; transition: color 0.15s;
        }
        .disease-name-btn:hover { color: var(--teal); }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirm?.type === 'delete' && (
        <ConfirmDialog
          title="Remove Condition?"
          message={`Are you sure you want to remove "${confirm.disease}" from your health record? This cannot be undone.`}
          confirmLabel="Yes, Remove"
          confirmStyle="danger"
          onConfirm={executeDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.type === 'cure' && (
        <ConfirmDialog
          title="Mark as Cured?"
          message={`Mark "${confirm.disease}" as cured? It will move to your cured conditions list.`}
          confirmLabel="Yes, Mark Cured"
          confirmStyle="primary"
          onConfirm={executeCure}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Disease detail modal */}
      {detailDisease && (
        <DiseaseDetailModal
          diseaseName={detailDisease}
          onClose={() => setDetailDisease(null)}
        />
      )}

      <span className="back-link" onClick={() => navigate('/dashboard')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back to Dashboard
      </span>

      <div className="profile-grid">

        {/* ── Left: Personal details ── */}
        <div>
          <div className="card">
            <div className="profile-header">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-name">{profile.full_name}</div>
              <div className="profile-username">@{profile.username}</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date of Birth</span>
              <span className="detail-value">{profile.dob}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Age</span>
              <span className="detail-value">{profile.age}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Contact</span>
              <span className="detail-value">{profile.contact}</span>
            </div>
          </div>

          {/* Radial chart — Health Overview */}
          {diseases.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header-row">
                <div className="card-header-dot" />
                <h3>Health Overview</h3>
              </div>
              <HealthRadialChart
                ongoing={ongoing.length}
                cured={cured.length}
                total={diseases.length}
              />
            </div>
          )}
        </div>

        {/* ── Right: Health records ── */}
        <div>
          <div className="card">
            <div className="card-header-row">
              <div className="card-header-dot" />
              <h3>Health Record</h3>
            </div>

            {diseases.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                color: 'var(--text-muted)', fontSize: 14,
                background: 'var(--bg-page)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
              }}>
                No health records yet.
                <br />
                <span style={{ fontSize: 13, marginTop: 6, display: 'block' }}>
                  Run a diagnosis to add conditions to your record.
                </span>
              </div>
            )}

            {ongoing.length > 0 && (
              <>
                <div className="section-label">Ongoing</div>
                {ongoing.map(d => (
                  <div key={d.name} className="disease-item animate-fade-in">
                    <div>
                      {/* Clicking the name opens the detail modal */}
                      <button
                        className="disease-name-btn"
                        onClick={() => setDetailDisease(d.name)}
                        title="Click to view disease details"
                      >
                        {d.name}
                      </button>
                      <span className="disease-badge badge-ongoing" style={{ display: 'block', marginTop: 4 }}>
                        Treatment Ongoing
                      </span>
                    </div>
                    <div className="disease-item-actions">
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => promptCure(d.name)}
                      >
                        Mark Cured
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => promptDelete(d.name)}
                        title="Remove from health record"
                        style={{ padding: '5px 10px' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {cured.length > 0 && (
              <>
                {ongoing.length > 0 && <div className="divider" />}
                <div className="section-label">Cured</div>
                {cured.map(d => (
                  <div key={d.name} className="disease-item cured animate-fade-in">
                    <div>
                      {/* Clicking the name opens the detail modal */}
                      <button
                        className="disease-name-btn"
                        onClick={() => setDetailDisease(d.name)}
                        title="Click to view disease details"
                      >
                        {d.name}
                      </button>
                      <span className="disease-badge badge-cured" style={{ display: 'block', marginTop: 4 }}>
                        Cured
                      </span>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => promptDelete(d.name)}
                      title="Remove from health record"
                      style={{ padding: '5px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}