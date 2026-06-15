import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { BookOpen, ShieldCheck, Lock, Landmark, CheckSquare, Save } from 'lucide-react';

export const Academics: React.FC = () => {
  const { showToast } = useAppStore();
  const [tab, setTab] = useState<'marks' | 'exams'>('marks');

  // API Lists
  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Selection state
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Marks grid data
  const [maxTheory, setMaxTheory] = useState(80);
  const [maxPractical, setMaxPractical] = useState(20);
  const [marksGrid, setMarksGrid] = useState<any[]>([]);

  // Load basic class/exam lists
  useEffect(() => {
    api.get('/api/settings/classes-sections').then(data => setClasses(data)).catch(err => console.error(err));
    api.get('/api/academics/exams').then(data => setExams(data)).catch(err => console.error(err));
    api.get('/api/academics/subjects').then(data => setSubjects(data)).catch(err => console.error(err));
  }, []);

  // Fetch Marks grid when selection changes
  const fetchMarks = async () => {
    if (!selectedClass || !selectedSection || !selectedExam || !selectedSubject) return;
    try {
      const url = `/api/academics/marks?examTypeId=${selectedExam}&classId=${selectedClass}&sectionId=${selectedSection}&subjectId=${selectedSubject}`;
      const data = await api.get(url);
      setMaxTheory(data.maxTheory);
      setMaxPractical(data.maxPractical);
      setMarksGrid(data.grid);
    } catch (err: any) {
      showToast(err.message || 'Failed to load marks matrix', 'error');
    }
  };

  useEffect(() => {
    fetchMarks();
  }, [selectedClass, selectedSection, selectedExam, selectedSubject]);

  // Handle single student marks adjustment
  const handleScoreChange = (studentId: string, field: 'theory' | 'practical', value: string) => {
    const score = parseFloat(value) || 0;
    
    setMarksGrid(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;

      const theory = field === 'theory' ? score : s.theoryMarks;
      const practical = field === 'practical' ? score : s.practicalMarks;
      const total = theory + practical;
      const maxTotal = maxTheory + maxPractical;
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

      // Grade calculation
      let grade = 'E';
      if (pct >= 91) grade = 'A1';
      else if (pct >= 81) grade = 'A2';
      else if (pct >= 71) grade = 'B1';
      else if (pct >= 61) grade = 'B2';
      else if (pct >= 51) grade = 'C1';
      else if (pct >= 41) grade = 'C2';
      else if (pct >= 33) grade = 'D';

      return {
        ...s,
        theoryMarks: field === 'theory' ? value : s.theoryMarks,
        practicalMarks: field === 'practical' ? value : s.practicalMarks,
        totalMarks: total,
        grade
      };
    }));
  };

  // Toggle absent state
  const handleAbsentChange = (studentId: string, checked: boolean) => {
    setMarksGrid(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      return {
        ...s,
        isAbsent: checked,
        theoryMarks: checked ? '0' : '0',
        practicalMarks: checked ? '0' : '0',
        totalMarks: 0,
        grade: 'E'
      };
    }));
  };

  // Bulk save
  const handleSaveMarks = async () => {
    if (!selectedClass || !selectedSection || !selectedExam || !selectedSubject) return;

    // Validation checks for out-of-bounds
    const outOfBounds = marksGrid.some(s => 
      parseFloat(s.theoryMarks) > maxTheory || 
      parseFloat(s.practicalMarks) > maxPractical
    );

    if (outOfBounds) {
      showToast('Some scores exceed the maximum marks allowed!', 'error');
      return;
    }

    try {
      const payload = {
        examTypeId: selectedExam,
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: selectedSubject,
        records: marksGrid.map(s => ({
          studentId: s.studentId,
          theoryMarks: parseFloat(s.theoryMarks) || 0,
          practicalMarks: parseFloat(s.practicalMarks) || 0,
          isAbsent: s.isAbsent,
          isExempted: s.isExempted,
          remarks: s.remarks
        }))
      };

      await api.post('/api/academics/marks/bulk', payload);
      showToast('Marks saved successfully (Draft)', 'success');
      fetchMarks();
    } catch (err: any) {
      showToast(err.message || 'Failed to save marks', 'error');
    }
  };

  // Class teacher verification
  const handleVerify = async () => {
    try {
      await api.post(`/api/academics/marks/verify/${selectedExam}`, {
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: selectedSubject
      });
      showToast('Marks verified successfully by Class Teacher', 'success');
      fetchMarks();
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error');
    }
  };

  // Principal lock
  const handleLock = async () => {
    try {
      await api.post(`/api/academics/marks/lock/${selectedExam}`, {
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: selectedSubject
      });
      showToast('Marks locked by Principal. Further edits disabled.', 'success');
      fetchMarks();
    } catch (err: any) {
      showToast(err.message || 'Lock failed', 'error');
    }
  };

  // Statistics summaries
  const scores = marksGrid.filter(s => !s.isAbsent).map(s => s.totalMarks);
  const classAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  const highest = scores.length > 0 ? Math.max(...scores) : 0;
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Academic Marks Board</h2>
          <p className="text-xs text-slate-500">Record assessment scores, generate report cards, and manage CBSE class averages.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setTab('marks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'marks' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Mark Entry
          </button>
        </div>
      </div>

      {tab === 'marks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Exam Type</label>
              <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="form-input">
                <option value="">Choose Exam...</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.shortName})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Class</label>
              <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }} className="form-input">
                <option value="">Choose Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Section</label>
              <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="form-input" disabled={!selectedClass}>
                <option value="">Choose Section...</option>
                {classes.find(c => c.id === selectedClass)?.sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="form-input">
                <option value="">Choose Subject...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedExam && selectedClass && selectedSection && selectedSubject && (
            <div className="card space-y-4">
              {/* Max marks info bar */}
              <div className="flex flex-wrap justify-between items-center gap-3 bg-brand-orange-50/50 p-4 rounded-xl border border-brand-orange-100/30 text-xs font-semibold text-brand-orange-800">
                <div className="flex gap-4">
                  <span>Theory Max: <strong className="text-slate-800">{maxTheory}</strong></span>
                  <span>Practical Max: <strong className="text-slate-800">{maxPractical}</strong></span>
                  <span>Passing Total: <strong className="text-slate-800">{Math.ceil((maxTheory + maxPractical) * 0.33)}</strong></span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleVerify} className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 flex items-center gap-1 font-bold">
                    <CheckSquare size={12} /> Class Teacher Verify
                  </button>
                  <button onClick={handleLock} className="px-2.5 py-1 bg-brand-orange-600 hover:bg-brand-orange-700 text-white rounded shadow flex items-center gap-1 font-bold">
                    <Lock size={12} /> Principal Lock
                  </button>
                </div>
              </div>

              {/* Marks Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3 w-16">Roll No</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3 w-28">Theory ({maxTheory})</th>
                      <th className="p-3 w-28">Practical ({maxPractical})</th>
                      <th className="p-3 w-20">Total</th>
                      <th className="p-3 w-20">Grade</th>
                      <th className="p-3 w-20 text-center">Absent</th>
                      <th className="p-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                    {marksGrid.map((row, idx) => {
                      const isLocked = row.isLocked;
                      const theoryExceeded = parseFloat(row.theoryMarks) > maxTheory;
                      const practicalExceeded = parseFloat(row.practicalMarks) > maxPractical;
                      const totalFailed = row.totalMarks < Math.ceil((maxTheory + maxPractical) * 0.33);

                      return (
                        <tr key={row.studentId} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-800 font-bold">{row.rollNumber || idx + 1}</td>
                          <td className="p-3 text-slate-800 font-bold">{row.name}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={row.isAbsent || isLocked}
                              value={row.theoryMarks}
                              onChange={(e) => handleScoreChange(row.studentId, 'theory', e.target.value)}
                              className={`form-input py-1 text-xs font-bold ${
                                theoryExceeded ? 'bg-rose-50 border-rose-300 text-rose-700 ring-rose-200 ring-2' : ''
                              }`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              disabled={row.isAbsent || isLocked}
                              value={row.practicalMarks}
                              onChange={(e) => handleScoreChange(row.studentId, 'practical', e.target.value)}
                              className={`form-input py-1 text-xs font-bold ${
                                practicalExceeded ? 'bg-rose-50 border-rose-300 text-rose-700 ring-rose-200 ring-2' : ''
                              }`}
                            />
                          </td>
                          <td className={`p-3 font-bold text-xs ${totalFailed && !row.isAbsent ? 'text-rose-600' : 'text-slate-800'}`}>
                            {row.isAbsent ? 'AB' : row.totalMarks}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              row.grade === 'E' ? 'bg-rose-50 text-rose-700' : 'bg-brand-green-50 text-brand-green-700'
                            }`}>
                              {row.grade}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={row.isAbsent}
                              onChange={(e) => handleAbsentChange(row.studentId, e.target.checked)}
                              className="w-4 h-4 accent-brand-orange-600 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.remarks || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMarksGrid(prev => prev.map(s => s.studentId === row.studentId ? { ...s, remarks: val } : s));
                              }}
                              placeholder="Remarks"
                              className="form-input py-1 text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Stats & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="flex gap-4 text-xs font-bold text-slate-500">
                  <span>Average: <strong className="text-slate-800">{classAvg}</strong></span>
                  <span>Highest: <strong className="text-brand-green-600">{highest}</strong></span>
                  <span>Lowest: <strong className="text-rose-500">{lowest}</strong></span>
                </div>
                <button onClick={handleSaveMarks} className="btn-primary flex items-center gap-1.5 text-xs">
                  <Save size={14} /> Save Draft Scores
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
