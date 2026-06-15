import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { 
  Search, UserPlus, GraduationCap, Users, Calendar, 
  ShieldCheck, AlertCircle, Save, Printer, Trash2, Download, Image,
  Eye, Edit
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

export const Students: React.FC = () => {
  const { showToast, activeYear, academicYears, user } = useAppStore();
  const [subView, setSubView] = useState<'list' | 'add' | 'promote'>('list');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState(activeYear?.id || '');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterRte, setFilterRte] = useState('');
  const [filterAdmissionNo, setFilterAdmissionNo] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  // Pagination states
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [dob, setDob] = useState('');
  const [age, setAge] = useState<number | string>('Auto calculated');
  const [aadhaar, setAadhaar] = useState('');

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<any>(null);
  const [deactivatingStudent, setDeactivatingStudent] = useState<any>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Single-Page Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    fullNameAsPerAadhaar: '',
    gender: 'MALE',
    bloodGroup: 'UNKNOWN',
    religion: 'Hindu',
    caste: '',
    category: 'GENERAL',
    nationality: 'Indian',
    motherTongue: 'Hindi',
    classId: '',
    sectionId: '',
    rollNumber: '',
    mediumOfInstruction: 'ENGLISH',
    board: 'STATE',
    rteStudent: false,
    satsNumber: '',
    admissionNumber: '',
    photoUrl: '', // Stores base64 profile photo representation
    // Guardians
    fatherName: '',
    fatherMobile: '',
    fatherOccupation: '',
    motherName: '',
    motherMobile: '',
    motherOccupation: '',
    address: '',
    city: '',
    taluka: '',
    village: '',
    pincode: '',
    status: 'ACTIVE'
  });

  // Calculate age from DOB
  useEffect(() => {
    if (dob) {
      const birth = new Date(dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge > 0 ? calculatedAge : 0);
    }
  }, [dob]);

  // Load Classes config on mount
  useEffect(() => {
    api.get('/api/settings/classes-sections')
      .then(data => setClasses(data))
      .catch(err => showToast(err.message || 'Failed to load class configs', 'error'));
  }, []);

  // Sync academic year selection state with global Topbar switcher state
  useEffect(() => {
    if (activeYear?.id) {
      setFilterYear(activeYear.id);
    }
  }, [activeYear]);

  // Fetch student items dynamically matching filters
  const loadData = async (shouldAppend = false, cursorVal = '') => {
    try {
      if (shouldAppend) setLoadingMore(true);
      else setLoading(true);

      const params: any = { limit: 50 };
      if (cursorVal) params.cursor = cursorVal;
      if (filterClass) params.classId = filterClass;
      if (filterSection) params.sectionId = filterSection;
      if (filterRte) params.rteStudent = filterRte;
      if (filterAdmissionNo) params.admissionNumber = filterAdmissionNo;
      if (search) params.search = search;
      if (filterYear) params.academicYearId = filterYear;
      if (filterStatus) params.status = filterStatus;

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/students?${query}`);

      const newItems = res.items || [];
      const newCursor = res.nextCursor || null;

      if (shouldAppend) {
        setStudents(prev => [...prev, ...newItems]);
      } else {
        setStudents(newItems);
      }
      setNextCursor(newCursor);
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve register list', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Trigger list fetch when filters or view changes
  useEffect(() => {
    if (subView === 'list') {
      loadData();
    }
  }, [filterClass, filterSection, filterYear, filterRte, filterAdmissionNo, search, subView]);

  // Read selected photo file as base64 string
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) { // Max limit 200KB to prevent memory issues
        showToast('Please upload a photo smaller than 200KB', 'info');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Format Aadhaar masking XXXX-XXXX-XXXX
  const handleAadhaarChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    setAadhaar(raw);
  };

  // Submit Admission Form
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.classId || !formData.admissionNumber || !dob || !formData.fatherName || !formData.fatherMobile) {
      showToast('Please fill out all mandatory fields (marked with *).', 'error');
      return;
    }

    const selectedClassObj = classes.find(c => c.id === formData.classId);
    const hasSections = (selectedClassObj?.sections || []).length > 0;
    if (hasSections && !formData.sectionId) {
      showToast('Please select a Class Section.', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        satsNumber: formData.satsNumber || undefined,
        dateOfBirth: dob,
        aadhaarNumber: aadhaar || undefined, // only pass if typed, backend ignores if undefined or empty
        guardians: [
          {
            type: 'FATHER',
            name: formData.fatherName || 'FATHER NAME',
            relation: 'Father',
            mobile: formData.fatherMobile || '9999999999',
            occupation: formData.fatherOccupation,
            isPrimaryContact: true,
            address: formData.address
          },
          {
            type: 'MOTHER',
            name: formData.motherName || 'MOTHER NAME',
            relation: 'Mother',
            mobile: formData.motherMobile || '9999999998',
            occupation: formData.motherOccupation,
            isPrimaryContact: false,
            address: formData.address
          }
        ]
      };

      if (editingStudentId) {
        await api.put(`/api/students/${editingStudentId}`, payload);
        showToast('Student details updated successfully!', 'success');
      } else {
        await api.post('/api/students', payload);
        showToast('Student admitted successfully! Parent credentials sent.', 'success');
      }

      setSubView('list');
      setEditingStudentId(null);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        fullNameAsPerAadhaar: '',
        gender: 'MALE',
        bloodGroup: 'UNKNOWN',
        religion: 'Hindu',
        caste: '',
        category: 'GENERAL',
        nationality: 'Indian',
        motherTongue: 'Hindi',
        classId: '',
        sectionId: '',
        rollNumber: '',
        mediumOfInstruction: 'ENGLISH',
        board: 'STATE',
        rteStudent: false,
        satsNumber: '',
        admissionNumber: '',
        photoUrl: '',
        fatherName: '',
        fatherMobile: '',
        fatherOccupation: '',
        motherName: '',
        motherMobile: '',
        motherOccupation: '',
        address: '',
        city: '',
        taluka: '',
        village: '',
        pincode: '',
        status: 'ACTIVE'
      });
      setDob('');
      setAadhaar('');
    } catch (err: any) {
      showToast(err.message || 'Saving failed', 'error');
    }
  };

  const handleEditClick = (st: any) => {
    setEditingStudentId(st.id);
    const father = st.guardians?.find((g: any) => g.type === 'FATHER') || {};
    const mother = st.guardians?.find((g: any) => g.type === 'MOTHER') || {};
    setFormData({
      firstName: st.firstName || '',
      lastName: st.lastName || '',
      fullNameAsPerAadhaar: st.fullNameAsPerAadhaar || '',
      gender: st.gender || 'MALE',
      bloodGroup: st.bloodGroup || 'UNKNOWN',
      religion: st.religion || 'Hindu',
      caste: st.caste || '',
      category: st.category || 'GENERAL',
      nationality: st.nationality || 'Indian',
      motherTongue: st.motherTongue || 'Hindi',
      classId: st.classId || '',
      sectionId: st.sectionId || '',
      rollNumber: st.rollNumber ? String(st.rollNumber) : '',
      mediumOfInstruction: st.mediumOfInstruction || 'ENGLISH',
      board: st.board || 'STATE',
      rteStudent: !!st.rteStudent,
      satsNumber: st.satsNumber || '',
      admissionNumber: st.admissionNumber || '',
      photoUrl: st.photoUrl || '',
      fatherName: father.name || '',
      fatherMobile: father.mobile || '',
      fatherOccupation: father.occupation || '',
      motherName: mother.name || '',
      motherMobile: mother.mobile || '',
      motherOccupation: mother.occupation || '',
      address: st.address || '',
      city: st.city || '',
      taluka: st.taluka || '',
      village: st.village || '',
      pincode: st.pincode || '',
      status: st.status || 'ACTIVE'
    });
    setAadhaar('');
    setDob(st.dateOfBirth ? new Date(st.dateOfBirth).toISOString().split('T')[0] : '');
    setSubView('add');
  };

  const handleStatusToggle = async (st: any) => {
    const isCurrentlyActive = st.status === 'ACTIVE';
    if (isCurrentlyActive) {
      setDeactivatingStudent(st);
      setDeactivateReason('');
    } else {
      const confirmActivate = window.confirm(`Are you sure you want to activate ${st.firstName} ${st.lastName}?`);
      if (!confirmActivate) return;
      
      try {
        await api.put(`/api/students/${st.id}/status`, { status: 'ACTIVE' });
        showToast('Student profile activated successfully.', 'success');
        loadData();
      } catch (err: any) {
        showToast(err.message || 'Status toggle failed', 'error');
      }
    }
  };

  const submitDeactivation = async () => {
    if (!deactivateReason.trim()) {
      showToast('Reason is required to deactivate a student profile.', 'error');
      return;
    }
    try {
      await api.put(`/api/students/${deactivatingStudent.id}/status`, { status: 'INACTIVE', statusReason: deactivateReason.trim() });
      showToast('Student profile deactivated successfully.', 'success');
      setDeactivatingStudent(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Status toggle failed', 'error');
    }
  };

  // Download Excel Sheet Action
  const triggerExcelExport = () => {
    const exportHeaders = [
      { label: 'Admission Number', key: 'admissionNumber' },
      { label: 'SATS Number', key: 'satsNumber' },
      { label: 'Roll Number', key: 'rollNumber' },
      { label: 'First Name', key: 'firstName' },
      { label: 'Last Name', key: 'lastName' },
      { label: 'Class', key: 'class.name' },
      { label: 'Section', key: 'section.name' },
      { label: 'Gender', key: 'gender' },
      { label: 'RTE Status', key: 'rteStudent' },
      { label: 'City', key: 'city' },
      { label: 'Taluka', key: 'taluka' },
      { label: 'Village', key: 'village' },
      { label: 'Status', key: 'status' }
    ];
    exportToCSV(students, exportHeaders, 'Shantiniketan_Student_Register');
    showToast('Exported register successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Administration</h2>
          <p className="text-xs text-slate-500">Manage admissions, registers, detailed profiles, and promotions.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setSubView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'list' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users size={14} /> Register List
          </button>
          <button 
            onClick={() => setSubView('add')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'add' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserPlus size={14} /> New Admission
          </button>
        </div>
      </div>

      {/* Subviews */}
      {subView === 'list' ? (
        <div className="card space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 no-print">
            <h3 className="font-bold text-sm text-slate-700">Worksheet Student Register Grid</h3>
            <div className="flex gap-2">
              <button 
                onClick={triggerExcelExport}
                className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow"
              >
                <Download size={14} /> Export to Excel
              </button>
              <button 
                onClick={() => window.print()}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow"
              >
                <Printer size={14} /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* Print-Only Professional Header showing selected filters */}
          <div className="hidden print:block mb-4 text-slate-900">
            <h1 className="text-sm font-extrabold uppercase tracking-tight text-center">SHANTINIKETAN PUBLIC SCHOOL, CHAPETLA</h1>
            <div className="flex justify-between items-center text-[10px] font-bold border-b border-blue-400 pb-1 mt-1">
              <div>Academic Year: {activeYear ? activeYear.name : 'N/A'}</div>
              <div>Class & Section: {classes.find(c => c.id === filterClass)?.name || 'All Classes'} - {classes.find(c => c.id === filterClass)?.sections?.find((s: any) => s.id === filterSection)?.name || 'All Sections'}</div>
            </div>
          </div>

          {/* Search filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 no-print">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name..."
                className="form-input pl-9"
              />
            </div>

            <input
              type="text"
              value={filterAdmissionNo}
              onChange={(e) => setFilterAdmissionNo(e.target.value.toUpperCase())}
              placeholder="Filter Admission No..."
              className="form-input uppercase"
            />

            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setFilterSection('');
              }}
              className="form-input"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="form-input"
              disabled={!filterClass}
            >
              <option value="">All Sections</option>
              {classes.find(c => c.id === filterClass)?.sections?.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input"
            >
              <option value="">Status: All</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
              <option value="TC_ISSUED">TC Issued Only</option>
              <option value="DETAINED">Detained Only</option>
              <option value="TRANSFERRED">Transferred Only</option>
              <option value="ALUMNI">Alumni Only</option>
            </select>

            <select
              value={filterRte}
              onChange={(e) => setFilterRte(e.target.value)}
              className="form-input"
            >
              <option value="">RTE Status: All</option>
              <option value="true">RTE Admitted Only</option>
              <option value="false">Non-RTE Only</option>
            </select>
          </div>

          {/* Student Grid/Table */}
          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th w-12 text-center no-print">Photo</th>
                  <th className="excel-th text-left">Admission No</th>
                  <th className="excel-th text-left">SATS Number</th>
                  <th className="excel-th w-16 text-center">Roll No</th>
                  <th className="excel-th text-left">Student Name</th>
                  <th className="excel-th text-left">Class/Section</th>
                  <th className="excel-th text-left">Father's Name</th>
                  <th className="excel-th text-left">Father's Mobile</th>
                  <th className="excel-th text-center">Category</th>
                  <th className="excel-th text-center">Status</th>
                  <th className="excel-th text-center w-24 no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => {
                  const father = st.guardians?.find((g: any) => g.type === 'FATHER');
                  const isEditAuthorized = user && ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'ACCOUNTANT'].includes(user.role);
                  return (
                    <tr key={st.id}>
                      <td className="excel-td flex justify-center items-center no-print">
                        {st.photoUrl ? (
                          <img src={st.photoUrl} alt="" className="w-8 h-8 rounded border object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded border bg-slate-100 flex items-center justify-center text-slate-400">
                            <Image size={14} />
                          </div>
                        )}
                      </td>
                      <td className="excel-td excel-mono text-left">{st.admissionNumber}</td>
                      <td className="excel-td excel-mono text-left">{st.satsNumber || 'N/A'}</td>
                      <td className="excel-td excel-mono text-center">{st.rollNumber || 'N/A'}</td>
                      <td className="excel-td font-bold text-slate-800 capitalize text-left">{st.firstName} {st.lastName}</td>
                      <td className="excel-td text-left">{st.class?.name} - {st.section?.name}</td>
                      <td className="excel-td font-semibold text-xs text-slate-700 text-left">
                        {father ? father.name : 'N/A'}
                      </td>
                      <td className="excel-td font-mono text-xs text-slate-700 text-left">
                        {father ? father.mobile : 'N/A'}
                      </td>
                      <td className="excel-td text-center">
                        <div className="flex flex-col gap-0.5 items-center">
                          <span className="text-[10px] text-slate-800 font-bold uppercase">{st.category}</span>
                          {st.rteStudent && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                              RTE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="excel-td text-center">
                        {isEditAuthorized ? (
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(st)}
                            title={st.status === 'ACTIVE' ? "Click to Deactivate / Make Inactive" : "Click to Activate"}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${
                              st.status === 'ACTIVE' 
                                ? 'bg-brand-green-100 hover:bg-brand-green-200 text-brand-green-800' 
                                : st.status === 'INACTIVE'
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-850'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {st.status}
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.status === 'ACTIVE' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {st.status}
                          </span>
                        )}
                      </td>
                      <td className="excel-td text-center no-print">
                        <div className="flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(st)}
                            title="View Full Details"
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          {isEditAuthorized && (
                            <button
                              type="button"
                              onClick={() => handleEditClick(st)}
                              title="Edit Profile"
                              className="p-1 text-brand-orange-600 hover:text-brand-orange-800 hover:bg-brand-orange-50 rounded transition-colors"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={11} className="excel-td text-center py-6 text-slate-400 font-bold">No active student profiles match the filter criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cursor pagination controls */}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => loadData(true, nextCursor)}
                disabled={loadingMore}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingMore ? 'Loading next 50...' : 'Load More Students ⬇'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Single-Page Professional Admission Form */
        <form onSubmit={handleSaveStudent} noValidate className="space-y-6">
          <div className="card space-y-6">
            <h3 className="font-extrabold text-sm text-slate-700 border-b pb-2">
              {editingStudentId ? 'Edit Student Registration & Details' : 'Student Admission & Enrollment Form'}
            </h3>

            {/* Section 1: Basic details */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">1. Personal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="form-input capitalize"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="form-input capitalize"
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <label className="form-label">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Age (Auto calculated)</label>
                  <input
                    type="text"
                    disabled
                    value={age}
                    className="form-input bg-slate-50 text-slate-500 font-bold"
                  />
                </div>
                <div>
                  <label className="form-label">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="form-input"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input"
                  >
                    <option value="GENERAL">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Aadhaar Card Number (12 digit)</label>
                  <input
                    type="text"
                    value={aadhaar}
                    onChange={(e) => handleAadhaarChange(e.target.value)}
                    className="form-input"
                    placeholder="XXXX-XXXX-XXXX"
                  />
                </div>
                <div>
                  <label className="form-label">Full Name As per Aadhaar</label>
                  <input
                    type="text"
                    value={formData.fullNameAsPerAadhaar}
                    onChange={(e) => setFormData({ ...formData, fullNameAsPerAadhaar: e.target.value })}
                    className="form-input capitalize"
                    placeholder="Full name as per Aadhaar"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: School Academic Enrollment details */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">2. Enrolment & Academic Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Admission Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value.toUpperCase() })}
                    className="form-input font-mono font-bold uppercase"
                    placeholder="Manually Enter (e.g. SCH/2026/001)"
                  />
                </div>
                <div>
                  <label className="form-label">SATS Number</label>
                  <input
                    type="text"
                    value={formData.satsNumber}
                    onChange={(e) => setFormData({ ...formData, satsNumber: e.target.value.toUpperCase() })}
                    className="form-input uppercase"
                    placeholder="State tracking ID (e.g. 1042319)"
                  />
                </div>
                <div>
                  <label className="form-label">Admission Class *</label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: '' })}
                    className="form-input"
                  >
                    <option value="">Select class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {(() => {
                    const selectedClassObj = classes.find(c => c.id === formData.classId);
                    const targetSections = selectedClassObj?.sections || [];
                    const sortedSections = [...targetSections].sort((a: any, b: any) => a.name.localeCompare(b.name));
                    const hasSections = sortedSections.length > 0;
                    return (
                      <>
                        <label className="form-label">Section {hasSections && '*'}</label>
                        <select
                          required={hasSections}
                          value={formData.sectionId}
                          onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                          className="form-input"
                          disabled={!formData.classId}
                        >
                          {hasSections ? (
                            <>
                              <option value="">Select section...</option>
                              {sortedSections.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </>
                          ) : (
                            <option value="">No sections available</option>
                          )}
                        </select>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label className="form-label">Roll Number</label>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={formData.rollNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                      setFormData({ ...formData, rollNumber: val });
                    }}
                    className="form-input font-mono"
                    placeholder="Max 3 digits (e.g. 12)"
                  />
                </div>
                <div>
                  <label className="form-label">Medium of Instruction</label>
                  <select
                    value={formData.mediumOfInstruction}
                    onChange={(e) => setFormData({ ...formData, mediumOfInstruction: e.target.value })}
                    className="form-input"
                  >
                    <option value="ENGLISH">English Medium</option>
                    <option value="KANNADA">Kannada Medium</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Board Affiliation</label>
                  <input
                    type="text"
                    readOnly
                    value="State Board"
                    className="form-input bg-slate-50 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
                {editingStudentId && (
                  <div>
                    <label className="form-label">Student Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="form-input font-semibold"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="TC_ISSUED">TC Issued</option>
                      <option value="DETAINED">Detained</option>
                      <option value="TRANSFERRED">Transferred</option>
                      <option value="ALUMNI">Alumni</option>
                    </select>
                  </div>
                )}
              </div>

              {/* RTE Toggle Selection */}
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.rteStudent}
                    onChange={(e) => setFormData({ ...formData, rteStudent: e.target.checked })}
                    className="w-4 h-4 accent-brand-orange-600 rounded"
                  />
                  Is Admitted under RTE (Right to Education)?
                </label>
              </div>
            </div>

            {/* Section 3: Primary Contact / Guardians */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">3. Guardians & Primary Contacts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Father profile */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Father's Profile</span>
                  <div>
                    <label className="form-label text-xs">Father's Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      className="form-input capitalize text-xs"
                      placeholder="Father's full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label text-xs">Contact Mobile *</label>
                      <input
                        type="text"
                        required
                        value={formData.fatherMobile}
                        onChange={(e) => setFormData({ ...formData, fatherMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="form-input text-xs"
                        placeholder="Primary contact"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Occupation</label>
                      <input
                        type="text"
                        value={formData.fatherOccupation}
                        onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                        className="form-input capitalize text-xs"
                        placeholder="Service/Business"
                      />
                    </div>
                  </div>
                </div>

                {/* Mother profile */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mother's Profile</span>
                  <div>
                    <label className="form-label text-xs">Mother's Name</label>
                    <input
                      type="text"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      className="form-input capitalize text-xs"
                      placeholder="Mother's full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label text-xs">Contact Mobile</label>
                      <input
                        type="text"
                        value={formData.motherMobile}
                        onChange={(e) => setFormData({ ...formData, motherMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="form-input text-xs"
                        placeholder="Mobile contact"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Occupation</label>
                      <input
                        type="text"
                        value={formData.motherOccupation}
                        onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                        className="form-input capitalize text-xs"
                        placeholder="Homemaker/Working"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Address Details */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">4. Contact Address & Profile Photo</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4">
                  <label className="form-label">Permanent Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-input"
                    placeholder="House number, Colony, Street name"
                  />
                </div>
                <div>
                  <label className="form-label">Village</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="form-input capitalize"
                    placeholder="Village Name"
                  />
                </div>
                <div>
                  <label className="form-label">Taluka</label>
                  <input
                    type="text"
                    value={formData.taluka}
                    onChange={(e) => setFormData({ ...formData, taluka: e.target.value })}
                    className="form-input capitalize"
                    placeholder="Taluka / Block"
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="form-input capitalize"
                    placeholder="City Name"
                  />
                </div>
                <div>
                  <label className="form-label">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="form-input"
                    placeholder="6-digit pincode"
                  />
                </div>
                
                {/* Photo Selector inside Form */}
                <div className="md:col-span-4 border-t border-slate-100 pt-4 flex items-center gap-4">
                  <div>
                    <label className="form-label">Student Profile Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-orange-50 file:text-brand-orange-700 hover:file:bg-brand-orange-100"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 200KB. Resized for storage.</p>
                  </div>
                  {formData.photoUrl && (
                    <div className="relative w-14 h-14 rounded border overflow-hidden bg-slate-50 shadow-inner shrink-0">
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                        className="absolute top-0 right-0 bg-rose-600 hover:bg-rose-700 text-white text-[9px] w-4 h-4 flex items-center justify-center font-bold rounded-bl"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="btn-secondary text-xs flex items-center gap-1.5 px-6 py-2"
              >
                <Save size={14} /> {editingStudentId ? 'Save Changes & Update Profile' : 'Submit & Admit Student'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* View Details Modal Overlay */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">Student Profile Summary</h3>
                <p className="text-xs text-slate-500">Comprehensive enrollment, personal, and guardian files.</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Profile Card Header */}
              <div className="flex flex-col md:flex-row gap-6 items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                {viewingStudent.photoUrl ? (
                  <img src={viewingStudent.photoUrl} alt="" className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md" />
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-white shadow-md bg-slate-200 flex items-center justify-center text-slate-400">
                    <Image size={36} />
                  </div>
                )}
                <div className="text-center md:text-left space-y-1">
                  <h4 className="text-xl font-bold text-slate-800 capitalize">
                    {viewingStudent.firstName} {viewingStudent.lastName}
                  </h4>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-2.5 py-0.5 bg-brand-orange-50 text-brand-orange-700 font-bold text-xs rounded-full">
                      Adm No: {viewingStudent.admissionNumber}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
                      Roll No: {viewingStudent.rollNumber || 'N/A'}
                    </span>
                    <span className={`px-2.5 py-0.5 font-bold text-xs rounded-full ${
                      viewingStudent.status === 'ACTIVE' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      Status: {viewingStudent.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Enrolled Class: <span className="font-semibold text-slate-700">{viewingStudent.class?.name || 'N/A'} - {viewingStudent.section?.name || 'N/A'}</span>
                  </p>
                  {viewingStudent.statusReason && (
                    <div className="text-xs text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 font-semibold mt-1 inline-block">
                      Reason for Inactive: {viewingStudent.statusReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Files */}
                <div className="border border-slate-100 rounded-xl p-4 space-y-3 shadow-inner bg-slate-50/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Personal Details</span>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400">Date of Birth</p>
                      <p className="font-semibold text-slate-700">
                        {viewingStudent.dateOfBirth ? new Date(viewingStudent.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Gender</p>
                      <p className="font-semibold text-slate-700 capitalize">{viewingStudent.gender?.toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Category / Caste</p>
                      <p className="font-semibold text-slate-700">
                        {viewingStudent.category} {viewingStudent.caste ? `(${viewingStudent.caste})` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Religion</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.religion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Aadhaar Masked</p>
                      <p className="font-mono font-semibold text-slate-700">{viewingStudent.aadhaarMasked || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Aadhaar Name</p>
                      <p className="font-semibold text-slate-700 capitalize">{viewingStudent.fullNameAsPerAadhaar || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Mother Tongue</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.motherTongue || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Nationality</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.nationality || 'Indian'}</p>
                    </div>
                  </div>
                </div>

                {/* Enrollment details */}
                <div className="border border-slate-100 rounded-xl p-4 space-y-3 shadow-inner bg-slate-50/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Enrollment & Academics</span>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400">SATS Number</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.satsNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">RTE Student</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.rteStudent ? 'Yes (Admitted under RTE)' : 'No (General)'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Medium of Instruction</p>
                      <p className="font-semibold text-slate-700 capitalize">{viewingStudent.mediumOfInstruction?.toLowerCase()} Medium</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Board Affiliation</p>
                      <p className="font-semibold text-slate-700 font-bold">State Board</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Admission Date</p>
                      <p className="font-semibold text-slate-700">
                        {viewingStudent.admissionDate ? new Date(viewingStudent.admissionDate).toLocaleDateString('en-IN') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Blood Group</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.bloodGroup || 'UNKNOWN'}</p>
                    </div>
                  </div>
                </div>

                {/* Guardian Details */}
                <div className="md:col-span-2 border border-slate-100 rounded-xl p-4 space-y-4 shadow-inner bg-slate-50/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. Guardians & Primary Contacts</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const father = viewingStudent.guardians?.find((g: any) => g.type === 'FATHER');
                      return (
                        <div className="p-3 bg-white rounded-lg border border-slate-100 text-xs space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Father Profile</p>
                          <p className="font-bold text-slate-700">{father?.name || 'N/A'}</p>
                          <p className="text-slate-500">Contact: <span className="font-mono text-slate-700">{father?.mobile || 'N/A'}</span></p>
                          <p className="text-slate-500">Occupation: <span className="text-slate-700">{father?.occupation || 'N/A'}</span></p>
                        </div>
                      );
                    })()}
                    {(() => {
                      const mother = viewingStudent.guardians?.find((g: any) => g.type === 'MOTHER');
                      return (
                        <div className="p-3 bg-white rounded-lg border border-slate-100 text-xs space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Mother Profile</p>
                          <p className="font-bold text-slate-700">{mother?.name || 'N/A'}</p>
                          <p className="text-slate-500">Contact: <span className="font-mono text-slate-700">{mother?.mobile || 'N/A'}</span></p>
                          <p className="text-slate-500">Occupation: <span className="text-slate-700">{mother?.occupation || 'N/A'}</span></p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Contact Address */}
                <div className="md:col-span-2 border border-slate-100 rounded-xl p-4 space-y-3 shadow-inner bg-slate-50/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">4. Contact Address</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400">Permanent Address</p>
                      <p className="font-semibold text-slate-700">{viewingStudent.address || 'N/A'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-slate-400">Village</p>
                        <p className="font-semibold text-slate-700">{viewingStudent.village || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Taluka</p>
                        <p className="font-semibold text-slate-700">{viewingStudent.taluka || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">City</p>
                        <p className="font-semibold text-slate-700">{viewingStudent.city || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Pincode</p>
                        <p className="font-mono font-semibold text-slate-700">{viewingStudent.pincode || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
              >
                Close File View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deactivation Reason Modal */}
      {deactivatingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Deactivate Student Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Please provide the reason for making <b>{deactivatingStudent.firstName} {deactivatingStudent.lastName}</b> inactive.</p>
            </div>
            <div>
              <label className="form-label text-xs">Reason for Deactivation *</label>
              <textarea
                rows={3}
                required
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="e.g. Student transferred, prolonged absence, parent request, etc."
                className="form-input text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeactivatingStudent(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDeactivation}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow"
              >
                Confirm Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
