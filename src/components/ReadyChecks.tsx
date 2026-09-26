import React, { useState } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import { User } from '../types';
import ChecksTypeList from './ChecksTypeList';

interface ReadyChecksProps {
  user: User;
  authToken: string;
  onDataChanged?: () => void;
}

export default function ReadyChecks({ user, authToken, onDataChanged }: ReadyChecksProps) {
  const [activeSubTab, setActiveSubTab] = useState<'advance' | 'bank'>('advance');

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab('advance')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'advance' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>شيك المقدم</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('bank')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'bank' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>الشيكات البنكية</span>
        </button>
      </div>

      <ChecksTypeList
        user={user}
        authToken={authToken}
        checkType={activeSubTab}
        onDataChanged={onDataChanged}
      />
    </div>
  );
}
