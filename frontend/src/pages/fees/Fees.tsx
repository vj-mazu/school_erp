import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { 
  Search, Wallet, CreditCard, Receipt, Printer, CheckCircle2, 
  AlertCircle, IndianRupee, RefreshCw, Download, Edit2, ShieldAlert,
  Settings, Calendar, PlusCircle, Trash2
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

export const Fees: React.FC = () => {
  const { showToast, user, activeYear } = useAppStore();
  const [activeTab, setActiveTab] = useState<'collect' | 'invoices' | 'concessions' | 'class-summary' | 'setup'>('collect');
  const [classSummary, setClassSummary] = useState<any[]>([]);

  // Collect tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [duesData, setDuesData] = useState<any | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [payingAmounts, setPayingAmounts] = useState<{ [key: string]: string }>({});
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [discount, setDiscount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [lateFine, setLateFine] = useState('0');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);

  // Invoices tab states
  const [classes, setClasses] = useState<any[]>([]);
  const [invoiceClass, setInvoiceClass] = useState('');
  const [invoiceSection, setInvoiceSection] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  
  // Edit Invoice Modal state
  const [editInvoice, setEditInvoice] = useState<any | null>(null);
  const [editAmountDue, setEditAmountDue] = useState('');
  const [editAmountAfterConcession, setEditAmountAfterConcession] = useState('');

  // Pending Concessions state
  const [pendingConcessions, setPendingConcessions] = useState<any[]>([]);

  // Set Fees Setup tab states
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [feeHeads, setFeeHeads] = useState<any[]>([]);
  const [setupClassId, setSetupClassId] = useState('');
  const [setupMedium, setSetupMedium] = useState('ENGLISH');
  const [setupFeeHeadId, setSetupFeeHeadId] = useState('');
  const [setupAmount, setSetupAmount] = useState('');
  const [setupFrequency, setSetupFrequency] = useState('MONTHLY');
  const [setupDueDay, setSetupDueDay] = useState('10');
  const [setupLateFine, setSetupLateFine] = useState('10');

  // Bulk monthly invoice generation states
  const [genClassId, setGenClassId] = useState('');
  const [genMonth, setGenMonth] = useState('');
  const [genDueDate, setGenDueDate] = useState('');

  // Load classes config
  useEffect(() => {
    api.get('/api/settings/classes-sections')
      .then(data => setClasses(data))
      .catch(err => console.error('Failed to load classes', err));
  }, []);

  // Fetch pending concessions for approvers
  const fetchPendingConcessions = async () => {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'PRINCIPAL') return;
    try {
      const pending = await api.get('/api/fees/concessions/pending');
      setPendingConcessions(pending);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchSetupData = async () => {
    try {
      const [structures, heads] = await Promise.all([
        api.get('/api/fees/structure'),
        api.get('/api/fees/heads')
      ]);
      setFeeStructures(structures);
      setFeeHeads(heads);
    } catch (err: any) {
      console.error('Failed to load setup data', err);
      showToast('Failed to load fee structures config', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'concessions') {
      fetchPendingConcessions();
    } else if (activeTab === 'class-summary') {
      fetchClassSummary();
    } else if (activeTab === 'setup') {
      fetchSetupData();
    }
  }, [activeTab]);

  const fetchClassSummary = async () => {
    try {
      const data = await api.get('/api/fees/class-summary');
      setClassSummary(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve class-wise summary', 'error');
    }
  };

  const handleExportClassSummary = () => {
    const headers = [
      { label: 'Class Name', key: 'className' },
      { label: 'Student Count', key: 'studentCount' },
      { label: 'Total Expected (₹)', key: 'totalExpected' },
      { label: 'Total Collected (₹)', key: 'totalCollected' },
      { label: 'Total Pending (₹)', key: 'totalPending' }
    ];
    exportToCSV(classSummary, headers, 'Class_Wise_Fees_Ledger');
    showToast('Exported class dues summary successfully!', 'success');
  };

  // Lookup invoices by class/section
  const handleFetchInvoices = async () => {
    try {
      const params: any = {};
      if (invoiceClass) params.classId = invoiceClass;
      if (invoiceSection) params.sectionId = invoiceSection;
      if (invoiceStatus) params.status = invoiceStatus;

      const query = new URLSearchParams(params).toString();
      const data = await api.get(`/api/fees/invoices?${query}`);
      setInvoicesList(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve invoices register', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'invoices') {
      handleFetchInvoices();
    }
  }, [invoiceClass, invoiceSection, invoiceStatus, activeTab]);

  // Load students on search query
  const handleSearchStudents = async () => {
    if (!searchQuery) return;
    try {
      const data = await api.get(`/api/students?search=${searchQuery}`);
      setStudentsList(data);
    } catch (err: any) {
      showToast(err.message || 'Search failed', 'error');
    }
  };

  // Select student and fetch dues details
  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    setStudentsList([]);
    try {
      const data = await api.get(`/api/fees/student-dues/${student.id}`);
      setDuesData(data);
      
      const pendingIds = data.invoices
        .filter((inv: any) => inv.status !== 'PAID')
        .map((inv: any) => inv.id);
      setSelectedInvoices(pendingIds);

      // Prefill paying amounts state map
      const initialPaying: { [key: string]: string } = {};
      data.invoices.forEach((inv: any) => {
        if (inv.status !== 'PAID') {
          initialPaying[inv.id] = String(inv.netDue);
        }
      });
      setPayingAmounts(initialPaying);

      const initialFines = data.invoices
        .filter((inv: any) => inv.status !== 'PAID')
        .reduce((sum: number, inv: any) => sum + (inv.lateFine || 0), 0);
      setLateFine(String(initialFines));
    } catch (err: any) {
      showToast(err.message || 'Failed to load outstanding dues', 'error');
    }
  };

  const toggleInvoiceSelect = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const activeInvoices = duesData?.invoices.filter((inv: any) => selectedInvoices.includes(inv.id)) || [];
  const selectedSubtotal = activeInvoices.reduce((sum: number, inv: any) => {
    const amt = parseFloat(payingAmounts[inv.id] || '0');
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  const fineAmount = parseFloat(lateFine) || 0;
  const discountAmount = parseFloat(discount) || 0;
  const netPayable = Math.max(0, selectedSubtotal + fineAmount - discountAmount);

  // Submit collected fee
  const handleCollectFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || selectedInvoices.length === 0) {
      showToast('Please select a student and at least one pending invoice.', 'error');
      return;
    }

    try {
      // Build individual invoice payment payload mappings
      const invoicePayments: { [key: string]: number } = {};
      selectedInvoices.forEach(id => {
        invoicePayments[id] = parseFloat(payingAmounts[id] || '0');
      });

      const payload = {
        studentId: selectedStudent.id,
        invoiceIds: selectedInvoices,
        invoicePayments,
        lateFine: fineAmount,
        discount: discountAmount,
        paymentMode,
        transactionId: transactionId || 'TXN-' + Date.now(),
        remarks: remarks || `Fee received for ${selectedStudent.firstName} ${selectedStudent.lastName}`
      };

      const payment = await api.post('/api/fees/collect', payload);
      const receiptDetails = await api.get(`/api/fees/receipt/${payment.id}`);
      setPrintedReceipt(receiptDetails);

      showToast('Fee payment received and updated successfully!', 'success');
      handleSelectStudent(selectedStudent);
      setDiscount('0');
      setDiscountReason('');
      setTransactionId('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Fee collection failed', 'error');
    }
  };

  // Submit invoice edit modifications
  const handleUpdateInvoice = async () => {
    if (!editInvoice) return;
    try {
      await api.put(`/api/fees/invoice/${editInvoice.id}`, {
        amountDue: parseFloat(editAmountDue),
        amountAfterConcession: parseFloat(editAmountAfterConcession)
      });
      showToast('Invoice amount updated successfully!', 'success');
      setEditInvoice(null);
      handleFetchInvoices();
    } catch (err: any) {
      showToast(err.message || 'Failed to edit invoice details', 'error');
    }
  };

  // Concession requests approvals handlers
  const handleConcessionApproval = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await api.post(`/api/fees/concession/${id}/approve`, {});
        showToast('Concession approved successfully!', 'success');
      } else {
        await api.delete(`/api/fees/concession/${id}`);
        showToast('Concession request rejected and deleted!', 'info');
      }
      fetchPendingConcessions();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  // Excel csv export methods
  const handleExportInvoices = () => {
    const headers = [
      { label: 'Invoice No', key: 'invoiceNumber' },
      { label: 'Student Name', key: 'student.firstName' },
      { label: 'Class', key: 'student.class.name' },
      { label: 'Section', key: 'student.section.name' },
      { label: 'Description', key: 'feeHead.name' },
      { label: 'Amount Due', key: 'amountDue' },
      { label: 'Amount After Concession', key: 'amountAfterConcession' },
      { label: 'Due Date', key: 'dueDate' },
      { label: 'Status', key: 'status' }
    ];
    exportToCSV(invoicesList, headers, 'Fees_Invoices_Register');
    showToast('Exported invoice sheet successfully!', 'success');
  };

  // Create Fee Structure config
  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupClassId || !setupFeeHeadId || !setupAmount) {
      showToast('Please select target Class, Fee Head, and Fee Amount.', 'error');
      return;
    }

    try {
      const payload = {
        classId: setupClassId,
        medium: setupMedium,
        feeHeadId: setupFeeHeadId,
        amount: parseFloat(setupAmount),
        frequency: setupFrequency,
        dueDay: parseInt(setupDueDay),
        lateFinePerDay: parseFloat(setupLateFine || '0')
      };

      await api.post('/api/fees/structure', payload);
      showToast('Fee Structure saved successfully!', 'success');
      setSetupAmount('');
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save fee structure config', 'error');
    }
  };

  // Bulk invoices generation handler
  const handleGenerateInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genMonth) {
      showToast('Please select the invoice cycle month.', 'error');
      return;
    }

    try {
      const payload = {
        classId: genClassId || undefined,
        month: parseInt(genMonth),
        dueDate: genDueDate || undefined
      };

      const res = await api.post('/api/fees/generate-invoices', payload);
      showToast(res.message || 'Bulk invoices generation completed!', 'success');
      setGenMonth('');
      setGenDueDate('');
    } catch (err: any) {
      showToast(err.message || 'Bulk generation failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher Headers */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fees Collection & Finance Management</h2>
          <p className="text-xs text-slate-500">Collect admissions/tuition fee structures, manage invoices sheet register, and review approvals.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('collect')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'collect' ? 'bg-brand-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Collect Fees
          </button>
          <button 
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'invoices' ? 'bg-brand-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Invoice Register Sheet
          </button>
          <button 
            onClick={() => setActiveTab('class-summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'class-summary' ? 'bg-brand-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Fees by Class
          </button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL' || user?.role === 'ADMIN') && (
            <button 
              onClick={() => setActiveTab('setup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'setup' ? 'bg-brand-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Set Fees
            </button>
          )}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && (
            <button 
              onClick={() => setActiveTab('concessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'concessions' ? 'bg-brand-orange-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pending Concessions ({pendingConcessions.length})
            </button>
          )}
        </div>
      </div>

      {/* Tabs panels */}
      {printedReceipt ? (
        /* Receipt Print Area overlay view */
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-md space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center border-b pb-4 no-print">
            <h3 className="font-bold text-slate-800 text-sm">Receipt Generated Successfully</h3>
            <button onClick={() => setPrintedReceipt(null)} className="btn-outline text-xs py-1">Back to Panel</button>
          </div>

          <div id="receipt-print" className="print-area space-y-6 border border-slate-300 p-8 bg-white text-xs leading-normal">
            <div className="flex justify-between items-start border-b border-slate-300 pb-4">
              <div>
                <h2 className="font-extrabold text-sm text-slate-800 uppercase">Shantiniketan Public School</h2>
                <p className="text-[10px] text-slate-500 mt-1">
                  Near Main Market, Chapetla, Madhya Pradesh - 462001<br />
                  Affiliation Number: MPBSE-AFF-330129 | DISE Code: 23260100101
                </p>
              </div>
              <div className="text-right">
                <h3 className="font-black text-brand-orange-600 uppercase tracking-widest text-[11px]">FEE INVOICE RECEIPT</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  Receipt: <strong>{printedReceipt.payment.receiptNumber}</strong><br />
                  Date: {new Date(printedReceipt.payment.paymentDate).toLocaleDateString('en-GB')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] font-semibold text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                Student Name: <strong className="text-slate-800 capitalize">{printedReceipt.payment.student.firstName} {printedReceipt.payment.student.lastName}</strong><br />
                Admission Number: <strong className="text-slate-800">{printedReceipt.payment.student.admissionNumber}</strong>
              </div>
              <div className="text-right">
                Class-Section: <strong className="text-slate-800">{printedReceipt.payment.student.class?.name} - {printedReceipt.payment.student.section?.name}</strong><br />
                Academic Session: <strong className="text-slate-800">{activeYear?.name || '2025-26'}</strong>
              </div>
            </div>

            <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-700 text-white font-bold uppercase text-[9px]">
                  <th className="p-2 border border-slate-300">Fee Description</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Fee Type</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600 font-medium">
                {printedReceipt.invoices.map((line: any) => {
                  const linePayment = printedReceipt.payment.invoiceIds.includes(line.id)
                    ? (printedReceipt.payment.invoicePayments?.[line.id] || parseFloat(line.amountPaid))
                    : 0;
                  return (
                    <tr key={line.id}>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800">{line.feeHead.name}</td>
                      <td className="p-2 border border-slate-200 text-right uppercase text-[9px]">{line.feeHead.feeType}</td>
                      <td className="p-2 border border-slate-200 text-right font-mono">₹{parseFloat(linePayment.toString()).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-bold text-slate-700">
                  <td colSpan={2} className="p-2 border border-slate-200 text-right">Subtotal Collected:</td>
                  <td className="p-2 border border-slate-200 text-right font-mono">₹{parseFloat(printedReceipt.payment.totalAmount).toLocaleString('en-IN')}</td>
                </tr>
                <tr className="text-amber-600 font-bold">
                  <td colSpan={2} className="p-2 border border-slate-200 text-right">Late Fine Charged:</td>
                  <td className="p-2 border border-slate-200 text-right font-mono">+₹{parseFloat(printedReceipt.payment.lateFine).toLocaleString('en-IN')}</td>
                </tr>
                <tr className="text-rose-500 font-bold">
                  <td colSpan={2} className="p-2 border border-slate-200 text-right">Additional Concession / Waiver:</td>
                  <td className="p-2 border border-slate-200 text-right font-mono">-₹{parseFloat(printedReceipt.payment.discount).toLocaleString('en-IN')}</td>
                </tr>
                <tr className="border-t-2 border-slate-800 font-extrabold text-slate-800 bg-brand-orange-50/20 text-xs">
                  <td colSpan={2} className="p-2 border border-slate-300 text-right">Net Amount Paid:</td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-brand-orange-600">₹{parseFloat(printedReceipt.payment.netAmount).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-between items-end pt-8">
              <div className="text-[9px] text-slate-400 max-w-xs leading-snug">
                * This is an official computer-generated receipt invoice for fees paid at Shantiniketan Public School, Chapetla. No signature is required.
              </div>
              <div className="text-center font-bold text-[9px] text-slate-700">
                <div className="h-8 w-24 border-b border-dashed border-slate-300 mx-auto mb-1"></div>
                Accounts Cashier Signature
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4 no-print">
            <button
              onClick={() => window.print()}
              className="btn-primary flex items-center gap-1.5 text-xs font-bold"
            >
              <Printer size={14} /> Send to Print / PDF
            </button>
          </div>
        </div>
      ) : activeTab === 'collect' ? (
        /* Collect Dues Panel */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <div className="lg:col-span-2 space-y-6">
            <div className="card space-y-4">
              <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                <Search size={16} className="text-brand-orange-500" /> Search Student Register
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter Admission No, Student Name, or Mobile Number..."
                  className="form-input"
                />
                <button onClick={handleSearchStudents} className="btn-primary text-xs font-bold shrink-0">
                  Lookup Dues
                </button>
              </div>

              {studentsList.length > 0 && (
                <div className="border rounded-xl overflow-hidden mt-3 max-h-40 overflow-y-auto bg-slate-50/50">
                  {studentsList.map(st => (
                    <button
                      key={st.id}
                      onClick={() => handleSelectStudent(st)}
                      className="w-full text-left p-3 hover:bg-slate-100 border-b flex justify-between items-center text-xs font-semibold text-slate-700"
                    >
                      <span className="capitalize">{st.firstName} {st.lastName} ({st.admissionNumber})</span>
                      <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border">{st.class?.name} - {st.section?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedStudent && (
              <div className="card space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm capitalize">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                    <p className="text-[10px] text-slate-400">Admission No: <span className="font-mono font-bold text-slate-600">{selectedStudent.admissionNumber}</span> | Class: <span className="font-bold text-slate-600">{selectedStudent.class?.name} - {selectedStudent.section?.name}</span></p>
                  </div>
                  <span className="badge-green">ACTIVE PROFILE</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="excel-table">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="excel-th w-10 text-center">Select</th>
                        <th className="excel-th">Fee Description</th>
                        <th className="excel-th">Due Date</th>
                        <th className="excel-th text-right">Fee Amount</th>
                        <th className="excel-th text-right">Concession</th>
                        <th className="excel-th text-right">Late Fine</th>
                        <th className="excel-th text-right">Net Due</th>
                        <th className="excel-th text-right w-32">Paying Amount</th>
                        <th className="excel-th text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duesData?.invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="excel-td text-center">
                            <input
                              type="checkbox"
                              checked={selectedInvoices.includes(inv.id)}
                              disabled={inv.status === 'PAID'}
                              onChange={() => toggleInvoiceSelect(inv.id)}
                              className="w-3.5 h-3.5 accent-brand-orange-600"
                            />
                          </td>
                          <td className="excel-td font-bold text-slate-800">{inv.feeHead}</td>
                          <td className="excel-td excel-mono">{new Date(inv.dueDate).toLocaleDateString('en-GB')}</td>
                          <td className="excel-td excel-mono text-right">₹{inv.amountDue.toLocaleString('en-IN')}</td>
                          <td className="excel-td excel-mono text-right text-rose-500">-₹{inv.concession.toLocaleString('en-IN')}</td>
                          <td className="excel-td excel-mono text-right text-amber-600">+₹{inv.lateFine.toLocaleString('en-IN')}</td>
                          <td className="excel-td excel-mono text-right font-black">₹{inv.netDue.toLocaleString('en-IN')}</td>
                          <td className="excel-td">
                            {selectedInvoices.includes(inv.id) ? (
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] text-slate-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  value={payingAmounts[inv.id] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPayingAmounts(prev => ({
                                      ...prev,
                                      [inv.id]: val
                                    }));
                                  }}
                                  max={inv.netDue}
                                  min="0"
                                  className="w-24 form-input py-0.5 px-1.5 text-right font-mono text-xs"
                                />
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unselected</span>
                            )}
                          </td>
                          <td className="excel-td text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              inv.status === 'PAID' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!duesData || duesData.invoices.length === 0) && (
                        <tr>
                          <td colSpan={9} className="excel-td text-center py-6 text-slate-400 font-bold">No active dues found. Generate monthly invoices first.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Collect Panel */}
          {selectedStudent && duesData && (
            <div className="card h-fit space-y-5">
              <h3 className="font-bold text-sm text-slate-700 pb-2 border-b">Summary & Payments Collection</h3>

              <div className="space-y-2.5 text-xs text-slate-600 font-semibold">
                <div className="flex justify-between">
                  <span>Selected Heads:</span>
                  <span className="font-bold text-slate-800">{selectedInvoices.length} heads</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal Dues:</span>
                  <span className="font-mono text-slate-800">₹{selectedSubtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Late Fines (₹):</span>
                  <input
                    type="number"
                    value={lateFine}
                    onChange={(e) => setLateFine(e.target.value)}
                    className="form-input py-0.5 px-2 text-right w-24 font-mono text-xs"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Concession Discount (₹):</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="form-input py-0.5 px-2 text-right w-24 font-mono text-xs"
                  />
                </div>
                {discountAmount > 0 && (
                  <div>
                    <label className="form-label text-[10px]">Concession Reason *</label>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="e.g. Sports Concession"
                      className="form-input py-1 text-xs"
                    />
                  </div>
                )}
                <div className="border-t border-dashed pt-3 flex justify-between items-center font-extrabold text-sm text-slate-800">
                  <span>Net Payable Amount:</span>
                  <span className="text-brand-orange-600 font-mono text-base">₹{netPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <form onSubmit={handleCollectFees} className="space-y-4 border-t pt-4">
                <div>
                  <label className="form-label">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="UPI">UPI / QR Scan</option>
                    <option value="CASH">Cash Payment</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="NETBANKING">Net Banking Transfer</option>
                    <option value="CHEQUE">Bank Cheque</option>
                  </select>
                </div>

                {paymentMode !== 'CASH' && (
                  <div>
                    <label className="form-label">Transaction Reference No</label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="UTR / Txn ID / Cheque No"
                      className="form-input text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="form-label">Receipt / Payment Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Reference notes"
                    className="form-input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={netPayable === 0 && selectedInvoices.length === 0}
                  className="w-full btn-secondary text-xs flex justify-center items-center gap-1.5 font-bold"
                >
                  <CreditCard size={14} /> Complete Fee Collection
                </button>
              </form>
            </div>
          )}
        </div>
      ) : activeTab === 'invoices' ? (
        /* Invoices Register Sheet panel view */
        <div className="card space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-700">Financial Invoice Worksheet Ledger</h3>
            <button 
              onClick={handleExportInvoices}
              className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow shadow-brand-green-100"
            >
              <Download size={14} /> Export to Excel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={invoiceClass}
              onChange={(e) => {
                setInvoiceClass(e.target.value);
                setInvoiceSection('');
              }}
              className="form-input"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={invoiceSection}
              onChange={(e) => setInvoiceSection(e.target.value)}
              className="form-input"
              disabled={!invoiceClass}
            >
              <option value="">All Sections</option>
              {classes.find(c => c.id === invoiceClass)?.sections.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value)}
              className="form-input"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Dues</option>
              <option value="PAID">Fully Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="OVERDUE">Overdue Invoices</option>
              <option value="WAIVED">Waiver / Void</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th">Invoice No</th>
                  <th className="excel-th">Student</th>
                  <th className="excel-th">Class/Sec</th>
                  <th className="excel-th">Description</th>
                  <th className="excel-th text-right">Gross Amt</th>
                  <th className="excel-th text-right">Paid Amt</th>
                  <th className="excel-th text-right">Net Amt</th>
                  <th className="excel-th">Due Date</th>
                  <th className="excel-th text-center">Status</th>
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && <th className="excel-th text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoicesList.map(inv => (
                  <tr key={inv.id}>
                    <td className="excel-td excel-mono">{inv.invoiceNumber}</td>
                    <td className="excel-td font-bold text-slate-800 capitalize">{inv.student.firstName} {inv.student.lastName}</td>
                    <td className="excel-td">{inv.student.class?.name} - {inv.student.section?.name}</td>
                    <td className="excel-td font-semibold text-slate-700">{inv.feeHead.name}</td>
                    <td className="excel-td excel-mono text-right">₹{parseFloat(inv.amountDue).toLocaleString('en-IN')}</td>
                    <td className="excel-td excel-mono text-right text-brand-green-600">₹{parseFloat(inv.amountPaid || 0).toLocaleString('en-IN')}</td>
                    <td className="excel-td excel-mono text-right font-bold text-slate-800">₹{parseFloat(inv.amountAfterConcession).toLocaleString('en-IN')}</td>
                    <td className="excel-td excel-mono">{new Date(inv.dueDate).toLocaleDateString('en-GB')}</td>
                    <td className="excel-td text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        inv.status === 'PAID' ? 'bg-brand-green-50 text-brand-green-700' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && (
                      <td className="excel-td text-center">
                        <button 
                          onClick={() => {
                            setEditInvoice(inv);
                            setEditAmountDue(String(inv.amountDue));
                            setEditAmountAfterConcession(String(inv.amountAfterConcession));
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-brand-orange-600 hover:text-brand-orange-700"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {invoicesList.length === 0 && (
                  <tr>
                    <td colSpan={10} className="excel-td text-center text-slate-400 py-6 font-semibold">No invoices matches filter criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'class-summary' ? (
        /* Class Dues Summary worksheet view */
        <div className="card space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-700">Class-Wise Fee Structure & Summary</h3>
              <p className="text-[10px] text-slate-400">Review total expected collections, received payments, and pending dues for each class level.</p>
            </div>
            <button 
              onClick={handleExportClassSummary}
              className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <Download size={14} /> Export to Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th">Class Level</th>
                  <th className="excel-th text-center">Active Students</th>
                  <th className="excel-th">Set Fee Head Structures</th>
                  <th className="excel-th text-right">Expected Total (₹)</th>
                  <th className="excel-th text-right">Total Collected (₹)</th>
                  <th className="excel-th text-right">Pending Dues (₹)</th>
                </tr>
              </thead>
              <tbody>
                {classSummary.map((cls: any) => (
                  <tr key={cls.classId}>
                    <td className="excel-td font-bold text-slate-800">{cls.className}</td>
                    <td className="excel-td excel-mono text-center">{cls.studentCount}</td>
                    <td className="excel-td">
                      <div className="flex flex-wrap gap-1.5">
                        {cls.feeStructures.map((fs: any, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-[10px] text-slate-600 font-bold border rounded uppercase">
                            {fs.headName} ({fs.medium}): ₹{fs.amount} ({fs.frequency.toLowerCase()})
                          </span>
                        ))}
                        {cls.feeStructures.length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">No fee structure set</span>
                        )}
                      </div>
                    </td>
                    <td className="excel-td excel-mono text-right font-semibold text-slate-800">₹{cls.totalExpected.toLocaleString('en-IN')}</td>
                    <td className="excel-td excel-mono text-right text-brand-green-600">₹{cls.totalCollected.toLocaleString('en-IN')}</td>
                    <td className="excel-td excel-mono text-right text-rose-600">₹{cls.totalPending.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {classSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="excel-td text-center text-slate-400 py-6 font-semibold">No class summaries available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'setup' ? (
        /* Setup / Set Fees panel view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creation form */}
          <div className="space-y-6">
            <div className="card space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
                <Settings size={16} className="text-brand-orange-500" /> Set Fee Structure
              </h3>
              <form onSubmit={handleCreateStructure} className="space-y-3">
                <div>
                  <label className="form-label text-xs">Target Class *</label>
                  <select 
                    value={setupClassId} 
                    onChange={(e) => setSetupClassId(e.target.value)} 
                    className="form-input text-xs"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Medium of Instruction *</label>
                  <select 
                    value={setupMedium} 
                    onChange={(e) => setSetupMedium(e.target.value)} 
                    className="form-input text-xs"
                    required
                  >
                    <option value="ENGLISH">English Medium</option>
                    <option value="HINDI">Hindi Medium</option>
                    <option value="REGIONAL">Regional Medium</option>
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Fee Head *</label>
                  <select 
                    value={setupFeeHeadId} 
                    onChange={(e) => setSetupFeeHeadId(e.target.value)} 
                    className="form-input text-xs"
                    required
                  >
                    <option value="">Select Head</option>
                    {feeHeads.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.feeType})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Fee Amount (₹) *</label>
                  <input 
                    type="number" 
                    value={setupAmount} 
                    onChange={(e) => setSetupAmount(e.target.value)} 
                    placeholder="e.g. 5000" 
                    className="form-input text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="form-label text-xs">Frequency *</label>
                  <select 
                    value={setupFrequency} 
                    onChange={(e) => setSetupFrequency(e.target.value)} 
                    className="form-input text-xs"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="ANNUALLY">Annually</option>
                    <option value="ONE_TIME">One Time</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label text-[10px]">Due Day of Month</label>
                    <input 
                      type="number" 
                      value={setupDueDay} 
                      onChange={(e) => setSetupDueDay(e.target.value)} 
                      min="1" 
                      max="31" 
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="form-label text-[10px]">Late Fine Per Day (₹)</label>
                    <input 
                      type="number" 
                      value={setupLateFine} 
                      onChange={(e) => setSetupLateFine(e.target.value)} 
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full btn-secondary font-bold text-xs flex justify-center items-center gap-1 mt-2">
                  <PlusCircle size={14} /> Add Structure Config
                </button>
              </form>
            </div>

            <div className="card space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
                <Calendar size={16} className="text-brand-orange-500" /> Generate Monthly Invoices
              </h3>
              <form onSubmit={handleGenerateInvoices} className="space-y-3">
                <div>
                  <label className="form-label text-xs">Target Class (Optional)</label>
                  <select 
                    value={genClassId} 
                    onChange={(e) => setGenClassId(e.target.value)} 
                    className="form-input text-xs"
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Invoice Cycle Month *</label>
                  <select 
                    value={genMonth} 
                    onChange={(e) => setGenMonth(e.target.value)} 
                    className="form-input text-xs"
                    required
                  >
                    <option value="">Select Month</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Due Date (Optional)</label>
                  <input 
                    type="date" 
                    value={genDueDate} 
                    onChange={(e) => setGenDueDate(e.target.value)} 
                    className="form-input text-xs"
                  />
                </div>

                <button type="submit" className="w-full btn-primary font-bold text-xs flex justify-center items-center gap-1 mt-2">
                  <RefreshCw size={14} /> Bulk Generate Invoices
                </button>
              </form>
            </div>
          </div>

          {/* List of configurations */}
          <div className="lg:col-span-2 card space-y-4">
            <h3 className="font-bold text-sm text-slate-700 border-b pb-2">Configured Class Fees Structures Register</h3>
            <div className="overflow-x-auto">
              <table className="excel-table">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="excel-th">Class Name</th>
                    <th className="excel-th">Medium</th>
                    <th className="excel-th">Fee Head</th>
                    <th className="excel-th text-right">Fee Amount</th>
                    <th className="excel-th">Frequency</th>
                    <th className="excel-th text-center">Due Day</th>
                    <th className="excel-th text-right">Fine/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {feeStructures.map((fs) => (
                    <tr key={fs.id}>
                      <td className="excel-td font-bold text-slate-800">{fs.class?.name}</td>
                      <td className="excel-td font-semibold text-slate-600">{fs.medium}</td>
                      <td className="excel-td font-semibold text-slate-700">{fs.feeHead?.name}</td>
                      <td className="excel-td excel-mono text-right">₹{parseFloat(fs.amount).toLocaleString('en-IN')}</td>
                      <td className="excel-td text-xs uppercase">{fs.frequency}</td>
                      <td className="excel-td text-center font-mono">{fs.dueDay}</td>
                      <td className="excel-td excel-mono text-right">₹{parseFloat(fs.lateFinePerDay || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {feeStructures.length === 0 && (
                    <tr>
                      <td colSpan={7} className="excel-td text-center text-slate-400 py-6 font-semibold">No configured fee structures found. Use form to add structures.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Pending Concession Waivers panel view */
        <div className="card space-y-4">
          <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
            <ShieldAlert size={16} className="text-brand-orange-500" /> Pending Concession & Waiver Approvals
          </h3>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th capitalize">Student Name</th>
                  <th className="excel-th">Class-Section</th>
                  <th className="excel-th">Fee head</th>
                  <th className="excel-th">Concession Model</th>
                  <th className="excel-th text-right">Percent Waiver</th>
                  <th className="excel-th text-right">Flat Deduction</th>
                  <th className="excel-th">Reason Details</th>
                  <th className="excel-th text-center">Operations</th>
                </tr>
              </thead>
              <tbody>
                {pendingConcessions.map(c => (
                  <tr key={c.id}>
                    <td className="excel-td font-bold text-slate-800 capitalize">{c.student.firstName} {c.student.lastName}</td>
                    <td className="excel-td">{c.student.class?.name} - {c.student.section?.name}</td>
                    <td className="excel-td font-semibold text-slate-700">{c.feeHead.name}</td>
                    <td className="excel-td uppercase text-[10px] font-bold text-slate-500">{c.concessionType}</td>
                    <td className="excel-td excel-mono text-right">{c.concessionPercent ? `${c.concessionPercent}%` : 'N/A'}</td>
                    <td className="excel-td excel-mono text-right">{c.concessionAmount ? `₹${c.concessionAmount}` : 'N/A'}</td>
                    <td className="excel-td text-xs text-slate-500">{c.reason || 'No details stated'}</td>
                    <td className="excel-td text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button 
                          onClick={() => handleConcessionApproval(c.id, 'approve')}
                          className="px-2 py-0.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded text-[9px] font-bold"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleConcessionApproval(c.id, 'reject')}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingConcessions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="excel-td text-center text-slate-400 py-6 font-semibold">No pending fee waiver requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Edit Modal */}
      {editInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-96 space-y-4">
            <div>
              <h4 className="font-extrabold text-sm text-slate-800">Adjust Invoice Amounts</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Invoice Number: {editInvoice.invoiceNumber}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="form-label text-xs">Gross Amount Due (₹)</label>
                <input
                  type="number"
                  value={editAmountDue}
                  onChange={(e) => setEditAmountDue(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
              <div>
                <label className="form-label text-xs">Net Amount After Concessions (₹)</label>
                <input
                  type="number"
                  value={editAmountAfterConcession}
                  onChange={(e) => setEditAmountAfterConcession(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditInvoice(null)} className="btn-outline text-xs font-bold py-1">Cancel</button>
              <button onClick={handleUpdateInvoice} className="btn-secondary text-xs font-bold py-1">Save Adjustments</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
