import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: (string | MultiSelectOption)[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  className?: string;
}

export default function MultiSelect({
  options,
  selected = [],
  onChange,
  placeholder,
  className = '',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to { label, value }
  const normalizedOptions: MultiSelectOption[] = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === normalizedOptions.length) {
      onChange([]);
    } else {
      onChange(normalizedOptions.map(o => o.value));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Label text display
  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const found = normalizedOptions.find(o => o.value === selected[0]);
      return found ? found.label : selected[0];
    }
    if (selected.length === normalizedOptions.length) {
      return `الكل (${selected.length})`;
    }
    return `${selected.length} محددة`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors text-right cursor-pointer"
      >
        <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
          {selected.length > 0 && (
            <span className="bg-amber-400 text-neutral-950 font-black text-[10px] px-1.5 py-0.5 rounded-md shrink-0">
              {selected.length}
            </span>
          )}
          <span className={`font-medium ${selected.length > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
            {getDisplayText()}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
              title="تفريغ التحديد"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Options Panel Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 text-right">
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1 text-xs font-bold text-slate-500">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-amber-600 hover:text-amber-700 cursor-pointer hover:underline text-[11px]"
            >
              {selected.length === normalizedOptions.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-rose-600 hover:text-rose-700 cursor-pointer hover:underline text-[11px]"
              >
                مسح التحديد
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 pl-1">
            {normalizedOptions.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-2">لا توجد خيارات</div>
            ) : (
              normalizedOptions.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleOption(opt.value);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isChecked 
                        ? 'bg-amber-50 text-amber-950 font-bold' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate ml-2">{opt.label}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked 
                        ? 'bg-amber-500 border-amber-500 text-white' 
                        : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
