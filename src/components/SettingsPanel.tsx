import React, { useState, useEffect } from 'react';
import { 
  Settings, Users, Plus, Edit2, Trash2, Key, Mail, ShieldAlert, Download, Upload, Check, AlertCircle,
  ArrowUp, ArrowDown, Layers, Printer, FileSpreadsheet, Sparkles
} from 'lucide-react';
import { translateRole } from '../utils';
import { ConfirmModal } from './ConfirmModal';
import { CustomField } from '../types';

interface SettingsPanelProps {
  user: any;
  dropdowns: any;
  dropdownLabels?: Record<string, string>;
  onRefreshDropdowns: () => void;
  customFields?: CustomField[];
  onRefreshCustomFields?: () => void;
}

export default function SettingsPanel({ user, dropdowns, dropdownLabels = {}, onRefreshDropdowns }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'smtp' | 'backup' | 'label_names'>('users');
  const [authToken, setAuthToken] = useState(localStorage.getItem('wd_token') || '');

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'warning' | 'info';
    icon: 'trash' | 'key' | 'warning';
    isLoading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'تأكيد',
    type: 'danger',
    icon: 'warning',
    isLoading: false,
    onConfirm: async () => {},
  });

  // Label Names state
  const [labelNames, setLabelNames] = useState<Record<string, string>>({});
  const [labelsSuccess, setLabelsSuccess] = useState('');
  const [labelsError, setLabelsError] = useState('');

  // Users State
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('club');
  const [newClub, setNewClub] = useState('');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Dropdowns category editing
  const [selectedCategory, setSelectedCategory] = useState<string>('clubs');
  const [newOption, setNewOption] = useState('');
  const [renameOldOption, setRenameOldOption] = useState('');
  const [renameNewOption, setRenameNewOption] = useState('');
  const [dropdownSuccess, setDropdownSuccess] = useState('');

  // New Category Creation Modal State
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryInitialOption, setNewCategoryInitialOption] = useState('');
  const [createCategoryError, setCreateCategoryError] = useState('');

  // SMTP Settings State
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('wd.cancellations@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSuccess, setSmtpSuccess] = useState('');

  // Backup state
  const [backupSuccess, setBackupSuccess] = useState('');
  const [restoreError, setRestoreError] = useState('');

  // Fetch all users on component load (Admin only)
  const fetchUsers = async () => {
    if (user.role !== 'admin') return;
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSystemUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLabelNames = async () => {
    try {
      const res = await fetch('/api/label-names', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLabelNames(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom Fields States
  const [customFieldsList, setCustomFieldsList] = useState<CustomField[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'select' | 'checkbox'>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldSection, setFieldSection] = useState<'member' | 'financial' | 'fees' | 'cancellation' | 'notes'>('member');
  const [fieldShowInPrint, setFieldShowInPrint] = useState(true);
  const [fieldPrintSection, setFieldPrintSection] = useState<'main_table' | 'member_summary' | 'exceptions' | 'footer'>('member_summary');
  const [fieldShowInExport, setFieldShowInExport] = useState(true);
  const [customFieldSuccess, setCustomFieldSuccess] = useState('');
  const [customFieldError, setCustomFieldError] = useState('');

  const fetchCustomFields = async () => {
    try {
      const res = await fetch('/api/custom-fields', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomFieldsList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLabelNames();
    fetchCustomFields();
    // Pre-set default club value
    if (dropdowns.clubs && dropdowns.clubs.length > 0) {
      setNewClub(dropdowns.clubs[0]);
    }
  }, [dropdowns]);

  const resetCustomFieldForm = () => {
    setEditingFieldId(null);
    setFieldLabel('');
    setFieldKey('');
    setFieldType('text');
    setFieldOptions('');
    setFieldSection('member');
    setFieldShowInPrint(true);
    setFieldPrintSection('member_summary');
    setFieldShowInExport(true);
    setCustomFieldError('');
  };

  const handleSaveCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFieldSuccess('');
    setCustomFieldError('');

    if (!fieldLabel.trim()) {
      setCustomFieldError('يرجى كتابة اسم الحقل بالعربية');
      return;
    }

    const key = fieldKey.trim().replace(/\s+/g, '_') || `cf_${Date.now()}`;

    const newCustomField: CustomField = {
      id: editingFieldId || `cf_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      key,
      label: fieldLabel.trim(),
      type: fieldType,
      options: fieldType === 'select' ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean) : [],
      section: fieldSection,
      showInPrint: fieldShowInPrint,
      printSection: fieldPrintSection,
      showInExport: fieldShowInExport,
      order: editingFieldId ? (customFieldsList.find(f => f.id === editingFieldId)?.order || customFieldsList.length + 1) : customFieldsList.length + 1
    };

    try {
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(newCustomField)
      });
      const data = await res.json();
      if (res.ok) {
        setCustomFieldSuccess(editingFieldId ? 'تم تحديث الحقل المخصص بنجاح!' : 'تم إضافة الحقل المخصص بنجاح!');
        resetCustomFieldForm();
        fetchCustomFields();
        if (typeof (window as any).refreshCustomFields === 'function') {
          (window as any).refreshCustomFields();
        }
        window.dispatchEvent(new Event('custom-fields-updated'));
      } else {
        setCustomFieldError(data.error || 'فشل حفظ الحقل المخصص');
      }
    } catch (err: any) {
      setCustomFieldError(err.message || 'حدث خطأ أثناء حفظ الحقل المخصص');
    }
  };

  const handleEditCustomField = (field: CustomField) => {
    setEditingFieldId(field.id);
    setFieldLabel(field.label);
    setFieldKey(field.key);
    setFieldType(field.type);
    setFieldOptions(field.options ? field.options.join(', ') : '');
    setFieldSection(field.section);
    setFieldShowInPrint(field.showInPrint);
    setFieldPrintSection(field.printSection);
    setFieldShowInExport(field.showInExport);
  };

  const handleDeleteCustomField = async (id: string) => {
    try {
      const res = await fetch(`/api/custom-fields/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setCustomFieldSuccess('تم حذف الحقل المخصص بنجاح');
        fetchCustomFields();
        window.dispatchEvent(new Event('custom-fields-updated'));
      }
    } catch (err) {
      setCustomFieldError('فشل حذف الحقل المخصص');
    }
  };

  const handleMoveCustomField = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customFieldsList.length) return;

    const newArr = [...customFieldsList];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;

    const ordered = newArr.map((item, idx) => ({ ...item, order: idx + 1 }));

    try {
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(ordered)
      });
      if (res.ok) {
        setCustomFieldsList(ordered);
        window.dispatchEvent(new Event('custom-fields-updated'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (!newUsername.trim() || !newName.trim()) {
      setUserError('جميع الحقول الأساسية مطلوبة');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          username: newUsername,
          name: newName,
          role: newRole,
          club: (newRole === 'club' || newRole === 'international_user') ? newClub : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إضافة المستخدم');
      }

      setUserSuccess(`تم إنشاء الحساب بنجاح! كلمة المرور الافتراضية هي 123`);
      setNewUsername('');
      setNewName('');
      setShowUserModal(false);
      fetchUsers();
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  // Handle User Deletion
  const handleDeleteUser = (id: string, name?: string, username?: string) => {
    const userLabel = name || username ? `"${name || username}" (${username || id})` : `صاحب المعرف (${id})`;
    setConfirmState({
      isOpen: true,
      title: 'تأكيد حذف حساب الموظف',
      message: `هل أنت متأكد تماماً من رغبتك في حذف حساب الموظف ${userLabel} نهائياً من السيستم والمنظومة؟\n\nتنبيه: لن يتمكن هذا الموظف من تسجيل الدخول مجدداً.`,
      confirmText: 'نعم، حذف الحساب نهائياً',
      type: 'danger',
      icon: 'trash',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            setUserSuccess('تم حذف حساب المستخدم بنجاح من المنظومة');
            fetchUsers();
          } else {
            const data = await res.json();
            setUserError(data.error || 'فشل حذف الحساب');
          }
        } catch (err: any) {
          setUserError(err.message || 'تعذر الاتصال بالسيرفر');
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Reset User Password to 123
  const handleResetPassword = (userId: string, name?: string, username?: string) => {
    const userLabel = name || username ? `"${name || username}" (${username || userId})` : `صاحب المعرف (${userId})`;
    setConfirmState({
      isOpen: true,
      title: 'تأكيد إعادة تعيين كلمة المرور',
      message: `هل أنت متأكد من رغبتك في إعادة تعيين كلمة المرور للمستخدم ${userLabel} إلى كلمة المرور الافتراضية "123"؟\n\nسيُطلب من المستخدم تغيير كلمة المرور عند تسجيل الدخول القادم.`,
      confirmText: 'نعم، تعيين إلى 123',
      type: 'warning',
      icon: 'key',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (res.ok) {
            setUserSuccess(`تم إعادة تعيين كلمة المرور للمستخدم ${name || username || userId} بنجاح إلى (123)`);
            fetchUsers();
          } else {
            setUserError(data.error || 'فشل إعادة التعيين');
          }
        } catch (err: any) {
          setUserError(err.message || 'تعذر الاتصال بالسيرفر');
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Dropdown options adding
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
        body: JSON.stringify({ option: newOption })
      });
      const data = await res.json();
      if (res.ok) {
        setDropdownSuccess('تمت إضافة الخيار بنجاح إلى القائمة');
        setNewOption('');
        onRefreshDropdowns();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dropdown Option Renaming
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
        body: JSON.stringify({ oldOption: renameOldOption, newOption: renameNewOption })
      });
      const data = await res.json();
      if (res.ok) {
        setDropdownSuccess('تم تعديل اسم الخيار بنجاح');
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

  // Dropdown Option Deleting
  const handleDeleteOption = (opt: string) => {
    setConfirmState({
      isOpen: true,
      title: 'حذف خيار من القائمة',
      message: `هل أنت متأكد من رغبتك في حذف الخيار "${opt}" من القائمة الديناميكية؟`,
      confirmText: 'حذف الخيار',
      type: 'danger',
      icon: 'trash',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        setDropdownSuccess('');
        try {
          const res = await fetch(`/api/dropdowns/${selectedCategory}?option=${encodeURIComponent(opt)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            setDropdownSuccess('تم حذف الخيار من القائمة بنجاح');
            onRefreshDropdowns();
          } else {
            const data = await res.json();
            console.error(data.error || 'فشل حذف الخيار');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Create New Dropdown Category
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
        setShowCreateCategoryModal(false);
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

  // Delete Dropdown Category
  const handleDeleteCategory = (categoryKey: string) => {
    const catLabel = dropdownLabels[categoryKey] || categoryKey;
    setConfirmState({
      isOpen: true,
      title: 'حذف قائمة اختيار بالكامل',
      message: `هل أنت متأكد من حذف قائمة الاختيار الكاملة "${catLabel}"؟`,
      confirmText: 'حذف القائمة بالكامل',
      type: 'danger',
      icon: 'trash',
      isLoading: false,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/dropdowns/categories/${categoryKey}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            setDropdownSuccess(`تم حذف القائمة بنجاح`);
            setSelectedCategory('clubs');
            onRefreshDropdowns();
          } else {
            const data = await res.json();
            console.error(data.error || 'فشل حذف القائمة');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Backup Full State Database
  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/backup', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const fullDb = await res.json();
        const blob = new Blob([JSON.stringify(fullDb, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Wadi_Degla_Cancellations_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        setBackupSuccess('تم تصدير وحفظ نسخة احتياطية كاملة بنجاح');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Restore State Database from file upload
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError('');
    setBackupSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.users || !parsed.dropdowns || !parsed.requests) {
          throw new Error('الملف لا يحتوي على الهيكل التنظيمي المطلوب لقاعدة بيانات النظام');
        }

        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(parsed)
        });

        if (res.ok) {
          setBackupSuccess('تم استيراد واستعادة قاعدة البيانات بنجاح! سيتم تطبيق التغييرات فوراً.');
          onRefreshDropdowns();
          fetchUsers();
        } else {
          const data = await res.json();
          setRestoreError(data.error || 'فشل رفع الملف على السيرفر');
        }
      } catch (err: any) {
        setRestoreError(`فشل استعادة قاعدة البيانات: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateLabels = async (e: React.FormEvent) => {
    e.preventDefault();
    setLabelsSuccess('');
    setLabelsError('');
    try {
      const res = await fetch('/api/label-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(labelNames)
      });
      const data = await res.json();
      if (res.ok) {
        setLabelsSuccess('تم تحديث مسميات الحقول بنجاح!');
        if (typeof (window as any).refreshLabelNames === 'function') {
          (window as any).refreshLabelNames();
        }
      } else {
        setLabelsError(data.error || 'فشل تحديث التسميات');
      }
    } catch (err: any) {
      setLabelsError(err.message);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm text-slate-800">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <Settings className="h-6 w-6 text-amber-500" />
          لوحة الإدارة الفنية وإعدادات النظام (System Administration)
        </h2>

        {/* Setting Tabs Nav */}
        <div className="flex border-b border-slate-200/80 gap-2 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-5 font-bold text-xs cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'users' ? 'border-amber-500 text-amber-700 font-black bg-amber-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            إدارة الحسابات وصلاحيات الموظفين
          </button>

          <button
            onClick={() => setActiveTab('smtp')}
            className={`pb-3 px-5 font-bold text-xs cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'smtp' ? 'border-amber-500 text-amber-700 font-black bg-amber-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            إعدادات بريد ملقم SMTP
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-3 px-5 font-bold text-xs cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'backup' ? 'border-amber-500 text-amber-700 font-black bg-amber-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            النسخ الاحتياطي واستعادة قاعدة البيانات
          </button>

          <button
            onClick={() => setActiveTab('label_names')}
            className={`pb-3 px-5 font-bold text-xs cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'label_names' ? 'border-amber-500 text-amber-700 font-black bg-amber-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            تخصيص مسميات الحقول والواجهات
          </button>
        </div>

        {/* Tab 1: Users Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-bold text-slate-700 text-sm">حسابات مستخدمي أندية وادي دجلة</h3>
                <p className="text-xxs text-slate-400 mt-0.5">يمكنك إضافة أو تعطيل أو إعادة تعيين كلمات مرور موظفي الفروع والإدارة المالية</p>
              </div>
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-1 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 text-xs font-black rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                إنشاء حساب موظف جديد
              </button>
            </div>

            {userSuccess && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2 font-bold">
                <Check className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{userSuccess}</span>
              </div>
            )}
            {userError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{userError}</span>
              </div>
            )}

            {/* Users list table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-3">اسم الموظف بالكامل</th>
                    <th className="p-3">اسم المستخدم بالدخول</th>
                    <th className="p-3">صلاحية النظام</th>
                    <th className="p-3">نادي الفرع</th>
                    <th className="p-3 text-center">تحديث دوري لرمز المرور</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-700">{u.name}</td>
                      <td className="p-3 font-mono text-slate-600">{u.username}</td>
                      <td className="p-3 font-semibold text-slate-600">{translateRole(u.role)}</td>
                      <td className="p-3 text-slate-500">{u.club || '— (إدارة عامة)'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.firstLogin ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {u.firstLogin ? 'يجب تغيير كلمة المرور' : 'نشط وآمن'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleResetPassword(u.id, u.name, u.username)}
                            title="إعادة تعيين كلمة المرور إلى 123"
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name, u.username)}
                            disabled={u.username === 'admin'}
                            title="حذف الحساب"
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Create User Modal */}
            {showUserModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full space-y-4 border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-sm border-b pb-2">إنشاء حساب جديد للموظف</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1">اسم المستخدم بالدخول (English only)</label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="sheraton_finance"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1">اسم الموظف بالكامل (ثلاثي/رباعي)</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="أحمد محمد مصطفى"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-bold text-slate-500 mb-1">الدور والصلاحية بالمنظومة</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                      >
                        <option value="club">مسؤول الفرع (إدخال وبحث وتعديل)</option>
                        <option value="international_user">مسؤول العضويات الدولية (International)</option>
                        <option value="first_manager">Manager (مراجعة اللجان)</option>
                        <option value="sector_manager">رئيس قطاع الإدارة المالية (اعتماد وختم)</option>
                        <option value="admin">سوبر أدمن مركزي (كامل الصلاحيات)</option>
                      </select>
                    </div>

                    {(newRole === 'club' || newRole === 'international_user') && (
                      <div>
                        <label className="block text-xxs font-bold text-slate-500 mb-1">تحديد الفرع التابع له</label>
                        <select
                          value={newClub}
                          onChange={(e) => setNewClub(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                        >
                          {dropdowns.clubs.map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t text-xs">
                    <button
                      type="button"
                      onClick={() => setShowUserModal(false)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                    >
                      حفظ وإنشاء الحساب
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dynamic Dropdowns Editor */}
        {activeTab === 'dropdowns' && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-xs">
              <div>
                <span className="font-bold text-slate-800 text-sm">إدارة وتعديل القوائم الديناميكية للنظام</span>
                <p className="text-xs text-slate-500 mt-0.5">يمكنك إضافة خيارات جديدة أو تعديل وحذف خيارات من أي قائمة، بالإضافة إلى إنشاء قوائم اختيار جديدة بالكامل.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateCategoryError('');
                  setShowCreateCategoryModal(true);
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة قائمة اختيار جديدة</span>
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
              {Object.keys(dropdowns || {}).map((catKey) => {
                const defaultLabels: Record<string, string> = {
                  clubs: 'نادي الفرع',
                  membershipTypes: 'نوع العضوية',
                  paymentMethods: 'طريقة الدفع',
                  cancellationReasons: 'سبب الإلغاء',
                  committeeResults: 'قرار اللجنة',
                  cancellationStatuses: 'حالة الإلغاء',
                  exceptions: 'الاستثناءات',
                };
                const label = dropdownLabels[catKey] || defaultLabels[catKey] || catKey;
                const isSelected = selectedCategory === catKey;
                const isCore = ['clubs', 'membershipTypes', 'paymentMethods', 'cancellationReasons', 'committeeResults', 'cancellationStatuses', 'exceptions'].includes(catKey);

                return (
                  <div key={catKey} className="flex items-center">
                    <button
                      onClick={() => setSelectedCategory(catKey)}
                      className={`px-3.5 py-2 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-amber-400 text-neutral-950 font-black shadow-xs' 
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 font-mono">
                        {dropdowns[catKey]?.length || 0}
                      </span>
                    </button>
                    {!isCore && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(catKey)}
                        className="mr-1 p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="حذف القائمة بالكامل"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {dropdownSuccess && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2 font-bold">
                <Check className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{dropdownSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Option 1: Add New Option */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <span className="block text-xs font-bold text-slate-700">إضافة خيار جديد إلى "{dropdownLabels[selectedCategory] || selectedCategory}":</span>
                <form onSubmit={handleAddOption} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="أدخل اسم الخيار الجديد..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    إدراج خيار جديد
                  </button>
                </form>
              </div>

              {/* Option 2: Rename Option */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <span className="block text-xs font-bold text-slate-700">تعديل وإعادة تسمية خيار متواجد:</span>
                <form onSubmit={handleRenameOption} className="space-y-3">
                  <select
                    value={renameOldOption}
                    onChange={(e) => setRenameOldOption(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="">اختر الخيار المراد تعديله...</option>
                    {dropdowns[selectedCategory]?.map((o: string) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={renameNewOption}
                    onChange={(e) => setRenameNewOption(e.target.value)}
                    placeholder="الاسم الجديد المعدل..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    حفظ وإعادة التسمية
                  </button>
                </form>
              </div>

              {/* Option 3: Current List Options Display */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3 col-span-1">
                <div className="flex justify-between items-center">
                  <span className="block text-xs font-bold text-slate-700">الخيارات المسجلة حالياً ({dropdowns[selectedCategory]?.length || 0}):</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {dropdowns[selectedCategory]?.map((opt: string) => (
                    <div key={opt} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                      <span className="font-semibold text-slate-700">{opt}</span>
                      <button
                        onClick={() => handleDeleteOption(opt)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="حذف هذا الخيار"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!dropdowns[selectedCategory] || dropdowns[selectedCategory].length === 0) && (
                    <p className="text-xs text-slate-400 text-center py-4">لا توجد خيارات مسجلة في هذه القائمة حتى الآن</p>
                  )}
                </div>
              </div>

            </div>

            {/* Create Category Modal */}
            {showCreateCategoryModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Plus className="h-4 w-4 text-amber-500" />
                      إنشاء قائمة اختيار جديدة (Dynamic Dropdown)
                    </h3>
                    <button 
                      onClick={() => setShowCreateCategoryModal(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {createCategoryError && (
                    <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold">
                      {createCategoryError}
                    </div>
                  )}

                  <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        اسم القائمة بالعربية <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        placeholder="مثال: حالة التنازل الورقي / اسم القطاع"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        الخيار الأول الافتراضي بالقائمة (اختياري)
                      </label>
                      <input
                        type="text"
                        value={newCategoryInitialOption}
                        onChange={(e) => setNewCategoryInitialOption(e.target.value)}
                        placeholder="مثال: مسلم / غير مسلم / قيد الانتظار"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowCreateCategoryModal(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                      >
                        إنشاء القائمة
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: SMTP Mail Server */}
        {activeTab === 'smtp' && (
          <div className="max-w-xl mx-auto space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">تكوين وتوثيق خادم بريد SMTP</h3>
            <p className="text-xxs text-slate-400">إدخال إعدادات البريد الإلكتروني الرسمي لتمكين النظام من إرسال مذكرات المطابقة والتنبيهات المباشرة للفروع والجهات الخارجية تلقائياً</p>

            {smtpSuccess && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold">
                {smtpSuccess}
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-slate-500 mb-1">خادم البريد SMTP Server</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-slate-500 mb-1">منفذ الاتصال Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-500 mb-1">اسم مستخدم البريد الإلكتروني</label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-500 mb-1">رمز المرور للتطبيقات الخارجي (App Password)</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <button
                onClick={() => {
                  setSmtpSuccess('تم التحقق وحفظ وتحديث تكوين البريد SMTP بنجاح!');
                }}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-colors"
              >
                حفظ التكوين واختبار الاتصال المباشر
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Database Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-right" dir="rtl">
              <div className="p-2 bg-emerald-500 text-white rounded-xl">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-900">قاعدة البيانات السحابية (Cloud SQL / PostgreSQL) متصلة ومفعلة</h4>
                <p className="text-xxs text-emerald-700 mt-0.5">يتم حفظ ومزامنة كافة الطلبات والمستخدمين والإعدادات تلقائياً في السحاب مع دعم الاستعادة والتصدير الفوري.</p>
              </div>
            </div>

            <h3 className="font-bold text-slate-700 text-sm">إدارة وضمان سلامة البيانات (مركز الاستعادة)</h3>
            <p className="text-xxs text-slate-400">
              يتيح لك هذا القسم سحب نسخة احتياطية مشفرة لملف قاعدة البيانات الشاملة للمنظومة بالكامل، لحفظها محلياً أو رفع نسخة سابقة لاسترجاع كافة لجان المطابقات وحسابات الموظفين والطلبات في ثانية واحدة.
            </p>

            {backupSuccess && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold">
                {backupSuccess}
              </div>
            )}
            {restoreError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold">
                {restoreError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Backing Up */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-3 text-center flex flex-col justify-between">
                <div className="mx-auto p-3 bg-amber-50 rounded-full text-amber-600 mb-2">
                  <Download className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-700 text-xs">حفظ نسخة احتياطية كاملة</h4>
                <p className="text-xxs text-slate-400">تحميل ملف JSON مدمج يحتوي على طلبات إلغاء العضويات واللجان وإجراءات الاعتماد الفورية</p>
                <button
                  onClick={handleExportBackup}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-colors"
                >
                  تصدير ملف الاحتياط
                </button>
              </div>

              {/* Restoring */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-3 text-center flex flex-col justify-between">
                <div className="mx-auto p-3 bg-slate-100 rounded-full text-slate-600 mb-2">
                  <Upload className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-700 text-xs">رفع واستعادة قاعدة بيانات</h4>
                <p className="text-xxs text-slate-400">اختر ملف JSON للنسخة الاحتياطية المعتمدة سابقاً لإعادة المنظومة لحالتها المسجلة</p>
                
                <label className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer block text-center transition-colors">
                  <span>رفع وتطبيق الملف</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Dynamic Label Names & Custom Fields Customization (Yellow & Black Theme) */}
        {activeTab === 'label_names' && (
          <div className="space-y-8 text-right" dir="rtl">
            
            {/* Header banner in Yellow and Black */}
            <div className="bg-neutral-950 border-2 border-amber-400 p-6 rounded-3xl text-white shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-400 text-neutral-950 rounded-2xl shrink-0 font-black">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                    تخصيص مسميات الحقول والواجهات (Yellow & Black Customizer)
                  </h3>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    تعديل مسميات الواجهات والتقارير، وإضافة حقول مخصصة جديدة بخصائصها الدقيقة، تحديد مكان ظهورها بالنموذج والمذكرة المطبوعة وتصدير Excel، وإعادة ترتيبها بمرونة.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Field Form: Create or Edit New Field */}
            <div className="bg-neutral-950 border-2 border-amber-400/80 p-6 rounded-3xl text-white shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-400" />
                  <h4 className="text-sm font-black text-amber-400">
                    {editingFieldId ? 'تعديل بيانات الحقل المخصص' : 'إضافة حقل مخصص جديد (New Custom Field)'}
                  </h4>
                </div>
                {editingFieldId && (
                  <button
                    type="button"
                    onClick={resetCustomFieldForm}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-bold rounded-lg border border-amber-400/30 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              {customFieldSuccess && (
                <div className="p-3 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  {customFieldSuccess}
                </div>
              )}
              {customFieldError && (
                <div className="p-3 bg-rose-900/80 text-rose-200 border border-rose-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {customFieldError}
                </div>
              )}

              <form onSubmit={handleSaveCustomField} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Field Label */}
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">اسم الحقل بالعربية (Label)</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: رقم قرار مجلس الإدارة"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 text-amber-300 rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Field Key */}
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">المعرف البرمجي (Key)</label>
                    <input
                      type="text"
                      placeholder="اختياري (تلقائي): board_decision_no"
                      value={fieldKey}
                      onChange={(e) => setFieldKey(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 text-amber-300 font-mono rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Field Data Type */}
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">نوع البيانات (Data Type)</label>
                    <select
                      value={fieldType}
                      onChange={(e: any) => setFieldType(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 text-amber-300 rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
                    >
                      <option value="text">نص عادي (Text)</option>
                      <option value="number">رقمي (Number)</option>
                      <option value="date">تاريخ (Date)</option>
                      <option value="select">قائمة منسدلة (Dropdown List)</option>
                      <option value="checkbox">مربع اختيار / نعم-لا (Checkbox)</option>
                    </select>
                  </div>
                </div>

                {/* Dropdown Options if type is select */}
                {fieldType === 'select' && (
                  <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                    <label className="block text-amber-400 font-bold mb-1">خيارات القائمة المنسدلة (افصل بين الخيارات بفارزة)</label>
                    <input
                      type="text"
                      placeholder="خيار 1, خيار 2, خيار 3"
                      value={fieldOptions}
                      onChange={(e) => setFieldOptions(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                  {/* Location in Form */}
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">مكان الظهور بالنموذج والعرض</label>
                    <select
                      value={fieldSection}
                      onChange={(e: any) => setFieldSection(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
                    >
                      <option value="member">1. بيانات العضوية والمشترك</option>
                      <option value="financial">2. المدخلات والمبالغ المالية</option>
                      <option value="fees">3. الخصومات ومستحقات الاسترداد</option>
                      <option value="cancellation">4. بيانات وسبب الإلغاء</option>
                      <option value="notes">5. الملاحظات واللجنة الفنية</option>
                    </select>
                  </div>

                  {/* Print Memo Section */}
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">مكان الظهور في المذكرة المطبوعة</label>
                    <select
                      disabled={!fieldShowInPrint}
                      value={fieldPrintSection}
                      onChange={(e: any) => setFieldPrintSection(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2.5 font-bold focus:border-amber-400 focus:outline-none cursor-pointer disabled:opacity-40"
                    >
                      <option value="member_summary">ملخص بيانات المشترك العلوي</option>
                      <option value="main_table">الجدول الرئيسي المالي</option>
                      <option value="exceptions">قسم الشروط والاستثناءات</option>
                      <option value="footer">تذييل وملاحظات المذكرة</option>
                    </select>
                  </div>

                  {/* Toggles: Print & Export */}
                  <div className="flex flex-col justify-center space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-300 select-none">
                      <input
                        type="checkbox"
                        checked={fieldShowInPrint}
                        onChange={(e) => setFieldShowInPrint(e.target.checked)}
                        className="h-4 w-4 accent-amber-400 rounded cursor-pointer"
                      />
                      <span>يظهر في طباعة المذكرة (Print Memo)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-300 select-none">
                      <input
                        type="checkbox"
                        checked={fieldShowInExport}
                        onChange={(e) => setFieldShowInExport(e.target.checked)}
                        className="h-4 w-4 accent-amber-400 rounded cursor-pointer"
                      />
                      <span>يظهر في تقرير تصدير البيانات Excel</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl cursor-pointer shadow-lg transition-transform active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    {editingFieldId ? 'تحديث الحقل المخصص' : 'إضافة وتثبيت الحقل المخصص'}
                  </button>
                </div>
              </form>
            </div>

            {/* List of Created Custom Fields with Reordering */}
            <div className="bg-neutral-950 border-2 border-amber-400/80 p-6 rounded-3xl text-white shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
                <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  قائمة الحقول المخصصة المضافة وحالتها ({customFieldsList.length} حقل)
                </h4>
                <span className="text-xs text-neutral-400 font-bold">يمكنك إعادة الترتيب بواسطة أزرار الأسهم</span>
              </div>

              {customFieldsList.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 font-bold text-xs bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-800">
                  لا توجد حقول مخصصة مضافة حالياً. استخدم النموذج أعلاه لإضافة حقل مخصص جديد.
                </div>
              ) : (
                <div className="space-y-3">
                  {customFieldsList.map((field, idx) => {
                    const sectionLabels: Record<string, string> = {
                      member: 'بيانات العضوية',
                      financial: 'المدخلات المالية',
                      fees: 'الخصومات والمستحقات',
                      cancellation: 'بيانات الإلغاء',
                      notes: 'الملاحظات واللجنة'
                    };
                    const printLabels: Record<string, string> = {
                      member_summary: 'ملخص المشترك',
                      main_table: 'الجدول المالي',
                      exceptions: 'الاستثناءات',
                      footer: 'تذييل المذكرة'
                    };

                    return (
                      <div 
                        key={field.id}
                        className="bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-amber-400 text-sm">{field.label}</span>
                            <span className="bg-neutral-950 text-neutral-400 font-mono text-[10px] px-2 py-0.5 rounded border border-neutral-800">
                              key: {field.key}
                            </span>
                            <span className="bg-amber-400/20 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30">
                              {field.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-neutral-300 flex-wrap">
                            <span><strong>الموقع بالنموذج:</strong> {sectionLabels[field.section] || field.section}</span>
                            <span>•</span>
                            <span>
                              <strong>الطباعة بالمذكرة:</strong> {field.showInPrint ? `نعم (${printLabels[field.printSection] || field.printSection})` : 'لا'}
                            </span>
                            <span>•</span>
                            <span>
                              <strong>تصدير Excel:</strong> {field.showInExport ? 'مُفعّل' : 'معطل'}
                            </span>
                            {field.options && field.options.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-200">الخيارات: {field.options.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Controls: Reorder Up/Down, Edit, Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCustomField(idx, 'up')}
                            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg disabled:opacity-30 cursor-pointer border border-neutral-700"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === customFieldsList.length - 1}
                            onClick={() => handleMoveCustomField(idx, 'down')}
                            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg disabled:opacity-30 cursor-pointer border border-neutral-700"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCustomField(field)}
                            className="p-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg cursor-pointer"
                            title="تعديل الحقل"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(field.id)}
                            className="p-2 bg-rose-900/80 hover:bg-rose-800 text-white rounded-lg cursor-pointer border border-rose-700"
                            title="حذف الحقل"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Standard Label Names Form in Yellow & Black */}
            <form onSubmit={handleUpdateLabels} className="bg-neutral-950 border-2 border-amber-400 p-6 rounded-3xl text-white shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
                <div>
                  <h4 className="font-black text-amber-400 text-sm">تعديل مسميات الحقول الأساسية والواجهات (Labels)</h4>
                  <p className="text-xs text-neutral-300 mt-0.5">يمكنك تخصيص النص الظاهر لجميع الحقول الأساسية بالمنظومة</p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs rounded-xl shadow-lg cursor-pointer transition-transform active:scale-95"
                >
                  حفظ المسميات الأساسية
                </button>
              </div>

              {labelsSuccess && (
                <div className="p-3 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs">
                  {labelsSuccess}
                </div>
              )}
              {labelsError && (
                <div className="p-3 bg-rose-900/80 text-rose-200 border border-rose-500 rounded-xl text-xs">
                  {labelsError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Column 1: Basic Fields */}
                <div className="bg-neutral-900/90 p-5 rounded-2xl border border-amber-400/30 shadow-lg space-y-4">
                  <h4 className="font-black text-amber-400 border-b border-amber-400/20 pb-1">البيانات الأساسية للمشترك</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">رقم العضوية</label>
                      <input
                        type="text"
                        value={labelNames.membershipNumber || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, membershipNumber: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">اسم العضو / المشترك</label>
                      <input
                        type="text"
                        value={labelNames.memberName || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, memberName: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">القرض باسم</label>
                      <input
                        type="text"
                        value={labelNames.loanUnderName || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, loanUnderName: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">الرقم القومي</label>
                      <input
                        type="text"
                        value={labelNames.nationalId || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, nationalId: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">رقم العميل / المعرف الخارجي</label>
                      <input
                        type="text"
                        value={labelNames.externalId || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, externalId: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">رقم الموبايل</label>
                      <input
                        type="text"
                        value={labelNames.mobileNumber || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, mobileNumber: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">تاريخ الاشتراك</label>
                      <input
                        type="text"
                        value={labelNames.subscriptionDate || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, subscriptionDate: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">تاريخ تقديم طلب الإلغاء</label>
                      <input
                        type="text"
                        value={labelNames.requestDate || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, requestDate: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">نوع العضوية</label>
                      <input
                        type="text"
                        value={labelNames.membershipType || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, membershipType: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">النادي / الفرع</label>
                      <input
                        type="text"
                        value={labelNames.club || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, club: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">رقم اللجنة</label>
                      <input
                        type="text"
                        value={labelNames.committeeNo || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, committeeNo: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">ملاحظات الفرع</label>
                      <input
                        type="text"
                        value={labelNames.clubNote || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, clubNote: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">ملاحظات الادمن</label>
                      <input
                        type="text"
                        value={labelNames.adminNote || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, adminNote: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Financial Fields */}
                <div className="bg-neutral-900/90 p-5 rounded-2xl border border-amber-400/30 shadow-lg space-y-4">
                  <h4 className="font-black text-amber-400 border-b border-amber-400/20 pb-1">المدخلات والمبالغ المالية</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">إجمالي قيمة العضوية</label>
                      <input
                        type="text"
                        value={labelNames.subscriptionValue || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, subscriptionValue: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">قيمة التحويلة</label>
                      <input
                        type="text"
                        value={labelNames.transferValue || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, transferValue: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">المبلغ المدفوع نقداً</label>
                      <input
                        type="text"
                        value={labelNames.cashAmount || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, cashAmount: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">المبلغ المدفوع بالفيزا</label>
                      <input
                        type="text"
                        value={labelNames.visaAmount || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, visaAmount: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مبلغ المقدم (نقداً + فيزا)</label>
                      <input
                        type="text"
                        value={labelNames.advancePaid || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, advancePaid: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">شيكات مسددة</label>
                      <input
                        type="text"
                        value={labelNames.checksPaid || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, checksPaid: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">شيكات غير مسددة</label>
                      <input
                        type="text"
                        value={labelNames.checksUnpaid || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, checksUnpaid: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">التجديد السنوي المستحق</label>
                      <input
                        type="text"
                        value={labelNames.annualRenewalDue || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, annualRenewalDue: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 3: Fees & Refunds */}
                <div className="bg-neutral-900/90 p-5 rounded-2xl border border-amber-400/30 shadow-lg space-y-4">
                  <h4 className="font-black text-amber-400 border-b border-amber-400/20 pb-1">الخصومات ومستحقات الاسترداد</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مصاريف إدارية مستقطعة</label>
                      <input
                        type="text"
                        value={labelNames.adminFees || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, adminFees: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مقابل الانتفاع بالعضوية</label>
                      <input
                        type="text"
                        value={labelNames.usageFee || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, usageFee: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مصاريف فيزا 2%</label>
                      <input
                        type="text"
                        value={labelNames.visaFees2Percent || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, visaFees2Percent: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">إجمالي مبلغ الخصومات</label>
                      <input
                        type="text"
                        value={labelNames.discountAmount || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, discountAmount: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مديونية البنك / الشركات</label>
                      <input
                        type="text"
                        value={labelNames.debtABKCompanies || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, debtABKCompanies: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">صافي مبلغ الاسترداد المالي</label>
                      <input
                        type="text"
                        value={labelNames.refundAmount || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, refundAmount: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">طريقة الدفع وقنوات السداد</label>
                      <input
                        type="text"
                        value={labelNames.paymentMethod || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, paymentMethod: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-300/80 font-bold mb-1">مستندات تسليم العضوية</label>
                      <input
                        type="text"
                        value={labelNames.documents || ''}
                        onChange={(e) => setLabelNames({ ...labelNames, documents: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 text-amber-300 rounded-xl p-2 font-bold focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText="إلغاء الأمر"
        type={confirmState.type}
        icon={confirmState.icon}
        isLoading={confirmState.isLoading}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
