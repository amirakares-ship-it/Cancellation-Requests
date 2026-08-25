import React, { useState } from 'react';
import { 
  ListFilter, Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, Layers, Sparkles
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface DropdownsManagerProps {
  user: any;
  dropdowns: any;
  dropdownLabels?: Record<string, string>;
  onRefreshDropdowns: () => void;
}

export default function DropdownsManager({
  user,
  dropdowns,
  dropdownLabels = {},
  onRefreshDropdowns
}: DropdownsManagerProps) {
  const [authToken] = useState(localStorage.getItem('wd_token') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('membershipTypes');

  // Confirm Modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isLoading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'حذف',
    isLoading: false,
    onConfirm: async () => {},
  });

  // New option & rename states
  const [newOption, setNewOption] = useState('');
  const [renameOldOption, setRenameOldOption] = useState('');
  const [renameNewOption, setRenameNewOption] = useState('');
  const [dropdownSuccess, setDropdownSuccess] = useState('');

  // Create Category Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryInitialOption, setNewCategoryInitialOption] = useState('');
  const [createCategoryError, setCreateCategoryError] = useState('');

  const defaultLabels: Record<string, string> = {
    clubs: 'نادي الفرع',
    membershipTypes: 'نوع العضوية',
    paymentMethods: 'طريقة الدفع',
    cancellationReasons: 'سبب الإلغاء',
    committeeResults: 'قرار اللجنة (Accepted & Rejected)',
    cancellationStatuses: 'حالة الإلغاء (Pending & Cancelled & Revoked & Deletion)',
    exceptions: 'الاستثناءات (حالة انسانية & جهة سيادية & حل مشكلة & بدون رد اى مبلغ)',
  };

  const coreCategories = [
    'membershipTypes',
    'clubs',
    'paymentMethods',
    'cancellationReasons',
    'committeeResults',
    'cancellationStatuses',
    'exceptions'
  ];

  // Add Option to Category
  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownSuccess('');
    if (!newOption.trim()) return;

    try {
      const res = await fetch(`/api/dropdowns/${selectedCategory}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ option: newOption.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const catLabel = dropdownLabels[selectedCategory] || defaultLabels[selectedCategory] || selectedCategory;
        setDropdownSuccess(`تمت إضافة "${newOption.trim()}" لقائمة ${catLabel} بنجاح`);
        setNewOption('');
        onRefreshDropdowns();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Rename Option
  const handleRenameOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownSuccess('');
    if (!renameOldOption || !renameNewOption.trim()) return;

    try {
      const res = await fetch(`/api/dropdowns/${selectedCategory}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          oldOption: renameOldOption,
          newOption: renameNewOption.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDropdownSuccess(`تم تعديل الخيار إلى "${renameNewOption.trim()}" بنجاح`);
        setRenameOldOption('');
        setRenameNewOption('');
        onRefreshDropdowns();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Option
  const handleDeleteOption = (opt: string) => {
    setConfirmState({
      isOpen: true,
      title: 'حذف خيار من القائمة',
      message: `هل أنت متأكد من رغبتك في حذف الخيار "${opt}" من هذه القائمة؟`,
      confirmText: 'حذف الخيار',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/dropdowns/${selectedCategory}?option=${encodeURIComponent(opt)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            setDropdownSuccess(`تم حذف الخيار "${opt}" بنجاح`);
            onRefreshDropdowns();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Create New Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateCategoryError('');
    if (!newCategoryLabel.trim()) {
      setCreateCategoryError('يرجى إدخال اسم القائمة بالعربية');
      return;
    }

    try {
      const res = await fetch('/api/dropdowns/categories/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          categoryLabel: newCategoryLabel.trim(),
          categoryKey: newCategoryKey.trim() || undefined,
          initialOption: newCategoryInitialOption.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDropdownSuccess(`تم إنشاء قائمة "${newCategoryLabel.trim()}" بنجاح!`);
        setShowCreateModal(false);
        setNewCategoryLabel('');
        setNewCategoryKey('');
        setNewCategoryInitialOption('');
        onRefreshDropdowns();
        const keys = Object.keys(data.dropdowns || {});
        if (keys.length > 0) {
          setSelectedCategory(keys[keys.length - 1]);
        }
      } else {
        setCreateCategoryError(data.error || 'حدث خطأ أثناء إنشاء القائمة');
      }
    } catch (err) {
      console.error(err);
      setCreateCategoryError('تعذر الاتصال بالسيرفر');
    }
  };

  // Delete Category
  const handleDeleteCategory = (catKey: string) => {
    const catLabel = dropdownLabels[catKey] || defaultLabels[catKey] || catKey;
    setConfirmState({
      isOpen: true,
      title: 'حذف قائمة اختيار بالكامل',
      message: `هل أنت متأكد من حذف قائمة الاختيار بالكامل "${catLabel}"؟`,
      confirmText: 'حذف القائمة',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/dropdowns/categories/${catKey}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            setDropdownSuccess(`تم حذف القائمة بنجاح`);
            setSelectedCategory('membershipTypes');
            onRefreshDropdowns();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const allCategories = Object.keys(dropdowns || {});

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-950 via-slate-900 to-neutral-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-amber-500/30">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-400 text-neutral-950 rounded-xl font-black">
                <ListFilter className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black text-white">إدارة قوائم الاختيار (Dropdown Lists)</h2>
            </div>
            <p className="text-xs text-slate-300">
              التحكم في جميع القوائم المنسدلة بالمشروع: نوع العضوية، نادي الفرع، طريقة الدفع، سبب الإلغاء، قرار اللجنة، حالة الإلغاء، الاستثناءات، وإمكانية إضافة قوائم مخصصة جديدة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateCategoryError('');
              setShowCreateModal(true);
            }}
            className="py-3 px-5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-amber-400/20 flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة قائمة Dropdown جديدة</span>
          </button>
        </div>
      </div>

      {dropdownSuccess && (
        <div className="p-4 bg-amber-400/10 border-r-4 border-amber-500 text-amber-900 text-xs font-bold rounded-2xl flex items-center gap-3">
          <Check className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{dropdownSuccess}</span>
        </div>
      )}

      {/* Category Pills Navigation */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-black text-slate-800">اختر القائمة المراد تعديلها وإدارتها:</span>
          <span className="text-[11px] text-slate-400">إجمالي القوائم: {allCategories.length}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {allCategories.map((catKey) => {
            const label = dropdownLabels[catKey] || defaultLabels[catKey] || catKey;
            const isSelected = selectedCategory === catKey;
            const isCore = coreCategories.includes(catKey);

            return (
              <div key={catKey} className="flex items-center">
                <button
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-4 py-2.5 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected 
                      ? 'bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/20' 
                      : 'bg-slate-50 border border-slate-200/80 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected ? 'bg-neutral-950/20 text-neutral-950 font-bold' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {dropdowns[catKey]?.length || 0}
                  </span>
                </button>
                {!isCore && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(catKey)}
                    className="mr-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف هذه القائمة بالكامل"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Panel 1: Add New Option */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="h-5 w-5 text-amber-500" />
            <h3 className="font-black text-slate-800 text-xs">إضافة خيار جديد إلى القائمة</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            أدخل الخيار الجديد ليظهر فوراً في كافة النماذج والجداول التابعة للقائمة المحددة ({dropdownLabels[selectedCategory] || defaultLabels[selectedCategory] || selectedCategory}).
          </p>

          <form onSubmit={handleAddOption} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم أو البيان الجديد:</label>
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="أدخل النص الجديد هنا..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md shadow-amber-400/20 transition-all cursor-pointer"
            >
              إدراج الخيار
            </button>
          </form>
        </div>

        {/* Panel 2: Edit / Rename Existing Option */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Edit2 className="h-5 w-5 text-amber-500" />
            <h3 className="font-black text-slate-800 text-xs">تعديل وإعادة تسمية خيار حالي</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            تحديث اسم خيار موجود لتعديل مسميات البيانات تلقائياً.
          </p>

          <form onSubmit={handleRenameOption} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اختر الخيار المراد تعديله:</label>
              <select
                value={renameOldOption}
                onChange={(e) => setRenameOldOption(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- اختر الخيار --</option>
                {dropdowns[selectedCategory]?.map((o: string) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم المعدل الجديد:</label>
              <input
                type="text"
                value={renameNewOption}
                onChange={(e) => setRenameNewOption(e.target.value)}
                placeholder="الاسم الجديد..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-950 text-amber-400 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              حفظ التعديل
            </button>
          </form>
        </div>

        {/* Panel 3: Current Options List Display */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-xs">الخيارات المسجلة حالياً</h3>
            </div>
            <span className="text-[10px] bg-amber-100/80 text-neutral-950 px-2 py-0.5 rounded-full font-black">
              {dropdowns[selectedCategory]?.length || 0} عنصر
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {dropdowns[selectedCategory]?.map((opt: string) => (
              <div 
                key={opt} 
                className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-colors"
              >
                <span className="font-bold text-slate-800">{opt}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteOption(opt)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="حذف هذا الخيار"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {(!dropdowns[selectedCategory] || dropdowns[selectedCategory].length === 0) && (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد خيارات مسجلة في هذه القائمة حتى الآن.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CREATE NEW CATEGORY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-100 text-neutral-950 rounded-xl font-bold">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </span>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">إنشاء قائمة Dropdown جديدة</h3>
                  <p className="text-[11px] text-slate-400">إضافة قائمة مخصصة جديدة للنظام</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createCategoryError && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold">
                {createCategoryError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القائمة بالعربية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder="مثال: حالة التنازل الورقي / اسم القطاع"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الخيار الأول الافتراضي بالقائمة (اختياري)
                </label>
                <input
                  type="text"
                  value={newCategoryInitialOption}
                  onChange={(e) => setNewCategoryInitialOption(e.target.value)}
                  placeholder="مثال: مسلم / غير مسلم / قيد الانتظار"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  إنشاء القائمة فوراً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText="إلغاء الأمر"
        type="danger"
        icon="trash"
        isLoading={confirmState.isLoading}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
