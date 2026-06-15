import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { Calendar, CheckCircle2, UserCheck, AlertTriangle, Clock, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/export';

export const Attendance: React.FC = () => {
  const { showToast } = useAppStore();
  const [tab, setTab] = useState<'mark' | 'leaves'>('mark');

  // Mark attendance parameters
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodWise, setPeriodWise] = useState(false);
  const [periodNo, setPeriodNo] = useState('1');

  const [studentList, setStudentList] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [triggerSms, setTriggerSms] = useState(true);

  // Load classes on load
  useEffect(() => {
    api.get('/api/settings/classes-sections')
      .then(data => setClasses(data))
      .catch(err => console.error(err));
  }, []);

  // Load student list when filter parameters update
  const fetchStudents = async () => {
    if (!selectedClass || !selectedSection) return;
    try {
      const url = `/api/attendance?date=${date}&classId=${selectedClass}&sectionId=${selectedSection}${periodWise ? `&periodNumber=${periodNo}` : ''}`;
      const data = await api.get(url);
      setStudentList(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch attendance state', 'error');
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, selectedSection, date, periodWise, periodNo]);

  // Load Leaves
  const fetchLeaves = async () => {
    try {
      const data = await api.get('/api/attendance/leave');
      setLeaves(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tab === 'leaves') fetchLeaves();
  }, [tab]);

  // Quick mark actions
  const markAll = (status: string) => {
    setStudentList(prev => prev.map(s => ({ ...s, status })));
  };

  // Toggle single status
  const toggleStatus = (studentId: string, status: string) => {
    setStudentList(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
  };

  // Submit attendance to DB
  const handleSaveAttendance = async () => {
    if (!selectedClass || !selectedSection) {
      showToast('Please select class and section first', 'error');
      return;
    }

    try {
      const records = studentList.map(s => ({
        studentId: s.studentId,
        status: s.status,
        remarks: s.remarks || ''
      }));

      await api.post('/api/attendance/mark', {
        date,
        classId: selectedClass,
        sectionId: selectedSection,
        periodNumber: periodWise ? periodNo : null,
        records
      });

      showToast('Attendance recorded and synced successfully!', 'success');
      
      // Fetch fresh list
      fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Failed to record attendance', 'error');
    }
  };

  // Review Leaves
  const handleReviewLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/api/attendance/leave/${leaveId}`, { status, remarks: `Processed by supervisor` });
      showToast(`Leave application status updated to ${status}`, 'success');
      fetchLeaves();
    } catch (err: any) {
      showToast(err.message || 'Failed to update leave', 'error');
    }
  };

  const triggerExcelExport = () => {
    const exportHeaders = [
      { label: 'Roll Number', key: 'rollNumber' },
      { label: 'First Name', key: 'firstName' },
      { label: 'Last Name', key: 'lastName' },
      { label: 'Status', key: 'status' },
      { label: 'Remarks', key: 'remarks' }
    ];
    exportToCSV(studentList, exportHeaders, `Attendance_${selectedClass}_${selectedSection}_${date}`);
    showToast('Exported attendance log successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Registry</h2>
          <p className="text-xs text-slate-500">Record daily or period student attendance, and coordinate leave application clearances.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setTab('mark')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'mark' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Mark Student Attendance
          </button>
          <button 
            onClick={() => setTab('leaves')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'leaves' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Leaves Inbox
          </button>
        </div>
      </div>

      {tab === 'mark' ? (
        <div className="space-y-4">
          {/* Controls Card */}
          <div className="card grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="form-label">Select Class</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSection('');
                }}
                className="form-input"
              >
                <option value="">Choose Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="form-input"
                disabled={!selectedClass}
              >
                <option value="">Choose Section...</option>
                {classes.find(c => c.id === selectedClass)?.sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-600">Attendance Type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodWise(false)}
                  className={`px-3 py-1.5 rounded text-xs font-bold ${!periodWise ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodWise(true)}
                  className={`px-3 py-1.5 rounded text-xs font-bold ${periodWise ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Period-wise
                </button>
              </div>
            </div>

            {periodWise && (
              <div>
                <label className="form-label">Period Number</label>
                <select
                  value={periodNo}
                  onChange={(e) => setPeriodNo(e.target.value)}
                  className="form-input"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>Period {n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Table list */}
          {selectedClass && selectedSection && (
            <div className="card space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex gap-2">
                  <button onClick={() => markAll('PRESENT')} className="px-2.5 py-1 bg-brand-green-50 hover:bg-brand-green-100 text-brand-green-700 text-xs font-bold rounded border border-brand-green-200">
                    Mark All Present
                  </button>
                  <button onClick={() => markAll('ABSENT')} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded border border-rose-200">
                    Mark All Absent
                  </button>
                  <button 
                    onClick={triggerExcelExport}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1.5 transition-all"
                  >
                    <Download size={13} /> Export Excel
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerSms}
                    onChange={(e) => setTriggerSms(e.target.checked)}
                    className="w-4 h-4 accent-brand-orange-600 rounded"
                  />
                  Send SMS notification to parents of absent students immediately
                </label>
              </div>

              {/* Grid table */}
              <div className="overflow-x-auto">
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th className="excel-th w-20">Roll No</th>
                      <th className="excel-th">Student Name</th>
                      <th className="excel-th w-72">Status Option</th>
                      <th className="excel-th">Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                    {studentList.map(st => (
                      <tr key={st.studentId}>
                        <td className="excel-td excel-mono">{st.rollNumber || 'N/A'}</td>
                        <td className="excel-td font-bold text-slate-800 capitalize">{st.firstName} {st.lastName}</td>
                        <td className="excel-td">
                          <div className="flex gap-1">
                            <button
                              onClick={() => toggleStatus(st.studentId, 'PRESENT')}
                              className={`px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                                st.status === 'PRESENT' 
                                  ? 'bg-brand-green-600 text-white border-brand-green-600 shadow-sm' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              P
                            </button>
                            <button
                              onClick={() => toggleStatus(st.studentId, 'ABSENT')}
                              className={`px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                                st.status === 'ABSENT' 
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              A
                            </button>
                            <button
                              onClick={() => toggleStatus(st.studentId, 'LATE')}
                              className={`px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                                st.status === 'LATE' 
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              L
                            </button>
                            <button
                              onClick={() => toggleStatus(st.studentId, 'HALF_DAY')}
                              className={`px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                                st.status === 'HALF_DAY' 
                                  ? 'bg-slate-500 text-white border-slate-500 shadow-sm' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              HD
                            </button>
                          </div>
                        </td>
                        <td className="excel-td">
                          <input
                            type="text"
                            value={st.remarks || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStudentList(prev => prev.map(s => s.studentId === st.studentId ? { ...s, remarks: val } : s));
                            }}
                            placeholder="Add remarks (e.g. medical leave)"
                            className="form-input py-1 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Bottom */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Total Class Capacity: <span className="font-bold text-slate-800">{studentList.length}</span>
                </div>
                <button
                  onClick={handleSaveAttendance}
                  className="btn-primary flex items-center gap-1.5 text-xs"
                >
                  <UserCheck size={14} /> Sync & Save Attendance
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Leaves inbox */
        <div className="card space-y-4">
          <h3 className="font-bold text-sm text-slate-800">Pending Leave Approvals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-3">Applicant</th>
                  <th className="p-3">Class/Section</th>
                  <th className="p-3">Leave Dates</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                {leaves.map((lv) => (
                  <tr key={lv.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-800 font-bold">
                      {lv.applicantType === 'STUDENT' 
                        ? `${lv.student?.firstName} ${lv.student?.lastName}` 
                        : `${lv.staff?.firstName} ${lv.staff?.lastName}`}
                    </td>
                    <td className="p-3">
                      {lv.applicantType === 'STUDENT' 
                        ? `${lv.student?.class?.name} - ${lv.student?.section?.name}` 
                        : 'Staff'}
                    </td>
                    <td className="p-3 font-mono">
                      {new Date(lv.fromDate).toLocaleDateString('en-GB')} to {new Date(lv.toDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {lv.leaveType}
                      </span>
                    </td>
                    <td className="p-3 truncate max-w-xs">{lv.reason}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lv.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                        lv.status === 'APPROVED' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {lv.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {lv.status === 'PENDING' ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleReviewLeave(lv.id, 'APPROVED')}
                            className="px-2 py-1 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded text-[10px] font-bold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewLeave(lv.id, 'REJECTED')}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
