import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { 
  Search, Wallet, CreditCard, Receipt, Printer, CheckCircle2, 
  AlertCircle, IndianRupee, RefreshCw, Download, Edit2, ShieldAlert,
  Settings, Calendar, PlusCircle, Trash2
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    if (n === 0) return '';
    let temp = '';
    if (n >= 100) {
      temp += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      temp += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      temp += a[n] + ' ';
    }
    return temp.trim();
  };

  let str = '';
  let tempNum = Math.floor(num);

  const crores = Math.floor(tempNum / 10000000);
  tempNum %= 10000000;
  if (crores > 0) {
    str += convertLessThanOneThousand(crores) + ' Crore ';
  }

  const lakhs = Math.floor(tempNum / 100000);
  tempNum %= 100000;
  if (lakhs > 0) {
    str += convertLessThanOneThousand(lakhs) + ' Lakh ';
  }

  const thousands = Math.floor(tempNum / 1000);
  tempNum %= 1000;
  if (thousands > 0) {
    str += convertLessThanOneThousand(thousands) + ' Thousand ';
  }

  if (tempNum > 0) {
    str += convertLessThanOneThousand(tempNum) + ' ';
  }

  str = str.trim();
  if (str) {
    return `Rupees ${str} Only`;
  }
  return '';
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

export const Fees: React.FC = () => {
  const { showToast, user, activeYear, school } = useAppStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pay_counter' | 'collected_fees' | 'dues_pending' | 'set_fees' | 'bulk_exports'>('dashboard');
  const [classSummary, setClassSummary] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Dashboard state
  const [stats, setStats] = useState({ totalStudents: 0, totalCollected: 0, totalCollectedToday: 0 });

  // Pay Counter tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [payCounterClass, setPayCounterClass] = useState('');
  const [payCounterSection, setPayCounterSection] = useState('');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [duesData, setDuesData] = useState<any | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [payingAmounts, setPayingAmounts] = useState<{ [key: string]: string }>({});
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [discount, setDiscount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);
  const [printedWorksheet, setPrintedWorksheet] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

  // Optional Fees (Ad-hoc) state
  const [adHocFeeName, setAdHocFeeName] = useState('Uniform Fee');
  const [adHocAmount, setAdHocAmount] = useState('');
  const [adHocMonth, setAdHocMonth] = useState(String(new Date().getMonth() + 1));
  const [adHocDueDate, setAdHocDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAdHocForm, setShowAdHocForm] = useState(false);

  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsMode, setPaymentsMode] = useState('');
  const [paymentsClass, setPaymentsClass] = useState('');
  const [paymentsSection, setPaymentsSection] = useState('');
  const [paymentsStart, setPaymentsStart] = useState('');
  const [paymentsEnd, setPaymentsEnd] = useState('');
  const [paymentsSummary, setPaymentsSummary] = useState({ totalNeeded: 0, totalPaid: 0, totalPending: 0 });

  // Dues & Pending tab states
  const [defaultersList, setDefaultersList] = useState<any[]>([]);
  const [defaultersPage, setDefaultersPage] = useState(1);
  const [defaultersTotalPages, setDefaultersTotalPages] = useState(1);
  const [defaultersClass, setDefaultersClass] = useState('');
  const [defaultersSection, setDefaultersSection] = useState('');
  const [defaultersSearch, setDefaultersSearch] = useState('');
  const [defaultersStatus, setDefaultersStatus] = useState('PENDING');
  const [defaultersFeeHeadId, setDefaultersFeeHeadId] = useState('');

  // Invoices Register Worksheet tab states (Used in Bulk Exports / Invoices view)
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

  // Edit states for Fee Head and Fee Structure
  const [editFeeHead, setEditFeeHead] = useState<any | null>(null);
  const [editHeadName, setEditHeadName] = useState('');
  const [editHeadDescription, setEditHeadDescription] = useState('');
  const [editHeadFeeType, setEditHeadFeeType] = useState('ACADEMIC');
  const [editHeadIsMandatory, setEditHeadIsMandatory] = useState(true);

  const [editFeeStructure, setEditFeeStructure] = useState<any | null>(null);
  const [editStructClassId, setEditStructClassId] = useState('');
  const [editStructMedium, setEditStructMedium] = useState('ENGLISH');
  const [editStructFeeHeadId, setEditStructFeeHeadId] = useState('');
  const [editStructAmount, setEditStructAmount] = useState('');
  const [editStructFrequency, setEditStructFrequency] = useState('MONTHLY');
  const [editStructDueDay, setEditStructDueDay] = useState('10');

  // Create Fee Head state
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadDescription, setNewHeadDescription] = useState('');
  const [newHeadFeeType, setNewHeadFeeType] = useState('TUITION');
  const [newHeadIsMandatory, setNewHeadIsMandatory] = useState(true);

  // Bulk monthly invoice generation states
  const [genClassId, setGenClassId] = useState('');
  const [genMonth, setGenMonth] = useState('');
  const [genDueDate, setGenDueDate] = useState('');

  // Load classes and fee heads config
  useEffect(() => {
    api.get('/api/settings/classes-sections')
      .then(data => setClasses(data))
      .catch(err => console.error('Failed to load classes', err));

    api.get('/api/fees/heads')
      .then(data => {
        setFeeHeads(data);
        if (data && data.length > 0) {
          setAdHocFeeName(data[0].name);
        }
      })
      .catch(err => console.error('Failed to load fee heads', err));
  }, []);

  const fetchDashboardMetrics = async () => {
    try {
      const data = await api.get('/api/fees/dashboard-metrics');
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard metrics', err);
    }
  };

  const fetchPaymentsHistory = async (page = 1) => {
    try {
      const params: any = {
        page: String(page),
        limit: '15',
        search: paymentsSearch,
        paymentMode: paymentsMode,
        startDate: paymentsStart,
        endDate: paymentsEnd
      };
      if (paymentsClass) params.classId = paymentsClass;
      if (paymentsSection) params.sectionId = paymentsSection;

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/fees/payments?${query}`);
      setPaymentsList(res.payments);
      setPaymentsPage(res.pagination.page);
      setPaymentsTotalPages(res.pagination.totalPages);
      if (res.summary) {
        setPaymentsSummary(res.summary);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve payments history', 'error');
    }
  };

  const fetchDefaultersList = async (page = 1) => {
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        classId: defaultersClass,
        sectionId: defaultersSection,
        search: defaultersSearch,
        status: defaultersStatus,
        feeHeadId: defaultersFeeHeadId
      }).toString();
      const res = await api.get(`/api/fees/defaulters?${query}`);
      setDefaultersList(res.defaulters);
      setDefaultersPage(res.pagination.page);
      setDefaultersTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve defaulters list', 'error');
    }
  };

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
    if (activeTab === 'dashboard') {
      fetchDashboardMetrics();
    } else if (activeTab === 'collected_fees') {
      fetchPaymentsHistory(1);
    } else if (activeTab === 'dues_pending') {
      fetchDefaultersList(1);
    } else if (activeTab === 'set_fees') {
      fetchSetupData();
      fetchPendingConcessions();
    }
  }, [activeTab, activeYear, paymentsSearch, paymentsMode, paymentsClass, paymentsSection, paymentsStart, paymentsEnd, defaultersClass, defaultersSection, defaultersSearch, defaultersStatus, defaultersFeeHeadId]);

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
      setInvoicesList(data.invoices || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve invoices register', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'bulk_exports') {
      handleFetchInvoices();
    }
  }, [invoiceClass, invoiceSection, invoiceStatus, activeTab]);

  const handleSearchStudents = async () => {
    if (!searchQuery && !payCounterClass && !payCounterSection) {
      setStudentsList([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (payCounterClass) params.append('classId', payCounterClass);
      if (payCounterSection) params.append('sectionId', payCounterSection);
      const data = await api.get(`/api/students?${params.toString()}`);
      setStudentsList(data);
    } catch (err: any) {
      showToast(err.message || 'Search failed', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'pay_counter') {
      handleSearchStudents();
    }
  }, [payCounterClass, payCounterSection, activeTab]);

  // Select student and fetch dues details
  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    setStudentsList([]);
    try {
      const data = await api.get(`/api/fees/student-dues/${student.id}`);
      setDuesData(data);
      
      const firstPending = data.invoices.find((inv: any) => inv.status !== 'PAID');
      if (firstPending) {
        setSelectedInvoiceId(firstPending.id);
        setSelectedInvoices([firstPending.id]);
        setPayingAmounts({ [firstPending.id]: String(firstPending.netDue) });
      } else {
        setSelectedInvoiceId('');
        setSelectedInvoices([]);
        setPayingAmounts({});
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load outstanding dues', 'error');
    }
  };

  const handleInvoiceDropdownChange = (id: string) => {
    setSelectedInvoiceId(id);
    if (id) {
      setSelectedInvoices([id]);
      const inv = duesData?.invoices.find((i: any) => i.id === id);
      if (inv) {
        setPayingAmounts({ [id]: String(inv.netDue) });
      }
    } else {
      setSelectedInvoices([]);
      setPayingAmounts({});
    }
  };

  const toggleInvoiceSelect = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllInvoices = () => {
    const pendingInvoices = duesData?.invoices.filter((inv: any) => inv.status !== 'PAID') || [];
    if (selectedInvoices.length === pendingInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(pendingInvoices.map((inv: any) => inv.id));
    }
  };

  const activeInvoices = duesData?.invoices.filter((inv: any) => selectedInvoices.includes(inv.id)) || [];
  const selectedSubtotal = activeInvoices.reduce((sum: number, inv: any) => {
    const amt = parseFloat(payingAmounts[inv.id] || '0');
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  const discountAmount = parseFloat(discount) || 0;
  const netPayable = Math.max(0, selectedSubtotal - discountAmount);

  // Submit collected fee
  const handleCollectFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || selectedInvoices.length === 0) {
      showToast('Please select a student and at least one pending invoice.', 'error');
      return;
    }

    try {
      setSaving(true);
      // Build individual invoice payment payload mappings
      const invoicePayments: { [key: string]: number } = {};
      selectedInvoices.forEach(id => {
        invoicePayments[id] = parseFloat(payingAmounts[id] || '0');
      });

      const payload = {
        studentId: selectedStudent.id,
        invoiceIds: selectedInvoices,
        invoicePayments,
        lateFine: 0,
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
    } finally {
      setSaving(false);
    }
  };

  // Submit invoice edit modifications
  const handleUpdateInvoice = async () => {
    if (!editInvoice) return;
    try {
      setSaving(true);
      await api.put(`/api/fees/invoice/${editInvoice.id}`, {
        amountDue: parseFloat(editAmountDue),
        amountAfterConcession: parseFloat(editAmountAfterConcession)
      });
      showToast('Invoice amount updated successfully!', 'success');
      setEditInvoice(null);
      handleFetchInvoices();
    } catch (err: any) {
      showToast(err.message || 'Failed to edit invoice details', 'error');
    } finally {
      setSaving(false);
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

  const handleExportInvoices = () => {
    const formattedInvoices = invoicesList.map((inv: any, idx: number) => ({
      ...inv,
      index: idx + 1,
      studentFullName: `${inv.student?.firstName || ''} ${inv.student?.lastName || ''}`.trim(),
      fatherName: inv.student?.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A',
      classSection: `${inv.student?.class?.name || ''} - ${inv.student?.section?.name || ''}`.trim() || 'N/A',
      formattedDueDate: new Date(inv.dueDate).toLocaleDateString('en-GB')
    }));
    const headers = [
      { label: 'Sl No', key: 'index' },
      { label: 'Invoice No', key: 'invoiceNumber' },
      { label: 'Student Name', key: 'studentFullName' },
      { label: 'Father\'s Name', key: 'fatherName' },
      { label: 'Class & Section', key: 'classSection' },
      { label: 'Description', key: 'feeHead.name' },
      { label: 'Gross Amount', key: 'amountDue' },
      { label: 'Net Amount', key: 'amountAfterConcession' },
      { label: 'Due Date', key: 'formattedDueDate' },
      { label: 'Status', key: 'status' }
    ];
    exportToCSV(formattedInvoices, headers, 'Fees_Invoices_Register');
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
      setSaving(true);
      const payload = {
        classId: setupClassId,
        medium: setupMedium,
        feeHeadId: setupFeeHeadId,
        amount: parseFloat(setupAmount),
        frequency: setupFrequency,
        dueDay: parseInt(setupDueDay),
        lateFinePerDay: 0
      };

      await api.post('/api/fees/structure', payload);
      showToast('Fee Structure saved successfully!', 'success');
      setSetupAmount('');
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save fee structure config', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update Fee Structure configuration
  const handleUpdateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFeeStructure) return;
    try {
      setSaving(true);
      const payload = {
        classId: editStructClassId,
        medium: editStructMedium,
        feeHeadId: editStructFeeHeadId,
        amount: parseFloat(editStructAmount),
        frequency: editStructFrequency,
        dueDay: parseInt(editStructDueDay),
        lateFinePerDay: 0
      };
      await api.put(`/api/fees/structure/${editFeeStructure.id}`, payload);
      showToast('Fee structure config updated successfully!', 'success');
      setEditFeeStructure(null);
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update fee structure config', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Fee Structure configuration
  const handleDeleteStructure = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this fee structure config?')) return;
    try {
      await api.delete(`/api/fees/structure/${id}`);
      showToast('Fee structure config deleted successfully!', 'success');
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete fee structure config', 'error');
    }
  };

  // Create Fee Head config
  const handleCreateFeeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadName) {
      showToast('Fee Head name is required.', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: newHeadName,
        description: newHeadDescription,
        feeType: newHeadFeeType,
        isMandatory: newHeadIsMandatory
      };
      await api.post('/api/fees/heads', payload);
      showToast('Fee Head created successfully!', 'success');
      setNewHeadName('');
      setNewHeadDescription('');
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create fee head', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update Fee Head config
  const handleUpdateFeeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFeeHead) return;
    try {
      setSaving(true);
      const payload = {
        name: editHeadName,
        description: editHeadDescription,
        feeType: editHeadFeeType,
        isMandatory: editHeadIsMandatory
      };
      await api.put(`/api/fees/heads/${editFeeHead.id}`, payload);
      showToast('Fee Head updated successfully!', 'success');
      setEditFeeHead(null);
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update fee head', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Fee Head config
  const handleDeleteFeeHead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this fee head? Note: This might fail if references exist.')) return;
    try {
      await api.delete(`/api/fees/heads/${id}`);
      showToast('Fee Head deleted successfully!', 'success');
      fetchSetupData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete fee head', 'error');
    }
  };

  // Submit ad-hoc / optional fee for student
  const handleAdHocFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !adHocAmount || !adHocFeeName) {
      showToast('Please fill out all required optional fee details.', 'error');
      return;
    }
    try {
      await api.post('/api/fees/invoice/ad-hoc', {
        studentId: selectedStudent.id,
        amount: adHocAmount,
        feeName: adHocFeeName,
        dueDate: adHocDueDate,
        month: adHocMonth
      });
      
      showToast('Optional fee invoice generated and assigned successfully!', 'success');
      setAdHocAmount('');
      setShowAdHocForm(false);
      handleSelectStudent(selectedStudent);
    } catch (err: any) {
      showToast(err.message || 'Failed to assign optional fee', 'error');
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
      
      // Update filters to show the newly generated invoices
      setInvoiceClass(genClassId || '');
      setInvoiceStatus('PENDING');

      // Fetch and download the newly generated list
      const params: any = {};
      if (genClassId) params.classId = genClassId;
      params.status = 'PENDING';
      const query = new URLSearchParams(params).toString();
      const fetchRes = await api.get(`/api/fees/invoices?${query}`);
      const list = fetchRes.invoices || [];
      setInvoicesList(list);

      // Trigger automatic PDF preview/print view
      if (list.length > 0) {
        setPrintedWorksheet(true);
        showToast('Bulk invoices generated! Review PDF report below.', 'success');
      }

      setGenMonth('');
      setGenDueDate('');
    } catch (err: any) {
      showToast(err.message || 'Bulk generation failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher Headers */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fees Collection & Finance Management</h2>
          <p className="text-xs text-slate-500 mt-1">Manage class structures, record fee payments, add optional fees on-the-fly, and download sheets.</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'dashboard' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('pay_counter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pay_counter' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pay Counter
          </button>
          <button 
            onClick={() => setActiveTab('collected_fees')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'collected_fees' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Collected Fees
          </button>
          <button 
            onClick={() => setActiveTab('dues_pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'dues_pending' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Dues & Pending
          </button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL' || user?.role === 'ADMIN') && (
            <button 
              onClick={() => setActiveTab('set_fees')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'set_fees' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Set Fees
            </button>
          )}
          <button 
            onClick={() => setActiveTab('bulk_exports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bulk_exports' ? 'bg-brand-orange-600 text-white shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Bulk Bill Exports
          </button>
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
                <h2 className="font-extrabold text-sm text-slate-800 uppercase">{(school?.name || "Shantiniketan Public School").replace(/,\s*Chapetla/i, '').replace(/,\s*Madhya Pradesh/i, '').trim()}</h2>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                  {(school?.city || "Chapetla").replace(/,\s*Madhya Pradesh/i, '').trim()}
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
                {parseFloat(printedReceipt.payment.discount || '0') > 0 && (
                  <tr className="text-rose-500 font-bold">
                    <td colSpan={2} className="p-2 border border-slate-200 text-right">Additional Concession / Waiver:</td>
                    <td className="p-2 border border-slate-200 text-right font-mono">-₹{parseFloat(printedReceipt.payment.discount).toLocaleString('en-IN')}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-slate-800 font-extrabold text-slate-800 bg-brand-orange-55/20 text-xs">
                  <td colSpan={2} className="p-2 border border-slate-300 text-right">Net Amount Paid:</td>
                  <td className="p-2 border border-slate-300 text-right font-mono text-brand-orange-600">₹{parseFloat(printedReceipt.payment.netAmount).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] font-bold text-slate-700 mt-4 capitalize">
              Amount in words: <span className="text-brand-orange-700">{numberToWords(parseFloat(printedReceipt.payment.netAmount))}</span>
            </div>

            <div className="flex justify-between items-end pt-8">
              <div className="text-[9px] text-slate-400 max-w-xs leading-snug">
                * This is an official computer-generated receipt invoice for fees paid at {school?.name || "Shantiniketan Public School"}, {school?.city || "Chapetla"}. No signature is required.
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
      ) : printedWorksheet ? (
        /* Worksheet Print Area overlay view */
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-md space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center border-b pb-4 no-print">
            <h3 className="font-bold text-slate-800 text-sm">Fees Invoices Ledger Report</h3>
            <button onClick={() => setPrintedWorksheet(false)} className="btn-outline text-xs py-1">Back to Panel</button>
          </div>

          <div id="worksheet-print" className="print-area space-y-6 border border-slate-300 p-8 bg-white text-xs leading-normal">
            <div className="flex justify-between items-start border-b border-slate-300 pb-4">
              <div>
                <h2 className="font-extrabold text-sm text-slate-800 uppercase">{(school?.name || "Shantiniketan Public School").replace(/,\s*Chapetla/i, '').replace(/,\s*Madhya Pradesh/i, '').trim()}</h2>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                  {(school?.city || "Chapetla").replace(/,\s*Madhya Pradesh/i, '').trim()}
                </p>
              </div>
              <div className="text-right">
                <h3 className="font-black text-brand-orange-600 uppercase tracking-widest text-[11px]">FEES INVOICES REGISTER</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  Report Date: {new Date().toLocaleDateString('en-GB')}<br />
                  Academic Session: {activeYear?.name || '2025-26'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[10px] font-semibold text-slate-600">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  Target Class Filter: <strong className="text-slate-800">{classes.find(c => c.id === invoiceClass)?.name || "All Classes"}</strong><br />
                  Section Filter: <strong className="text-slate-800">{classes.find(c => c.id === invoiceClass)?.sections?.find((s: any) => s.id === invoiceSection)?.name || "All Sections"}</strong>
                </div>
                <div className="text-right">
                  Status Filter: <strong className="text-slate-800">{invoiceStatus || "All Statuses"}</strong><br />
                  Total Invoices Displayed: <strong className="text-slate-800">{invoicesList.length}</strong>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-700 text-white font-bold uppercase text-[9px]">
                  <th className="p-1 border border-slate-300 w-8 text-center">Sl No</th>
                  <th className="p-1 border border-slate-300 w-24">Invoice No</th>
                  <th className="p-1 border border-slate-300">Student Name</th>
                  <th className="p-1 border border-slate-300">Father's Name</th>
                  <th className="p-1 border border-slate-300 w-16 text-center">Class/Sec</th>
                  <th className="p-1 border border-slate-300">Description</th>
                  <th className="p-1 border border-slate-300 w-14 text-right">Gross Amt</th>
                  <th className="p-1 border border-slate-300 w-14 text-right">Net Amt</th>
                  <th className="p-1 border border-slate-300 w-20">Due Date</th>
                  <th className="p-1 border border-slate-300 w-14 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600 font-medium">
                {invoicesList.map((inv: any, idx: number) => (
                  <tr key={inv.id} className="break-inside-avoid">
                    <td className="p-1 border border-slate-200 text-center font-bold font-mono">{idx + 1}</td>
                    <td className="p-1 border border-slate-200 font-mono font-bold text-slate-800 text-[8px] break-all">{inv.invoiceNumber}</td>
                    <td className="p-1 border border-slate-200 capitalize font-bold text-slate-800 truncate max-w-[100px]">{inv.student.firstName} {inv.student.lastName}</td>
                    <td className="p-1 border border-slate-200 capitalize truncate max-w-[100px]">{inv.student.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A'}</td>
                    <td className="p-1 border border-slate-200 text-center">{inv.student.class?.name} - {inv.student.section?.name || 'N/A'}</td>
                    <td className="p-1 border border-slate-200 font-semibold truncate max-w-[90px]">{inv.feeHead.name}</td>
                    <td className="p-1 border border-slate-200 text-right font-mono text-[9px]">₹{parseFloat(inv.amountDue).toLocaleString('en-IN')}</td>
                    <td className="p-1 border border-slate-200 text-right font-mono text-[9px] font-bold text-slate-800">₹{parseFloat(inv.amountAfterConcession).toLocaleString('en-IN')}</td>
                    <td className="p-1 border border-slate-200 font-mono text-[8px]">{new Date(inv.dueDate).toLocaleDateString('en-GB')}</td>
                    <td className="p-1 border border-slate-200 text-center">
                      <span className={`px-1 py-0.5 rounded text-[7px] font-extrabold uppercase ${
                        inv.status === 'PAID' ? 'bg-brand-green-50 text-brand-green-700' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoicesList.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-slate-400 font-bold">No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between items-end pt-8">
              <div className="text-[9px] text-slate-400 max-w-xs leading-snug">
                * This is a system-generated audit report registry for school tuition and academic fees. No signature required.
              </div>
              <div className="text-center font-bold text-[9px] text-slate-700">
                <div className="h-8 w-24 border-b border-dashed border-slate-300 mx-auto mb-1"></div>
                Accounts Officer Signature
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
      ) : activeTab === 'dashboard' ? (
        /* Tab 1: Dashboard */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-2 bottom-2 text-white/10">
                <Search size={120} />
              </div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Active Students Count</p>
              <h3 className="text-3xl font-black mt-2 font-mono">{stats.totalStudents}</h3>
              <p className="text-[10px] text-white/60 mt-4">Current enrollment count in current academic term.</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-2 bottom-2 text-white/10">
                <IndianRupee size={120} />
              </div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Total Fees Collected</p>
              <h3 className="text-3xl font-black mt-2 font-mono">₹{stats.totalCollected.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] text-white/60 mt-4">Net fees deposited within {activeYear?.name || 'Current Term'}.</p>
            </div>

            <div className="bg-gradient-to-br from-brand-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-2 bottom-2 text-white/10">
                <CreditCard size={120} />
              </div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Collected Today</p>
              <h3 className="text-3xl font-black mt-2 font-mono">₹{stats.totalCollectedToday.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] text-white/60 mt-4">Real-time cashier counter collection sheet for today.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Wallet size={16} className="text-brand-orange-500" /> Quick Payment Entry
              </h3>
              <p className="text-xs text-slate-500">Go to the Pay Counter tab to quickly search for a student profile, generate optional fees, or print receipts instantly.</p>
              <button 
                onClick={() => setActiveTab('pay_counter')} 
                className="px-4 py-2 bg-brand-orange-600 hover:bg-brand-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow"
              >
                Open Pay Counter Panel
              </button>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Settings size={16} className="text-brand-orange-500" /> Structure Configurations
              </h3>
              <p className="text-xs text-slate-500">Modify fee headers, setup class rules, and review concessions waiver authorization queues.</p>
              <button 
                onClick={() => setActiveTab('set_fees')} 
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow"
              >
                Go to Set Fees Configuration
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'pay_counter' ? (
        /* Tab 2: Pay Counter */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                <Search size={16} className="text-brand-orange-500" /> Search Student Register
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={payCounterClass}
                  onChange={(e) => {
                    setPayCounterClass(e.target.value);
                    setPayCounterSection('');
                  }}
                  className="form-input text-xs"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={payCounterSection}
                  onChange={(e) => setPayCounterSection(e.target.value)}
                  className="form-input text-xs"
                  disabled={!payCounterClass}
                >
                  <option value="">All Sections</option>
                  {classes.find(c => c.id === payCounterClass)?.sections.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Admission No, Name, or Mobile..."
                  className="form-input text-xs"
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
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm capitalize">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                    <p className="text-[10px] text-slate-400">
                      Admission No: <span className="font-mono font-bold text-slate-600">{selectedStudent.admissionNumber}</span> | 
                      Class: <span className="font-bold text-slate-600">{selectedStudent.class?.name} - {selectedStudent.section?.name}</span> |
                      Father: <span className="font-bold text-slate-600">{selectedStudent.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A'}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAdHocForm(!showAdHocForm)}
                    className="px-2.5 py-1 bg-brand-orange-55/10 hover:bg-brand-orange-55/20 text-brand-orange-700 border border-brand-orange-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <PlusCircle size={13} /> Optional/Ad-hoc Fee
                  </button>
                </div>

                {showAdHocForm && (
                  <form onSubmit={handleAdHocFeeSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-800">Add Optional/Ad-hoc Fee On-The-Fly</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="form-label text-[10px]">Fee Head Name *</label>
                        <select 
                          value={adHocFeeName}
                          onChange={(e) => setAdHocFeeName(e.target.value)}
                          className="form-input text-xs py-1"
                        >
                          {feeHeads.map((h: any) => (
                            <option key={h.id} value={h.name}>{h.name}</option>
                          ))}
                          {feeHeads.length === 0 && (
                            <>
                              <option value="Uniform Fee">Uniform Fee</option>
                              <option value="Bus Fee">Bus Fee</option>
                              <option value="Books Fee">Books Fee</option>
                              <option value="Miscellaneous Fee">Miscellaneous Fee</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Fee Amount (₹) *</label>
                        <input
                          type="number"
                          value={adHocAmount}
                          onChange={(e) => setAdHocAmount(e.target.value)}
                          placeholder="e.g. 1500"
                          className="form-input text-xs py-1"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Billing Month (1-12) *</label>
                        <select
                          value={adHocMonth}
                          onChange={(e) => setAdHocMonth(e.target.value)}
                          className="form-input text-xs py-1"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en-US', { month: 'long' })}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Due Date</label>
                        <input
                          type="date"
                          value={adHocDueDate}
                          onChange={(e) => setAdHocDueDate(e.target.value)}
                          className="form-input text-xs py-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowAdHocForm(false)} className="btn-outline text-[10px] py-1">Cancel</button>
                      <button type="submit" className="btn-secondary text-[10px] py-1">Generate Fee & Select</button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="excel-table">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="excel-th w-12 text-left">
                          <input
                            type="checkbox"
                            checked={duesData?.invoices.filter((inv: any) => inv.status !== 'PAID').length > 0 && selectedInvoices.length === duesData.invoices.filter((inv: any) => inv.status !== 'PAID').length}
                            onChange={toggleAllInvoices}
                            className="w-3.5 h-3.5 accent-brand-orange-600 rounded cursor-pointer"
                          />
                        </th>
                        <th className="excel-th">Fee Description</th>
                        <th className="excel-th">Due Date</th>
                        <th className="excel-th text-left">Fee Amount</th>
                        <th className="excel-th text-left">Concession</th>
                        <th className="excel-th text-left">Net Due</th>
                        <th className="excel-th text-left w-36">Paying Amount</th>
                        <th className="excel-th text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duesData?.invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="excel-td text-left">
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
                          <td className="excel-td excel-mono text-left">₹{inv.amountDue.toLocaleString('en-IN')}</td>
                          <td className="excel-td excel-mono text-left text-rose-500">-₹{inv.concession.toLocaleString('en-IN')}</td>
                          <td className="excel-td excel-mono text-left font-black">₹{inv.netDue.toLocaleString('en-IN')}</td>
                          <td className="excel-td">
                            {selectedInvoices.includes(inv.id) ? (
                              <div className="flex items-center gap-1 justify-start">
                                <span className="text-xs text-slate-500 font-extrabold">₹</span>
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
                                  className="w-28 form-input py-1 px-2 text-left font-mono text-xs font-bold focus:border-brand-orange-500 focus:ring-1 focus:ring-brand-orange-500"
                                />
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unselected</span>
                            )}
                          </td>
                          <td className="excel-td text-left">
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
                          <td colSpan={8} className="excel-td text-center py-6 text-slate-400 font-bold">No active dues found. Create an optional fee or generate invoices.</td>
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
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm h-fit space-y-4">
              <div className="text-center space-y-1 pb-3 border-b">
                <h4 className="font-extrabold text-sm text-slate-800 tracking-wide uppercase">
                  {school?.name || "Shantiniketan Public School"}
                </h4>
                <div className="text-[10px] text-slate-400 font-bold font-mono">
                  PAYMENT RECEIPT SLIP — {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>

              {/* Student & Parent Info Card */}
              <div className="bg-slate-50/70 rounded-xl border border-slate-200/60 p-3.5 space-y-2 text-xs font-semibold text-slate-600 shadow-sm">
                <div className="flex justify-between items-center">
                  <span>Student Name:</span>
                  <span className="text-slate-800 font-bold capitalize">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Class & Section:</span>
                  <span className="text-slate-800 font-bold">{selectedStudent.class?.name} - {selectedStudent.section?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-1.5 mt-1">
                  <span>Father's Name:</span>
                  <span className="text-slate-800 font-bold capitalize">
                    {selectedStudent.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Fee Head Dropdown Selection */}
              <div className="space-y-3 border-t pt-3">
                <div>
                  <label className="form-label font-bold text-slate-500">Select Fee Head *</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceDropdownChange(e.target.value)}
                    className="form-input text-xs font-bold py-1.5 focus:border-brand-orange-500 focus:ring-1 focus:ring-brand-orange-500"
                  >
                    <option value="">-- Select Fee Head --</option>
                    {duesData?.invoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id} disabled={inv.status === 'PAID'}>
                        {inv.feeHead} {inv.status === 'PAID' ? '(PAID)' : `(Pending: ₹${inv.netDue.toLocaleString('en-IN')})`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInvoiceId && (
                  (() => {
                    const currentInv = duesData?.invoices.find((i: any) => i.id === selectedInvoiceId);
                    if (!currentInv) return null;
                    const payingAmt = parseFloat(payingAmounts[selectedInvoiceId] || '0');
                    return (
                      <div className="space-y-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/50 shadow-inner">
                        <div className="flex justify-between font-bold text-xs">
                          <span className="text-slate-500">Total Expected Amount:</span>
                          <span className="text-slate-800 font-mono">₹{currentInv.netDue.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <label className="form-label font-bold text-slate-500">Paying Amount (₹) *</label>
                          <input
                            type="number"
                            value={payingAmounts[selectedInvoiceId] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPayingAmounts({ [selectedInvoiceId]: val });
                            }}
                            max={currentInv.netDue}
                            min="0"
                            className="form-input text-xs font-bold font-mono text-right py-1.5 focus:border-brand-orange-500 focus:ring-1 focus:ring-brand-orange-500"
                          />
                        </div>
                        <div className="flex justify-between font-bold text-xs">
                          <span className="text-slate-500">Remaining Balance:</span>
                          <span className="text-slate-800 font-mono">
                            ₹{Math.max(0, currentInv.netDue - (isNaN(payingAmt) ? 0 : payingAmt)).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-xs items-center">
                          <span className="text-slate-500">Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            currentInv.status === 'PAID' ? 'bg-brand-green-50 text-brand-green-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {currentInv.status}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 font-semibold border-t pt-3">
                <div className="flex justify-between">
                  <span>Selected Heads Count:</span>
                  <span className="font-bold text-slate-800">{selectedInvoices.length} heads</span>
                </div>
                <div className="border-t border-dashed pt-3 flex justify-between items-center font-extrabold text-sm text-slate-800">
                  <span>Total Amount Payable:</span>
                  <span className="text-brand-orange-600 font-mono text-base">₹{selectedSubtotal.toLocaleString('en-IN')}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] font-bold text-slate-700 mt-2 capitalize leading-relaxed shadow-sm">
                  Amount in words:<br />
                  <span className="text-brand-orange-700 mt-1 block">{numberToWords(selectedSubtotal)}</span>
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
                  <label className="form-label">Receipt / Remarks</label>
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
                  disabled={saving || (netPayable === 0 && selectedInvoices.length === 0)}
                  className="w-full btn-secondary text-xs flex justify-center items-center gap-1.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} /> Complete Fee Collection
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      ) : activeTab === 'collected_fees' ? (
        /* Tab 3: Collected Fees */
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-700">Receipts Collection History & Ledger</h3>
            <button 
              onClick={() => {
                const formattedPayments = paymentsList.map((p, idx) => ({
                  ...p,
                  index: idx + 1,
                  formattedDate: new Date(p.paymentDate).toLocaleDateString('en-GB'),
                  studentFullName: `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim(),
                  fatherName: p.student?.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A',
                  classSection: `${p.student?.class?.name || ''} - ${p.student?.section?.name || ''}`.trim() || 'N/A',
                  amountInWordsText: numberToWords(parseFloat(p.netAmount))
                }));
                const headers = [
                  { label: 'Sl No', key: 'index' },
                  { label: 'Receipt No', key: 'receiptNumber' },
                  { label: 'Date', key: 'formattedDate' },
                  { label: 'Student Name', key: 'studentFullName' },
                  { label: 'Father\'s Name', key: 'fatherName' },
                  { label: 'Class & Section', key: 'classSection' },
                  { label: 'Payment Mode', key: 'paymentMode' },
                  { label: 'Transaction ID', key: 'transactionId' },
                  { label: 'Paid Amount', key: 'netAmount' },
                  { label: 'Amount in Words', key: 'amountInWordsText' }
                ];
                exportToCSV(formattedPayments, headers, 'Collected_Fees_Receipts');
                showToast('Receipt ledger exported!', 'success');
              }}
              className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <Download size={14} /> Export Receipts
            </button>
          </div>

          {/* Real-time Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600">Total Needed (Expected)</span>
              <span className="text-2xl font-black text-indigo-900 mt-1 font-mono">₹{paymentsSummary.totalNeeded.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-indigo-500/80 mt-1">Total invoiced fees target for selection</span>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600">Total Paid (Collected)</span>
              <span className="text-2xl font-black text-emerald-900 mt-1 font-mono">₹{paymentsSummary.totalPaid.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-emerald-500/80 mt-1">Successfully processed receipts value</span>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-wider text-amber-600">Total Pending (Dues)</span>
              <span className="text-2xl font-black text-amber-900 mt-1 font-mono">₹{paymentsSummary.totalPending.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-amber-500/80 mt-1">Outstanding payments remaining</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Search Receipt..."
              value={paymentsSearch}
              onChange={(e) => setPaymentsSearch(e.target.value)}
              className="form-input text-xs"
            />
            <select
              value={paymentsClass}
              onChange={(e) => {
                setPaymentsClass(e.target.value);
                setPaymentsSection('');
              }}
              className="form-input text-xs"
            >
              <option value="">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={paymentsSection}
              onChange={(e) => setPaymentsSection(e.target.value)}
              className="form-input text-xs"
              disabled={!paymentsClass}
            >
              <option value="">All Sections</option>
              {paymentsClass && classes.find((c: any) => c.id === paymentsClass)?.sections?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={paymentsMode}
              onChange={(e) => setPaymentsMode(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Modes</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="NETBANKING">Net Banking</option>
              <option value="CHEQUE">Cheque</option>
            </select>
            <input
              type="date"
              value={paymentsStart}
              onChange={(e) => setPaymentsStart(e.target.value)}
              className="form-input text-xs"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={paymentsEnd}
              onChange={(e) => setPaymentsEnd(e.target.value)}
              className="form-input text-xs"
              placeholder="End Date"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th w-12 text-left">Sl No</th>
                  <th className="excel-th">Receipt No</th>
                  <th className="excel-th">Date</th>
                  <th className="excel-th">Student Name</th>
                  <th className="excel-th">Father's Name</th>
                  <th className="excel-th">Class/Sec</th>
                  <th className="excel-th">Mode</th>
                  <th className="excel-th">Transaction ID</th>
                  <th className="excel-th text-left">Paid Amount</th>
                  <th className="excel-th">Amount in Words</th>
                  <th className="excel-th text-left">Operations</th>
                </tr>
              </thead>
              <tbody>
                {paymentsList.map((p: any, idx: number) => (
                  <tr key={p.id}>
                    <td className="excel-td text-left font-bold font-mono text-slate-500">{(paymentsPage - 1) * 15 + idx + 1}</td>
                    <td className="excel-td excel-mono font-bold text-slate-800">{p.receiptNumber}</td>
                    <td className="excel-td excel-mono text-xs">{new Date(p.paymentDate).toLocaleDateString('en-GB')}</td>
                    <td className="excel-td capitalize font-bold text-slate-800">{p.student.firstName} {p.student.lastName}</td>
                    <td className="excel-td font-semibold text-slate-600">{p.student.guardians?.find((g: any) => g.type === 'FATHER')?.name || 'N/A'}</td>
                    <td className="excel-td">{p.student.class?.name} - {p.student.section?.name || 'N/A'}</td>
                    <td className="excel-td text-xs font-black uppercase text-slate-500">{p.paymentMode}</td>
                    <td className="excel-td excel-mono text-xs">{p.transactionId}</td>
                    <td className="excel-td excel-mono text-left font-black">₹{parseFloat(p.netAmount).toLocaleString('en-IN')}</td>
                    <td className="excel-td text-[10px] text-slate-500 capitalize">{numberToWords(parseFloat(p.netAmount))}</td>
                    <td className="excel-td text-left">
                      <div className="flex gap-1 justify-start">
                        <button
                          onClick={async () => {
                            try {
                              const receipt = await api.get(`/api/fees/receipt/${p.id}`);
                              setPrintedReceipt(receipt);
                            } catch (err: any) {
                              showToast('Failed to load receipt details', 'error');
                            }
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border rounded text-[10px] font-bold text-slate-600 flex items-center gap-1"
                        >
                          <Printer size={11} /> Print
                        </button>
                        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'PRINCIPAL' || user?.role === 'ACCOUNTANT') && (
                          <button
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to VOID this payment record? This action will reverse invoices status.')) return;
                              try {
                                await api.delete(`/api/fees/payment/${p.id}`);
                                showToast('Payment successfully voided and reverted!', 'success');
                                fetchPaymentsHistory(paymentsPage);
                              } catch (err: any) {
                                showToast(err.message || 'Failed to void payment', 'error');
                              }
                            }}
                            className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-[10px] font-bold text-rose-700"
                          >
                            Void/Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paymentsList.length === 0 && (
                  <tr>
                    <td colSpan={10} className="excel-td text-center py-6 text-slate-400 font-bold">No payments found matching filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {paymentsTotalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-slate-500">Page {paymentsPage} of {paymentsTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={paymentsPage <= 1}
                  onClick={() => fetchPaymentsHistory(paymentsPage - 1)}
                  className="btn-outline py-1 text-[11px] font-bold"
                >
                  Previous
                </button>
                <button
                  disabled={paymentsPage >= paymentsTotalPages}
                  onClick={() => fetchPaymentsHistory(paymentsPage + 1)}
                  className="btn-outline py-1 text-[11px] font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'dues_pending' ? (
        /* Tab 4: Dues & Pending */
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-700">Student Dues Ledger Sheet</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Rows highlighted in yellow have outstanding unpaid balances.</p>
            </div>
            <button 
              onClick={() => {
                const headers = [
                  { label: 'Student Name', key: 'student.name' },
                  { label: 'Father Name', key: 'student.fatherName' },
                  { label: 'Admission No', key: 'student.admissionNumber' },
                  { label: 'Class', key: 'student.class' },
                  { label: 'Section', key: 'student.section' },
                  { label: 'Expected Amount', key: 'totalExpected' },
                  { label: 'Paid Amount', key: 'totalPaid' },
                  { label: 'Balance Outstanding', key: 'balance' },
                  { label: 'Status', key: 'status' }
                ];
                exportToCSV(defaultersList, headers, 'Dues_Defaulters_Sheet');
                showToast('Defaulters sheet exported successfully!', 'success');
              }}
              className="px-2.5 py-1.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <Download size={14} /> Export Dues
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              value={defaultersClass}
              onChange={(e) => {
                setDefaultersClass(e.target.value);
                setDefaultersSection('');
              }}
              className="form-input text-xs"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={defaultersSection}
              onChange={(e) => setDefaultersSection(e.target.value)}
              className="form-input text-xs"
              disabled={!defaultersClass}
            >
              <option value="">All Sections</option>
              {classes.find(c => c.id === defaultersClass)?.sections.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={defaultersFeeHeadId}
              onChange={(e) => setDefaultersFeeHeadId(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Fee Heads</option>
              {feeHeads.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <select
              value={defaultersStatus}
              onChange={(e) => setDefaultersStatus(e.target.value)}
              className="form-input text-xs"
            >
              <option value="PENDING">Pending Dues Only</option>
              <option value="ALL">All Accounts (Paid & Pending)</option>
            </select>
            <input
              type="text"
              placeholder="Search Student Name / Admission No..."
              value={defaultersSearch}
              onChange={(e) => setDefaultersSearch(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="excel-table">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="excel-th w-12 text-left">Sl No</th>
                  <th className="excel-th">Student Name</th>
                  <th className="excel-th">Father's Name</th>
                  <th className="excel-th">Admission No</th>
                  <th className="excel-th">Class / Section</th>
                  <th className="excel-th text-left">Expected Fee (₹)</th>
                  <th className="excel-th text-left">Paid Amount (₹)</th>
                  <th className="excel-th text-left">Balance Due (₹)</th>
                  <th className="excel-th text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {defaultersList.map((d: any, index: number) => {
                  const isDefaulter = d.balance > 0;
                  return (
                    <tr 
                      key={index}
                      className={isDefaulter ? 'bg-yellow-100/60 hover:bg-yellow-100/90 transition-colors' : 'hover:bg-slate-50'}
                    >
                      <td className="excel-td text-left font-bold font-mono text-slate-500">{(defaultersPage - 1) * 50 + index + 1}</td>
                      <td className="excel-td font-bold text-slate-800 capitalize">{d.student.name}</td>
                      <td className="excel-td font-semibold text-slate-600">{d.student.fatherName}</td>
                      <td className="excel-td excel-mono">{d.student.admissionNumber}</td>
                      <td className="excel-td font-bold text-slate-700">{d.student.class} - {d.student.section}</td>
                      <td className="excel-td excel-mono text-left">₹{d.totalExpected.toLocaleString('en-IN')}</td>
                      <td className="excel-td excel-mono text-left text-brand-green-600">₹{d.totalPaid.toLocaleString('en-IN')}</td>
                      <td className={`excel-td excel-mono text-left font-black ${isDefaulter ? 'text-amber-700' : 'text-slate-800'}`}>
                        ₹{d.balance.toLocaleString('en-IN')}
                      </td>
                      <td className="excel-td text-left">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isDefaulter ? 'bg-amber-100 text-amber-800' : 'bg-brand-green-50 text-brand-green-700'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {defaultersList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="excel-td text-left py-6 text-slate-400 font-bold">No accounts found matching filter parameters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {defaultersTotalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-slate-500">Page {defaultersPage} of {defaultersTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={defaultersPage <= 1}
                  onClick={() => fetchDefaultersList(defaultersPage - 1)}
                  className="btn-outline py-1 text-[11px] font-bold"
                >
                  Previous
                </button>
                <button
                  disabled={defaultersPage >= defaultersTotalPages}
                  onClick={() => fetchDefaultersList(defaultersPage + 1)}
                  className="btn-outline py-1 text-[11px] font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'set_fees' ? (
        /* Tab 5: Set Fees Configuration */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Block: Fee Heads and Structures forms */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
                <PlusCircle size={16} className="text-brand-orange-500" /> Create Fee Head Configuration
              </h3>
              <form onSubmit={handleCreateFeeHead} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="form-label text-xs">Fee Head Name *</label>
                  <input
                    type="text"
                    value={newHeadName}
                    onChange={(e) => setNewHeadName(toTitleCase(e.target.value))}
                    placeholder="e.g. Tuition Fee, Sports Fee, Bus Fee..."
                    className="form-input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Fee Category *</label>
                  <select
                    value={newHeadFeeType}
                    onChange={(e) => setNewHeadFeeType(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="TUITION">Academic / Tuition Fee</option>
                    <option value="TRANSPORT">Transport / Bus Fee</option>
                    <option value="HOSTEL">Hostel Boarding Fee</option>
                    <option value="MISCELLANEOUS">Miscellaneous / Optional</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Is Mandatory *</label>
                  <select
                    value={String(newHeadIsMandatory)}
                    onChange={(e) => setNewHeadIsMandatory(e.target.value === 'true')}
                    className="form-input text-xs"
                  >
                    <option value="true">Yes, auto-assigned to all</option>
                    <option value="false">No, optional / assigned manual</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="form-label text-xs">Brief Description</label>
                  <input
                    type="text"
                    value={newHeadDescription}
                    onChange={(e) => setNewHeadDescription(toTitleCase(e.target.value))}
                    placeholder="Short description note"
                    className="form-input text-xs"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={saving} className="btn-secondary text-xs font-bold px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} /> Save Fee Head
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
                <Settings size={16} className="text-brand-orange-500" /> Setup Fee Structure Rule
              </h3>
              <form onSubmit={handleCreateStructure} className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <label className="form-label text-xs">Medium *</label>
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

                <div>
                  <label className="form-label text-xs">Due Day of Month</label>
                  <input 
                    type="number" 
                    value={setupDueDay} 
                    onChange={(e) => setSetupDueDay(e.target.value)} 
                    min="1" 
                    max="31" 
                    className="form-input text-xs"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={saving} className="btn-secondary text-xs font-bold px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} /> Add Structure Config
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Block: Tables showing config & concession approvals */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2">Configured Fee Heads</h3>
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="excel-table">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="excel-th w-12 text-left">Sl No</th>
                      <th className="excel-th">Name</th>
                      <th className="excel-th">Category</th>
                      <th className="excel-th">Mandatory</th>
                      <th className="excel-th text-left">Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeHeads.map((h: any, idx: number) => (
                      <tr key={h.id}>
                        <td className="excel-td text-left font-bold font-mono text-slate-500">{idx + 1}</td>
                        <td className="excel-td font-bold text-slate-800">{h.name}</td>
                        <td className="excel-td text-xs uppercase text-slate-500 font-bold">{h.feeType}</td>
                        <td className="excel-td text-xs">{h.isMandatory ? 'Yes' : 'No'}</td>
                        <td className="excel-td text-left">
                          <div className="flex gap-1 justify-start">
                            <button
                              onClick={() => {
                                setEditFeeHead(h);
                                setEditHeadName(h.name);
                                setEditHeadDescription(h.description || '');
                                setEditHeadFeeType(h.feeType);
                                setEditHeadIsMandatory(h.isMandatory);
                              }}
                              className="p-1 text-slate-600 hover:text-brand-orange-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteFeeHead(h.id)}
                              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-700 border-b pb-2">Class Dues Structures Register</h3>
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="excel-table">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="excel-th w-12 text-left">Sl No</th>
                      <th className="excel-th">Class</th>
                      <th className="excel-th">Medium</th>
                      <th className="excel-th">Fee Head</th>
                      <th className="excel-th text-left">Amount</th>
                      <th className="excel-th">Frequency</th>
                      <th className="excel-th text-left">Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeStructures.map((fs: any, idx: number) => (
                      <tr key={fs.id}>
                        <td className="excel-td text-left font-bold font-mono text-slate-500">{idx + 1}</td>
                        <td className="excel-td font-bold text-slate-800">{fs.class?.name}</td>
                        <td className="excel-td text-xs">{fs.medium}</td>
                        <td className="excel-td font-semibold text-slate-700">{fs.feeHead?.name}</td>
                        <td className="excel-td excel-mono text-left">₹{parseFloat(fs.amount).toLocaleString('en-IN')}</td>
                        <td className="excel-td text-xs uppercase">{fs.frequency}</td>
                        <td className="excel-td text-left">
                          <div className="flex gap-1 justify-start">
                            <button
                              onClick={() => {
                                setEditFeeStructure(fs);
                                setEditStructClassId(fs.classId);
                                setEditStructMedium(fs.medium);
                                setEditStructFeeHeadId(fs.feeHeadId);
                                setEditStructAmount(String(fs.amount));
                                setEditStructFrequency(fs.frequency);
                                setEditStructDueDay(String(fs.dueDay));
                              }}
                              className="p-1 text-slate-600 hover:text-brand-orange-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteStructure(fs.id)}
                              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && (
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-700 border-b pb-2 flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-brand-orange-500" /> Pending Concession Approvals
                </h3>
                <div className="overflow-x-auto">
                  <table className="excel-table">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="excel-th text-[10px]">Student Name</th>
                        <th className="excel-th text-[10px]">Fee Head</th>
                        <th className="excel-th text-[10px]">Model</th>
                        <th className="excel-th text-left text-[10px]">Value</th>
                        <th className="excel-th text-left text-[10px]">Operations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingConcessions.map((c: any) => (
                        <tr key={c.id}>
                          <td className="excel-td font-bold text-slate-800 capitalize text-[10px]">{c.student.firstName} {c.student.lastName}</td>
                          <td className="excel-td font-semibold text-slate-700 text-[10px]">{c.feeHead.name}</td>
                          <td className="excel-td uppercase text-[9px] font-bold text-slate-500 text-left">{c.concessionType}</td>
                          <td className="excel-td excel-mono text-left text-[10px]">
                            {c.concessionType === 'PERCENTAGE' ? `${c.concessionPercent}%` : `₹${c.concessionAmount}`}
                          </td>
                          <td className="excel-td text-left">
                            <div className="flex gap-1 justify-start">
                              <button 
                                onClick={() => handleConcessionApproval(c.id, 'approve')}
                                className="px-1.5 py-0.5 bg-brand-green-600 hover:bg-brand-green-700 text-white rounded text-[8px] font-bold"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => handleConcessionApproval(c.id, 'reject')}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[8px] font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingConcessions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="excel-td text-left py-4 text-slate-400 font-bold text-[10px]">No pending concession requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab 6: Bulk Exports */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4 h-fit">
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

            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-700">Financial Invoice Worksheet Ledger</h3>
                <button 
                  onClick={() => setPrintedWorksheet(true)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow shadow-blue-100"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={invoiceClass}
                  onChange={(e) => {
                    setInvoiceClass(e.target.value);
                    setInvoiceSection('');
                  }}
                  className="form-input text-xs"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={invoiceSection}
                  onChange={(e) => setInvoiceSection(e.target.value)}
                  className="form-input text-xs"
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
                  className="form-input text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending Dues</option>
                  <option value="PAID">Fully Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="WAIVED">Waiver / Void</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="excel-table">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="excel-th w-12 text-left">Sl No</th>
                      <th className="excel-th">Invoice No</th>
                      <th className="excel-th">Student</th>
                      <th className="excel-th">Class/Sec</th>
                      <th className="excel-th">Description</th>
                      <th className="excel-th text-left">Gross Amt</th>
                      <th className="excel-th text-left">Paid Amt</th>
                      <th className="excel-th text-left">Net Amt</th>
                      <th className="excel-th">Due Date</th>
                      <th className="excel-th text-left">Status</th>
                      {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && <th className="excel-th text-left">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesList.map((inv: any, idx: number) => (
                      <tr key={inv.id}>
                        <td className="excel-td text-left font-bold font-mono text-slate-500">{idx + 1}</td>
                        <td className="excel-td excel-mono">{inv.invoiceNumber}</td>
                        <td className="excel-td font-bold text-slate-800 capitalize">{inv.student.firstName} {inv.student.lastName}</td>
                        <td className="excel-td">{inv.student.class?.name} - {inv.student.section?.name}</td>
                        <td className="excel-td font-semibold text-slate-700">{inv.feeHead.name}</td>
                        <td className="excel-td excel-mono text-left">₹{parseFloat(inv.amountDue).toLocaleString('en-IN')}</td>
                        <td className="excel-td excel-mono text-left text-brand-green-600">₹{parseFloat(inv.amountPaid || 0).toLocaleString('en-IN')}</td>
                        <td className="excel-td excel-mono text-left font-bold text-slate-800">₹{parseFloat(inv.amountAfterConcession).toLocaleString('en-IN')}</td>
                        <td className="excel-td excel-mono">{new Date(inv.dueDate).toLocaleDateString('en-GB')}</td>
                        <td className="excel-td text-left">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            inv.status === 'PAID' ? 'bg-brand-green-50 text-brand-green-700' :
                            inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        {(user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL') && (
                          <td className="excel-td text-left">
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
                        <td colSpan={11} className="excel-td text-left text-slate-400 py-6 font-semibold">No invoices matching filters found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Invoice Modal */}
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
              <button onClick={() => setEditInvoice(null)} disabled={saving} className="btn-outline text-xs font-bold py-1 disabled:opacity-50">Cancel</button>
              <button onClick={handleUpdateInvoice} disabled={saving} className="btn-secondary text-xs font-bold py-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                {saving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Saving...
                  </>
                ) : 'Save Adjustments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fee Head Modal */}
      {editFeeHead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-96 space-y-4">
            <div>
              <h4 className="font-extrabold text-sm text-slate-800">Edit Fee Head</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Modify properties of {editFeeHead.name}</p>
            </div>

            <form onSubmit={handleUpdateFeeHead} className="space-y-3">
              <div>
                <label className="form-label text-xs">Fee Head Name *</label>
                <input
                  type="text"
                  value={editHeadName}
                  onChange={(e) => setEditHeadName(toTitleCase(e.target.value))}
                  className="form-input text-xs"
                  required
                />
              </div>
              <div>
                <label className="form-label text-xs">Fee Category *</label>
                <select
                  value={editHeadFeeType}
                  onChange={(e) => setEditHeadFeeType(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="TUITION">Academic / Tuition Fee</option>
                  <option value="TRANSPORT">Transport / Bus Fee</option>
                  <option value="HOSTEL">Hostel Boarding Fee</option>
                  <option value="MISCELLANEOUS">Miscellaneous / Optional</option>
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Is Mandatory *</label>
                <select
                  value={String(editHeadIsMandatory)}
                  onChange={(e) => setEditHeadIsMandatory(e.target.value === 'true')}
                  className="form-input text-xs"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Description</label>
                <input
                  type="text"
                  value={editHeadDescription}
                  onChange={(e) => setEditHeadDescription(toTitleCase(e.target.value))}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditFeeHead(null)} disabled={saving} className="btn-outline text-xs font-bold py-1 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="btn-secondary text-xs font-bold py-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                  {saving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fee Structure Modal */}
      {editFeeStructure && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-96 space-y-4">
            <div>
              <h4 className="font-extrabold text-sm text-slate-800">Edit Fee Structure Rule</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Modify structure configurations</p>
            </div>

            <form onSubmit={handleUpdateStructure} className="space-y-3">
              <div>
                <label className="form-label text-xs">Target Class *</label>
                <select 
                  value={editStructClassId} 
                  onChange={(e) => setEditStructClassId(e.target.value)} 
                  className="form-input text-xs"
                  required
                >
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Medium *</label>
                <select 
                  value={editStructMedium} 
                  onChange={(e) => setEditStructMedium(e.target.value)} 
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
                  value={editStructFeeHeadId} 
                  onChange={(e) => setEditStructFeeHeadId(e.target.value)} 
                  className="form-input text-xs"
                  required
                >
                  {feeHeads.map((h: any) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Fee Amount (₹) *</label>
                <input 
                  type="number" 
                  value={editStructAmount} 
                  onChange={(e) => setEditStructAmount(e.target.value)} 
                  className="form-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">Frequency *</label>
                <select 
                  value={editStructFrequency} 
                  onChange={(e) => setEditStructFrequency(e.target.value)} 
                  className="form-input text-xs"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ANNUALLY">Annually</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Due Day of Month</label>
                <input 
                  type="number" 
                  value={editStructDueDay} 
                  onChange={(e) => setEditStructDueDay(e.target.value)} 
                  min="1" 
                  max="31" 
                  className="form-input text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditFeeStructure(null)} disabled={saving} className="btn-outline text-xs font-bold py-1 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="btn-secondary text-xs font-bold py-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                  {saving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
