import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, FileText, Image as ImageIcon, Download, Eye, Trash2, Upload, RefreshCw,
  Lock, Unlock, Filter, Layers, LayoutGrid, LayoutList, Calendar, User, Building,
  AlertCircle, CheckCircle2, ShieldCheck, ExternalLink, ShieldAlert, ArrowUpDown,
  Plus, Check, X, FileCheck, Tag, Info, Paperclip, RotateCcw, Printer, Pin
} from 'lucide-react';
import { RequestAttachment } from '../types';
import { formatDateCustom, formatCommitteeWithYear } from '../utils';
import { useFilterVisibility } from '../hooks/useFilterVisibility';
import DocumentViewerModal from './DocumentViewerModal';
import UploadDocumentModal from './UploadDocumentModal';

interface AttachmentsArchiveProps {
  currentUser?: any;
  user?: any;
  dropdowns?: any;
  onNavigateToRequest?: (requestId: number | string) => void;
  onRequestViewDetails?: (request: any) => void;
  onRefreshRequests?: () => void;
}

// The dedicated document category for revocation requests ("طلب التراجع"),
// used to drive the dedicated tab in this archive page.
const REVOCATION_CATEGORY = 'طلب التراجع';

export default function AttachmentsArchive({
  currentUser,
  user,
  dropdowns,
  onNavigateToRequest,
  onRequestViewDetails,
  onRefreshRequests
}: AttachmentsArchiveProps) {
  const activeUser = currentUser || user;
  const { visible: filtersVisible, pinned: filtersPinned, toggleVisible: toggleFiltersVisible, togglePinned: toggleFiltersPinned } = useFilterVisibility('attachments-archive', activeUser?.username);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClub, setSelectedClub] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFileType, setSelectedFileType] = useState<'all' | 'pdf' | 'image'>('all');
  const [selectedLockStatus, setSelectedLockStatus] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modals
  const [activeViewerAttachment, setActiveViewerAttachment] = useState<any | null>(null);
  const [activeUploadTarget, setActiveUploadTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all attachments
  const fetchAllAttachments = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('wd_token') || '';
      const res = await fetch('/api/attachments/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('فشل جلب أرشيف المرفقات من الخادم');
      }
      const data = await res.json();
      setAttachments(data.attachments || []);
    } catch (err: any) {
      console.error('Error fetching attachments archive:', err);
      setErrorMessage(err.message || 'تعذر تحميل المستندات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAttachments();
  }, []);

  // Filtered & Sorted Attachments
  const filteredAttachments = useMemo(() => {
    return attachments.filter(item => {
      // 1. Text Search (Member Name, Membership #, National ID, External ID, File Name, Uploader, Notes, Request ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const memNum = String(item.membershipNumber || '').toLowerCase();
        const memName = String(item.memberName || '').toLowerCase();
        const natId = String(item.nationalId || '').toLowerCase();
        const extId = String(item.externalId || '').toLowerCase();
        const fName = String(item.fileName || '').toLowerCase();
        const uploader = String(item.uploaderName || item.uploadedBy || '').toLowerCase();
        const notes = String(item.notes || '').toLowerCase();
        const reqId = String(item.requestId || '');

        const matches = memNum.includes(q) || 
          memName.includes(q) || 
          natId.includes(q) || 
          extId.includes(q) || 
          fName.includes(q) || 
          uploader.includes(q) || 
          notes.includes(q) || 
          reqId.includes(q);

        if (!matches) return false;
      }

      // 2. Club filter
      if (selectedClub !== 'all') {
        const clubStr = String(item.club || '').trim();
        if (clubStr !== selectedClub) return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      } else {
        // "كل المستندات" tab: revocation-request documents live only in
        // their own dedicated tab, so exclude them from the general view.
        if (item.category === REVOCATION_CATEGORY) return false;
      }

      // 4. File Type filter
      if (selectedFileType === 'pdf') {
        const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf');
        if (!isPdf) return false;
      } else if (selectedFileType === 'image') {
        const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf');
        if (isPdf) return false;
      }

      // 5. Lock / Review Status filter
      if (selectedLockStatus === 'locked' && !item.isLocked) return false;
      if (selectedLockStatus === 'unlocked' && item.isLocked) return false;

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.uploadedAt || 0).getTime();
      const timeB = new Date(b.uploadedAt || 0).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [attachments, searchQuery, selectedClub, selectedCategory, selectedFileType, selectedLockStatus, sortOrder]);

  // One row per request (membership) for the table view -- each row carries
  // the list of documents attached to that request, shown together in the
  // "نوع المستند" cell instead of one table row per document.
  const groupedRequestRows = useMemo(() => {
    const byRequest = new Map<string, any>();
    filteredAttachments.forEach(item => {
      const key = String(item.requestId ?? item.id);
      if (!byRequest.has(key)) {
        byRequest.set(key, {
          requestId: item.requestId,
          membershipNumber: item.membershipNumber,
          memberName: item.memberName,
          club: item.club,
          committeeNo: item.committeeNo,
          committeeYear: item.committeeYear,
          isLocked: item.isLocked,
          documents: []
        });
      }
      byRequest.get(key).documents.push(item);
    });
    return Array.from(byRequest.values());
  }, [filteredAttachments]);

  // Statistics calculation.
  // "طلب التراجع" documents are excluded from the general (non-revocation)
  // counts so the top stats cards and the "كل المستندات" tab badge reflect
  // only what actually shows up in that tab -- revocation docs get their
  // own separate count instead.
  const stats = useMemo(() => {
    let totalCount = 0;
    let pdfCount = 0;
    let imageCount = 0;
    let lockedCount = 0;
    let revocationCount = 0;
    const uniqueReqs = new Set();

    attachments.forEach(item => {
      if (item.category === REVOCATION_CATEGORY) {
        revocationCount++;
        return;
      }
      totalCount++;
      const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf');
      if (isPdf) pdfCount++;
      else imageCount++;
      if (item.isLocked) lockedCount++;
      if (item.requestId) uniqueReqs.add(item.requestId);
    });

    return {
      totalCount,
      pdfCount,
      imageCount,
      lockedCount,
      unlockedCount: totalCount - lockedCount,
      requestsCount: uniqueReqs.size,
      revocationCount
    };
  }, [attachments]);

  // Handle Attachment Deletion
  const handleDeleteAttachment = async (itemToDelete: any) => {
    if (!itemToDelete) return;

    if (currentUser?.role !== 'admin' && itemToDelete.isLocked) {
      setErrorMessage('لا يمكن حذف المستند بعد اعتماده - الحذف بعد الاعتماد متاح للأدمن فقط.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('wd_token') || '';
      const res = await fetch(`/api/requests/${itemToDelete.requestId}/attachments/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل حذف المستند المرفق');
      }

      setSuccessMessage(`تم حذف المستند (${itemToDelete.fileName}) بنجاح`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setDeleteTarget(null);
      fetchAllAttachments();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف المستند');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (item: any) => {
    try {
      const link = document.createElement('a');
      link.href = item.fileData;
      link.download = item.fileName || 'مستند_طلب_إلغاء';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handlePrint = (item: any) => {
    try {
      const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf') || String(item.fileData).startsWith('data:application/pdf');

      if (isPdf) {
        // Chrome's native PDF viewer (rendered out-of-process) doesn't
        // reliably respond to a script-triggered print() call on a freshly
        // created iframe -- opening it directly is the only reliable way
        // to reach its own (working) print icon, without needing to click
        // through this list into the preview modal first.
        const win = window.open(item.fileData, '_blank');
        win?.focus();
        return;
      }

      // Images: print via a hidden iframe injected into the current page,
      // instead of opening a new tab/window -- stays on the same page;
      // only the browser's native print dialog appears.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      };

      iframe.srcdoc = `
        <html>
          <head>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${item.fileData}" onload="window.focus();window.print();" />
          </body>
        </html>
      `;

      window.addEventListener('focus', cleanup, { once: true });
      setTimeout(cleanup, 60000);
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Categories list from existing attachments
  const availableCategories = useMemo(() => {
    const defaultCategories = (dropdowns?.documentTypes && dropdowns.documentTypes.length > 0)
      ? dropdowns.documentTypes
      : [
        'طلب الإلغاء الموقع',
        'صورة بطاقة الرقم القومي',
        'إيصال سداد / مخالصة',
        'إقرار وتنازل معتمد',
        'تقرير طبي / مستندات استثناء',
        'ملف مراجعة الإدارة المالية',
        'شيكات / مستندات بنكية',
        'أخرى'
      ];
    const fromData = Array.from(new Set(attachments.map(a => a.category).filter(Boolean)));
    return Array.from(new Set([...defaultCategories, ...fromData]));
  }, [attachments, dropdowns]);

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Header section */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/70">
            <Paperclip className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {selectedCategory === REVOCATION_CATEGORY ? 'أرشيف طلبات التراجع' : 'أرشيف المستندات والمرفقات'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {selectedCategory === REVOCATION_CATEGORY ? stats.revocationCount : stats.totalCount} مستند
              </span>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={toggleFiltersVisible}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${filtersVisible ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            title={filtersVisible ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>فلاتر</span>
          </button>
          <button
            type="button"
            onClick={toggleFiltersPinned}
            className={`flex items-center justify-center p-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${filtersPinned ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
            title={filtersPinned ? 'إلغاء تثبيت حالة الفلاتر' : 'تثبيت حالة الفلاتر (ظاهرة/مخفية) لزياراتك القادمة'}
          >
            <Pin className={`w-3.5 h-3.5 ${filtersPinned ? 'fill-sky-700' : ''}`} />
          </button>
          <button
            type="button"
            onClick={fetchAllAttachments}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Dedicated Tabs: All Documents / Revocation Requests */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCategory !== REVOCATION_CATEGORY ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>كل المستندات</span>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">{stats.totalCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory(REVOCATION_CATEGORY)}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === REVOCATION_CATEGORY ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>طلبات التراجع</span>
            <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-mono">{stats.revocationCount}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      {filtersVisible && (
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم العضوية، اسم العضو، الرقم القومي، اسم الملف، المرفوع بواسطة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/80 text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Club Filter */}
          <div>
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/80 cursor-pointer"
            >
              <option value="all">النادي</option>
              {(dropdowns?.clubs || []).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/80 cursor-pointer"
            >
              <option value="all">جميع تصنيفات المستندات</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort & View Mode Row */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2.5">
            {/* Sorting */}
            <div className="flex items-center gap-1 text-slate-500">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent border-0 text-slate-700 font-bold text-[11px] focus:ring-0 cursor-pointer"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
                title="معرض البطاقات"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
                title="جدول تفصيلي"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Attachments Content View */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">جاري تحميل وتجميع أرشيف المرفقات من كافة الفروع...</p>
        </div>
      ) : filteredAttachments.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="p-4 bg-slate-100 text-slate-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">لا توجد مرفقات مطابقة لخيارات البحث</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedClub !== 'all' || selectedCategory !== 'all' 
              ? 'جرّب تعديل كلمات البحث أو تصفية الفروع لإظهار المزيد من النتائج.'
              : 'لم يتم رفع أي مستندات أو استمارات إلغاء بالمنظومة حتى الآن.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* --- Grid / Gallery View --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredAttachments.map((item) => {
            const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf');
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col overflow-hidden group"
              >
                {/* Visual Thumbnail Area */}
                <div 
                  onClick={() => setActiveViewerAttachment(item)}
                  className="h-40 bg-slate-50 relative overflow-hidden flex items-center justify-center cursor-pointer border-b border-slate-100 group-hover:bg-slate-100/70 transition-colors"
                >
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                        <FileText className="w-8 h-8" />
                      </div>
                      <span className="mt-1.5 text-[10px] font-bold text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded">
                        مستند PDF
                      </span>
                    </div>
                  ) : item.fileData ? (
                    <img
                      src={item.fileData}
                      alt={item.fileName}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  )}

                  {/* Badges on Thumbnail */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/75 text-white backdrop-blur-xs">
                      {item.category || 'مستند'}
                    </span>
                    {item.isLocked ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/90 text-white flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        معتمد
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-slate-950 flex items-center gap-1">
                        <Unlock className="w-2.5 h-2.5" />
                        قيد المراجعة
                      </span>
                    )}
                  </div>

                  {/* Hover Overlay Button */}
                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveViewerAttachment(item); }}
                      className="px-3 py-1.5 bg-white text-slate-900 rounded-xl shadow-md font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة</span>
                    </button>
                  </div>
                </div>

                {/* Card Info Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                  <div>
                    <h4 
                      onClick={() => setActiveViewerAttachment(item)}
                      className="text-xs font-bold text-slate-800 line-clamp-1 hover:text-amber-600 cursor-pointer" 
                      title={item.fileName}
                    >
                      {item.fileName}
                    </h4>

                    {/* Member & Club Info */}
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">رقم العضوية:</span>
                        <strong className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-xs">
                          {item.membershipNumber || '—'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">اسم المشترك:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[130px]">{item.memberName || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">الفرع:</span>
                        <span className="font-semibold text-slate-700">{item.club || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">تاريخ الرفع:</span>
                        <span className="text-slate-500">{formatDateCustom(item.uploadedAt)}</span>
                      </div>
                    </div>

                    {item.notes && (
                      <p className="mt-2 p-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[10px] text-slate-600 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveViewerAttachment(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="معاينة"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => isAdmin ? handleDownload(item) : handlePrint(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title={isAdmin ? "تحميل الملف" : "طباعة الملف"}
                      >
                        {isAdmin ? <Download className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveUploadTarget({ id: item.requestId, membershipNumber: item.membershipNumber, memberName: item.memberName, club: item.club, reviewed: item.isLocked })}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="إضافة مستند لنفس الطلب"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Delete Action -- any user before review, admin always */}
                    <div>
                      {(isAdmin || !item.isLocked) ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف المستند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div 
                          className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                          title="لا يمكن الحذف بعد اعتماد المستند - متاح للأدمن فقط"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- Structured Table View --- */
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">م</th>
                  <th className="py-2.5 px-3">رقم العضوية</th>
                  <th className="py-2.5 px-3">الاسم</th>
                  <th className="py-2.5 px-3">النادي</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">رقم اللجنة (السنة)</th>
                  <th className="py-2.5 px-3">نوع المستند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {groupedRequestRows.map((row, idx) => (
                  <tr key={row.requestId ?? idx} className="hover:bg-slate-50/60 transition-colors align-top">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {row.membershipNumber || '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {row.memberName || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-semibold">
                      {row.club || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-semibold whitespace-nowrap">
                      {formatCommitteeWithYear(row.committeeNo, row.committeeYear)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.documents.map((doc: any) => {
                          const docIsPdf = doc.fileType === 'application/pdf' || String(doc.fileName).toLowerCase().endsWith('.pdf');
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => setActiveViewerAttachment(doc)}
                              title={doc.fileName}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors max-w-[170px] ${docIsPdf ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                            >
                              {docIsPdf ? <FileText className="w-3.5 h-3.5 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{doc.category || doc.fileName}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setActiveUploadTarget({ id: row.requestId, membershipNumber: row.membershipNumber, memberName: row.memberName, club: row.club, reviewed: row.isLocked })}
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="إضافة مستند"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {activeViewerAttachment && (
        <DocumentViewerModal
          attachment={activeViewerAttachment}
          onClose={() => setActiveViewerAttachment(null)}
          canDelete={isAdmin || !activeViewerAttachment.isLocked}
          isAdmin={isAdmin}
          onDelete={() => {
            const target = activeViewerAttachment;
            setActiveViewerAttachment(null);
            handleDeleteAttachment(target);
          }}
        />
      )}

      {/* Upload Extra Documents Modal */}
      {activeUploadTarget && (
        <UploadDocumentModal
          request={activeUploadTarget}
          currentUser={currentUser}
          dropdowns={dropdowns}
          onClose={() => setActiveUploadTarget(null)}
          onUploadSuccess={() => {
            setSuccessMessage('تم رفع وإضافة المستندات الجديدة بنجاح إلى الأرشيف');
            setTimeout(() => setSuccessMessage(''), 4000);
            fetchAllAttachments();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-5 border border-slate-200 text-right space-y-4 font-sans" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تأكيد حذف المستند المرفق</h3>
                <p className="text-xs text-slate-500 mt-0.5">هل أنت متأكد من رغبتك في حذف هذا المستند؟</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div><strong>اسم الملف:</strong> <span className="text-slate-800">{deleteTarget.fileName}</span></div>
              <div><strong>رقم العضوية:</strong> <span className="font-mono font-bold text-slate-900">{deleteTarget.membershipNumber}</span></div>
              <div><strong>اسم العضو:</strong> <span>{deleteTarget.memberName}</span></div>
              <div><strong>الفرع:</strong> <span className="text-amber-800 font-bold">{deleteTarget.club}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAttachment(deleteTarget)}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
