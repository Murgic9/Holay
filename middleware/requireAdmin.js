export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export function requireSupervisor(req, res, next) {
  if (!req.user || !['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Supervisor access required' });
  }
  next();
}
