import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { FileText, Search, ShieldCheck, AlertTriangle, FileSpreadsheet, Lock } from 'lucide-react';

export const Documents: React.FC = () => {
  const { showToast } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // live dues verification state
  const [duesCheck, setDuesCheck] = useState<any | null>(null);
  
  // TC input details
  const [reason, setReason] = useState('');
  const [conduct, setConduct] = useState('EXCELLENT');
  const [daysPresent, setDaysPresent] = useState('200');
  const [workingDays, setWorkingDays] = useState('220');

  const [tcsList, setTcsList] = useState<any[]>([]);

  // Load TCs
  const loadTcs = async () => {
    try {
      const data = await api.get('/api/tc');
      setTcsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTcs();
  }, [selectedStudent]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const data = await api.get(`/api/students?search=${searchQuery}`);
      setStudentsList(data);
    } catch (err: any) {
      showToast(err.message || 'Search failed', 'error');
    }
  };

  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    setStudentsList([]);
    try {
      const dues = await api.get(`/api/tc/no-dues/${student.id}`);
      setDuesCheck(dues);
    } catch (err: any) {
      showToast(err.message || 'Dues check failed', 'error');
    }
  };

  // Submit TC Draft
  const handleInitiateTc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !duesCheck?.canProceed) {
      showToast('Cannot issue TC. Verify outstanding dues are cleared first.', 'error');
      return;
    }

    try {
      const payload = {
        reasonForLeaving: reason,
        conduct,
        daysAttended: parseInt(daysPresent),
        totalWorkingDays: parseInt(workingDays)
      };

      await api.post(`/api/tc/initiate/${selectedStudent.id}`, payload);
      showToast('Transfer Certificate draft forwarded to Principal for signing approval.', 'success');
      setSelectedStudent(null);
      setDuesCheck(null);
      setReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to initiate TC', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Transfer Certificate & Certificates</h2>
          <p className="text-xs text-slate-500">Initiate school leaving certificates (TCs) with automated three-point dues clearing checks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Left Column - Initiate TC */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-4">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <Search size={16} className="text-brand-orange-500" /> Verify Student leaving
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Student Name or Admission Number..."
                className="form-input"
              />
              <button onClick={handleSearch} className="btn-primary text-xs font-bold shrink-0">
                Verify Clearance
              </button>
            </div>

            {/* Results selection */}
            {studentsList.length > 0 && (
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden bg-slate-50">
                {studentsList.map(st => (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className="w-full text-left p-3 hover:bg-white flex items-center justify-between text-xs font-semibold text-slate-600 transition-colors"
                  >
                    <span>{st.firstName} {st.lastName} ({st.admissionNumber})</span>
                    <span className="text-[10px] text-slate-400">{st.class?.name} - {st.section?.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dues check indicator card */}
          {selectedStudent && duesCheck && (
            <div className="card space-y-6">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider border-b pb-2">Three-Point No-Dues Checklist</h3>

              <div className="space-y-3">
                {/* 1. Fees */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                  <span className="text-xs font-semibold text-slate-700">1. School Fees & Invoices</span>
                  {duesCheck.feesClear ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green-700 bg-brand-green-50 px-2 py-0.5 rounded border border-brand-green-200">
                      <ShieldCheck size={12} /> Clear (₹0 Dues)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <AlertTriangle size={12} /> Pending (₹{duesCheck.feeDuesAmount} Due)
                    </span>
                  )}
                </div>

                {/* 2. Library */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                  <span className="text-xs font-semibold text-slate-700">2. Library Book Inventory</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green-700 bg-brand-green-50 px-2 py-0.5 rounded border border-brand-green-200">
                    <ShieldCheck size={12} /> Clear (No Books Pending)
                  </span>
                </div>

                {/* 3. Hostel */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                  <span className="text-xs font-semibold text-slate-700">3. Boarding/Hostel/Mess Dues</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green-700 bg-brand-green-50 px-2 py-0.5 rounded border border-brand-green-200">
                    <ShieldCheck size={12} /> Clear (N/A Day Scholar)
                  </span>
                </div>
              </div>

              {/* Form entries for TC */}
              {duesCheck.canProceed ? (
                <form onSubmit={handleInitiateTc} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Total Working Days</label>
                      <input
                        type="number"
                        value={workingDays}
                        onChange={(e) => setWorkingDays(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Days Present</label>
                      <input
                        type="number"
                        value={daysPresent}
                        onChange={(e) => setDaysPresent(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Conduct & Behaviour</label>
                    <select
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                      className="form-input font-semibold"
                    >
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="SATISFACTORY">Satisfactory</option>
                      <option value="POOR">Poor</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Reason for leaving School *</label>
                    <textarea
                      rows={2}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Parents Transfer / High Studies options"
                      className="form-input text-xs"
                    />
                  </div>

                  <button type="submit" className="w-full btn-primary text-xs py-2.5 font-bold">
                    Forward TC for Principal Signing
                  </button>
                </form>
              ) : (
                <div className="bg-rose-50 text-rose-800 text-xs font-bold p-4 rounded-xl border border-rose-100 flex items-center gap-2">
                  <Lock size={16} /> Cannot Initiate Certificate: Dues are pending. Clear fee invoices from the Fees Collection panel first.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column - TCs register history */}
        <div className="card space-y-4">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
            <FileSpreadsheet size={16} className="text-brand-orange-500" /> Issued Register
          </h3>
          <div className="space-y-3">
            {tcsList.map((tc) => (
              <div key={tc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-brand-green-200 transition-colors">
                <div className="flex justify-between items-center">
                  <strong className="font-bold text-xs text-slate-800">{tc.student?.firstName} {tc.student?.lastName}</strong>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    tc.status === 'APPROVED' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {tc.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-1">TC No: {tc.tcNumber}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
