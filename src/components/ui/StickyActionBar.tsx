import type { ReactNode } from 'react'

export function StickyActionBar({ children, hasBottomNav = true }: { children: ReactNode; hasBottomNav?: boolean }) {
  return (
    <>
      <div className={`fixed inset-x-0 z-20 flex border-t border-outline-soft bg-surface px-4 shadow-nav lg:static lg:justify-end lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none ${hasBottomNav ? 'bottom-[calc(72px+env(safe-area-inset-bottom))] py-3' : 'bottom-0 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]'}`}>
        {children}
      </div>
      <div aria-hidden="true" className="h-[calc(52px+1.5rem+1px)] lg:hidden" />
    </>
  )
}
