import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoveHorizontal } from 'lucide-react';

interface TableScrollWrapperProps {
  children: React.ReactNode;
  className?: string;
  showBarAlways?: boolean;
}

export default function TableScrollWrapper({ children, className = '', showBarAlways = true }: TableScrollWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 (far right) to 100 (far left)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      
      const isScrollable = maxScroll > 5;
      setCanScroll(isScrollable);

      if (maxScroll > 0) {
        const absLeft = Math.abs(scrollLeft);
        const pct = Math.min(100, Math.max(0, Math.round((absLeft / maxScroll) * 100)));
        setScrollProgress(pct);
      } else {
        setScrollProgress(0);
      }
    }
  };

  useEffect(() => {
    checkScroll();
    // Re-check after layout shifts or image/font loads
    const timer = setTimeout(checkScroll, 200);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children]);

  const scrollToPct = (pct: number) => {
    if (!scrollRef.current) return;
    const { scrollWidth, clientWidth, scrollLeft } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) return;

    const targetAbs = (pct / 100) * maxScroll;
    // Determine sign of scrollLeft in RTL (usually negative or 0 in modern Chrome)
    // If scrollLeft is negative or zero, target is negative
    const isNegativeMode = scrollLeft <= 0;
    const targetLeft = isNegativeMode ? -targetAbs : targetAbs;

    scrollRef.current.scrollTo({
      left: targetLeft,
      behavior: 'smooth'
    });
    setScrollProgress(pct);
  };

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -350, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 350, behavior: 'smooth' });
    }
  };

  const handleScrollToStart = () => {
    if (scrollRef.current) {
      // In RTL, far right is scroll position 0 or positive large
      const isNegativeMode = scrollRef.current.scrollLeft <= 0;
      scrollRef.current.scrollTo({ left: isNegativeMode ? 0 : 10000, behavior: 'smooth' });
    }
  };

  const handleScrollToEnd = () => {
    if (scrollRef.current) {
      // In RTL, far left is negative maxScroll
      const { scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const isNegativeMode = scrollRef.current.scrollLeft <= 0;
      scrollRef.current.scrollTo({ left: isNegativeMode ? -maxScroll : 0, behavior: 'smooth' });
    }
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPct = Number(e.target.value);
    scrollToPct(newPct);
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Scrollable Container */}
      <div 
        ref={scrollRef} 
        onScroll={checkScroll}
        className="overflow-x-auto scroll-smooth w-full custom-table-scrollbar"
      >
        {children}
      </div>

      {/* Bottom Left-Right Bar (شريط التمرير والتنقل أفقياً) */}
      {(canScroll || showBarAlways) && (
        <div className="sticky bottom-0 z-20 bg-slate-100/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 text-slate-700 text-xs select-none no-print shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 shrink-0">
            <MoveHorizontal className="w-4 h-4 text-amber-500 shrink-0" />
            {canScroll && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold font-mono">
                {scrollProgress}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-1 max-w-xl mx-2">
            {/* Scroll Far Right (أول الجدول) */}
            <button
              type="button"
              onClick={handleScrollToStart}
              className="p-1.5 bg-white hover:bg-amber-50 border border-slate-300 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs text-xs shrink-0 active:scale-95"
              title="الانتقال إلى بداية الجدول (يمين)"
            >
              <ChevronsRight className="w-4 h-4 text-amber-600" />
            </button>

            {/* Scroll Right */}
            <button
              type="button"
              onClick={handleScrollRight}
              className="p-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-2xs text-xs shrink-0 active:scale-95"
              title="تحريك يميناً"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Interactive Range Slider Track */}
            <div className="flex-1 flex items-center px-1">
              <input
                type="range"
                min={0}
                max={100}
                value={scrollProgress}
                onChange={handleRangeChange}
                disabled={!canScroll}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                title="اسحب شريط التمرير لرؤية جميع الأعمدة"
              />
            </div>

            {/* Scroll Left */}
            <button
              type="button"
              onClick={handleScrollLeft}
              className="p-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-2xs text-xs shrink-0 active:scale-95"
              title="تحريك يساراً"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scroll Far Left (آخر الجدول) */}
            <button
              type="button"
              onClick={handleScrollToEnd}
              className="p-1.5 bg-white hover:bg-amber-50 border border-slate-300 rounded-lg font-bold text-slate-700 hover:text-amber-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs text-xs shrink-0 active:scale-95"
              title="الانتقال إلى نهاية الجدول (يسار)"
            >
              <ChevronsLeft className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
