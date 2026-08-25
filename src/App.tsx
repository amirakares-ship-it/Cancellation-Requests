import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Layers, Users, TrendingUp, CheckCircle, CheckCircle2, ShieldAlert, Mail, Settings, 
  FileSpreadsheet, LogOut, Key, UserCheck, AlertTriangle, Printer, Eye, 
  ChevronLeft, Upload, Download, RefreshCw, FileText, Check, ShieldCheck, XCircle, Info, Receipt, Calculator, ListFilter, Trash2, FileCheck2, User,
  PanelRightClose, PanelRightOpen, Menu, ChevronRight, FileCheck, FileUp
} from 'lucide-react';

// Subcomponents
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RequestsList from './components/RequestsList';
import RequestForm from './components/RequestForm';
import PrintHub from './components/PrintHub';
import Memo from './components/Memo';
import SettingsPanel from './components/SettingsPanel';
import EmailTemplates from './components/EmailTemplates';
import AdvanceReceipts from './components/AdvanceReceipts';
import CommitteeManager from './components/CommitteeManager';
import FormulasManager from './components/FormulasManager';
import DropdownsManager from './components/DropdownsManager';
import CancellationStatusManager from './components/CancellationStatusManager';
import CompanyAndABKDebtsManager from './components/CompanyAndABKDebtsManager';
import { ConfirmModal } from './components/ConfirmModal';
import FirstManagerDecisionModal from './components/FirstManagerDecisionModal';
import SettlementStatementModal from './components/SettlementStatementModal';
import FirstManagerPDFModal from './components/FirstManagerPDFModal';
import FirstManagerHub from './components/FirstManagerHub';
import SendToFirstManagerModal from './components/SendToFirstManagerModal';

import { CustomField } from './types';
import { translateStatus, translateRole, calculateAllFields, formatCommitteeYear, formatCommitteeWithYear, isSameClub, parseDebtWorkbook, parseSmartNumber, isInternationalRequest, formatDateCustom } from './utils';

export default function App() {
  // Authentication state
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('wd_token'));
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Core Data State
  const [requests, setRequests] = useState<any[]>([]);
  const [dropdowns, setDropdowns] = useState<any>({ clubs: [], membershipTypes: [], paymentMethods: [], cancellationReasons: [], committeeResults: [], cancellationStatuses: [], exceptions: [] });
  const [dropdownLabels, setDropdownLabels] = useState<Record<string, string>>({});
  const [committees, setCommittees] = useState<any[]>([]);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };
  const openCommittee = committees.find((c: any) => c.status === 'open');
  const activeCommitteeFormatted = openCommittee
    ? `${String(openCommittee.number).padStart(2, '0')}-${formatCommitteeYear(openCommittee.year || openCommittee.approvalDate)}`
    : 'لا توجد';
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [labelNames, setLabelNames] = useState<Record<string, string>>({
    membershipNumber: "رقم العضوية",
    memberName: "اسم العضو",
    loanUnderName: "القرض باسم",
    nationalId: "الرقم القومي",
    externalId: "رقم العميل",
    subscriptionDate: "تاريخ الاشتراك",
    requestDate: "تاريخ الطلب",
    membershipType: "نوع العضوية",
    club: "النادي",
    committeeNo: "رقم اللجنة",
    paymentMethod: "طريقة الدفع",
    accountNumber: "رقم الحساب",
    documents: "المستندات",
    cancellationReason: "سبب طلب الالغاء",
    cancellationReasonDetail: "السبب بالتفصيل",
    salesPerson: "مسؤول المبيعات",
    clubNote: "ملاحظات الفرع",
    adminNote: "ملاحظات الادمن",
    subscriptionValue: "إجمالي قيمة العضوية",
    transferValue: "قيمة التحويلة",
    cashAmount: "المبلغ نقداً",
    visaAmount: "المبلغ فيزا",
    advancePaid: "قيمة المقدم",
    checksPaid: "شيكات مسددة",
    checksUnpaid: "شيكات غير مسددة",
    annualRenewalDue: "التجديد السنوي المستحق",
    adminFees: "مصاريف إدارية",
    usageFee: "مقابل الانتفاع",
    visaFees2Percent: "مصاريف فيزا 2%",
    discountAmount: "مبلغ الخصم",
    debtABKCompanies: "مديونية البنك / الشركات",
    refundAmount: "مبلغ الاسترداد",
    mobileNumber: "رقم الموبايل",
    actions: "تعديل"
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'print' | 'memo' | 'emails' | 'reconcile' | 'settings' | 'receipts' | 'cancellation_status' | 'formulas' | 'dropdowns_lists' | 'committees'>('dashboard');
  const [showLoginCommitteePrompt, setShowLoginCommitteePrompt] = useState(false);
  
  // Delete Request Confirm Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    requestId: number | string | null;
    memberName: string;
    membershipNumber: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    requestId: null,
    memberName: '',
    membershipNumber: '',
    isLoading: false,
  });

  // Bulk Delete Request Confirm Modal State
  const [bulkDeleteModalState, setBulkDeleteModalState] = useState<{
    isOpen: boolean;
    ids: (number | string)[];
    isLoading: boolean;
  }>({
    isOpen: false,
    ids: [],
    isLoading: false,
  });
  
  // Requests views states
  const [requestViewMode, setRequestViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null); // Details Modal
  const [firstManagerModalRequest, setFirstManagerModalRequest] = useState<any | null>(null);
  const [isSubmittingFirstManagerModal, setIsSubmittingFirstManagerModal] = useState(false);
  const [statementModalRequest, setStatementModalRequest] = useState<any | null>(null);
  const [firstManagerPdfModalRequest, setFirstManagerPdfModalRequest] = useState<any | null>(null);
  const [sendToFirstManagerTarget, setSendToFirstManagerTarget] = useState<any | null>(null);
  const [isSendingToFirstManager, setIsSendingToFirstManager] = useState(false);
  
  // User display name helper
  const userDisplayName = useMemo(() => {
    if (!currentUser) return '';
    if (currentUser.name === 'المدير المالي الأول (مراجعة)' || currentUser.name === 'المدير المالي الأول' || currentUser.role === 'first_manager') {
      if (currentUser.name === 'المدير المالي الأول (مراجعة)' || currentUser.name === 'المدير المالي الأول') {
        return 'Manager';
      }
      return currentUser.name || 'Manager';
    }
    return currentUser.name || '';
  }, [currentUser]);

  // First Manager pending count for badge & notifications
  const firstManagerPendingCount = useMemo(() => {
    return requests.filter(r => r.approvalSentToFirstManager && (r.firstManagerApproved === null || r.firstManagerApproved === undefined)).length;
  }, [requests]);

  // Dashboard filtering states
  const [dashFilters, setDashFilters] = useState({
    startDate: '',
    endDate: '',
    committeeNo: '',
    club: '',
    year: ''
  });

  // Reconciliation States
  const [reconResults, setReconResults] = useState<any[]>([]);
  const [reconSuccess, setReconSuccess] = useState('');
  const [debtImportSuccess, setDebtImportSuccess] = useState('');

  // Password Change State for Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Signature state for Sector Manager
  const [signatureFile, setSignatureFile] = useState<string | null>(null);

  // Fetch current user from token
  const verifySession = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          setCurrentUser(data.user);
          // Preload user's signature locally if sector manager
          if (data.user.role === 'sector_manager' && data.user.signatureUrl) {
            setSignatureFile(data.user.signatureUrl);
          }
        }
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      verifySession(authToken);
    } else {
      setAuthLoading(false);
    }
  }, [authToken]);

  // Fetch Core Data
  const fetchAllData = async () => {
    if (!authToken) return;
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };

      // Helper to safely parse JSON response
      const safeJson = async (r: Response) => {
        if (!r.ok) return null;
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;
        try {
          return await r.json();
        } catch {
          return null;
        }
      };

      // Requests
      const resRequests = await fetch('/api/requests', { headers });
      const dataRequests = await safeJson(resRequests);
      if (dataRequests) setRequests(dataRequests);

      // Dropdowns
      const resDropdowns = await fetch('/api/dropdowns', { headers });
      const dataDropdowns = await safeJson(resDropdowns);
      if (dataDropdowns) {
        if (dataDropdowns.dropdowns) {
          setDropdowns(dataDropdowns.dropdowns);
          if (dataDropdowns.dropdownLabels) setDropdownLabels(dataDropdowns.dropdownLabels);
        } else {
          setDropdowns(dataDropdowns);
        }
      }

      // Label Names
      const resLabels = await fetch('/api/label-names', { headers });
      const dataLabels = await safeJson(resLabels);
      if (dataLabels) setLabelNames(dataLabels);

      // Committees
      const resCommittees = await fetch('/api/committees', { headers });
      const dataCommittees = await safeJson(resCommittees);
      if (dataCommittees) setCommittees(dataCommittees);

      // Custom Fields
      const resCF = await fetch('/api/custom-fields', { headers });
      const dataCF = await safeJson(resCF);
      if (dataCF && Array.isArray(dataCF)) setCustomFields(dataCF);

      // Audit logs (Admin only)
      if (currentUser?.role === 'admin') {
        const resLogs = await fetch('/api/logs/audit', { headers });
        const dataLogs = await safeJson(resLogs);
        if (dataLogs) setAuditLogs(dataLogs);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    const handleCFUpdate = () => {
      fetchAllData();
    };
    window.addEventListener('custom-fields-updated', handleCFUpdate);
    return () => window.removeEventListener('custom-fields-updated', handleCFUpdate);
  }, [authToken]);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      if (currentUser.role !== 'admin' && ['cancellation_status', 'memo', 'reconcile', 'formulas', 'dropdowns_lists', 'emails', 'settings'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser]);

  useEffect(() => {
    (window as any).refreshLabelNames = () => {
      if (authToken) {
        fetch('/api/label-names', { headers: { 'Authorization': `Bearer ${authToken}` } })
          .then(res => res.json())
          .then(data => setLabelNames(data))
          .catch(err => console.error(err));
      }
    };
    return () => {
      delete (window as any).refreshLabelNames;
    };
  }, [authToken]);

  const handleLoginSuccess = (token: string, user: any) => {
    localStorage.setItem('wd_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    if (user.role === 'club') {
      setDashFilters(f => ({ ...f, club: user.club || '' }));
    }
    if (user.role === 'first_manager') {
      setActiveTab('first_manager_hub');
    }
    if (user.role === 'admin') {
      setShowLoginCommitteePrompt(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wd_token');
    setAuthToken(null);
    setCurrentUser(null);
    setRequests([]);
    setAuditLogs([]);
  };

  // Profile Password Change handler
  const handleProfilePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileCurrentPassword || !profileNewPassword || !profileConfirmPassword) {
      setProfileError('يرجى ملء جميع الحقول');
      return;
    }
    if (profileNewPassword !== profileConfirmPassword) {
      setProfileError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    if (profileNewPassword === '123') {
      setProfileError('لا يمكن استخدام كلمة المرور الافتراضية 123 كخيار آمن');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword: profileCurrentPassword,
          newPassword: profileNewPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileSuccess('تم تغيير كلمة المرور بنجاح!');
        setProfileCurrentPassword('');
        setProfileNewPassword('');
        setProfileConfirmPassword('');
      } else {
        setProfileError(data.error || 'فشل تغيير كلمة المرور');
      }
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  // Profile Signature upload for Sector Manager (png file convert to base64)
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert('يرجى رفع صورة توقيع بصيغة PNG شفافة فقط لدمجها بمذكرات الإلغاء');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSignatureFile(base64);

      try {
        const res = await fetch(`/api/users/${currentUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ signatureUrl: base64 })
        });
        if (res.ok) {
          alert('تم رفع وتثبيت توقيعك وختمك الإلكتروني بنجاح على نظام التسويات!');
          verifySession(authToken!);
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Saving Cancellation Request (Create/Edit)
  const handleSaveRequest = async (payload: any) => {
    try {
      const method = requestViewMode === 'create' ? 'POST' : 'PUT';
      const url = requestViewMode === 'create' ? '/api/requests' : `/api/requests/${editingRequest.id}`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setRequestViewMode('list');
        setEditingRequest(null);
        fetchAllData();
      } else {
        alert(data.error || 'فشل حفظ الطلب، يرجى التحقق من الرقم المالي والعضوية الفرعية');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkReview = async (ids: (number | string)[], reviewed: boolean) => {
    if (!ids || ids.length === 0) return;

    // 1. Optimistic update in local state immediately so UI reflects change instantly without lag
    const strIds = ids.map((id) => String(id).trim());
    setRequests((prev) =>
      prev.map((r) => (strIds.includes(String(r.id).trim()) ? { ...r, reviewed } : r))
    );

    // Also update selectedRequest if opened in modal
    if (selectedRequest && strIds.includes(String(selectedRequest.id).trim())) {
      setSelectedRequest((prev: any) => (prev ? { ...prev, reviewed } : prev));
    }

    try {
      const res = await fetch('/api/requests/bulk-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ids, reviewed })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.requests && Array.isArray(data.requests)) {
          setRequests(data.requests);
        } else {
          fetchAllData();
        }
        if (ids.length > 1) {
          alert(`تم تحديث حالة المراجعة لعدد ${ids.length} طلبات بنجاح!`);
        }
      } else {
        fetchAllData();
        alert(data.error || 'فشل تحديث حالة المراجعة');
      }
    } catch (err) {
      console.error("Error updating review status:", err);
      fetchAllData();
    }
  };

  const handleDeleteRequestPrompt = (id: number | string) => {
    const targetReq = requests.find((r) => String(r.id) === String(id));
    setDeleteModalState({
      isOpen: true,
      requestId: id,
      memberName: targetReq?.memberName || '',
      membershipNumber: targetReq?.membershipNumber || '',
      isLoading: false,
    });
  };

  const executeDeleteRequest = async () => {
    if (!deleteModalState.requestId) return;
    setDeleteModalState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(`/api/requests/${deleteModalState.requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchAllData();
        if (selectedRequest && String(selectedRequest.id) === String(deleteModalState.requestId)) {
          setSelectedRequest(null);
        }
      } else {
        alert(data.error || 'حدث خطأ أثناء محاولة حذف الطلب');
      }
    } catch (err: any) {
      alert(err.message || 'تعذر الاتصال بالسيرفر لحذف الطلب');
    } finally {
      setDeleteModalState({
        isOpen: false,
        requestId: null,
        memberName: '',
        membershipNumber: '',
        isLoading: false,
      });
    }
  };

  const handleBulkDeleteRequestsPrompt = (ids: (number | string)[]) => {
    if (!ids || ids.length === 0) return;
    setBulkDeleteModalState({
      isOpen: true,
      ids,
      isLoading: false,
    });
  };

  const executeBulkDeleteRequest = async () => {
    const ids = bulkDeleteModalState.ids;
    if (!ids || ids.length === 0) return;

    setBulkDeleteModalState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch('/api/requests/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(prev => prev.filter(r => !ids.map(String).includes(String(r.id))));
        fetchAllData();
        if (selectedRequest && ids.map(String).includes(String(selectedRequest.id))) {
          setSelectedRequest(null);
        }
        setBulkDeleteModalState({ isOpen: false, ids: [], isLoading: false });
      } else {
        alert(data.error || 'حدث خطأ أثناء الحذف الجماعي');
        setBulkDeleteModalState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err: any) {
      alert(err.message || 'تعذر الاتصال بالخادم للحذف الجماعي');
      setBulkDeleteModalState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleClearAllRequests = async () => {
    if (!window.confirm(`⚠️ تحذير مسح كافة البيانات!\n\nهل أنت متأكد تماماً من مسح جميع طلبات الإلغاء؟ (عدد الطلبات الحالية: ${requests.length})\n\nسيتم إفراغ قاعدة البيانات بالكامل وتصفير القائمة لتتمكن من رفع البيانات من جديد.`)) {
      return;
    }
    try {
      const res = await fetch('/api/requests/clear-all', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(`تم مسح كافة طلبات الإلغاء بنجاح (عدد ${data.count ?? requests.length} طلب). يمكنك الآن إعادة رفع البيانات.`);
        setRequests([]);
        fetchAllData();
        setSelectedRequest(null);
      } else {
        alert(data.error || 'حدث خطأ أثناء مسح طلبات الإلغاء');
      }
    } catch (err: any) {
      alert(err.message || 'تعذر الاتصال بالخادم لمسح البيانات');
    }
  };

  // Workflow Action buttons (inside details modal)
  const handleSendToFirstManager = async (reqId: number) => {
    const foundReq = requests.find(r => r.id === reqId);
    if (foundReq) {
      setSendToFirstManagerTarget(foundReq);
    } else {
      // Fallback
      try {
        const res = await fetch(`/api/requests/${reqId}/send-first-manager`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          alert('تم إرسال الطلب لمهام واعتمادات المدير الأول بنجاح!');
          fetchAllData();
          setSelectedRequest(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExecuteSendToFirstManager = async (reqId: number, pdfData: string, pdfName: string, pdfSize: number, notes: string) => {
    setIsSendingToFirstManager(true);
    try {
      const res = await fetch(`/api/requests/${reqId}/send-first-manager`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify({ pdfData, pdfName, pdfSize, notes })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم إرسال الطلب ومستندات أوراق العضو (PDF) بنجاح إلى مهام واعتمادات المدير الأول!');
        setSendToFirstManagerTarget(null);
        fetchAllData();
        if (selectedRequest && selectedRequest.id === reqId) {
          setSelectedRequest(null);
        }
      } else {
        alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
    } catch (err: any) {
      console.error(err);
      alert('تعذر الاتصال بالخادم لإرسال الطلب');
    } finally {
      setIsSendingToFirstManager(false);
    }
  };

  const handleAttachFirstManagerPdf = async (reqId: number, pdfData: string, pdfName: string, pdfSize: number, notes: string) => {
    try {
      const res = await fetch(`/api/requests/${reqId}/attach-first-manager-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ pdfData, pdfName, pdfSize, notes })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم حفظ وتحديث ملف الـ PDF بنجاح!');
        fetchAllData();
      } else {
        alert(data.error || 'حدث خطأ أثناء تحديث ملف PDF');
      }
    } catch (err: any) {
      console.error(err);
      alert('تعذر الاتصال بالخادم لتحديث ملف PDF');
    }
  };

  const handleFirstManagerDecision = async (reqId: number, approve: boolean, comments: string) => {
    setIsSubmittingFirstManagerModal(true);
    try {
      const res = await fetch(`/api/requests/${reqId}/first-manager-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ approve, comments })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'تعذر حفظ قرار المدير المالي الأول');
      }
      alert(approve ? 'تم اعتماد الطلب بنجاح وتحويله لرئيس قطاع المالية!' : 'تم تسجيل رفض الطلب وتغيير حالة الإلغاء إلى Rejected');
      await fetchAllData();
      setSelectedRequest(null);
      setFirstManagerModalRequest(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ قرار المدير المالي الأول');
      console.error(err);
    } finally {
      setIsSubmittingFirstManagerModal(false);
    }
  };

  const handleSendToSectorManager = async (reqId: number) => {
    try {
      const res = await fetch(`/api/requests/${reqId}/send-sector-manager`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        alert('تم تحويل الطلب لملف الاعتماد الفوري والختم الإلكتروني لرئيس قطاع المالية!');
        fetchAllData();
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSectorManagerDecision = async (reqId: number, approve: boolean, comments: string) => {
    try {
      const res = await fetch(`/api/requests/${reqId}/sector-manager-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ approve, comments })
      });
      if (res.ok) {
        alert(approve ? 'تم الاعتماد المالي النهائي للطلب وتثبيت الختم والتوقيع الأزرق برقم اللجنة!' : 'تم رفض الطلب');
        fetchAllData();
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update receipt received checkbox (Admin Only)
  const handleUpdateReceiptStatus = async (reqId: number, received: boolean) => {
    try {
      const res = await fetch(`/api/requests/${reqId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          receiptReceived: received,
          receiptReceivedDate: received ? new Date().toISOString().split('T')[0] : null
        })
      });
      if (res.ok) {
        fetchAllData();
        // Update details modal instantly
        const updated = await res.json();
        setSelectedRequest(updated.request);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Excel Reconciliation engine
  const handleReconcileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReconResults([]);
    setReconSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Parse rows as JSON
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        
        // Expected columns mapping (Arabic or English)
        // e.g. "رقم العضوية" or "membershipNumber", "حالة النظام" or "systemStatus"
        const mappedRows = rows.map(r => {
          const mNum = r['رقم العضوية'] || r['membershipNumber'] || r['Membership Number'] || '';
          const sStatus = r['حالة النظام'] || r['systemStatus'] || r['System Status'] || '';
          return { membershipNumber: String(mNum).trim(), systemStatus: String(sStatus).trim() };
        }).filter(r => r.membershipNumber);

        if (mappedRows.length === 0) {
          alert('ملف الإكسل لا يحتوي على بيانات مطابقة صحيحة. يرجى التأكد من احتواء الملف على عمود "رقم العضوية" وعمود "حالة النظام".');
          return;
        }

        // Send to backend to update DB matching fields
        const res = await fetch('/api/requests/reconcile-system-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ mappings: mappedRows })
        });

        const backendData = await res.json();
        if (res.ok) {
          // Compute mismatches lists locally for UI presentation
          const mismatches: any[] = [];
          backendData.requests.forEach((req: any) => {
            if (req.systemStatus && req.status !== req.systemStatus) {
              mismatches.push({
                membershipNumber: req.membershipNumber,
                memberName: req.memberName,
                club: req.club,
                status: req.status,
                systemStatus: req.systemStatus,
                mismatchReason: `حالة التسوية (${translateStatus(req.status)}) لا تتطابق مع حالة السي آر إم الموحد (${translateStatus(req.systemStatus)})`
              });
            }
          });

          setReconResults(mismatches);
          setReconSuccess(`تمت معالجة ملف المطابقة بنجاح لمطابقة لجان الإلغاء! تم فحص وتحديث ${backendData.updatedCount} عضوية.`);
          fetchAllData();
        } else {
          alert(backendData.error);
        }
      } catch (err: any) {
        alert(`فشل قراءة ملف إكسل: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Template for Bulk Company / Bank Debts Upload
  const handleDownloadCompanyDebtsTemplate = () => {
    const nonCompany = ["نقدا", "نقداً", "شيكات", "فيزا", "ABK", "عضوية دولية", "المشرق", "QNB", "تحويل بنكي"];
    const companyRequests = requests.filter(r => {
      const method = r.paymentMethod || '';
      return method === 'ABK' || method === 'المشرق' || !nonCompany.includes(method.trim());
    });

    const targetList = companyRequests.length > 0 ? companyRequests : requests;

    const dataToExport = targetList.map((r, idx) => ({
      'م': idx + 1,
      'رقم العضوية': r.membershipNumber || '',
      'القرض بإسم': r.loanUnderName || 'لا يوجد',
      'الرقم القومى': r.nationalId || '',
      'طريقة الدفع': r.paymentMethod || '',
      'مديونية البنوك/الشركات': r.debtABKCompanies || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مديونيات_البنوك_والشركات');
    XLSX.writeFile(workbook, `نموذج_رفع_مديونيات_الشركات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Bulk Import Company / Bank Debts Handler
  const handleImportCompanyDebtsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDebtImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const mappedRows = parseDebtWorkbook(data);

        if (mappedRows.length === 0) {
          alert('ملف الإكسل لا يحتوي على بيانات مطابقة صحيحة. يرجى التأكد من احتواء الملف على عمود "رقم العضوية" وعمود "مديونية البنوك/الشركات".');
          return;
        }

        const res = await fetch('/api/requests/import-company-debts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ rows: mappedRows })
        });

        const backendData = await res.json();
        if (res.ok) {
          if (backendData.requests) {
            setRequests(backendData.requests);
          }

          let msg = `تم تحديث مديونية البنوك/الشركات بنجاح لعدد ${backendData.updatedCount} طلب (بإجمالي مديونيات ${backendData.totalDebtAmount ? backendData.totalDebtAmount.toLocaleString() : 0} ج.م)`;
          if (backendData.nonZeroDebtCount !== undefined) {
            msg += ` — [تم إدخال ${backendData.nonZeroDebtCount} مديونية برصيد فعلي]`;
          }
          if (backendData.zeroDebtCount > 0 && backendData.nonZeroDebtCount === 0) {
            msg += ` (تنبيه: جميع قيم المديونيات في الملف قيمتها صفر 0 ج.م)`;
          }
          if (backendData.notFoundCount > 0) {
            msg += ` (تنبيه: يوجد ${backendData.notFoundCount} رقم عضوية غير مسجل بالمنظومة: ${backendData.notFoundList.slice(0, 5).join(', ')}${backendData.notFoundList.length > 5 ? '...' : ''})`;
          }
          setDebtImportSuccess(msg);
          fetchAllData();
        } else {
          alert(backendData.error || 'حدث خطأ أثناء تحديث المديونيات');
        }
      } catch (err: any) {
        alert(`فشل قراءة شيت المديونيات: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Bulk Excel Migration Loader (For super admin to upload existing records with full exported columns)
  const handleBulkImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        
        // Map excel columns to database fields
        const mappedRequests = rows.map(r => {
          // Result mapping
          let resultVal = 'Pending';
          const resCol = r['قرار اللجنة'] || r['النتيجة'] || r['Result'];
          if (resCol) {
            const sRes = String(resCol).trim();
            if (sRes.includes('موافق') || sRes === 'Accepted') resultVal = 'Accepted';
            else if (sRes.includes('مرفوض') || sRes === 'Rejected') resultVal = 'Rejected';
            else resultVal = 'Pending';
          }

          // Status mapping
          let statusVal = 'Pending';
          const stCol = r['حالة الإلغاء'] || r['الحالة'] || r['Status'];
          if (stCol) {
            const sSt = String(stCol).trim();
            if (sSt.includes('تم الإلغاء') || sSt === 'Cancelled') statusVal = 'Cancelled';
            else if (sSt.includes('مسترد') || sSt === 'Revoked') statusVal = 'Revoked';
            else if (sSt.includes('شطب') || sSt === 'Deletion') statusVal = 'Deletion';
            else if (sSt.includes('مرفوض') || sSt === 'Rejected') statusVal = 'Rejected';
            else statusVal = 'Pending';
          }

          // 1. سبب الرفض (Rejection Reason)
          const rejReasonCol = r['سبب الرفض'] || r['سبب رفض اللجنة'] || r['ملاحظات الرفض'] || r['Rejection Reason'] || '';
          const rejReasonStr = String(rejReasonCol).trim();
          if (rejReasonStr && resultVal !== 'Accepted') {
            resultVal = 'Rejected';
          }

          // 2. ايصال المقدم (Advance Receipt)
          const rawReceipt = r['ايصال المقدم'] ?? r['إيصال المقدم'] ?? r['استلام ايصال المقدم'] ?? r['استلام إيصال المقدم'] ?? r['أصل الإيصال'] ?? r['حالة أصل الإيصال'] ?? r['Advance Receipt'] ?? r['receiptReceived'];
          let receiptReceivedVal = false;
          if (rawReceipt !== undefined && rawReceipt !== null && rawReceipt !== '') {
            if (typeof rawReceipt === 'boolean') {
              receiptReceivedVal = rawReceipt;
            } else if (typeof rawReceipt === 'number') {
              receiptReceivedVal = rawReceipt === 1;
            } else {
              const str = String(rawReceipt).trim().toLowerCase();
              if (['نعم', 'تم', 'تم الاستلام', 'مستلم', 'استلام', 'true', '1', 'yes', '✓', '✓ تم الاستلام'].includes(str) || (str !== 'لا' && str !== '0' && str !== 'false' && str !== 'لم يتم' && str !== 'لم يتم الاستلام')) {
                receiptReceivedVal = true;
              }
            }
          }

          // 3. المراجعة (Reviewed)
          const rawReviewed = r['المراجعة'] ?? r['تم المراجعة'] ?? r['حالة المراجعة'] ?? r['مراجعة'] ?? r['مُراجع'] ?? r['مراجع'] ?? r['Reviewed'] ?? r['Is Reviewed'] ?? r['isReviewed'] ?? r['reviewed'];
          let reviewedVal = false;
          if (rawReviewed !== undefined && rawReviewed !== null && rawReviewed !== '') {
            if (typeof rawReviewed === 'boolean') {
              reviewedVal = rawReviewed;
            } else if (typeof rawReviewed === 'number') {
              reviewedVal = rawReviewed === 1;
            } else {
              const str = String(rawReviewed).trim().toLowerCase();
              if (['نعم', 'تم', 'تم المراجعة', 'مُراجع', 'مراجع', 'راجع', 'true', '1', 'yes', '✓', '✓ تم المراجعة', 'reviewed'].includes(str) || (str !== 'لا' && str !== '0' && str !== 'false' && str !== 'لم يتم' && str !== 'غير مراجع' && str !== 'غير مُراجع')) {
                reviewedVal = true;
              }
            }
          }

          // 4. تم الارسال (approvalSentToFirstManager)
          const rawSent = r['تم الارسال'] ?? r['تم الإرسال'] ?? r['إرسال للمدير الأول'] ?? r['ارسال للمدير الاول'] ?? r['الارسال للمدير الاول'] ?? r['تم تحويله للمدير'] ?? r['تم التحويل للمدير الأول'] ?? r['approvalSentToFirstManager'] ?? r['Approval Sent'];
          let approvalSentVal = false;
          if (rawSent !== undefined && rawSent !== null && rawSent !== '') {
            if (typeof rawSent === 'boolean') {
              approvalSentVal = rawSent;
            } else if (typeof rawSent === 'number') {
              approvalSentVal = rawSent === 1;
            } else {
              const str = String(rawSent).trim().toLowerCase();
              if (['تم', 'نعم', 'تم الارسال', 'تم الإرسال', 'مرسل', 'مُرسل', 'ارسال', 'إرسال', 'true', '1', 'yes', '✓'].includes(str) || (str !== 'لا' && str !== '0' && str !== 'false' && str !== 'لم يتم' && str !== 'غير مرسل' && str !== 'غير مُرسل')) {
                approvalSentVal = true;
              }
            }
          }

          // 5. قرار المدير الأول (First Manager Approval)
          const rawFmCol = r['قرار المدير الأول'] || r['اعتماد المدير الأول'] || r['المدير الأول'] || r['First Manager Decision'] || r['firstManagerApproved'];
          let fmApprovedVal: boolean | undefined = undefined;
          if (rawFmCol !== undefined && rawFmCol !== null && rawFmCol !== '') {
            const sFm = String(rawFmCol).trim().toLowerCase();
            if (sFm.includes('موافق') || sFm.includes('معتمد') || sFm === 'accepted' || sFm === 'true' || sFm === '1') {
              fmApprovedVal = true;
            } else if (sFm.includes('مرفوض') || sFm === 'rejected' || sFm === 'false' || sFm === '0') {
              fmApprovedVal = false;
            }
          }

          // 6. تاريخ حالة الإلغاء / الرفض
          const rawStatusDateCol = r['تاريخ حالة الإلغاء'] || r['تاريخ الرفض'] || r['تاريخ القرار'] || r['تاريخ موافقة اللجنة'] || r['تاريخ الإلغاء'] || r['Status Date'] || r['Rejection Date'] || '';
          let rawStatusDateFormatted = formatDateCustom(rawStatusDateCol);

          const mNum = String(r['رقم العضوية'] || r['Membership Number'] || '').trim();
          const mName = String(r['اسم العضو المشترك'] || r['اسم العضو'] || r['Member Name'] || '').trim();

          const parsedApprovalDate = formatDateCustom(r['تاريخ موافقة اللجنة'] || r['Approval Date'] || '') || String(r['تاريخ موافقة اللجنة'] || '').trim();

          return {
            membershipNumber: mNum,
            memberName: mName,
            loanUnderName: String(r['القرض بإسم'] || r['القرض باسم'] || r['Loan Under Name'] || mName || '').trim(),
            nationalId: String(r['الرقم القومي'] || r['الرقم القومى'] || r['National ID'] || '').trim(),
            externalId: String(r['رقم العميل'] || r['External Id'] || '').trim(),
            subscriptionDate: String(r['تاريخ الاشتراك'] || r['Subscription Date'] || '2026-01-01').trim(),
            requestDate: String(r['تاريخ الطلب'] || r['Request Date'] || '2026-06-01').trim(),
            type: r['تصنيف فترة الاشتراك'] ? String(r['تصنيف فترة الاشتراك']).trim() : undefined,
            membershipType: String(r['نوع العضوية'] || r['Membership Type'] || 'Regular').trim(),
            club: String(r['نادي الفرع'] || r['النادي'] || r['النادى'] || r['Club'] || 'Sheraton').trim(),
            paymentMethod: String(r['طريقة الدفع'] || r['Payment Method'] || 'نقدا').trim(),
            accountNumber: String(r['رقم الحساب لـ ABK'] || r['رقم الحساب'] || r['Account Number'] || '').trim(),
            accountNumberABK: String(r['رقم الحساب لـ ABK'] || r['رقم الحساب'] || '').trim(),
            documents: String(r['المستندات'] || r['Documents'] || 'مكتمل').trim(),
            cancellationReason: String(r['سبب الإلغاء'] || r['سبب الالغاء'] || r['سبب طلب الالغاء'] || r['Cancellation Reason'] || 'اسباب شخصية').trim(),
            cancellationReasonDetail: String(r['السبب بالتفصيل'] || r['السبب التفصيلي'] || r['Detailed Reason'] || 'بدون أسباب تفصيلية').trim(),
            firstManagerComments: String(r['ملاحظات المدير الأول'] || r['تعليق المدير الأول'] || '').trim() || undefined,
            firstManagerApproved: fmApprovedVal,
            salesPerson: String(r['اسم البائع'] || r['مسؤول المبيعات'] || r['Sales Person'] || 'مسؤول الفرع').trim(),
            subscriptionValue: parseSmartNumber(r['إجمالي قيمة العضوية'] || r['قيمة الاشتراك'] || r['قيمة العضوية'] || r['إجمالي الاشتراك'] || r['Subscription Value']),
            transferValue: parseSmartNumber(r['قيمة التحويلة (قرض)'] || r['قيمة التحويلة'] || r['Transfer Value']),
            cashAmount: parseSmartNumber(r['مقدم نقدي'] || r['المبلغ نقداً'] || r['نقدا'] || r['نقداً'] || r['Cash Amount']),
            visaAmount: parseSmartNumber(r['مقدم فيزا'] || r['المبلغ فيزا'] || r['فيزا'] || r['Visa Amount']),
            checksPaid: parseSmartNumber(r['الشيكات المسددة'] || r['شيكات مسددة'] || r['Checks Paid']),
            checksUnpaid: parseSmartNumber(r['الشيكات غير مسددة'] || r['الشيكات الغير مسددة'] || r['شيكات غير مسددة'] || r['Checks Unpaid']),
            annualRenewalDue: parseSmartNumber(r['التجديد السنوي المستحق'] || r['التجديد المستحق']),
            debtABKCompanies: parseSmartNumber(r['مديونية البنوك/الشركات'] || r['مديونية البنك / الشركات'] || r['مديونية ABK+Companies'] || r['مديونية'] || r['debtABKCompanies']),
            refundAmount: r['مبلغ الاسترداد الكلي'] !== undefined || r['مبلغ الاسترداد'] !== undefined || r['صافي الاسترداد'] !== undefined || r['المبلغ المسترد'] !== undefined || r['القيمة المستردة'] !== undefined || r['Refund Amount'] !== undefined
              ? parseSmartNumber(r['مبلغ الاسترداد الكلي'] || r['مبلغ الاسترداد'] || r['صافي الاسترداد'] || r['المبلغ المسترد'] || r['القيمة المستردة'] || r['Refund Amount'])
              : undefined,
            result: resultVal,
            status: statusVal,
            committeeNo: String(r['رقم اللجنة'] || '').trim(),
            committeeYear: formatCommitteeYear(r['سنة اللجنة'] || r['تاريخ موافقة اللجنة'] || ''),
            approvalDate: parsedApprovalDate,
            statusDate: rawStatusDateFormatted || ((resultVal === 'Rejected' || statusVal === 'Rejected' || statusVal === 'Cancelled') ? (parsedApprovalDate || formatDateCustom(r['تاريخ الطلب']) || new Date().toISOString().split('T')[0]) : ''),
            receiptReceived: receiptReceivedVal,
            receiptReceivedDate: receiptReceivedVal ? (String(r['تاريخ استلام الأصل'] || '').trim() || new Date().toISOString().split('T')[0]) : null,
            reviewed: reviewedVal,
            approvalSentToFirstManager: approvalSentVal,
            clubNote: String(r['ملاحظات الفرع'] || '').trim(),
            adminNote: String(r['ملاحظات الادمن'] || r['ملاحظات الأدمن'] || rejReasonStr || '').trim(),
            mobileNumber: String(r['رقم الموبايل'] || '').trim(),
            currency: String(r['العملة'] || r['Currency'] || 'جم').trim(),
            exceptions: String(r['الاستثناء'] || '').trim(),
            exceptionType: String(r['نوع الاستثناء'] || '').trim(),
          };
        }).filter(r => r.membershipNumber && r.memberName);

        if (mappedRequests.length === 0) {
          alert('لم يتم العثور على أي بيانات صحيحة في الملف. يرجى التأكد من احتواء الشيت على أعمدة (رقم العضوية) و (اسم العضو المشترك).');
          return;
        }

        // Upload mapped requests to bulk importer
        const res = await fetch('/api/requests/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ rows: mappedRequests })
        });

        const importRes = await res.json();
        if (res.ok) {
          alert(`تهانينا! تم استيراد ودمج ${importRes.importedCount} سجل بنجاح لقاعدة بيانات التسويات، وتخطي ${importRes.skippedCount} سجلات متكررة أو غير مكتملة!`);
          fetchAllData();
        } else {
          alert(importRes.error || 'حدث خطأ أثناء استيراد البيانات');
        }
      } catch (err: any) {
        alert(`فشل دمج ملف استيراد الحسابات: ${err.message}`);
      } finally {
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Custom Report EXCEL Export (With Dynamic Custom Fields)
  const handleExportExcelReport = (customData?: any[]) => {
    const listToExport = Array.isArray(customData) ? customData : requests;
    if (!listToExport || listToExport.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير حالياً طبقاً للتصفية المحددة');
      return;
    }

    const exportableCustomFields = [...customFields]
      .filter(f => f.showInExport)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const exportData = listToExport.map((r, idx) => {
      const row: Record<string, any> = {
        'م (تسلسلي)': idx + 1,
        'رقم العضوية': r.membershipNumber || '',
        'اسم العضو المشترك': r.memberName || '',
        'القرض بإسم': r.loanUnderName || r.loanInNameOf || r.memberName || '—',
        'الرقم القومي': r.nationalId || '',
        'رقم العميل': r.externalId || '',
        'تاريخ الاشتراك': r.subscriptionDate || '',
        'تاريخ الطلب': r.requestDate || '',
        'فترة الاشتراك باليوم': r.days ?? 0,
        'تصنيف فترة الاشتراك': r.type || '',
        'نوع العضوية': r.membershipType || '',
        'نادي الفرع': r.club || '',
        'طريقة الدفع': r.paymentMethod || '',
        'العملة': r.currency || 'جم',
        'رقم الحساب لـ ABK': r.accountNumberABK || r.accountNumber || '—',
        'المستندات': r.documents || '',
        'سبب الإلغاء': r.cancellationReason || r.reasons || '',
        'السبب بالتفصيل': r.cancellationReasonDetail || r.detailedReason || '',
        'قرار اللجنة': r.result === 'Accepted' ? 'موافق' : r.result === 'Rejected' ? 'مرفوض' : 'قيد النظر',
        'سبب الرفض': r.adminNote || r.firstManagerComments || r.sectorManagerComments || '—',
        'رقم اللجنة': formatCommitteeWithYear(r.committeeNo, r.committeeYear, r.approvalDate || r.requestDate || r.createdAt),
        'تاريخ موافقة اللجنة': r.approvalDate ? formatDateCustom(r.approvalDate) : '—',
        'قيمة الاشتراك': r.subscriptionValue ?? 0,
        'قيمة التحويلة (قرض)': r.transferValue ?? 0,
        'مقدم نقدي': r.cashAmount ?? 0,
        'مقدم فيزا': r.visaAmount ?? 0,
        'مبلغ المقدم': r.advancePaid ?? ((r.cashAmount || 0) + (r.visaAmount || 0)),
        'ايصال المقدم': r.receiptReceived ? 'تم الاستلام' : 'لم يتم',
        'الشيكات المسددة': r.checksPaid ?? 0,
        'الشيكات غير مسددة': r.checksUnpaid ?? 0,
        'التجديد السنوي المستحق': r.annualRenewalDue ?? 0,
        'المصاريف الإدارية': r.adminFees ?? 0,
        'مقابل الانتفاع': r.usageFee ?? 0,
        'مصاريف الفيزا 2%': r.visaFees2Percent ?? 0,
        'إجمالي مبلغ الخصم': r.discountAmount ?? 0,
        'مديونية البنوك/الشركات': r.debtABKCompanies ?? 0,
        'مبلغ الاسترداد الكلي': r.refundAmount ?? 0,
        'رد للعميل (Companies)': r.refundToClient ?? 'Not Required',
        'فرق مديونية ABK': r.abkDebtDifference ?? 'Not Required',
        'حالة الإلغاء': translateStatus(r.status),
        'تاريخ حالة الإلغاء': r.statusDate ? formatDateCustom(r.statusDate) : (r.approvalDate ? formatDateCustom(r.approvalDate) : '—'),
        'المراجعة': r.reviewed ? 'تم المراجعة' : 'لم يتم',
        'تم الارسال': r.approvalSentToFirstManager ? 'تم' : 'لم يتم',
        'ملاحظات الفرع': r.clubNote || '—',
        'ملاحظات الادمن': r.adminNote || '—',
        'اسم البائع': r.salesPerson || '—',
        'رقم الموبايل': r.mobileNumber || '—',
        'الاستثناء': r.isException ? (r.exceptions ? `نعم - ${r.exceptions}` : 'نعم') : (r.exceptions || (r.adminFeesOverride !== undefined || r.usageFeeOverride !== undefined ? 'استثناء يدوي' : 'لا يوجد'))
      };

      // Dynamic Custom Fields mapping
      exportableCustomFields.forEach(cf => {
        const val = r.customValues?.[cf.key];
        if (val === undefined || val === null || val === '') {
          row[cf.label] = '—';
        } else if (typeof val === 'boolean') {
          row[cf.label] = val ? 'نعم' : 'لا';
        } else {
          row[cf.label] = val;
        }
      });

      // Ensure 'نوع الاستثناء' is at the absolute end of Excel report
      row['نوع الاستثناء'] = r.exceptionType || '—';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تسويات العضويات الملغاة');
    XLSX.writeFile(workbook, `Wadi_Degla_Cancellations_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans text-right" dir="rtl">
        <div className="text-center space-y-3">
          <RefreshCw className="h-10 w-10 animate-spin mx-auto text-amber-400" />
          <p className="text-sm font-bold">جاري تحميل المنظومة وتدقيق الهوية الآمنة...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden text-right" dir="rtl">
      
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-68'} bg-neutral-950 text-white flex flex-col shrink-0 no-print transition-all duration-300 ease-in-out border-l border-neutral-900 shadow-xl z-30`} dir="rtl">
        {/* Right Sidebar Header */}
        <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'} border-b border-neutral-900/80 bg-neutral-950/90 backdrop-blur-xs`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-linear-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-neutral-950 shrink-0 shadow-md ring-2 ring-amber-400/20">
              WDC
            </div>
            {!isSidebarCollapsed && (
              <div className="text-right min-w-0">
                <h1 className="text-xs font-black tracking-wider text-white uppercase truncate">WADI DEGLA CLUBS</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <p className="text-[10px] font-bold text-amber-400/90 truncate">نظام إلغاء العضويات</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 rounded-xl border border-neutral-900 hover:border-neutral-800 transition-all cursor-pointer shadow-2xs"
            title={isSidebarCollapsed ? "توسيع القائمة الجانبية" : "طّي القائمة الجانبية"}
          >
            {isSidebarCollapsed ? <PanelRightOpen className="w-4 h-4 text-amber-400" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 text-right overflow-y-auto custom-scrollbar">
          
          {/* 1. لوحة المراقبة والإحصائيات */}
          <button
            onClick={() => { setActiveTab('dashboard'); setRequestViewMode('list'); }}
            title="لوحة المراقبة والإحصائيات"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
            }`}
          >
            <TrendingUp className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
            {!isSidebarCollapsed && <span>لوحة المراقبة والإحصائيات</span>}
          </button>

          {/* 2. متابعة طلبات الإلغاء */}
          <button
            onClick={() => { setActiveTab('requests'); setRequestViewMode('list'); }}
            title="متابعة طلبات الإلغاء"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 relative' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'requests' && requestViewMode !== 'create' 
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
            }`}
          >
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'requests' && requestViewMode !== 'create' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>متابعة طلبات الإلغاء</span>}
            </div>
            {currentUser.role === 'first_manager' ? (
              requests.filter(r => r.approvalSentToFirstManager).length > 0 && (
                <span className={`text-[10px] font-bold font-mono ${isSidebarCollapsed ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : 'px-2 py-0.5'} rounded-full ${
                  activeTab === 'requests' && requestViewMode !== 'create' ? 'bg-neutral-950 text-amber-400' : 'bg-amber-400 text-neutral-950'
                }`}>
                  {requests.filter(r => r.approvalSentToFirstManager).length}
                </span>
              )
            ) : (
              requests.length > 0 && (
                <span className={`text-[10px] font-bold font-mono ${isSidebarCollapsed ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : 'px-2 py-0.5'} rounded-full ${
                  activeTab === 'requests' && requestViewMode !== 'create' ? 'bg-neutral-950 text-amber-400' : 'bg-amber-400 text-neutral-950'
                }`}>
                  {requests.length}
                </span>
              )
            )}
          </button>

          {/* 3. طلب إلغاء جديد */}
          <button
            onClick={() => { setActiveTab('requests'); setRequestViewMode('create'); }}
            title="طلب إلغاء جديد"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'requests' && requestViewMode === 'create' 
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
            }`}
          >
            <CheckCircle className={`w-4 h-4 shrink-0 ${activeTab === 'requests' && requestViewMode === 'create' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
            {!isSidebarCollapsed && <span>طلب إلغاء جديد</span>}
          </button>

          {/* 4. إيصال المقدم */}
          {currentUser.role !== 'first_manager' && currentUser.username !== 'manager1' && (
            <button
              onClick={() => setActiveTab('receipts')}
              title="إيصال المقدم"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'receipts' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <Receipt className={`w-4 h-4 shrink-0 ${activeTab === 'receipts' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>إيصال المقدم</span>}
            </button>
          )}

          {/* 5. مديونية الشركات */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('reconcile')}
              title="مديونية الشركات"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reconcile' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'reconcile' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>مديونية الشركات</span>}
            </button>
          )}

          {/* 6. طباعة المذكرة Memo */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('memo')}
              title="طباعة المذكرة (Memo)"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'memo' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <Printer className={`w-4 h-4 shrink-0 ${activeTab === 'memo' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>طباعة المذكرة (Memo)</span>}
            </button>
          )}

          {/* 7. تحديث وتحديد حالة الإلغاء */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('cancellation_status')}
              title="تحديث وتحديد حالة الإلغاء"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'cancellation_status' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <FileCheck2 className={`w-4 h-4 shrink-0 ${activeTab === 'cancellation_status' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>تحديث وتحديد حالة الإلغاء</span>}
            </button>
          )}

          {/* 8. متابعة مهام واعتمادات */}
          {(currentUser.role === 'first_manager' || currentUser.role === 'admin') && (
            <button
              onClick={() => { setActiveTab('first_manager_hub'); setRequestViewMode('list'); }}
              title="متابعة مهام واعتمادات"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 relative' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'first_manager_hub' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'first_manager_hub' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
                {!isSidebarCollapsed && <span>متابعة مهام واعتمادات</span>}
              </div>
              {firstManagerPendingCount > 0 && (
                <span className={`text-[10px] font-black font-mono ${isSidebarCollapsed ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : 'px-2 py-0.5'} rounded-full bg-rose-500 text-white shadow-xs`} title="طلبات بانتظار قرار المدير الأول">
                  {firstManagerPendingCount}
                </span>
              )}
            </button>
          )}

          {/* Divider for System Administration & Configurations */}
          {currentUser.role === 'admin' && (
            <div className="pt-2 pb-1">
              <div className="border-t border-neutral-900"></div>
              {!isSidebarCollapsed && (
                <span className="px-3 pt-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                  إعدادات النظام والتهيئة
                </span>
              )}
            </div>
          )}

          {/* 9. المعادلات والقواعد الحسابية */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('formulas')}
              title="المعادلات والقواعد الحسابية"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'formulas' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <Calculator className={`w-4 h-4 shrink-0 ${activeTab === 'formulas' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>المعادلات والقواعد الحسابية</span>}
            </button>
          )}

          {/* 10. قوائم الاختيار (Dropdown lists) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('dropdowns_lists')}
              title="Dropdown lists (قوائم الاختيار)"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dropdowns_lists' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <ListFilter className={`w-4 h-4 shrink-0 ${activeTab === 'dropdowns_lists' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>Dropdown lists (قوائم الاختيار)</span>}
            </button>
          )}

          {/* 11. مركز البريد والرسائل */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('emails')}
              title="مركز البريد والرسائل"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'emails' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <Mail className={`w-4 h-4 shrink-0 ${activeTab === 'emails' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>مركز البريد والرسائل</span>}
            </button>
          )}

          {/* 12. الإعدادات والنسخ الفني */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('settings')}
              title="الإعدادات والنسخ الفني"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/10' 
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400'
              }`}
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-neutral-950' : 'text-amber-400/80'}`} />
              {!isSidebarCollapsed && <span>الإعدادات والنسخ الفني</span>}
            </button>
          )}
        </nav>
        
        {/* User Info & Footer */}
        <div className="p-3.5 border-t border-neutral-900 bg-neutral-950/80">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-400 overflow-hidden border border-amber-300/30 flex items-center justify-center font-black text-[11px] text-neutral-950 shrink-0 shadow-2xs">
                {userDisplayName ? userDisplayName.substring(0, 2).toUpperCase() : 'WD'}
              </div>
              {!isSidebarCollapsed && (
                <div className="text-right min-w-0">
                  <p className="text-xs font-bold leading-tight text-white truncate">{userDisplayName}</p>
                  <button 
                    onClick={() => setShowProfileModal(true)}
                    className="text-[10px] text-amber-400 font-bold hover:text-amber-300 hover:underline block text-right mt-0.5 truncate"
                  >
                    {translateRole(currentUser.role)}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/90 flex items-center justify-between px-6 shrink-0 no-print shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Collapse/Expand Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="p-2 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
              title={isSidebarCollapsed ? "عرض القائمة الجانبية" : "طّي القائمة الجانبية لتوسيع الشاشة"}
            >
              <Menu className="w-4 h-4 text-amber-500" />
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <span className="text-slate-400">اللجنة الحالية:</span>
              <span className="text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/70 font-mono font-black">
                {activeCommitteeFormatted}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="text-slate-400">مرحباً بك،</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
                <User className="w-3.5 h-3.5 text-amber-500" />
                <span>{userDisplayName}</span>
                <span className="bg-amber-400 text-neutral-950 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-2xs">
                  {translateRole(currentUser.role)}
                </span>
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-400 text-neutral-950 shadow-2xs">AR</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">EN</span>
            </div>
            {(currentUser.role === 'sector_manager' || currentUser.role === 'admin') && (
              <button
                type="button"
                onClick={handleExportExcelReport}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 text-amber-400 border border-neutral-800 hover:bg-neutral-850 hover:text-amber-300 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Download className="h-3.5 w-3.5 text-amber-400" />
                <span>تصدير البيانات (Excel)</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content Workspace */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
        
        {/* TAB WORKFLOW INJECTION */}

        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {currentUser?.role === 'admin' && (
              <CommitteeManager 
                user={currentUser}
                committees={committees}
                authToken={authToken || ''}
                onRefresh={fetchAllData}
                showAsModal={false}
              />
            )}
            <Dashboard 
              requests={requests} 
              dropdowns={dropdowns} 
              user={currentUser} 
              filters={dashFilters}
              setFilters={setDashFilters}
              labelNames={labelNames}
            />
          </div>
        )}

        {/* Tab 2: Requests CRUD Section */}
        {activeTab === 'requests' && (
          <>
            {requestViewMode === 'list' && (
              <RequestsList 
                requests={requests} 
                user={currentUser} 
                dropdowns={dropdowns} 
                onEditRequest={(r) => {
                  setEditingRequest(r);
                  setRequestViewMode('edit');
                }}
                onDeleteRequest={handleDeleteRequestPrompt}
                onCreateNew={() => setRequestViewMode('create')}
                onBulkReview={handleBulkReview}
                onBulkDelete={handleBulkDeleteRequestsPrompt}
                onRefresh={fetchAllData}
                onImportExcel={handleBulkImportExcel}
                onExportExcel={handleExportExcelReport}
                onClearAll={handleClearAllRequests}
                labelNames={labelNames}
                onFirstManagerDecision={handleFirstManagerDecision}
                onSendToFirstManager={handleSendToFirstManager}
              />
            )}

            {requestViewMode === 'create' && (
              <RequestForm 
                user={currentUser} 
                dropdowns={dropdowns} 
                existingRequests={requests}
                onSave={handleSaveRequest} 
                onCancel={() => setRequestViewMode('list')}
                labelNames={labelNames}
                customFields={customFields}
              />
            )}

            {requestViewMode === 'edit' && (
              <RequestForm 
                request={editingRequest}
                user={currentUser} 
                dropdowns={dropdowns} 
                existingRequests={requests}
                onSave={handleSaveRequest} 
                onCancel={() => {
                  setRequestViewMode('list');
                  setEditingRequest(null);
                }}
                labelNames={labelNames}
                customFields={customFields}
              />
            )}
          </>
        )}

        {/* Tab: First Manager Approvals & Tasks Hub */}
        {activeTab === 'first_manager_hub' && (
          <FirstManagerHub
            requests={requests}
            user={currentUser}
            dropdowns={dropdowns}
            labelNames={labelNames}
            onRefresh={fetchAllData}
            onExportExcel={handleExportExcelReport}
            onFirstManagerDecision={handleFirstManagerDecision}
            onAttachPdf={handleAttachFirstManagerPdf}
          />
        )}

        {/* Tab 3: Print Hub View */}
        {activeTab === 'print' && (
          <PrintHub 
            request={editingRequest} 
            user={currentUser} 
            onBack={() => {
              setActiveTab('requests');
              setRequestViewMode('list');
              setEditingRequest(null);
            }}
            labelNames={labelNames}
            customFields={customFields}
          />
        )}

        {/* Tab Memo: Memo Printing Center (Admin only) */}
        {activeTab === 'memo' && currentUser.role === 'admin' && (
          <Memo 
            requests={requests}
            request={editingRequest}
            user={currentUser}
            onRefresh={fetchAllData}
            onBack={() => {
              setActiveTab('requests');
              setRequestViewMode('list');
              setEditingRequest(null);
            }}
          />
        )}

        {/* Advance Receipts Center */}
        {activeTab === 'receipts' && currentUser.role !== 'first_manager' && currentUser.username !== 'manager1' && (
          <AdvanceReceipts 
            requests={requests}
            user={currentUser}
            onUpdateReceiptStatus={handleUpdateReceiptStatus}
            labelNames={labelNames}
          />
        )}

        {/* Cancellation Status Management Tab (Admin only) */}
        {activeTab === 'cancellation_status' && currentUser.role === 'admin' && (
          <CancellationStatusManager
            requests={requests}
            user={currentUser}
            dropdowns={dropdowns}
            onRefresh={fetchAllData}
            labelNames={labelNames}
          />
        )}

        {/* Tab 4: Simulated Emails Center */}
        {activeTab === 'emails' && currentUser.role === 'admin' && (
          <EmailTemplates 
            request={editingRequest || requests[0]} 
            user={currentUser}
            onSendSuccess={fetchAllData}
          />
        )}

        {/* Tab 5: System Status Reconciliation & Bank Debts Uploader */}
        {activeTab === 'reconcile' && currentUser.role === 'admin' && (
          <CompanyAndABKDebtsManager
            requests={requests}
            user={currentUser}
            dropdowns={dropdowns}
            authToken={authToken || ''}
            onRefresh={fetchAllData}
            onDownloadTemplate={handleDownloadCompanyDebtsTemplate}
            onImportExcel={handleImportCompanyDebtsExcel}
            onBulkImportRequests={handleBulkImportExcel}
            importSuccessMsg={debtImportSuccess}
          />
        )}

        {/* Formulas Management Tab (Admin only) */}
        {activeTab === 'formulas' && currentUser.role === 'admin' && (
          <FormulasManager
            user={currentUser}
            authToken={authToken || ''}
            onRefreshAll={fetchAllData}
          />
        )}

        {/* Dropdown Lists Management Tab (Admin only) */}
        {activeTab === 'dropdowns_lists' && currentUser.role === 'admin' && (
          <DropdownsManager
            user={currentUser}
            dropdowns={dropdowns}
            dropdownLabels={dropdownLabels}
            onRefreshDropdowns={fetchAllData}
          />
        )}

        {/* Tab 6: Settings panel (Admin only) */}
        {activeTab === 'settings' && currentUser.role === 'admin' && (
          <SettingsPanel 
            user={currentUser} 
            dropdowns={dropdowns}
            dropdownLabels={dropdownLabels} 
            onRefreshDropdowns={fetchAllData}
          />
        )}

      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase shrink-0 no-print flex-row-reverse">
        <div className="flex gap-4 flex-row-reverse">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> 
            قاعدة البيانات متصلة (Database Connected)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 
            المزامنة تامة (Sync Complete)
          </span>
        </div>
        <div>نظام إلغاء العضويات وادى دجلة v1.0.42 — Powered by DeepMind</div>
      </footer>
    </main>

      {/* --- PROFILE / PASSWORD CHANGE MODAL --- */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-1.5">
              <Users className="h-5 w-5 text-amber-500" />
              إدارة ملف المستخدم الحالي والتوقيع
            </h3>

            {profileSuccess && (
              <div className="p-3 bg-amber-400/10 text-amber-600 rounded-lg text-xs font-bold">
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs">
                {profileError}
              </div>
            )}

            {/* Profile Signature Manager (For Sector Manager only) */}
            {currentUser.role === 'sector_manager' && (
              <div className="space-y-2.5 border-b pb-4">
                <span className="block text-xxs font-bold text-slate-500">الختم الإلكتروني والتوقيع الرقمي (PNG شفاف)</span>
                <p className="text-[10px] text-slate-400 leading-normal">ارفع صورة توقيعك الشخصي باللون الأزرق المفرغ (الخلفية شفافة). سيقوم النظام بلصقها فوراً على أي مذكرة صرف فنية تعتمدها.</p>
                
                {signatureFile ? (
                  <div className="relative border p-2 rounded-xl flex items-center justify-center bg-slate-50">
                    <img src={signatureFile} alt="Signature Uploaded" className="max-h-16 mix-blend-multiply" />
                    <button
                      onClick={() => setSignatureFile(null)}
                      className="absolute top-1 right-1 p-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[9px] font-bold"
                    >
                      إزالة التوقيع
                    </button>
                  </div>
                ) : (
                  <label className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer block text-center">
                    <span>رفع التوقيع الشخصي</span>
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Password Changer */}
            <form onSubmit={handleProfilePasswordChange} className="space-y-3 text-xs">
              <span className="block text-xxs font-bold text-slate-500">تعديل وتحديث كلمة المرور الخاصة بك:</span>
              
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">كلمة المرور الحالية</label>
                <input
                  type="password"
                  required
                  value={profileCurrentPassword}
                  onChange={(e) => setProfileCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={profileNewPassword}
                  onChange={(e) => setProfileNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">تأكيد كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={profileConfirmPassword}
                  onChange={(e) => setProfileConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black rounded-lg cursor-pointer transition-all shadow"
              >
                تحديث كلمة المرور
              </button>
            </form>

            <button
              onClick={() => {
                setShowProfileModal(false);
                setProfileError('');
                setProfileSuccess('');
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs rounded-lg cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* --- ADMIN LOGIN COMMITTEE APPROVAL PROMPT MODAL --- */}
      {showLoginCommitteePrompt && currentUser?.role === 'admin' && (
        <CommitteeManager 
          user={currentUser}
          committees={committees}
          authToken={authToken || ''}
          onRefresh={fetchAllData}
          showAsModal={true}
          onCloseModal={() => setShowLoginCommitteePrompt(false)}
        />
      )}

      {/* Request Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModalState.isOpen}
        title="تأكيد حذف طلب إلغاء العضوية"
        message={`هل أنت متأكد تماماً من رغبتك في حذف طلب المشترك "${deleteModalState.memberName}" (رقم العضوية: ${deleteModalState.membershipNumber}) نهائياً من قاعدة البيانات والمنظومة؟\n\nتنبيه: لا يمكن التراجع عن هذه العملية بعد إتمامها.`}
        confirmText="نعم، حذف الطلب نهائياً"
        cancelText="إلغاء الأمر"
        type="danger"
        icon="trash"
        isLoading={deleteModalState.isLoading}
        onConfirm={executeDeleteRequest}
        onClose={() => setDeleteModalState({ isOpen: false, requestId: null, memberName: '', membershipNumber: '', isLoading: false })}
      />

      {/* Bulk Requests Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={bulkDeleteModalState.isOpen}
        title={`تأكيد مسح (${bulkDeleteModalState.ids.length}) طلبات محددة`}
        message={`هل أنت متأكد تماماً من رغبتك في حذف عدد (${bulkDeleteModalState.ids.length}) طلب/طلبات من التحديد نهائياً من قاعدة البيانات والمنظومة؟\n\nتنبيه: لا يمكن التراجع عن هذه العملية بعد إتمامها.`}
        confirmText={`نعم، مسح ${bulkDeleteModalState.ids.length} طلبات نهائياً`}
        cancelText="إلغاء الأمر"
        type="danger"
        icon="trash"
        isLoading={bulkDeleteModalState.isLoading}
        onConfirm={executeBulkDeleteRequest}
        onClose={() => setBulkDeleteModalState({ isOpen: false, ids: [], isLoading: false })}
      />

      {/* First Manager Decision Modal */}
      <FirstManagerDecisionModal
        isOpen={!!firstManagerModalRequest}
        request={firstManagerModalRequest}
        onClose={() => setFirstManagerModalRequest(null)}
        onDecision={handleFirstManagerDecision}
        onOpenStatement={(req) => setStatementModalRequest(req)}
        onOpenPDF={(req) => setFirstManagerPdfModalRequest(req)}
        isSubmitting={isSubmittingFirstManagerModal}
      />

      {/* Statement Modal */}
      <SettlementStatementModal
        isOpen={!!statementModalRequest}
        request={statementModalRequest}
        onClose={() => setStatementModalRequest(null)}
      />

      {/* First Manager PDF Documents & Review Modal */}
      <FirstManagerPDFModal
        isOpen={!!firstManagerPdfModalRequest}
        request={firstManagerPdfModalRequest}
        user={currentUser}
        onClose={() => setFirstManagerPdfModalRequest(null)}
        onOpenStatement={(req) => setStatementModalRequest(req)}
        onOpenDecision={(req) => setFirstManagerModalRequest(req)}
        onAttachPdf={handleAttachFirstManagerPdf}
      />

      {/* Send / Upload PDF to First Manager Modal (Admin) */}
      <SendToFirstManagerModal
        isOpen={!!sendToFirstManagerTarget}
        request={sendToFirstManagerTarget}
        onClose={() => setSendToFirstManagerTarget(null)}
        onSend={handleExecuteSendToFirstManager}
        isSubmitting={isSendingToFirstManager}
      />
    </div>
  );
}
