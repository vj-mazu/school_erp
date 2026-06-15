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
    designation: 'TGT Science',
    department: 'Science',
    employeeType: 'PERMANENT',
    joiningDate: '',
    basicSalary: '35000',
    daPercent: '12',
    hraPercent: '18',
    taAmount: '1500',
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

    try {
      await api.post('/api/staff', formData);
      showToast('Staff registered successfully! OTP credentials generated.', 'success');
      setSubView('list');
      setWizardTab(1);
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
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
            onClick={() => setSubView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'list' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserCog size={14} /> Staff List
          </button>
          <button 
            onClick={() => setSubView('add')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              subView === 'add' ? 'bg-brand-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
                    <td className="excel-td excel-mono">₹{parseFloat(st.basicSalary).toLocaleString('en-IN')}</td>
                    <td className="excel-td">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-green-50 text-brand-green-700">
                        {st.status}
                      </span>
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
        /* Add Wizard Form */
        <div className="card space-y-6">
          <div className="flex border-b border-slate-200 text-xs font-bold text-slate-500 overflow-x-auto">
            {[
              { num: 1, label: 'Personal Details', icon: UserCog },
              { num: 2, label: 'Employment Settings', icon: Briefcase },
              { num: 3, label: 'Salary & Allowances', icon: Banknote },
              { num: 4, label: 'Bank Profile', icon: Landmark }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.num}
                  onClick={() => setWizardTab(tab.num)}
                  className={`py-3 px-4 border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                    wizardTab === tab.num ? 'border-brand-orange-500 text-brand-orange-600 bg-orange-50/10' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveStaff} className="space-y-6">
            {wizardTab === 1 && (
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
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
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
                <div className="md:col-span-3 border-t border-slate-100 pt-4 flex items-center gap-4">
                  <div>
                    <label className="form-label">Profile Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-orange-50 file:text-brand-orange-700 hover:file:bg-brand-orange-100"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 200KB. Automatically resized for database storage.</p>
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
            )}

            {wizardTab === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="form-input"
                    placeholder="e.g. TGT Science"
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
                    <option value="Administration">Administration</option>
                    <option value="Other">Other</option>
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
              </div>
            )}

            {wizardTab === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
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
                    type="number"
                    value={formData.taAmount}
                    onChange={(e) => setFormData({ ...formData, taAmount: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {wizardTab === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankIfsc}
                    onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {/* Common Wizard Navigation Footer */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                disabled={wizardTab === 1}
                onClick={() => setWizardTab(prev => Math.max(1, prev - 1))}
                className="btn-outline text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Back
              </button>

              <div className="flex gap-2">
                {wizardTab < 4 && (
                  <button
                    type="button"
                    onClick={() => setWizardTab(prev => Math.min(4, prev + 1))}
                    className="btn-primary text-xs"
                  >
                    Next Tab →
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Save size={14} /> Save Staff Registry
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
