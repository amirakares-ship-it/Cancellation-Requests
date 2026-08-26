import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, FileText, Image as ImageIcon, Download, Eye, Trash2, Upload, RefreshCw,
  Lock, Unlock, Filter, Layers, LayoutGrid, LayoutList, Calendar, User, Building,
  AlertCircle, CheckCircle2, ShieldCheck, ExternalLink, ShieldAlert, ArrowUpDown,
  Plus, Check, X, FileCheck, Tag, Info, Paperclip
} from 'lucide-react';
import { RequestAttachment } from '../types';
import { formatDateCustom } from '../utils';
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

export default function AttachmentsArchive({
  currentUser,
  user,
  dropdowns,
  onNavigateToRequest,
  onRequestViewDetails,
  onRefreshRequests
}: AttachmentsArchiveProps) {
  const activeUser = currentUser || user;
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = attachments.length;
    let pdfCount = 0;
    let imageCount = 0;
    let lockedCount = 0;
    const uniqueReqs = new Set();

    attachments.forEach(item => {
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
      requestsCount: uniqueReqs.size
    };
  }, [attachments]);

  // Handle Attachment Deletion
  const handleDeleteAttachment = async (itemToDelete: any) => {
    if (!itemToDelete) return;

    if (itemToDelete.isLocked && currentUser?.role !== 'admin') {
      setErrorMessage('لا يمكن حذف هذا المستند نظراً لاعتماد مراجعة الأدمن للطلب لحماية السجلات الرسمية.');
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Categories list from existing attachments
  const availableCategories = useMemo(() => {
    const defaultCategories = [
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
  }, [attachments]);

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
              <h2 className="text-lg font-black text-slate-900">أرشيف المستندات والمرفقات</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {stats.totalCount} مستند
              </span>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

      {/* Calm & Organized Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Card 1: Total */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-slate-400 text-[11px] font-bold">إجمالي المستندات</div>
          <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{stats.totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">كافة الفروع</div>
        </div>

        {/* Card 2: PDF */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-[11px] font-bold flex items-center gap-1">
            <FileText className="w-3 h-3 text-rose-500" />
            <span>ملفات PDF</span>
          </div>
          <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{stats.pdfCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">مستندات رقمية</div>
        </div>

        {/* Card 3: Images */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-[11px] font-bold flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-blue-500" />
            <span>صور مستندات</span>
          </div>
          <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{stats.imageCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">بطاقات وإيصالات</div>
        </div>

        {/* Card 4: Unique Requests */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-[11px] font-bold flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-600" />
            <span>طلبات موثقة</span>
          </div>
          <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{stats.requestsCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">طلب إلغاء</div>
        </div>

        {/* Card 5: Locked (Reviewed) */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>معتمد ومحمي</span>
          </div>
          <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">{stats.lockedCount}</div>
          <div className="text-[10px] text-emerald-600/70 mt-0.5">بعد المراجعة 🔒</div>
        </div>

        {/* Card 6: Unlocked */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-slate-600 text-[11px] font-bold flex items-center gap-1">
            <Unlock className="w-3 h-3 text-amber-500" />
            <span>قيد المراجعة</span>
          </div>
          <div className="text-lg font-black text-slate-800 font-mono mt-0.5">{stats.unlockedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">قابل للحذف 🔓</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
              <option value="all">جميع الفروع والأندية</option>
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

        {/* Secondary Filter Row: File Type, Lock Status, Sort & View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold text-[11px]">النوع:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedFileType('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${selectedFileType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileType('pdf')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${selectedFileType === 'pdf' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <FileText className="w-3 h-3 text-rose-500" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileType('image')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${selectedFileType === 'image' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <ImageIcon className="w-3 h-3 text-blue-500" />
                صور
              </button>
            </div>

            <span className="text-slate-400 font-bold text-[11px] mr-2">المراجعة:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedLockStatus('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${selectedLockStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setSelectedLockStatus('locked')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${selectedLockStatus === 'locked' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Lock className="w-2.5 h-2.5 text-emerald-600" />
                معتمد
              </button>
              <button
                type="button"
                onClick={() => setSelectedLockStatus('unlocked')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${selectedLockStatus === 'unlocked' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Unlock className="w-2.5 h-2.5 text-amber-500" />
                قيد المراجعة
              </button>
            </div>
          </div>

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
                        onClick={() => handleDownload(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="تحميل الملف"
                      >
                        <Download className="w-3.5 h-3.5" />
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

                    {/* Delete Action */}
                    <div>
                      {item.isLocked && currentUser?.role !== 'admin' ? (
                        <div 
                          className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                          title="تمت مراجعة الطلب (Reviewed) - المستند محمي ولا يمكن حذفه"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={item.isLocked ? "حذف المستند (صلاحية الأدمن)" : "حذف المستند"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                  <th className="py-2.5 px-3 text-center w-12">نوع</th>
                  <th className="py-2.5 px-3">اسم الملف</th>
                  <th className="py-2.5 px-3">التصنيف</th>
                  <th className="py-2.5 px-3">رقم العضوية</th>
                  <th className="py-2.5 px-3">اسم المشترك</th>
                  <th className="py-2.5 px-3">الفرع</th>
                  <th className="py-2.5 px-3">تاريخ الرفع</th>
                  <th className="py-2.5 px-3">المستخدم</th>
                  <th className="py-2.5 px-3 text-center">المراجعة</th>
                  <th className="py-2.5 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAttachments.map((item) => {
                  const isPdf = item.fileType === 'application/pdf' || String(item.fileName).toLowerCase().endsWith('.pdf');
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex p-1 rounded-lg bg-slate-100">
                          {isPdf ? <FileText className="w-3.5 h-3.5 text-rose-500" /> : <ImageIcon className="w-3.5 h-3.5 text-blue-500" />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[200px] truncate" title={item.fileName}>
                        <button
                          type="button"
                          onClick={() => setActiveViewerAttachment(item)}
                          className="hover:text-amber-600 cursor-pointer truncate text-right block font-bold"
                        >
                          {item.fileName}
                        </button>
                        <span className="text-[10px] text-slate-400 font-normal">{formatFileSize(item.fileSize)}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                          {item.category || 'أخرى'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {item.membershipNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {item.memberName || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-semibold">
                        {item.club || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-normal">
                        {formatDateCustom(item.uploadedAt)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {item.uploaderName || item.uploadedBy || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="تمت مراجعة الطلب (Reviewed) - المستند محمي">
                            <Lock className="w-2.5 h-2.5" />
                            <span>معتمد</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="قيد المراجعة - يمكن حذفه إذا رفع بالخطأ">
                            <Unlock className="w-2.5 h-2.5" />
                            <span>قيد المراجعة</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveViewerAttachment(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="معاينة فورية"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="تحميل"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveUploadTarget({ id: item.requestId, membershipNumber: item.membershipNumber, memberName: item.memberName, club: item.club, reviewed: item.isLocked })}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="إضافة مستند"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {item.isLocked && currentUser?.role !== 'admin' ? (
                            <span 
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="محمي بعد المراجعة - لا يمكن حذفه"
                            >
                              <Lock className="w-3 h-3" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={item.isLocked ? "حذف المستند (صلاحية الأدمن)" : "حذف المستند"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          canDelete={currentUser?.role === 'admin' || !activeViewerAttachment.isLocked}
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
