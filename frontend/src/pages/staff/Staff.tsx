import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { 
  UserCog, UserPlus, Search, Save, BadgePercent, 
  Banknote, Landmark, Briefcase, GraduationCap, Download, Image
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

export const Staff: React.FC = () => {
  const { showToast } = useAppStore();
  const [subView, setSubView] = useState<'list' | 'add'>('list');
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Edit and View states
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [viewingStaff, setViewingStaff] = useState<any | null>(null);

  // Pagination states
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Add Staff wizard tabs
  const [wizardTab, setWizardTab] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    bloodGroup: 'O+',
    mobile: '',
    email: '',
    address: '',
    aadhaarNumber: '',
    designation: '',
    department: 'Science',
    employeeType: 'PERMANENT',
    joiningDate: '',
    basicSalary: '',
    daPercent: '',
    hraPercent: '',
    taAmount: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    photoUrl: '', // Stores base64 profile photo representation
    role: 'SUBJECT_TEACHER'
  });

  const loadStaff = async (shouldAppend = false, cursorVal = '') => {
    try {
      if (shouldAppend) setLoadingMore(true);
      else setLoading(true);

      const params: any = { limit: 50 };
      if (cursorVal) params.cursor = cursorVal;
      if (filterDept) params.department = filterDept;
      if (search) params.search = search;

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/staff?${query}`);

      const newItems = res.items || [];
      const newCursor = res.nextCursor || null;

      if (shouldAppend) {
        setStaff(prev => [...prev, ...newItems]);
      } else {
        setStaff(newItems);
      }
      setNextCursor(newCursor);
    } catch (err: any) {
      showToast(err.message || 'Failed to load staff profiles', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (subView === 'list') {
      loadStaff();
    }
  }, [filterDept, search, subView]);

  const formatSalaryInput = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('en-IN');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
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

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.mobile || !formData.email) {
      showToast('Mandatory personal details are missing.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    const payload = {
      ...formData,
      basicSalary: formData.basicSalary.replace(/,/g, ''),
      daPercent: formData.daPercent.replace(/,/g, ''),
      hraPercent: formData.hraPercent.replace(/,/g, ''),
      taAmount: formData.taAmount.replace(/,/g, '')
    };

    try {
      if (editingStaffId) {
        await api.put(`/api/staff/${editingStaffId}`, payload);
        showToast('Staff profile updated successfully!', 'success');
      } else {
        await api.post('/api/staff', payload);
        showToast('Staff registered successfully! OTP credentials generated.', 'success');
      }
      setSubView('list');
      setEditingStaffId(null);
      setWizardTab(1);
    } catch (err: any) {
      showToast(err.message || 'Saving staff failed', 'error');
    }
  };

  const handleEditClick = (st: any) => {
    setEditingStaffId(st.id);
    setFormData({
      firstName: st.firstName || '',
      lastName: st.lastName || '',
      dateOfBirth: st.dateOfBirth ? st.dateOfBirth.split('T')[0] : '',
      gender: st.gender || 'MALE',
      bloodGroup: st.bloodGroup || 'O+',
      mobile: st.mobile || '',
      email: st.email || '',
      address: st.address || '',
      aadhaarNumber: st.aadhaarNumber || '',
      designation: st.designation || '',
      department: st.department || 'Science',
      employeeType: st.employeeType || 'PERMANENT',
      joiningDate: st.joiningDate ? st.joiningDate.split('T')[0] : '',
      basicSalary: st.basicSalary ? Number(st.basicSalary).toLocaleString('en-IN') : '',
      daPercent: String(st.daPercent || '12'),
      hraPercent: String(st.hraPercent || '18'),
      taAmount: st.taAmount ? Number(st.taAmount).toLocaleString('en-IN') : '',
      bankName: st.bankName || '',
      bankAccountNumber: st.bankAccountNumber || '',
      bankIfsc: st.bankIfsc || '',
      photoUrl: st.photoUrl || '',
      role: st.user?.role || 'SUBJECT_TEACHER'
    });
    setSubView('add');
    setWizardTab(1);
  };

  const handleToggleStatus = async (st: any) => {
    const newStatus = st.status === 'ACTIVE' ? 'RESIGNED' : 'ACTIVE';
    try {
      await api.put(`/api/staff/${st.id}/status`, { status: newStatus });
      showToast(`Staff status updated to ${newStatus}`, 'success');
      loadStaff();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const triggerExcelExport = () => {
    const exportHeaders = [
      { label: 'Employee ID', key: 'employeeId' },
      { label: 'First Name', key: 'firstName' },
      { label: 'Last Name', key: 'lastName' },
      { label: 'Designation', key: 'designation' },
      { label: 'Department', key: 'department' },
      { label: 'Mobile', key: 'mobile' },
      { label: 'Email', key: 'email' },
      { label: 'Basic Salary', key: 'basicSalary' },
      { label: 'Status', key: 'status' }
    ];
    exportToCSV(staff, exportHeaders, 'Shantiniketan_Staff_Register');
    showToast('Exported staff list successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff & HR Management</h2>
          <p className="text-xs text-slate-500">Coordinate employee registers, qualifications, salary sheets, and roles.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              setEditingStaffId(null);
              setSubView('list');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'list' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserCog size={14} /> Staff List
          </button>
          <button 
            onClick={() => {
              setEditingStaffId(null);
              setFormData({
                firstName: '',
                lastName: '',
                dateOfBirth: '',
                gender: 'MALE',
                bloodGroup: 'O+',
                mobile: '',
                email: '',
                address: '',
                aadhaarNumber: '',
                designation: '',
                department: 'Science',
                employeeType: 'PERMANENT',
                joiningDate: '',
                basicSalary: '',
                daPercent: '',
                hraPercent: '',
                taAmount: '',
                bankName: '',
                bankAccountNumber: '',
                bankIfsc: '',
                photoUrl: '',
                role: 'SUBJECT_TEACHER'
              });
              setSubView('add');
              setWizardTab(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'add' && !editingStaffId ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserPlus size={14} /> Add Staff
          </button>
        </div>
      </div>

      {subView === 'list' ? (
        <div className="card space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-700">Worksheet Staff Registry Grid</h3>
            <button 
              onClick={triggerExcelExport}
              className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow"
            >
              <Download size={14} /> Export to Excel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name or Employee ID..."
                className="form-input pl-10"
              />
            </div>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="form-input"
            >
              <option value="">All Departments</option>
              <option value="Science">Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Kannada">Kannada</option>
              <option value="Administration">Administration</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="excel-th w-12 text-center">Photo</th>
                  <th className="excel-th">Employee ID</th>
                  <th className="excel-th">Name</th>
                  <th className="excel-th">Designation</th>
                  <th className="excel-th">Department</th>
                  <th className="excel-th">Mobile</th>
                  <th className="excel-th">Salary (Basic)</th>
                  <th className="excel-th">Status</th>
                  <th className="excel-th w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((st) => (
                  <tr key={st.id}>
                    <td className="excel-td flex justify-center items-center">
                      {st.photoUrl ? (
                        <img src={st.photoUrl} alt="" className="w-8 h-8 rounded border object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded border bg-slate-100 flex items-center justify-center text-slate-400">
                          <Image size={14} />
                        </div>
                      )}
                    </td>
                    <td className="excel-td excel-mono">{st.employeeId}</td>
                    <td className="excel-td font-bold text-slate-800 capitalize">{st.firstName} {st.lastName}</td>
                    <td className="excel-td">{st.designation}</td>
                    <td className="excel-td">{st.department}</td>
                    <td className="excel-td excel-mono">{st.mobile}</td>
                    <td className="excel-td excel-mono">
                      {st.basicSalary && !isNaN(parseFloat(st.basicSalary)) 
                        ? `₹${parseFloat(st.basicSalary).toLocaleString('en-IN')}` 
                        : '₹0'}
                    </td>
                    <td className="excel-td">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.status === 'ACTIVE' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {st.status}
                      </span>
                    </td>
                    <td className="excel-td">
                      <div className="flex gap-1 justify-center items-center py-0.5">
                        <button 
                          onClick={() => setViewingStaff(st)}
                          className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded text-[10px] font-bold hover:bg-blue-100"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleEditClick(st)}
                          className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(st)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            st.status === 'ACTIVE' 
                              ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {st.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cursor pagination controls */}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => loadStaff(true, nextCursor)}
                disabled={loadingMore}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingMore ? 'Loading next 50...' : 'Load More Staff ⬇'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Single-Page Professional Staff Form */
        <form onSubmit={handleSaveStaff} noValidate className="space-y-6">
          <div className="card space-y-6">
            <h3 className="font-extrabold text-sm text-slate-700 border-b pb-2">
              {editingStaffId ? 'Edit Staff Registration & Details' : 'Staff Admission & Enrollment Form'}
            </h3>

            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">1. Personal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="form-input capitalize"
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
                  />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) {
                        setFormData({ ...formData, mobile: val });
                      }
                    }}
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
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
                  <label className="form-label">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="form-input"
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Aadhaar Card Number (12 digit)</label>
                  <input
                    type="text"
                    value={formData.aadhaarNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 12) {
                        setFormData({ ...formData, aadhaarNumber: val });
                      }
                    }}
                    maxLength={12}
                    placeholder="12-digit Aadhaar number"
                    className="form-input"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="form-label">Residential Address</label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-input"
                  />
                </div>
                {/* Photo Selector */}
                <div className="md:col-span-3 pt-2 flex items-center gap-4">
                  <div>
                    <label className="form-label">Profile Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-orange-50 file:text-brand-orange-700 hover:file:bg-brand-orange-100"
                    />
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

            {/* Section 2: Employment Settings */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">2. Employment Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value.toUpperCase() })}
                    className="form-input uppercase"
                  />
                </div>
                <div>
                  <label className="form-label">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="form-input"
                  >
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Administration">Administration</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Login Authorization Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-input"
                  >
                    <option value="SUBJECT_TEACHER">Subject Teacher</option>
                    <option value="CLASS_TEACHER">Class Teacher</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ADMIN">Admin Clerk</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Salary & Allowances */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">3. Salary & Allowances</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="form-label">Basic Salary (₹)</label>
                  <input
                    type="text"
                    value={formData.basicSalary}
                    onChange={(e) => {
                      const formatted = formatSalaryInput(e.target.value);
                      setFormData({ ...formData, basicSalary: formatted });
                    }}
                    placeholder="e.g. 11,000"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">DA Allowance (%)</label>
                  <input
                    type="number"
                    value={formData.daPercent}
                    onChange={(e) => setFormData({ ...formData, daPercent: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">HRA Allowance (%)</label>
                  <input
                    type="number"
                    value={formData.hraPercent}
                    onChange={(e) => setFormData({ ...formData, hraPercent: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">TA Allowance (₹)</label>
                  <input
                    type="text"
                    value={formData.taAmount}
                    onChange={(e) => {
                      const formatted = formatSalaryInput(e.target.value);
                      setFormData({ ...formData, taAmount: formatted });
                    }}
                    placeholder="e.g. 1,500"
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Bank Profile */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h4 className="font-bold text-xs text-brand-orange-600 uppercase tracking-wider">4. Bank Profile</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value.toUpperCase() })}
                    className="form-input uppercase"
                  />
                </div>
                <div>
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 12) {
                        setFormData({ ...formData, bankAccountNumber: val });
                      }
                    }}
                    maxLength={12}
                    placeholder="Max 12 digits"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankIfsc}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                      if (val.length <= 8) {
                        setFormData({ ...formData, bankIfsc: val });
                      }
                    }}
                    maxLength={8}
                    placeholder="Max 8 chars"
                    className="form-input uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Form Action Footer */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => {
                  setEditingStaffId(null);
                  setSubView('list');
                }}
                className="btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Save size={14} /> {editingStaffId ? 'Update Staff Profile' : 'Save Staff Registry'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Staff View Modal */}
      {viewingStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Staff Profile Details</h3>
                <p className="text-xs text-slate-500">Employee ID: {viewingStaff.employeeId}</p>
              </div>
              <button 
                onClick={() => setViewingStaff(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-24 h-24 rounded border bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {viewingStaff.photoUrl ? (
                  <img src={viewingStaff.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image size={32} className="text-slate-300" />
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs w-full">
                <div><span className="font-semibold text-slate-500">Full Name:</span> <span className="text-slate-800 font-bold capitalize">{viewingStaff.firstName} {viewingStaff.lastName}</span></div>
                <div><span className="font-semibold text-slate-500">Authorization Role:</span> <span className="text-slate-800 font-bold uppercase">{viewingStaff.user?.role || viewingStaff.role || 'N/A'}</span></div>
                <div><span className="font-semibold text-slate-500">Mobile Number:</span> <span className="text-slate-800 font-mono">{viewingStaff.mobile}</span></div>
                <div><span className="font-semibold text-slate-500">Email Address:</span> <span className="text-slate-800 font-mono">{viewingStaff.email}</span></div>
                <div><span className="font-semibold text-slate-500">Designation:</span> <span className="text-slate-800 font-bold">{viewingStaff.designation}</span></div>
                <div><span className="font-semibold text-slate-500">Department:</span> <span className="text-slate-800 font-bold">{viewingStaff.department}</span></div>
                <div><span className="font-semibold text-slate-500">Gender:</span> <span className="text-slate-800 uppercase">{viewingStaff.gender}</span></div>
                <div><span className="font-semibold text-slate-500">Blood Group:</span> <span className="text-slate-800">{viewingStaff.bloodGroup || 'N/A'}</span></div>
                <div><span className="font-semibold text-slate-500">Joining Date:</span> <span className="text-slate-800">{viewingStaff.joiningDate ? new Date(viewingStaff.joiningDate).toLocaleDateString('en-IN') : 'N/A'}</span></div>
                <div><span className="font-semibold text-slate-500">Basic Salary:</span> <span className="text-slate-800 font-mono">
                  {viewingStaff.basicSalary && !isNaN(parseFloat(viewingStaff.basicSalary)) 
                    ? `₹${parseFloat(viewingStaff.basicSalary).toLocaleString('en-IN')}` 
                    : '₹0'}
                </span></div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Residential Address:</span> <span className="text-slate-800">{viewingStaff.address || 'N/A'}</span></div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button 
                onClick={() => setViewingStaff(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
