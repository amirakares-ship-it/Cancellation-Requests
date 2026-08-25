import React, { useState, useEffect } from 'react';
import { 
  Calculator, Save, RefreshCw, CheckCircle, AlertTriangle, Info, Calendar, 
  Percent, ShieldAlert, Sparkles, Layers, Sliders, ArrowRight, Plus, Trash2, Edit2, Code, FunctionSquare,
  Settings, X, Check, RotateCcw, ListFilter, PlusCircle, HelpCircle, ChevronRight, Play
} from 'lucide-react';
import { 
  FormulasConfig, DEFAULT_FORMULAS_CONFIG, PaymentFormulaOption, 
  CustomPaymentMethodFormula, DEFAULT_PAYMENT_METHOD_OPTIONS, evaluateCustomFormula 
} from '../utils';
import { CustomField } from '../types';

interface FormulasManagerProps {
  user: any;
  authToken: string;
  onRefreshAll: () => void;
}

export default function FormulasManager({ user, authToken, onRefreshAll }: FormulasManagerProps) {
  const [formulas, setFormulas] = useState<FormulasConfig>(DEFAULT_FORMULAS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Scope modal state
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [recalcScope, setRecalcScope] = useState<'all' | 'old' | 'new' | 'none'>('new');
  const [pendingCustomField, setPendingCustomField] = useState<CustomField | null>(null);

  // Dropdown Options Management State (تحكم كامل في خيارات القوائم المنسدلة)
  const [dropdownModalOpen, setDropdownModalOpen] = useState(false);
  const [activeMethodForDropdown, setActiveMethodForDropdown] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [optLabel, setOptLabel] = useState('');
  const [optValue, setOptValue] = useState('');
  const [optDescription, setOptDescription] = useState('');
  const [optExpression, setOptExpression] = useState('');
  const [optError, setOptError] = useState('');
  const [optSuccess, setOptSuccess] = useState('');

  // Custom Payment Method Creation Modal State
  const [customMethodModalOpen, setCustomMethodModalOpen] = useState(false);
  const [newCustomMethodName, setNewCustomMethodName] = useState('');
  const [newCustomMethodBadge, setNewCustomMethodBadge] = useState('');
  const [newCustomMethodInitialLabel, setNewCustomMethodInitialLabel] = useState('');
  const [newCustomMethodInitialExpression, setNewCustomMethodInitialExpression] = useState('');
  const [newCustomMethodError, setNewCustomMethodError] = useState('');

  // Custom Formula Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [cfLabel, setCfLabel] = useState('');
  const [cfKey, setCfKey] = useState('');
  const [cfExpression, setCfExpression] = useState('');
  const [cfSection, setCfSection] = useState<'member' | 'financial' | 'fees' | 'cancellation' | 'notes'>('fees');
  const [cfPrintSection, setCfPrintSection] = useState<'member_summary' | 'main_table' | 'exceptions' | 'footer'>('exceptions');
  const [cfShowInPrint, setCfShowInPrint] = useState(true);
  const [cfShowInExport, setCfShowInExport] = useState(true);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [cfSuccess, setCfSuccess] = useState('');
  const [cfError, setCfError] = useState('');

  // Exception rules local state for adding new rules
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleExemptAdmin, setNewRuleExemptAdmin] = useState(false);
  const [newRuleExemptUsage, setNewRuleExemptUsage] = useState(false);
  const [newRuleExemptVisa, setNewRuleExemptVisa] = useState(false);

  useEffect(() => {
    fetchFormulas();
    fetchCustomFields();
  }, []);

  const fetchFormulas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/formulas', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormulas(data);
      }
    } catch (err) {
      console.error('Error loading formulas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await fetch('/api/custom-fields', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomFields(data || []);
      }
    } catch (err) {
      console.error('Error loading custom fields:', err);
    }
  };

  // Custom Formula Field Functions
  const resetCfForm = () => {
    setCfLabel('');
    setCfKey('');
    setCfExpression('');
    setCfSection('fees');
    setCfPrintSection('exceptions');
    setCfShowInPrint(true);
    setCfShowInExport(true);
    setEditingFieldId(null);
    setCfError('');
    setCfSuccess('');
  };

  const handleSaveCustomFormulaField = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfError('');
    setCfSuccess('');

    if (!cfLabel.trim()) {
      setCfError('اسم الحقل مطلوب');
      return;
    }
    if (!cfExpression.trim()) {
      setCfError('صيغة المعادلة الحسابية مطلوبة');
      return;
    }

    const keyToUse = cfKey.trim() ? cfKey.trim().toLowerCase().replace(/\s+/g, '_') : 'cf_formula_' + Date.now();

    const newField: CustomField = {
      id: editingFieldId || 'cf_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      key: keyToUse,
      label: cfLabel.trim(),
      type: 'formula',
      formulaExpression: cfExpression.trim(),
      section: cfSection,
      printSection: cfPrintSection,
      showInPrint: cfShowInPrint,
      showInExport: cfShowInExport,
      order: customFields.length + 1
    };

    setPendingCustomField(newField);
    setShowScopeModal(true);
  };

  const handleEditCf = (field: CustomField) => {
    setEditingFieldId(field.id);
    setCfLabel(field.label);
    setCfKey(field.key);
    setCfExpression(field.formulaExpression || '');
    setCfSection(field.section);
    setCfPrintSection(field.printSection);
    setCfShowInPrint(field.showInPrint);
    setCfShowInExport(field.showInExport);
    setCfError('');
    setCfSuccess('');
  };

  const handleDeleteCf = async (id: string) => {
    try {
      const res = await fetch(`/api/custom-fields/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCustomFields(data.customFields || []);
        onRefreshAll();
      }
    } catch (err) {
      console.error('Error deleting custom field:', err);
    }
  };

  const insertVariable = (varName: string) => {
    setCfExpression(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + varName + ' ');
  };

  const persistExceptionRules = async (updatedRules: any[]) => {
    const updatedFormulas = { ...formulas, exceptionRules: updatedRules };
    setFormulas(updatedFormulas);
    try {
      const res = await fetch('/api/formulas', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          formulas: updatedFormulas,
          recalculateScope: 'none'
        })
      });
      if (res.ok) {
        setSuccessMsg('تم حفظ وتحديث قواعد واستثناءات الإعفاء في النظام بنجاح! 💾');
        setTimeout(() => setSuccessMsg(''), 3500);
        onRefreshAll();
      }
    } catch (err) {
      console.error('Error saving exception rules:', err);
    }
  };

  // Helper to get options for a payment method
  const getOptionsForMethod = (methodKey: string): PaymentFormulaOption[] => {
    if (formulas.paymentMethodOptions && formulas.paymentMethodOptions[methodKey] && formulas.paymentMethodOptions[methodKey]!.length > 0) {
      return formulas.paymentMethodOptions[methodKey]!;
    }
    if (DEFAULT_PAYMENT_METHOD_OPTIONS[methodKey]) {
      return DEFAULT_PAYMENT_METHOD_OPTIONS[methodKey];
    }
    const custom = (formulas.customPaymentMethods || []).find(m => m.id === methodKey || m.methodName === methodKey);
    if (custom && custom.options && custom.options.length > 0) {
      return custom.options;
    }
    return [
      {
        id: 'opt_default',
        value: 'subscriptionValue',
        label: 'قيمة الاشتراك - إجمالي الخصم (افتراضي)',
        description: 'قيمة الاشتراك - إجمالي مبلغ الخصم',
        expression: 'subscriptionValue - discountAmount'
      }
    ];
  };

  // Helper to get active formula key for a method
  const getActiveFormulaForMethod = (methodKey: string): string => {
    if (methodKey === 'cash') return formulas.cashRefundFormula || 'subscriptionValue';
    if (methodKey === 'checks') return formulas.checksRefundFormula || 'all_checks';
    if (methodKey === 'banks') return formulas.bankRefundFormula || 'transferValue';
    if (methodKey === 'companies') return formulas.companyRefundFormula || 'net_subscription';
    const customM = (formulas.customPaymentMethods || []).find(m => m.id === methodKey || m.methodName === methodKey);
    return customM ? customM.selectedFormula : 'subscriptionValue';
  };

  // Helper to update active formula for a method
  const setActiveFormulaForMethod = (methodKey: string, val: string) => {
    if (methodKey === 'cash') setFormulas(prev => ({ ...prev, cashRefundFormula: val }));
    else if (methodKey === 'checks') setFormulas(prev => ({ ...prev, checksRefundFormula: val }));
    else if (methodKey === 'banks') setFormulas(prev => ({ ...prev, bankRefundFormula: val }));
    else if (methodKey === 'companies') setFormulas(prev => ({ ...prev, companyRefundFormula: val }));
    else {
      const updatedCustom = (formulas.customPaymentMethods || []).map(m => {
        if (m.id === methodKey || m.methodName === methodKey) {
          return { ...m, selectedFormula: val };
        }
        return m;
      });
      setFormulas(prev => ({ ...prev, customPaymentMethods: updatedCustom }));
    }
  };

  // Helper to get human friendly title for a method
  const getMethodTitle = (methodKey: string): { title: string; badge: string; color: string } => {
    if (methodKey === 'cash') return { title: 'الدفع نقداً وفيزا (Cash & Visa)', badge: 'نقداً / فيزا', color: 'emerald' };
    if (methodKey === 'checks') return { title: 'الدفع بالشيكات (Checks)', badge: 'شيكات', color: 'blue' };
    if (methodKey === 'banks') return { title: 'بنوك (ABK / المشرق / QNB)', badge: 'بنوك', color: 'indigo' };
    if (methodKey === 'companies') return { title: 'شركات التمويل (Aman/Premium/Ollin...)', badge: 'تمويل', color: 'amber' };
    const custom = (formulas.customPaymentMethods || []).find(m => m.id === methodKey || m.methodName === methodKey);
    return {
      title: custom ? `طريقة دفع مخصصة: ${custom.methodName}` : `طريقة دفع: ${methodKey}`,
      badge: custom?.badge || 'مخصص',
      color: 'purple'
    };
  };

  const resetOptionForm = () => {
    setEditingOptionId(null);
    setOptLabel('');
    setOptValue('');
    setOptDescription('');
    setOptExpression('');
    setOptError('');
    setOptSuccess('');
  };

  const handleOpenDropdownManager = (methodKey: string) => {
    setActiveMethodForDropdown(methodKey);
    resetOptionForm();
    setDropdownModalOpen(true);
  };

  const handleEditOption = (option: PaymentFormulaOption) => {
    setEditingOptionId(option.id || option.value);
    setOptLabel(option.label);
    setOptValue(option.value);
    setOptDescription(option.description || '');
    setOptExpression(option.expression || '');
    setOptError('');
    setOptSuccess('');
  };

  const handleSaveDropdownOption = async () => {
    if (!activeMethodForDropdown) return;
    setOptError('');
    setOptSuccess('');

    if (!optLabel.trim()) {
      setOptError('اسم وعنوان الخيار مطلوب');
      return;
    }

    const currentOpts = getOptionsForMethod(activeMethodForDropdown);
    const valKey = optValue.trim() ? optValue.trim().replace(/\s+/g, '_') : ('opt_' + Date.now().toString(36));

    let updatedOpts: PaymentFormulaOption[];
    if (editingOptionId) {
      updatedOpts = currentOpts.map(o => {
        if (o.id === editingOptionId || o.value === editingOptionId) {
          return {
            ...o,
            label: optLabel.trim(),
            value: valKey,
            description: optDescription.trim() || optLabel.trim(),
            expression: optExpression.trim() || undefined,
            isCustom: true
          };
        }
        return o;
      });
    } else {
      const newOpt: PaymentFormulaOption = {
        id: 'opt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        label: optLabel.trim(),
        value: valKey,
        description: optDescription.trim() || optLabel.trim(),
        expression: optExpression.trim() || undefined,
        isCustom: true
      };
      updatedOpts = [...currentOpts, newOpt];
    }

    const updatedPaymentMethodOptions = {
      ...(formulas.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS),
      [activeMethodForDropdown]: updatedOpts
    };

    let updatedCustom = formulas.customPaymentMethods || [];
    if (updatedCustom.some(m => m.id === activeMethodForDropdown || m.methodName === activeMethodForDropdown)) {
      updatedCustom = updatedCustom.map(m => {
        if (m.id === activeMethodForDropdown || m.methodName === activeMethodForDropdown) {
          return { ...m, options: updatedOpts };
        }
        return m;
      });
    }

    const newFormulasConfig: FormulasConfig = {
      ...formulas,
      paymentMethodOptions: updatedPaymentMethodOptions,
      customPaymentMethods: updatedCustom
    };

    setFormulas(newFormulasConfig);
    setOptSuccess(editingOptionId ? 'تم تحديث وتعديل الخيار في القائمة بنجاح! 💾' : 'تمت إضافة الخيار الجديد إلى القائمة بنجاح! 💾');
    resetOptionForm();
    await persistFormulasImmediate(newFormulasConfig);
  };

  const handleDeleteDropdownOption = async (optionId: string, optionVal: string) => {
    if (!activeMethodForDropdown) return;
    setOptError('');
    setOptSuccess('');
    const currentOpts = getOptionsForMethod(activeMethodForDropdown);
    if (currentOpts.length <= 1) {
      setOptError('لا يمكن حذف جميع الخيارات! يجب الإبقاء على خيار واحد على الأقل في القائمة.');
      return;
    }

    const updatedOpts = currentOpts.filter(o => o.id !== optionId && o.value !== optionVal);
    
    // If the deleted option was active, switch active to first available
    const activeFormula = getActiveFormulaForMethod(activeMethodForDropdown);
    let nextActiveFormula = activeFormula;
    if (activeFormula === optionVal || activeFormula === optionId) {
      nextActiveFormula = updatedOpts[0]?.value || 'subscriptionValue';
      setActiveFormulaForMethod(activeMethodForDropdown, nextActiveFormula);
    }

    const updatedPaymentMethodOptions = {
      ...(formulas.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS),
      [activeMethodForDropdown]: updatedOpts
    };

    let updatedCustom = formulas.customPaymentMethods || [];
    if (updatedCustom.some(m => m.id === activeMethodForDropdown || m.methodName === activeMethodForDropdown)) {
      updatedCustom = updatedCustom.map(m => {
        if (m.id === activeMethodForDropdown || m.methodName === activeMethodForDropdown) {
          return { ...m, selectedFormula: nextActiveFormula, options: updatedOpts };
        }
        return m;
      });
    }

    const newFormulasConfig: FormulasConfig = {
      ...formulas,
      paymentMethodOptions: updatedPaymentMethodOptions,
      customPaymentMethods: updatedCustom
    };

    if (activeMethodForDropdown === 'cash') newFormulasConfig.cashRefundFormula = nextActiveFormula;
    else if (activeMethodForDropdown === 'checks') newFormulasConfig.checksRefundFormula = nextActiveFormula;
    else if (activeMethodForDropdown === 'banks') newFormulasConfig.bankRefundFormula = nextActiveFormula;
    else if (activeMethodForDropdown === 'companies') newFormulasConfig.companyRefundFormula = nextActiveFormula;

    setFormulas(newFormulasConfig);
    setOptSuccess('تم حذف الخيار من القائمة بنجاح! 🗑️');
    resetOptionForm();
    await persistFormulasImmediate(newFormulasConfig);
  };

  const handleResetMethodDefaults = async (methodKey: string) => {
    if (!DEFAULT_PAYMENT_METHOD_OPTIONS[methodKey]) return;
    setOptError('');
    setOptSuccess('');

    const defaultOpts = DEFAULT_PAYMENT_METHOD_OPTIONS[methodKey];
    const updatedPaymentMethodOptions = {
      ...(formulas.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS),
      [methodKey]: defaultOpts
    };
    const newFormulasConfig: FormulasConfig = {
      ...formulas,
      paymentMethodOptions: updatedPaymentMethodOptions
    };
    setFormulas(newFormulasConfig);
    setOptSuccess('تمت استعادة الخيارات الافتراضية للقائمة بنجاح! 🔄');
    resetOptionForm();
    await persistFormulasImmediate(newFormulasConfig);
  };

  const handleSelectOptionAsActive = async (optionVal: string) => {
    if (!activeMethodForDropdown) return;
    setActiveFormulaForMethod(activeMethodForDropdown, optionVal);

    const newFormulasConfig: FormulasConfig = {
      ...formulas
    };
    if (activeMethodForDropdown === 'cash') newFormulasConfig.cashRefundFormula = optionVal;
    else if (activeMethodForDropdown === 'checks') newFormulasConfig.checksRefundFormula = optionVal;
    else if (activeMethodForDropdown === 'banks') newFormulasConfig.bankRefundFormula = optionVal;
    else if (activeMethodForDropdown === 'companies') newFormulasConfig.companyRefundFormula = optionVal;
    else {
      newFormulasConfig.customPaymentMethods = (formulas.customPaymentMethods || []).map(m => {
        if (m.id === activeMethodForDropdown || m.methodName === activeMethodForDropdown) {
          return { ...m, selectedFormula: optionVal };
        }
        return m;
      });
    }

    setFormulas(newFormulasConfig);
    setOptSuccess('تم تفعيل الخيار كمعادلة أساسية لطريقة الدفع هذه! ✅');
    await persistFormulasImmediate(newFormulasConfig);
  };

  const insertOptionVariable = (varName: string) => {
    setOptExpression(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + varName + ' ');
  };

  const handleAddCustomPaymentMethod = async () => {
    setNewCustomMethodError('');
    if (!newCustomMethodName.trim()) {
      setNewCustomMethodError('اسم طريقة الدفع مطلوب');
      return;
    }

    const customId = 'cpm_' + Date.now();
    const methodName = newCustomMethodName.trim();
    const badge = newCustomMethodBadge.trim() || methodName;
    const initialLabel = newCustomMethodInitialLabel.trim() || 'قيمة الاشتراك - إجمالي الخصم';
    const initialExpr = newCustomMethodInitialExpression.trim() || 'subscriptionValue - discountAmount';

    const defaultOpt: PaymentFormulaOption = {
      id: 'opt_' + Date.now(),
      label: initialLabel,
      value: 'opt_default_' + customId,
      description: initialLabel,
      expression: initialExpr,
      isCustom: true
    };

    const newMethod: CustomPaymentMethodFormula = {
      id: customId,
      methodName,
      badge,
      selectedFormula: defaultOpt.value,
      options: [defaultOpt]
    };

    const updatedCustom = [...(formulas.customPaymentMethods || []), newMethod];
    const updatedPaymentMethodOptions = {
      ...(formulas.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS),
      [customId]: [defaultOpt]
    };

    const newFormulasConfig: FormulasConfig = {
      ...formulas,
      customPaymentMethods: updatedCustom,
      paymentMethodOptions: updatedPaymentMethodOptions
    };

    setFormulas(newFormulasConfig);
    setCustomMethodModalOpen(false);
    setNewCustomMethodName('');
    setNewCustomMethodBadge('');
    setNewCustomMethodInitialLabel('');
    setNewCustomMethodInitialExpression('');
    setSuccessMsg('تمت إضافة طريقة الدفع وقائمتها المنسدلة بنجاح! 🎉');
    setTimeout(() => setSuccessMsg(''), 3500);
    await persistFormulasImmediate(newFormulasConfig);
  };

  const handleDeleteCustomPaymentMethod = async (customId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف طريقة الدفع المخصصة هذه وقوائمها؟')) return;

    const updatedCustom = (formulas.customPaymentMethods || []).filter(m => m.id !== customId);
    const updatedPaymentMethodOptions = { ...(formulas.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS) };
    delete updatedPaymentMethodOptions[customId];

    const newFormulasConfig: FormulasConfig = {
      ...formulas,
      customPaymentMethods: updatedCustom,
      paymentMethodOptions: updatedPaymentMethodOptions
    };

    setFormulas(newFormulasConfig);
    setSuccessMsg('تم حذف طريقة الدفع المخصصة بنجاح! 🗑️');
    setTimeout(() => setSuccessMsg(''), 3500);
    await persistFormulasImmediate(newFormulasConfig);
  };

  const persistFormulasImmediate = async (newFormulasConfig: FormulasConfig) => {
    try {
      const res = await fetch('/api/formulas', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          formulas: newFormulasConfig,
          recalculateScope: 'none'
        })
      });
      if (res.ok) {
        onRefreshAll();
      }
    } catch (err) {
      console.error('Error persisting formulas:', err);
    }
  };

  const handleOpenSaveDialog = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setPendingCustomField(null);
    setShowScopeModal(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (pendingCustomField) {
        const cfRes = await fetch('/api/custom-fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(pendingCustomField)
        });
        const cfData = await cfRes.json();
        if (!cfRes.ok) {
          throw new Error(cfData.error || 'فشل حفظ حقل المعادلة المخصص');
        }
        setCustomFields(cfData.customFields || []);
        setCfSuccess(editingFieldId ? 'تم تحديث حقل المعادلة بنجاح!' : 'تمت إضافة حقل المعادلة المخصص بنجاح!');
        resetCfForm();
        setPendingCustomField(null);
      }

      const res = await fetch('/api/formulas', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          formulas,
          recalculateScope: recalcScope
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حفظ القواعد والمعادلات الحسابية');
      }

      setFormulas(data.formulas);

      let scopeLabel = 'الطلبات الجديدة فقط';
      if (recalcScope === 'old') scopeLabel = 'الطلبات القديمة (السابقة) فقط';
      else if (recalcScope === 'all') scopeLabel = 'جميع الطلبات (الكل)';
      else if (recalcScope === 'none') scopeLabel = 'حفظ التكوين بدون تطبيق فورى';

      setSuccessMsg(`تم حفظ وتطبيق القواعد الحسابية بنجاح! [نطاق التطبيق: ${scopeLabel}] - تم إعادة احتساب ${data.updatedCount || 0} طلب.`);
      setShowScopeModal(false);
      onRefreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const updateRegularPercentage = (index: number, val: number) => {
    const updated = [...(formulas.regularUsagePercentages || [0.1, 0.2, 0.3, 0.4, 0.5])];
    updated[index] = val / 100;
    setFormulas({ ...formulas, regularUsagePercentages: updated });
  };

  const updateSmartPercentage = (index: number, val: number) => {
    const updated = [...(formulas.smartUsagePercentages || [0.15, 0.3, 0.45, 0.6, 0.75])];
    updated[index] = val / 100;
    setFormulas({ ...formulas, smartUsagePercentages: updated });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
        <p className="text-xs font-bold">جاري تحميل قواعد ومعادلات الاحتساب المالي...</p>
      </div>
    );
  }

  // Sample variables for formula live tester
  const sampleVars = {
    subscriptionValue: 100000,
    transferValue: 80000,
    cashAmount: 10000,
    visaAmount: 10000,
    checksPaid: 0,
    checksUnpaid: 0,
    advancePaid: 20000,
    annualRenewalDue: 2500,
    adminFees: 2500,
    usageFee: 16000,
    visaFees2Percent: 200,
    discountAmount: 18700,
    debtABKCompanies: 50000,
    refundAmount: 61300,
    days: 120
  };

  const testedVal = evaluateCustomFormula(cfExpression, sampleVars);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Eye-friendly Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-white p-6 rounded-3xl text-slate-800 shadow-xs relative overflow-hidden border border-amber-200/80">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-amber-400 text-neutral-950 rounded-2xl font-black shadow-xs">
                <Calculator className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-800">إدارة وتعديل المعادلات والقواعد الحسابية</h2>
                <p className="text-xs text-slate-600 mt-1">
                  التحكم الكامل في معادلات تصنيف الفترات، المصاريف الإدارية، مقابل الانتفاع، مبالغ الاسترداد، وإضافة حقول مخصصة جديدة بمعادلات مرنة مع تحديد مكان وجودها بالتصدير والمذكرة.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenSaveDialog}
            className="py-3 px-6 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <Save className="h-4 w-4" />
            <span>حفظ وتطبيق القواعد الحسابية</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-2xl flex items-center gap-3 shadow-xs">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleOpenSaveDialog} className="space-y-6">
        
        {/* SECTION 1: Period Classification & 1 July Cutoff Rule */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="h-5 w-5 text-amber-500" />
            <h3 className="font-black text-slate-800 text-sm">1. معادلة تصنيف فترة الاشتراك وتاريخ القطع (1 يوليو)</h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            تُحدد هذه القاعدة شرط احتساب فترة الاشتراك باليوم والتصنيف (اقل من 3 شهور للطلبات القديمة vs اقل من شهر للطلبات الجديدة من 1 يوليو فأحدث).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50/40 p-4 rounded-2xl border border-amber-200/50">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ تطبيق المعادلة الجديدة (تاريخ القطع)
              </label>
              <input
                type="date"
                value={formulas.cutoffDate}
                onChange={(e) => setFormulas({ ...formulas, cutoffDate: e.target.value })}
                className="w-full text-xs bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">تاريخ الاشتراك المقبول لتطبيق المعادلة المعدلة</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الحد الأقصى القديم (للداتا القديمة قبل تاريخ القطع)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formulas.oldDaysThreshold}
                  onChange={(e) => setFormulas({ ...formulas, oldDaysThreshold: parseInt(e.target.value) || 90 })}
                  className="w-24 text-xs bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={formulas.oldDaysLabel}
                  onChange={(e) => setFormulas({ ...formulas, oldDaysLabel: e.target.value })}
                  placeholder="اقل من 3 شهور"
                  className="flex-1 text-xs bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">أي فترة ≤ 90 يوم قبل 1 يوليو تسمى "اقل من 3 شهور"</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الحد الأقصى الجديد (للداتا الجديدة من 1 يوليو فأحدث)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formulas.newDaysThreshold}
                  onChange={(e) => setFormulas({ ...formulas, newDaysThreshold: parseInt(e.target.value) || 30 })}
                  className="w-24 text-xs bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={formulas.newDaysLabel}
                  onChange={(e) => setFormulas({ ...formulas, newDaysLabel: e.target.value })}
                  placeholder="اقل من شهر"
                  className="flex-1 text-xs bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">أي فترة ≤ 30 يوم بعد 1 يوليو تسمى "اقل من شهر"</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Administrative Fees & Visa Fee */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="h-5 w-5 text-amber-500" />
            <h3 className="font-black text-slate-800 text-sm">2. المصاريف الإدارية ومصاريف الفيزا 2%</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <label className="block text-xs font-bold text-slate-700">المصاريف الإدارية القياسية (Standard Admin Fee)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formulas.adminFeesStandard}
                  onChange={(e) => setFormulas({ ...formulas, adminFeesStandard: parseFloat(e.target.value) || 0 })}
                  className="w-36 text-xs bg-white border border-slate-200 text-amber-600 rounded-xl p-2.5 font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-xs font-bold text-slate-600">جنيه مصري</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                • العضوية الدولية (International) = <strong className="text-amber-600">0 ج.م</strong> تلقائياً.<br />
                • استثناء الشركات (Aman, Premium...): <strong className="text-amber-600">MIN(مبلغ المقدم - التجديد السنوي, المصاريف الإدارية)</strong> لحماية العميل إذا كان المقدم أقل من 2500 ج.م.
              </p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <label className="block text-xs font-bold text-slate-700">نسبة مصاريف الدفع بالفيزا (Visa Fee Percentage)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={(formulas.visaFeePercentage * 100).toFixed(1)}
                  onChange={(e) => setFormulas({ ...formulas, visaFeePercentage: (parseFloat(e.target.value) || 0) / 100 })}
                  className="w-36 text-xs bg-white border border-slate-200 text-amber-600 rounded-xl p-2.5 font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-xs font-bold text-slate-600">% من مبلغ مقدم الفيزا</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                تطبق النسبة مباشرة على قيمة خانة "مقدم فيزا" لخصمها ضمن مصاريف الخصم الكلي.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Usage Fees Rules & Rates */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 justify-between flex-wrap">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-sm">3. مقابل الانتفاع (نسب الاستخدام طبقاً لنوع العضوية والسنوات)</h3>
            </div>
            <div className="flex items-center gap-2 bg-amber-50/60 px-3 py-1.5 rounded-xl border border-amber-200/60">
              <span className="text-[10px] text-amber-900 font-bold">مبلغ أساس الخصم (للطرق العادية):</span>
              <select
                value={formulas.usageFeeBase}
                onChange={(e) => setFormulas({ ...formulas, usageFeeBase: e.target.value as any })}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="transferValue">قيمة التحويلة</option>
                <option value="subscriptionValue">قيمة الاشتراك الإجمالي</option>
              </select>
            </div>
          </div>

          {/* Company vs Non-Company Usage Fee Logic Note */}
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-2 text-xs text-slate-800">
            <div className="font-bold text-amber-900 flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-600" />
              <span>قواعد احتساب مقابل الانتفاع بحسب طريقة الدفع:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed pr-2">
              <li><strong>طرق الدفع العادية (نقداً / شيكات / ABK / البنوك):</strong> تُطبق جداول نسب الاستخدام (العضوية العادية Regular: 10%-50%، الذكية Smart: 15%-75%) حسب عدد السنوات ونوع العضوية.</li>
              <li><strong>طرق دفع الشركات وجهات التمويل (أمان / بريميوم / فاليو / شركات):</strong> يُحسب مقابل الانتفاع طبقاً لمعادلة المتبقي: <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono text-amber-800 font-bold">مقابل الانتفاع = net_amount - (المصاريف الإدارية + مصاريف الفيزا)</code> بشرط أن تكون مدة الاشتراك 3 شهور فأكثر، ويكون صافي المبلغ أكبر من المصاريف الإدارية والفيزا.</li>
            </ul>
          </div>

          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/70 text-xs text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <strong className="text-amber-900 text-xs font-black flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                تعديل وتخصيص شروط الإعفاء التلقائي من مقابل الانتفاع (Automatic Exemption Rules):
              </strong>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-100/80 px-2.5 py-1 rounded-lg">
                يمكنك إلغاء إعفاء أي شرط لتطبيق جدول نسب مقابل الانتفاع عليه
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. إعفاء الفترات القصيرة */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={
                    (formulas.usageFeeExemptTypes || []).includes(formulas.oldDaysLabel) || 
                    (formulas.usageFeeExemptTypes || []).includes(formulas.newDaysLabel) ||
                    (formulas.usageFeeExemptTypes || []).includes("اقل من 3 شهور") ||
                    (formulas.usageFeeExemptTypes || []).includes("اقل من شهر")
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let types = [...(formulas.usageFeeExemptTypes || [])];
                    if (checked) {
                      if (!types.includes(formulas.oldDaysLabel)) types.push(formulas.oldDaysLabel);
                      if (!types.includes(formulas.newDaysLabel)) types.push(formulas.newDaysLabel);
                      if (!types.includes("اقل من 3 شهور")) types.push("اقل من 3 شهور");
                      if (!types.includes("اقل من شهر")) types.push("اقل من شهر");
                    } else {
                      types = types.filter(t => t !== formulas.oldDaysLabel && t !== formulas.newDaysLabel && t !== "اقل من 3 شهور" && t !== "اقل من شهر");
                    }
                    setFormulas({ ...formulas, usageFeeExemptTypes: types });
                  }}
                  className="mt-0.5 h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block text-xs">إعفاء الفترات القصيرة (≤ 90 / 30 يوم)</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    إعفاء طلبات الاشتراكات ذات المدة القصيرة ({formulas.oldDaysLabel} أو {formulas.newDaysLabel}) من حق الانتفاع (0 ج.م).
                  </p>
                </div>
              </label>

              {/* 2. إعفاء فرع طنطا */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={(formulas.usageFeeExemptClubs || []).some(c => c && (c.toLowerCase().includes('tanta') || c.includes('طنطا')))}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let clubs = [...(formulas.usageFeeExemptClubs || [])];
                    if (checked) {
                      if (!clubs.some(c => c && c.toLowerCase() === 'tanta')) clubs.push('Tanta');
                      if (!clubs.some(c => c === 'طنطا')) clubs.push('طنطا');
                    } else {
                      clubs = clubs.filter(c => c && !c.toLowerCase().includes('tanta') && !c.includes('طنطا'));
                    }
                    setFormulas({ ...formulas, usageFeeExemptClubs: clubs });
                  }}
                  className="mt-0.5 h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block text-xs">إعفاء نادي فرع طنطا (Tanta Branch)</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {(formulas.usageFeeExemptClubs || []).some(c => c && (c.toLowerCase().includes('tanta') || c.includes('طنطا'))) 
                      ? "✓ فرع طنطا معفى تلقائياً (0 ج.م مقابل انتفاع)." 
                      : "✕ فرع طنطا غير معفى (سيتم تطبيق نسب الاستخدام 10%-75% عليه)."}
                  </p>
                </div>
              </label>

              {/* 3. إعفاء العضوية الدولية */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={(formulas.usageFeeExemptTypes || []).includes("International")}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let types = [...(formulas.usageFeeExemptTypes || [])];
                    if (checked) {
                      if (!types.includes("International")) types.push("International");
                    } else {
                      types = types.filter(t => t !== "International");
                    }
                    setFormulas({ ...formulas, usageFeeExemptTypes: types });
                  }}
                  className="mt-0.5 h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block text-xs">إعفاء العضوية الدولية (International)</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    إعفاء أعضاء العضويات الدولية من احتساب مقابل الانتفاع.
                  </p>
                </div>
              </label>

              {/* 4. إعفاء تقديم مستند جهة سيادية */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={(formulas.usageFeeExemptDocuments || []).some(d => d && d.includes('سيادية'))}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let docs = [...(formulas.usageFeeExemptDocuments || [])];
                    if (checked) {
                      if (!docs.includes('جهة سيادية')) docs.push('جهة سيادية');
                    } else {
                      docs = docs.filter(d => !d || !d.includes('سيادية'));
                    }
                    setFormulas({ ...formulas, usageFeeExemptDocuments: docs });
                  }}
                  className="mt-0.5 h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block text-xs">إعفاء مستندات الجهة السيادية</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    إعفاء الحالات التي تقدم خطاباً أو مستنداً من جهات سيادية.
                  </p>
                </div>
              </label>

              {/* 5. إعفاء مذكرات وملاحظات النادي */}
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={formulas.usageFeeExemptExceptions !== false}
                  onChange={(e) => setFormulas({ ...formulas, usageFeeExemptExceptions: e.target.checked })}
                  className="mt-0.5 h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block text-xs">اعتماد ملاحظات "بدون حق انتفاع"</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    تصفير مقابل الانتفاع تلقائياً إذا كُتب بالملاحظات "بدون حق انتفاع" أو اختيار نوع استثناء مقابل الانتفاع.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Regular Membership Rates */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center justify-between border-b border-slate-200 pb-2">
                <span>جدول نسب العضوية العادية (Regular)</span>
                <span className="text-[10px] text-amber-600 font-mono">10% - 50%</span>
              </h4>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[1, 2, 3, 4, 5].map((year, idx) => (
                  <div key={`reg-${year}`} className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block mb-1">{year} سنة</span>
                    <input
                      type="number"
                      step="1"
                      value={Math.round((formulas.regularUsagePercentages?.[idx] || 0) * 100)}
                      onChange={(e) => updateRegularPercentage(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-black text-slate-800 text-center focus:outline-none border-b border-amber-400 pb-0.5"
                    />
                    <span className="text-[9px] text-slate-400 font-bold block mt-1">%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Membership Rates */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center justify-between border-b border-slate-200 pb-2">
                <span>جدول نسب العضوية الذكية (Smart)</span>
                <span className="text-[10px] text-amber-600 font-mono">15% - 75%</span>
              </h4>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[1, 2, 3, 4, 5].map((year, idx) => (
                  <div key={`smart-${year}`} className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block mb-1">{year} سنة</span>
                    <input
                      type="number"
                      step="1"
                      value={Math.round((formulas.smartUsagePercentages?.[idx] || 0) * 100)}
                      onChange={(e) => updateSmartPercentage(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-black text-amber-600 text-center focus:outline-none border-b border-amber-400 pb-0.5"
                    />
                    <span className="text-[9px] text-slate-400 font-bold block mt-1">%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3.5: Exception Rules & Automated Discount Impact */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-sm">3.5 قواعد وتأثيرات الاستثناءات المخصصة والآلية (Automated Exception Rules)</h3>
            </div>
            <span className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1 rounded-full font-bold border border-amber-200/60">
              تأثير الاستثناء الآلي على الخصومات
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            يمكنك التحكم وتحديد تأثير أي استثناء عند اختيار استخدامه (إعفاء المصاريف الإدارية، إعفاء مقابل الانتفاع، إعفاء مصاريف الفيزا 2%).
            الاستثناءات الافتراضية المحددة بالنظام: <strong>عضوية دولية</strong> (إعفاء انتفاع وإدارية)، <strong>بدون خصم مصاريف ادارية</strong> (إعفاء إدارية وفيزا)، <strong>جهة سيادية</strong> (إعفاء انتفاع)، <strong>بدون رد اى مبلغ</strong> (تصفير الاسترداد والرد للعميل 0 ج.م). باقي الاستثناءات يمكن إضافة تأثير آلي لها أو خصمها يدوياً.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(formulas.exceptionRules || [
                { id: '1', name: 'عضوية دولية', exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
                { id: '2', name: 'بدون خصم مصاريف ادارية', exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
                { id: '3', name: 'جهة سيادية', exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
              ]).map((rule, idx) => (
                <div key={rule.id || idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 relative">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => {
                        const updated = [...(formulas.exceptionRules || [])];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setFormulas({ ...formulas, exceptionRules: updated });
                      }}
                      onBlur={() => {
                        persistExceptionRules(formulas.exceptionRules || []);
                      }}
                      className="text-xs font-black text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-400 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (formulas.exceptionRules || []).filter((_, i) => i !== idx);
                        persistExceptionRules(updated);
                      }}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      title="حذف الاستثناء"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.exemptAdminFee}
                        onChange={(e) => {
                          const updated = [...(formulas.exceptionRules || [])];
                          updated[idx] = { ...updated[idx], exemptAdminFee: e.target.checked };
                          persistExceptionRules(updated);
                        }}
                        className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                      />
                      <span>إعفاء المصاريف الإدارية (0 ج.م)</span>
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.exemptUsageFee}
                        onChange={(e) => {
                          const updated = [...(formulas.exceptionRules || [])];
                          updated[idx] = { ...updated[idx], exemptUsageFee: e.target.checked };
                          persistExceptionRules(updated);
                        }}
                        className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                      />
                      <span>إعفاء مقابل الانتفاع (0 ج.م)</span>
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-slate-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.exemptVisaFee}
                        onChange={(e) => {
                          const updated = [...(formulas.exceptionRules || [])];
                          updated[idx] = { ...updated[idx], exemptVisaFee: e.target.checked };
                          persistExceptionRules(updated);
                        }}
                        className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                      />
                      <span>إعفاء مصاريف الفيزا 2% (0 ج.م)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Exception Rule Form */}
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-600" />
                <span>إضافة استثناء جديد وتحديد التخصيص التلقائي للخصومات</span>
              </h4>

              <div className="flex flex-col md:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="اسم الاستثناء الجديد (مثال: خصم خاص، قرار رئيس مجلس إدارة...)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 flex-1 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full"
                />

                <div className="flex items-center gap-4 bg-white px-3 py-2 rounded-xl border border-slate-200 shrink-0">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRuleExemptAdmin}
                      onChange={(e) => setNewRuleExemptAdmin(e.target.checked)}
                      className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                    />
                    <span>إدارية</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRuleExemptUsage}
                      onChange={(e) => setNewRuleExemptUsage(e.target.checked)}
                      className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                    />
                    <span>انتفاع</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRuleExemptVisa}
                      onChange={(e) => setNewRuleExemptVisa(e.target.checked)}
                      className="h-3.5 w-3.5 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                    />
                    <span>فيزا</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!newRuleName.trim()) return;
                    const existing = formulas.exceptionRules || [
                      { id: '1', name: 'عضوية دولية', exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
                      { id: '2', name: 'بدون خصم مصاريف ادارية', exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
                      { id: '3', name: 'جهة سيادية', exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
                    ];
                    const updated = [
                      ...existing,
                      {
                        id: 'rule_' + Date.now(),
                        name: newRuleName.trim(),
                        exemptAdminFee: newRuleExemptAdmin,
                        exemptUsageFee: newRuleExemptUsage,
                        exemptVisaFee: newRuleExemptVisa
                      }
                    ];
                    persistExceptionRules(updated);
                    setNewRuleName('');
                    setNewRuleExemptAdmin(false);
                    setNewRuleExemptUsage(false);
                    setNewRuleExemptVisa(false);
                  }}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 w-full md:w-auto text-center"
                >
                  + إضافة الاستثناء
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Interactive Refund Formulas Configurator & Dropdown Control */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 text-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-400 text-neutral-950 rounded-xl font-black">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">4. إدارة وتعديل معادلات الاسترداد المالي حسب طريقة الدفع (تحكم كامل في القوائم المنسدلة)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يمكنك تعديل خيارات القوائم المنسدلة، إضافة خيارات جديدة، تعديل صيغ الحساب الرياضية، أو إضافة طرق دفع مخصصة.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNewCustomMethodName('');
                  setNewCustomMethodBadge('');
                  setNewCustomMethodInitialLabel('');
                  setNewCustomMethodInitialExpression('');
                  setNewCustomMethodError('');
                  setCustomMethodModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>+ إضافة طريقة دفع مخصصة</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Cash Refund Formula */}
            {(() => {
              const cashOpts = getOptionsForMethod('cash');
              const activeVal = getActiveFormulaForMethod('cash');
              const activeOpt = cashOpts.find(o => o.value === activeVal || o.id === activeVal) || cashOpts[0];
              return (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5 hover:border-amber-300/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                      <span className="font-bold text-xs text-slate-800">الدفع نقداً وفيزا (Cash & Visa)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">نقداً / فيزا</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('cash')}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="تحكم كامل وتعديل خيارات القائمة المنسدلة"
                      >
                        <Settings className="h-3 w-3 text-amber-600" />
                        <span>إدارة خيارات القائمة ({cashOpts.length})</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">اختر الأساس المستخدم في معادلة حساب المبلغ المسترد عند إلغاء اشتراك نقدي:</p>
                  <select
                    value={activeVal}
                    onChange={(e) => setActiveFormulaForMethod('cash', e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:border-amber-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {cashOpts.map((opt) => (
                      <option key={opt.id || opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>الشرح والمعادلة الحالية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('cash')}
                        className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        تعديل الخيارات ⚙️
                      </button>
                    </div>
                    <div className="font-mono text-amber-900 font-bold text-xs bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                      {activeOpt?.expression || activeOpt?.description || activeOpt?.label}
                    </div>
                    {activeOpt?.description && activeOpt.description !== activeOpt.label && (
                      <p className="text-[10.5px] text-slate-500 mt-1">{activeOpt.description}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 2. Checks Refund Formula */}
            {(() => {
              const checkOpts = getOptionsForMethod('checks');
              const activeVal = getActiveFormulaForMethod('checks');
              const activeOpt = checkOpts.find(o => o.value === activeVal || o.id === activeVal) || checkOpts[0];
              return (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5 hover:border-amber-300/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                      <span className="font-bold text-xs text-slate-800">الدفع بالشيكات (Checks)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-200">شيكات</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('checks')}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="تحكم كامل وتعديل خيارات القائمة المنسدلة"
                      >
                        <Settings className="h-3 w-3 text-amber-600" />
                        <span>إدارة خيارات القائمة ({checkOpts.length})</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">اختر معادلة احتساب الاسترداد المالي لطلبات الشيكات:</p>
                  <select
                    value={activeVal}
                    onChange={(e) => setActiveFormulaForMethod('checks', e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:border-amber-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {checkOpts.map((opt) => (
                      <option key={opt.id || opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>الشرح والمعادلة الحالية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('checks')}
                        className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        تعديل الخيارات ⚙️
                      </button>
                    </div>
                    <div className="font-mono text-amber-900 font-bold text-xs bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                      {activeOpt?.expression || activeOpt?.description || activeOpt?.label}
                    </div>
                    {activeOpt?.description && activeOpt.description !== activeOpt.label && (
                      <p className="text-[10.5px] text-slate-500 mt-1">{activeOpt.description}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3. Bank Transfer Refund Formula */}
            {(() => {
              const bankOpts = getOptionsForMethod('banks');
              const activeVal = getActiveFormulaForMethod('banks');
              const activeOpt = bankOpts.find(o => o.value === activeVal || o.id === activeVal) || bankOpts[0];
              return (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5 hover:border-amber-300/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                      <span className="font-bold text-xs text-slate-800">بنوك (ABK / المشرق / QNB)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md border border-indigo-200">بنوك</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('banks')}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="تحكم كامل وتعديل خيارات القائمة المنسدلة"
                      >
                        <Settings className="h-3 w-3 text-amber-600" />
                        <span>إدارة خيارات القائمة ({bankOpts.length})</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">اختر معادلة الاسترداد المالي لحسابات البنوك:</p>
                  <select
                    value={activeVal}
                    onChange={(e) => setActiveFormulaForMethod('banks', e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:border-amber-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {bankOpts.map((opt) => (
                      <option key={opt.id || opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>الشرح والمعادلة الحالية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('banks')}
                        className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        تعديل الخيارات ⚙️
                      </button>
                    </div>
                    <div className="font-mono text-amber-900 font-bold text-xs bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                      {activeOpt?.expression || activeOpt?.description || activeOpt?.label}
                    </div>
                    {activeOpt?.description && activeOpt.description !== activeOpt.label && (
                      <p className="text-[10.5px] text-slate-500 mt-1">{activeOpt.description}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 4. Finance Companies Refund Formula */}
            {(() => {
              const compOpts = getOptionsForMethod('companies');
              const activeVal = getActiveFormulaForMethod('companies');
              const activeOpt = compOpts.find(o => o.value === activeVal || o.id === activeVal) || compOpts[0];
              return (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5 hover:border-amber-300/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <span className="font-bold text-xs text-slate-800">شركات التمويل (Aman/Premium/Ollin...)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">تمويل</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('companies')}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="تحكم كامل وتعديل خيارات القائمة المنسدلة"
                      >
                        <Settings className="h-3 w-3 text-amber-600" />
                        <span>إدارة خيارات القائمة ({compOpts.length})</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">اختر كيفية احتساب الاسترداد المالي والرد للعميل في شركات التمويل:</p>
                  <select
                    value={activeVal}
                    onChange={(e) => setActiveFormulaForMethod('companies', e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:border-amber-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {compOpts.map((opt) => (
                      <option key={opt.id || opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>الشرح والمعادلة الحالية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager('companies')}
                        className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        تعديل الخيارات ⚙️
                      </button>
                    </div>
                    <div className="font-mono text-amber-900 font-bold text-xs bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                      {activeOpt?.expression || activeOpt?.description || activeOpt?.label}
                    </div>
                    {activeOpt?.description && activeOpt.description !== activeOpt.label && (
                      <p className="text-[10.5px] text-slate-500 mt-1">{activeOpt.description}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 5. Custom Added Payment Methods (if any) */}
            {(formulas.customPaymentMethods || []).map((cpm) => {
              const cpmOpts = getOptionsForMethod(cpm.id);
              const activeVal = cpm.selectedFormula || cpmOpts[0]?.value;
              const activeOpt = cpmOpts.find(o => o.value === activeVal || o.id === activeVal) || cpmOpts[0];
              return (
                <div key={cpm.id} className="bg-purple-50/40 p-5 rounded-2xl border border-purple-200/80 space-y-3.5 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span>
                      <span className="font-bold text-xs text-slate-800">طريقة مخصصة: {cpm.methodName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md border border-purple-200">{cpm.badge || 'مخصص'}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager(cpm.id)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="تحكم كامل وتعديل خيارات القائمة المنسدلة"
                      >
                        <Settings className="h-3 w-3 text-purple-600" />
                        <span>إدارة خيارات ({cpmOpts.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomPaymentMethod(cpm.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="حذف طريقة الدفع المخصصة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">اختر معادلة احتساب الاسترداد المالي المطبقة لطريقة الدفع {cpm.methodName}:</p>
                  <select
                    value={activeVal}
                    onChange={(e) => setActiveFormulaForMethod(cpm.id, e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:border-purple-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    {cpmOpts.map((opt) => (
                      <option key={opt.id || opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="bg-white p-3 rounded-xl border border-purple-100 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>الشرح والمعادلة الحالية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenDropdownManager(cpm.id)}
                        className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        تعديل الخيارات ⚙️
                      </button>
                    </div>
                    <div className="font-mono text-purple-950 font-bold text-xs bg-purple-50 p-2 rounded-lg border border-purple-100">
                      {activeOpt?.expression || activeOpt?.description || activeOpt?.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit button bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="py-3 px-8 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Save className="h-4 w-4" />
            <span>تحديث وحفظ القواعد الحسابية</span>
          </button>
        </div>

      </form>

      {/* SECTION 5: NEW CUSTOM FORMULA FIELDS (إضافة حقل بمعادلة جديدة) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 text-slate-800 mt-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-xl font-black">
              <FunctionSquare className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">5. حقول المعادلات والقواعد المخصصة (Custom Formula Fields)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إضافة حقل حسابي جديد بمعادلة مخصصة، واختيار تفعيله في التصدير Excel، والمذكرة المطبوعة، وتحديد مكانه بالضبط بالنموذج.
              </p>
            </div>
          </div>
        </div>

        {cfSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{cfSuccess}</span>
          </div>
        )}

        {cfError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{cfError}</span>
          </div>
        )}

        {/* Add / Edit Form Block */}
        <form onSubmit={handleSaveCustomFormulaField} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-black text-slate-800 text-xs">
              {editingFieldId ? 'تعديل حقل المعادلة المخصص' : 'إضافة حقل حسابي جديد بمعادلة (New Calculated Field)'}
            </span>
            {editingFieldId && (
              <button
                type="button"
                onClick={resetCfForm}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">اسم الحقل الحسابي بالعربية (Label)</label>
              <input
                type="text"
                required
                placeholder="مثال: ضريبة القيمة المضافة 14%"
                value={cfLabel}
                onChange={(e) => setCfLabel(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">المعرف البرمجي (Key)</label>
              <input
                type="text"
                placeholder="اختياري تلقائي: tax_14_percent"
                value={cfKey}
                onChange={(e) => setCfKey(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 font-mono rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Formula Builder */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-slate-800 font-black text-xs flex items-center gap-1.5">
                <Code className="h-4 w-4 text-amber-500" />
                المعادلة الحسابية (Formula Expression):
              </label>
              <span className="text-[10px] text-slate-400">انقر على الخانات أدناه لإدراجها بالمعادلة مباشرة</span>
            </div>

            {/* Quick Insertion Pills for Variables */}
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {[
                { name: 'subscriptionValue', label: 'قيمة الاشتراك' },
                { name: 'transferValue', label: 'قيمة التحويلة' },
                { name: 'cashAmount', label: 'نقداً' },
                { name: 'visaAmount', label: 'فيزا' },
                { name: 'adminFees', label: 'المصاريف الإدارية' },
                { name: 'usageFee', label: 'مقابل الانتفاع' },
                { name: 'visaFees2Percent', label: 'فيزا 2%' },
                { name: 'discountAmount', label: 'إجمالي الخصم' },
                { name: 'refundAmount', label: 'صافي الاسترداد' },
                { name: 'advancePaid', label: 'المقدم' },
                { name: 'debtABKCompanies', label: 'مديونية الشركة/البنك' },
                { name: 'annualRenewalDue', label: 'التجديد السنوي' },
                { name: 'days', label: 'عدد الأيام' },
              ].map(v => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => insertVariable(v.name)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 font-bold rounded-lg border border-slate-200 hover:border-amber-300 cursor-pointer transition-all active:scale-95"
                >
                  + {v.label}
                </button>
              ))}
            </div>

            {/* Quick Insertion Operators */}
            <div className="flex items-center gap-1.5 text-xs pt-1">
              {['+', '-', '*', '/', '(', ')', '%'].map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => insertVariable(op)}
                  className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-black rounded-lg border border-amber-200 cursor-pointer"
                >
                  {op}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              required
              placeholder="مثال: subscriptionValue * 0.14  أو  (subscriptionValue - discountAmount) * 0.05"
              value={cfExpression}
              onChange={(e) => setCfExpression(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none text-left dir-ltr"
            />

            {/* Live Formula Test Result */}
            {cfExpression.trim() && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <span className="text-slate-700 font-bold">نتيجة تجربة المعادلة عينة توضيحية:</span>
                <span className="font-mono text-amber-700 font-black text-sm bg-white px-3 py-1 rounded border border-amber-200 shadow-2xs">
                  {testedVal.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            )}
          </div>

          {/* Placement and Output Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-700 font-bold mb-1">مكان الظهور بنموذج الإدخال</label>
              <select
                value={cfSection}
                onChange={(e: any) => setCfSection(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="member">1. بيانات العضوية والمشترك</option>
                <option value="financial">2. المدخلات والمبالغ المالية</option>
                <option value="fees">3. الخصومات ومستحقات الاسترداد</option>
                <option value="cancellation">4. بيانات وسبب الإلغاء</option>
                <option value="notes">5. الملاحظات واللجنة الفنية</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">مكان الظهور في المذكرة المطبوعة</label>
              <select
                disabled={!cfShowInPrint}
                value={cfPrintSection}
                onChange={(e: any) => setCfPrintSection(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer disabled:opacity-40"
              >
                <option value="member_summary">ملخص بيانات المشترك العلوي</option>
                <option value="main_table">الجدول الرئيسي المالي</option>
                <option value="exceptions">قسم الشروط والاستثناءات</option>
                <option value="footer">تذييل وملاحظات المذكرة</option>
              </select>
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={cfShowInPrint}
                  onChange={(e) => setCfShowInPrint(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                />
                <span>تظهر في طباعة المذكرة (Print Memo)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={cfShowInExport}
                  onChange={(e) => setCfShowInExport(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                />
                <span>تظهر في تقرير تصدير البيانات Excel</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black rounded-xl cursor-pointer shadow-md transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {editingFieldId ? 'تحديث حقل المعادلة' : 'حفظ وإضافة حقل المعادلة المخصص'}
            </button>
          </div>
        </form>

        {/* Existing Custom Formula Fields List */}
        <div className="space-y-3 pt-2">
          <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-2">
            حقول المعادلات المخصصة المضافة حالياً ({customFields.filter(f => f.type === 'formula').length} حقل):
          </h4>

          {customFields.filter(f => f.type === 'formula').length === 0 ? (
            <div className="text-center py-6 text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              لا توجد حقول حسابية بمعادلات مخصصة حالياً.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {customFields.filter(f => f.type === 'formula').map(field => (
                <div
                  key={field.id}
                  className="bg-slate-50 border border-slate-200/80 hover:border-amber-300 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-800 text-sm">{field.label}</span>
                      <span className="bg-white text-slate-500 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-200">
                        key: {field.key}
                      </span>
                      <span className="bg-amber-100 text-amber-900 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold">
                        {field.formulaExpression}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                      <span><strong>الظهور بالمذكرة:</strong> {field.showInPrint ? `نعم (${field.printSection})` : 'لا'}</span>
                      <span>•</span>
                      <span><strong>تصدير Excel:</strong> {field.showInExport ? 'نعم' : 'لا'}</span>
                      <span>•</span>
                      <span><strong>القسم بالنموذج:</strong> {field.section}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditCf(field)}
                      className="p-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg cursor-pointer"
                      title="تعديل المعادلة"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCf(field.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer border border-rose-200"
                      title="حذف الحقل"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- SCOPE SELECTION MODAL --- */}
      {showScopeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl max-w-lg w-full space-y-5 text-slate-800">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl font-black">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-sm">تأكيد تعديل القواعد والمعادلات الحسابية</h4>
                <p className="text-[11px] text-slate-500">يرجى تحديد نطاق تطبيق هذا التعديل الحسابي على طلبات الإلغاء</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="new"
                  checked={recalcScope === 'new'}
                  onChange={() => setRecalcScope('new')}
                  className="mt-1 accent-amber-500 h-4 w-4 shrink-0"
                />
                <div>
                  <strong className="text-slate-800 block text-xs font-black">1. تطبيق التعديل على الطلبات الجديدة فقط</strong>
                  <span className="text-[11px] text-slate-500 block mt-0.5">تطبيق القواعد المعدلة على الطلبات الجديدة المستقبلية، مع الحفاظ على نتائج الطلبات القديمة المحسوبة سابقاً دون أي تغيير.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="old"
                  checked={recalcScope === 'old'}
                  onChange={() => setRecalcScope('old')}
                  className="mt-1 accent-amber-500 h-4 w-4 shrink-0"
                />
                <div>
                  <strong className="text-slate-800 block text-xs font-black">2. تطبيق التعديل على الطلبات القديمة (السابقة) فقط</strong>
                  <span className="text-[11px] text-slate-500 block mt-0.5">إعادة احتساب وتحديث القيم والحسابات للطلبات المسجلة سابقاً بالمنظومة فقط، دون التأثير على قواعد الطلبات الجديدة.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={recalcScope === 'all'}
                  onChange={() => setRecalcScope('all')}
                  className="mt-1 accent-amber-500 h-4 w-4 shrink-0"
                />
                <div>
                  <strong className="text-slate-800 block text-xs font-black">3. تطبيق التعديل على جميع الطلبات (الكل - السابقة والجديدة)</strong>
                  <span className="text-[11px] text-slate-500 block mt-0.5">إعادة احتساب شاملة وتطبيق التعديل على كافة طلبات الإلغاء المسجلة بالمنظومة بالكامل.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="none"
                  checked={recalcScope === 'none'}
                  onChange={() => setRecalcScope('none')}
                  className="mt-1 accent-amber-500 h-4 w-4 shrink-0"
                />
                <div>
                  <strong className="text-slate-800 block text-xs font-black">4. حفظ التكوين والقواعد فقط بدون إعادة احتساب فورية</strong>
                  <span className="text-[11px] text-slate-500 block mt-0.5">حفظ التعديلات في النظام للاستخدام المستقبلي دون إجراء تغييرات فورية على الطلبات القائمة.</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowScopeModal(false);
                  setPendingCustomField(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black rounded-xl cursor-pointer flex items-center gap-2 active:scale-95 transition-all shadow-sm"
              >
                {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>تأكيد الحفظ والتطبيق</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DROPDOWN OPTIONS & FORMULAS MANAGER MODAL (تحكم كامل في خيارات القائمة المنسدلة) --- */}
      {dropdownModalOpen && activeMethodForDropdown && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl max-w-4xl w-full space-y-5 text-slate-800 my-8 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-2xl font-black">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-800 text-base">
                      إدارة وتعديل خيارات القائمة المنسدلة: {getMethodTitle(activeMethodForDropdown).title}
                    </h4>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                      {getMethodTitle(activeMethodForDropdown).badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تحكم كامل بإضافة، تعديل، حذف خيارات القائمة المنسدلة، وتخصيص معادلة الاسترداد المالي المرتبطة بكل خيار.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDropdownModalOpen(false);
                  setActiveMethodForDropdown(null);
                  resetOptionForm();
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alert Messages inside Modal */}
            {optSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{optSuccess}</span>
              </div>
            )}
            {optError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{optError}</span>
              </div>
            )}

            {/* Grid Layout: Left Column (Add/Edit Form), Right Column (Existing Options List) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Right Column (List of Current Dropdown Options) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-800">
                      الخيارات الحالية بالقائمة ({getOptionsForMethod(activeMethodForDropdown).length})
                    </span>
                  </div>
                  {DEFAULT_PAYMENT_METHOD_OPTIONS[activeMethodForDropdown] && (
                    <button
                      type="button"
                      onClick={() => handleResetMethodDefaults(activeMethodForDropdown)}
                      className="text-[11px] text-slate-500 hover:text-amber-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      title="استعادة الخيارات الافتراضية الأصلية لهذه القائمة"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>استعادة الافتراضي</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {getOptionsForMethod(activeMethodForDropdown).map((opt, idx) => {
                    const isActive = getActiveFormulaForMethod(activeMethodForDropdown) === opt.value || getActiveFormulaForMethod(activeMethodForDropdown) === opt.id;
                    const isBeingEdited = editingOptionId === opt.id || editingOptionId === opt.value;

                    return (
                      <div
                        key={opt.id || opt.value || idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-amber-50/50 border-amber-300/80 shadow-xs'
                            : isBeingEdited
                            ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{opt.label}</span>
                              {isActive && (
                                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" />
                                  <span>مفعل حالياً</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              الرمز: <span className="text-slate-700 font-bold">{opt.value}</span>
                            </div>
                            {opt.description && opt.description !== opt.label && (
                              <p className="text-[11px] text-slate-600">{opt.description}</p>
                            )}
                            {opt.expression && (
                              <div className="mt-1 bg-white p-2 rounded-lg border border-slate-200/80 text-[10.5px] font-mono text-amber-900">
                                📐 المعادلة: <span className="font-bold">{opt.expression}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => handleSelectOptionAsActive(opt.value)}
                                className="px-2.5 py-1 bg-white hover:bg-amber-400 hover:text-neutral-950 text-slate-700 border border-slate-200 hover:border-amber-400 font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                title="تعيين كخيار افتراضي مفعل حالياً"
                              >
                                <Check className="h-2.5 w-2.5" />
                                <span>تفعيل</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEditOption(opt)}
                              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                              title="تعديل هذا الخيار"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDropdownOption(opt.id || opt.value, opt.value)}
                              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                              title="حذف هذا الخيار من القائمة"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left Column (Add / Edit Form) */}
              <div className="lg:col-span-6 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <FunctionSquare className="h-4 w-4 text-amber-600" />
                    <span className="font-black text-slate-800 text-xs">
                      {editingOptionId ? '✏️ تعديل بيانات الخيار' : '➕ إضافة خيار جديد للقائمة المنسدلة'}
                    </span>
                  </div>
                  {editingOptionId && (
                    <button
                      type="button"
                      onClick={resetOptionForm}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      اسم الخيار الظاهر في القائمة المنسدلة (Label) *
                    </label>
                    <input
                      type="text"
                      value={optLabel}
                      onChange={(e) => setOptLabel(e.target.value)}
                      placeholder="مثال: قيمة الاشتراك - 5% مصاريف"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      الرمز أو المعرف البرمجي (Key) <span className="text-[10px] text-slate-400">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={optValue}
                      onChange={(e) => setOptValue(e.target.value)}
                      placeholder="مثال: custom_cash_option_1"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-800 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      الوصف والشرح التوضيحي (Description)
                    </label>
                    <input
                      type="text"
                      value={optDescription}
                      onChange={(e) => setOptDescription(e.target.value)}
                      placeholder="شرح مختصر لطريقة الحساب والتطبيق"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-bold">
                        صيغة المعادلة الحسابية المخصصة (Formula Expression)
                      </label>
                      <span className="text-[10px] text-amber-700 font-bold">اضغط لإدراج المتغيرات ⬇️</span>
                    </div>

                    {/* Variable insertion buttons */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 mb-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {[
                        { label: '+ قيمة الاشتراك', key: 'subscriptionValue' },
                        { label: '+ قيمة التحويلة', key: 'transferValue' },
                        { label: '+ نقداً', key: 'cashAmount' },
                        { label: '+ فيزا', key: 'visaAmount' },
                        { label: '+ المقدم', key: 'advancePaid' },
                        { label: '+ شيكات مسددة', key: 'checksPaid' },
                        { label: '+ شيكات غير مسددة', key: 'checksUnpaid' },
                        { label: '+ إجمالي الخصم', key: 'discountAmount' },
                        { label: '+ مصاريف إدارية', key: 'adminFees' },
                        { label: '+ مقابل الانتفاع', key: 'usageFee' },
                        { label: '+ مصاريف فيزا 2%', key: 'visaFees2Percent' },
                        { label: '+ مديونية التمويل', key: 'debtABKCompanies' },
                        { label: '+ عدد الأيام', key: 'days' }
                      ].map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertOptionVariable(v.key)}
                          className="px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* Operators */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-slate-400 font-bold">العمليات:</span>
                      {['+', '-', '*', '/', '(', ')'].map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => insertOptionVariable(op)}
                          className="w-7 h-6 bg-slate-200 hover:bg-slate-300 font-black text-slate-800 text-xs rounded-md transition-all cursor-pointer flex items-center justify-center font-mono"
                        >
                          {op}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      value={optExpression}
                      onChange={(e) => setOptExpression(e.target.value)}
                      placeholder="مثال: subscriptionValue - discountAmount"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-amber-900 font-bold focus:border-amber-400 focus:outline-none"
                    />

                    {/* Live Calculator preview */}
                    {optExpression.trim() && (
                      <div className="mt-2 p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-amber-900">
                          <span>🔬 تجربة واختبار المعادلة فورياً (قيم تجريبية):</span>
                          {(() => {
                            try {
                              const testVars = {
                                subscriptionValue: 50000,
                                transferValue: 50000,
                                cashAmount: 10000,
                                visaAmount: 10000,
                                advancePaid: 20000,
                                checksPaid: 15000,
                                checksUnpaid: 15000,
                                adminFees: 2500,
                                usageFee: 5000,
                                visaFees2Percent: 200,
                                discountAmount: 7700,
                                debtABKCompanies: 20000,
                                days: 120,
                                net_amount: 30000
                              };
                              const res = evaluateCustomFormula(optExpression, testVars);
                              return (
                                <span className="font-mono bg-amber-200/80 text-neutral-950 px-2 py-0.5 rounded-md font-black">
                                  الناتج: {res.toLocaleString('ar-EG')} ج.م
                                </span>
                              );
                            } catch (e) {
                              return <span className="text-rose-600 text-[10px]">صيغة غير مكتملة</span>;
                            }
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          (بافتراض: اشتراك=50,000 | إجمالي الخصم=7,700 | مديونية=20,000 | أيام=120)
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveDropdownOption}
                      className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <Save className="h-4 w-4" />
                      <span>{editingOptionId ? 'حفظ وتحديث الخيار في القائمة' : 'إضافة الخيار الجديد للقائمة'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDropdownModalOpen(false);
                  setActiveMethodForDropdown(null);
                  resetOptionForm();
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD CUSTOM PAYMENT METHOD MODAL --- */}
      {customMethodModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl max-w-md w-full space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-neutral-950 rounded-xl font-black">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm">إضافة طريقة دفع مخصصة جديدة</h4>
                  <p className="text-[11px] text-slate-500">إنشاء طريقة دفع مع قائمة منسدلة ومعادلات خاصة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomMethodModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {newCustomMethodError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{newCustomMethodError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم طريقة الدفع *</label>
                <input
                  type="text"
                  value={newCustomMethodName}
                  onChange={(e) => setNewCustomMethodName(e.target.value)}
                  placeholder="مثال: فاليو (ValU) أو أقساط مباشرة"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الشارة المختصرة (Badge)</label>
                <input
                  type="text"
                  value={newCustomMethodBadge}
                  onChange={(e) => setNewCustomMethodBadge(e.target.value)}
                  placeholder="مثال: فاليو"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم الخيار الأول في القائمة</label>
                <input
                  type="text"
                  value={newCustomMethodInitialLabel}
                  onChange={(e) => setNewCustomMethodInitialLabel(e.target.value)}
                  placeholder="مثال: قيمة الاشتراك - إجمالي الخصم"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">صيغة المعادلة الحسابية</label>
                <input
                  type="text"
                  value={newCustomMethodInitialExpression}
                  onChange={(e) => setNewCustomMethodInitialExpression(e.target.value)}
                  placeholder="مثال: subscriptionValue - discountAmount"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-amber-900 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setCustomMethodModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddCustomPaymentMethod}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black rounded-xl cursor-pointer transition-all shadow-xs"
              >
                حفظ وإضافة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
