type RouteAccess = { committee: boolean; hasHouse: boolean; admin: boolean }

export function getMobileBackFallback(pathname: string, { committee, hasHouse, admin }: RouteAccess): '/' | '/more' {
  if (pathname === '/announcements' || pathname === '/reports' || pathname === '/profile') return '/more'
  if (pathname === '/payments/upload' || pathname === '/payments/history') return !committee || hasHouse ? '/more' : '/'
  if (pathname === '/repairs' || pathname.startsWith('/repairs/')) return !committee || hasHouse ? '/more' : '/'
  if (pathname === '/maintenance' || pathname.startsWith('/maintenance/') || pathname === '/finance' || pathname === '/admin/payment-status' || pathname === '/admin/contractors' || pathname === '/assets' || pathname.startsWith('/assets/')) {
    return committee ? '/more' : '/'
  }
  if (pathname === '/admin/houses' || pathname === '/admin/settings' || pathname === '/admin/password-requests') return admin ? '/more' : '/'
  return '/'
}
