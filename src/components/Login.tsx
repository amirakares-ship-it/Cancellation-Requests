import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // First Login Force Reset States
  const [forceReset, setForceReset] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = {};
        }
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          if (!res.ok) {
            throw new Error(text && text.length < 200 ? text : `تعذر الاتصال بـ API الخادم (رمز الخطأ ${res.status}).`);
          }
        }
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `فشل تسجيل الدخول (رمز الخطأ ${res.status}): اسم المستخدم أو كلمة المرور غير صحيحة أو تعذر الوصول لقاعدة البيانات`);
      }

      // Check if first login force reset is required (default password 123)
      if (data.user.firstLogin || password === '123') {
        setTempToken(data.token);
        setTempUser(data.user);
        setForceReset(true);
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setResetError('جميع حقول كلمة المرور مطلوبة');
      return;
    }

    if (newPassword.length < 4) {
      setResetError('كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل');
      return;
    }

    if (newPassword === '123') {
      setResetError('لا يمكن استخدام كلمة المرور الافتراضية 123 ككلمة مرور جديدة');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('كلمتا المرور غير متطابقتين');
      return;
    }

    setResetError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ currentPassword: password, newPassword })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          if (!res.ok) {
            throw new Error(`تعذر الاتصال بـ API الخادم (رمز الخطأ ${res.status}).`);
          }
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'فشل تغيير كلمة المرور');
      }

      // Successfully reset, proceed to log user in with updated flags
      const updatedUser = { ...tempUser, firstLogin: false, passwordChanged: true };
      onLoginSuccess(tempToken, updatedUser);
    } catch (err: any) {
      setResetError(err.message || 'حدث خطأ أثناء حفظ كلمة المرور الجديدة');
    } finally {
      setLoading(false);
    }
  };

  if (forceReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8 font-sans" dir="rtl">
        <div className="max-w-md w-full space-y-8 bg-neutral-900 p-8 rounded-2xl shadow-2xl border border-neutral-800">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 border border-amber-400/20">
              <Key className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white">حماية وتأمين الحساب</h2>
            <p className="mt-2 text-sm text-neutral-400">
              مرحباً <span className="font-semibold text-amber-400">{tempUser?.name}</span>. هذه المرة الأولى التي تقوم فيها بتسجيل الدخول باستخدام كلمة المرور الافتراضية. يرجى اختيار كلمة مرور جديدة لمتابعة الدخول.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
            {resetError && (
              <div className="p-3 bg-rose-950/50 border-r-4 border-rose-500 text-rose-200 text-sm rounded-md">
                {resetError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">كلمة المرور الجديدة</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pr-10 pl-3 py-2 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-right text-white bg-neutral-800"
                    placeholder="أدخل كلمة مرور قوية"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pr-10 pl-3 py-2 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-right text-white bg-neutral-800"
                    placeholder="أعد كتابة كلمة المرور"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-black rounded-lg text-neutral-950 bg-amber-400 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {loading ? 'جاري حفظ كلمة المرور...' : 'حفظ كلمة المرور ومتابعة الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="max-w-md w-full space-y-8 bg-neutral-900 p-10 rounded-3xl shadow-2xl border border-neutral-800">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-neutral-800 rounded-2xl flex items-center justify-center border border-neutral-700 text-amber-400 shadow-lg mb-6">
            <Shield className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">نظام إدارة طلبات إلغاء العضويات</h2>
          <p className="mt-2 text-sm text-amber-400 font-bold">شركة أندية وادى دجلة — Wadi Degla Clubs</p>
          <p className="mt-1 text-xs text-neutral-500">الإصدار 1.0 (يونيو 2026)</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="p-3 bg-rose-950/50 border-r-4 border-rose-500 text-rose-200 text-sm rounded-md text-right">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-300 text-right mb-1">اسم المستخدم</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2.5 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-right text-white bg-neutral-800 focus:bg-neutral-800/80 transition-colors"
                  placeholder="مثال: admin أو sheraton_club"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300 text-right mb-1">كلمة المرور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pr-10 pl-3 py-2.5 border border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-right text-white bg-neutral-800 focus:bg-neutral-800/80 transition-colors"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-black rounded-xl text-neutral-950 bg-amber-400 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 disabled:opacity-50 cursor-pointer shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            {loading ? 'جاري التحقق من الهوية...' : 'تسجيل الدخول الآمن'}
          </button>
        </form>
      </div>
    </div>
  );
}
