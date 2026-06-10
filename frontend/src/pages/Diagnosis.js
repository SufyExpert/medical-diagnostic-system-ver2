import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts';

const SEVERITY_LABELS = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' };

// ─── Toast notification ───────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: { bg: '#e8f8f3', border: '#1a9e7a', text: '#0d5e46' },
    warning: { bg: '#fef6e8', border: '#d4861b', text: '#7a4d0a' },
    error: { bg: '#fdf1ef', border: '#C46B5E', text: '#7a2e27' },
  };
  const c = colors[type] || colors.success;

  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: c.bg, border: `1.5px solid ${c.border}`, color: c.text,
      padding: '13px 22px', borderRadius: 10, fontWeight: 600, fontSize: 13.5,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 420, width: '90%',
      animation: 'slideDown 0.25s ease',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <span
        onClick={onClose}
        style={{ cursor: 'pointer', opacity: 0.5, fontSize: 18, lineHeight: 1, marginLeft: 4 }}
      >×</span>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
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
          background: 'var(--teal-light)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.55, fontWeight: 500 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1, padding: '10px 0' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm} style={{ flex: 1, padding: '10px 0' }}>
            Yes, Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step indicator component ─────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Enter Symptoms', 'Refine', 'Result'];
  return (
    <div className="step-indicator">
      {steps.map((label, i) => {
        const num = i + 1;
        const isDone = step > num;
        const isActive = step === num;
        return (
          <React.Fragment key={label}>
            <div className="step-item">
              <div className={`step-circle ${isDone ? 'done' : isActive ? 'active' : 'idle'}`}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : num}
              </div>
              <span className={`step-label ${isDone ? 'done' : isActive ? 'active' : 'idle'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`step-connector ${isDone ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Reusable symptom search picker ──────────────────────────────────
// FIX: The previous version called onSelect('') on every keystroke, which
// cleared the parent state immediately. Now we only notify the parent when
// a valid symptom is picked (onMouseDown) or when the text no longer matches
// the previously selected value (on blur / clear).
function SymptomPicker({ label, allSymptoms, selected, onSelect, excluded }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Keep the input text in sync when selected changes from outside (e.g. reset)
  useEffect(() => {
    if (!selected) setQuery('');
  }, [selected]);

  const filtered = allSymptoms
    .filter(s => !excluded.includes(s) && s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = s => {
    onSelect(s);
    setQuery(s);
    setOpen(false);
  };

  const handleChange = e => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    // If user cleared the field or typed something different, clear parent selection
    if (!val || val !== selected) {
      onSelect('');
    }
  };

  return (
    <div ref={ref} className="symptom-search">
      <div className="form-group">
        <label>{label}</label>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Type to search symptoms..."
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="symptom-dropdown">
          {filtered.map(s => (
            <div key={s} className="symptom-option" onMouseDown={() => pick(s)}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Severity badge helper ────────────────────────────────────────────
function SeverityBadge({ value }) {
  const cls = value === 1 ? 'mild' : value === 2 ? 'moderate' : 'severe';
  return <span className={`severity-badge ${cls}`}>{SEVERITY_LABELS[value]}</span>;
}

// ─── Main Diagnosis component ─────────────────────────────────────────
export default function Diagnosis() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allSymptoms, setAllSymptoms] = useState([]);
  const [s1, setS1] = useState(''); const [sev1, setSev1] = useState(2);
  const [s2, setS2] = useState(''); const [sev2, setSev2] = useState(2);

  const [step, setStep] = useState(1);
  const [top4, setTop4] = useState([]);
  const [additionalSymptoms, setAdditionalSymptoms] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [finalResult, setFinalResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [savedDiseases, setSavedDiseases] = useState([]);

  // ── Logic to fix the "wrong" data from Neo4j AND Deduplicate ────────
  const parseMultiDrugData = (medicineList) => {
    if (!medicineList) return [];

    const allParsedMeds = medicineList.flatMap(med => {
      const getSegments = (str) => {
        if (!str || typeof str !== 'string') return [];
        const cleanedStr = str.replace(/Â/g, '');
        const rawParts = cleanedStr.split(',').map(p => p.trim()).filter(Boolean);
        const segments = [];

        rawParts.forEach(part => {
          const isContinuation = segments.length > 0 && (
            /^[a-z]/.test(part) ||
            /^[\d]+$/.test(part) ||
            /^[\d]+\s/.test(part) ||
            part.toLowerCase().startsWith('then') ||
            part.toLowerCase().startsWith('t hen')
          );

          if (isContinuation) {
            segments[segments.length - 1] += `, ${part}`;
          } else {
            segments.push(part);
          }
        });

        return segments.map(s => {
          const words = s.split(' ');
          return {
            name: words[0].replace(/[:;,]$/, ''),
            dosage: words.slice(1).join(' ')
          };
        });
      };

      const adultParts = getSegments(med.adult_dosage);
      const childParts = getSegments(med.child_dosage);
      const elderlyParts = getSegments(med.elderly_dosage);

      const maxDrugs = Math.max(adultParts.length, childParts.length, elderlyParts.length);
      const alignedResults = [];

      for (let i = 0; i < maxDrugs; i++) {
        alignedResults.push({
          displayName: adultParts[i]?.name || childParts[i]?.name || elderlyParts[i]?.name || med.name,
          adult: adultParts[i]?.dosage || 'N/A',
          child: childParts[i]?.dosage || 'N/A',
          elderly: elderlyParts[i]?.dosage || 'N/A',
          note: med.note
        });
      }
      return alignedResults;
    });

    const uniqueMeds = [];
    const seenNames = new Set();
    for (const med of allParsedMeds) {
      const key = med.displayName?.toLowerCase().trim();
      if (key && !seenNames.has(key)) {
        seenNames.add(key);
        uniqueMeds.push(med);
      }
    }
    return uniqueMeds;
  };

  useEffect(() => {
    axios.get('/api/symptoms').then(r => setAllSymptoms(r.data)).catch(() => { });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    if (user?.username) {
      axios.get(`/api/profile/${user.username}`)
        .then(r => {
          const names = (r.data.diseases || []).map(d => d.name);
          setSavedDiseases(names);
        })
        .catch(() => { });
    }
  }, [user]);

  const showToast = (message, type = 'success') => { setToast({ message, type }); };

  const handleStep1 = async () => {
    if (!s1 || !s2 || s1 === s2) { setError('Please select two different valid symptoms.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await axios.post('/api/diagnose/step1', {
        symptoms: [{ name: s1, severity: sev1 }, { name: s2, severity: sev2 }]
      });
      setTop4(res.data.top4);
      setAdditionalSymptoms(res.data.additional_symptoms);
      setSelectedExtras({});
      setStep(2);
    } catch { setError('Diagnosis failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const toggleExtra = (symptom) => {
    setSelectedExtras(prev => {
      const updated = { ...prev };
      if (updated[symptom] !== undefined) delete updated[symptom];
      else updated[symptom] = 2;
      return updated;
    });
  };

  const setExtraSeverity = (symptom, severity) => {
    setSelectedExtras(prev => ({ ...prev, [symptom]: severity }));
  };

  const handleStep2 = async () => {
    setError(''); setLoading(true);
    const allSymptomInput = [
      { name: s1, severity: sev1 },
      { name: s2, severity: sev2 },
      ...Object.entries(selectedExtras).map(([name, severity]) => ({ name, severity }))
    ];
    try {
      const res = await axios.post('/api/diagnose/step2', { symptoms: allSymptomInput, top4 });
      setFinalResult(res.data);
      setStep(3);
    } catch { setError('Refinement failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleSaveClick = () => {
    if (!finalResult?.disease) return;
    if (savedDiseases.includes(finalResult.disease)) {
      showToast(`"${finalResult.disease}" is already in your health record.`, 'warning');
      return;
    }
    setConfirmSave(true);
  };

  const confirmSaveDisease = async () => {
    setConfirmSave(false);
    try {
      await axios.post(`/api/profile/${user.username}/disease`, { disease: finalResult.disease });
      setSavedDiseases(prev => [...prev, finalResult.disease]);
      showToast(`"${finalResult.disease}" added to your health record.`, 'success');
    } catch {
      showToast('Could not save. Please try again.', 'error');
    }
  };

  const reset = () => {
    setStep(1); setS1(''); setS2(''); setSev1(2); setSev2(2);
    setTop4([]); setAdditionalSymptoms([]); setSelectedExtras({});
    setFinalResult(null); setError('');
  };

  const alreadySaved = finalResult && savedDiseases.includes(finalResult.disease);

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmSave && (
        <ConfirmDialog
          message={`Save "${finalResult?.disease}" to your health record?`}
          onConfirm={confirmSaveDisease}
          onCancel={() => setConfirmSave(false)}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <span className="back-link" onClick={() => navigate('/dashboard')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back to Dashboard
      </span>
      <div className="diagnosis-container">

        <h1 className="page-title">Symptom-Based Diagnosis</h1>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

        {/* ── STEP 1: Primary symptoms ── */}
        {step === 1 && (
          <div className="animate-fade-in">
            <p className="page-subtitle">Select your two primary symptoms and rate their severity.</p>
            <div className="card" style={{ marginBottom: 16 }}>
              <SymptomPicker label="Primary Symptom" allSymptoms={allSymptoms} selected={s1} onSelect={setS1} excluded={[s2]} />
              <div className="severity-row" style={{ marginTop: 12 }}>
                <label>Severity:</label>
                <input type="range" min={1} max={3} step={1} value={sev1} onChange={e => setSev1(+e.target.value)} />
                <SeverityBadge value={sev1} />
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <SymptomPicker label="Secondary Symptom" allSymptoms={allSymptoms} selected={s2} onSelect={setS2} excluded={[s1]} />
              <div className="severity-row" style={{ marginTop: 12 }}>
                <label>Severity:</label>
                <input type="range" min={1} max={3} step={1} value={sev2} onChange={e => setSev2(+e.target.value)} />
                <SeverityBadge value={sev2} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleStep1} disabled={loading} style={{ width: '100%', padding: 14 }}>
              {loading ? 'Analysing...' : 'Analyse Symptoms'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Refine ── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header-row">
                <div className="card-header-dot" />
                <h3>Possible Conditions</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
                Based on your symptoms, these conditions are possible. Select additional symptoms below to narrow the diagnosis.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {top4.map(d => (
                  <span key={d} className="condition-tag">{d}</span>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header-row">
                <div className="card-header-dot" />
                <h3>Do you also have any of these?</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Select all that apply and rate their severity.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {additionalSymptoms.map(symptom => {
                  const isSelected = selectedExtras[symptom] !== undefined;
                  return (
                    <div key={symptom} style={{
                      border: `1.5px solid ${isSelected ? 'var(--teal)' : 'var(--border)'}`,
                      borderRadius: 8, padding: '12px 14px',
                      background: isSelected ? 'var(--teal-light)' : 'var(--bg-page)',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => toggleExtra(symptom)}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${isSelected ? 'var(--teal)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--teal)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.15s'
                        }}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400, color: 'var(--text-primary)' }}>
                          {symptom}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="severity-row" style={{ marginTop: 10, paddingLeft: 28 }} onClick={e => e.stopPropagation()}>
                          <label style={{ fontSize: 12 }}>Severity:</label>
                          <input
                            type="range" min={1} max={3} step={1}
                            value={selectedExtras[symptom]}
                            onChange={e => setExtraSeverity(symptom, +e.target.value)}
                          />
                          <SeverityBadge value={selectedExtras[symptom]} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline" onClick={reset} style={{ flex: 1, padding: 13 }}>
                Start Over
              </button>
              <button className="btn btn-primary" onClick={handleStep2} disabled={loading} style={{ flex: 2, padding: 13 }}>
                {loading ? 'Finalizing...' : 'Finalize Diagnosis'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Final result ── */}
        {step === 3 && finalResult && (
          <div className="animate-fade-in">

            {/* Result hero */}
            <div className="result-hero">
              <div className="result-hero-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M9 12h6M12 9v6" strokeLinecap="round" />
                  <path d="M3 9a4 4 0 014-4h10a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V9z" />
                </svg>
              </div>
              <div className="result-label">Diagnosis Complete</div>
              <div className="result-disease-name">{finalResult.disease}</div>
              <div className="result-disclaimer">
                AI-generated result — always consult a qualified physician.
              </div>
            </div>

            {/* Symptom Severity Chart */}
            {(() => {
              const chartData = [
                { name: s1, severity: sev1, label: SEVERITY_LABELS[sev1] },
                { name: s2, severity: sev2, label: SEVERITY_LABELS[sev2] },
                ...Object.entries(selectedExtras).map(([name, sev]) => ({
                  name, severity: sev, label: SEVERITY_LABELS[sev],
                })),
              ];
              const barColors = { 1: '#1a9e7a', 2: '#d4861b', 3: '#C46B5E' };
              const CustomTooltip = ({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      <strong>{payload[0].payload.name}</strong>
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Severity: {payload[0].payload.label}</div>
                    </div>
                  );
                }
                return null;
              };
              return (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header-row">
                    <div className="card-header-dot" />
                    <h3>Symptom Severity Overview</h3>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={Math.max(90, chartData.length * 44)}>
                      <BarChart data={chartData} layout="vertical" barSize={14} margin={{ left: 12, right: 24, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number" domain={[0, 3]} ticks={[1, 2, 3]}
                          tickFormatter={v => ['', 'Mild', 'Moderate', 'Severe'][v]}
                          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          type="category" dataKey="name" width={130}
                          tick={{ fontSize: 12, fill: 'var(--text-primary)' }}
                          axisLine={false} tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="severity" radius={[0, 6, 6, 0]}>
                          {chartData.map((entry, i) => (
                            <Cell key={i} fill={barColors[entry.severity] || '#0D8C9E'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {[{ label: 'Mild', color: '#1a9e7a' }, { label: 'Moderate', color: '#d4861b' }, { label: 'Severe', color: '#C46B5E' }].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                          {l.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Recommended Tests */}
            {finalResult.tests?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header-row">
                  <div className="card-header-dot" />
                  <h3>Recommended Tests</h3>
                </div>
                <div style={{ marginTop: 4 }}>
                  {finalResult.tests.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
            )}

            {/* Recommended Medicines */}
            {finalResult.medicines?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header-row">
                  <div className="card-header-dot" />
                  <h3>Recommended Medicines</h3>
                </div>
                {parseMultiDrugData(finalResult.medicines).map((m, idx) => (
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

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={reset} style={{ flex: 1, padding: 13 }}>
                New Diagnosis
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, padding: 13 }}
                onClick={handleSaveClick}
                disabled={alreadySaved}
              >
                {alreadySaved ? 'Saved to Health Record' : 'Save to Health Record'}
              </button>
            </div>
          </div>
        )}

        {loading && <div className="spinner" style={{ marginTop: 24 }} />}
      </div>
    </div>
  );
}