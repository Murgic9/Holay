import { AccessLog, Staff } from '../models/index.js';
import { sequelize } from '../db/index.js';
import { verifyChain } from '../utils/hashChain.js';

/**
 * GET /logs
 * Retrieve all access logs, most recent first, with limit & offset pagination.
 */
export async function getLogs(req, res) {
  try {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const { count, rows } = await AccessLog.findAndCountAll({
      order: [['id', 'DESC']],
      limit,
      offset
    });

    return res.json({
      total: count,
      limit,
      offset,
      logs: rows.map((r) => r.toJSON())
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve access logs' });
  }
}

/**
 * GET /logs/emergency
 * Retrieve emergency access events separately so they remain prominent in audit views.
 */
export async function getEmergencyLogs(req, res) {
  try {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { count, rows } = await AccessLog.findAndCountAll({
      where: { action: 'EMERGENCY_ACCESS' },
      order: [['id', 'DESC']],
      limit,
      offset
    });

    return res.json({ total: count, limit, offset, logs: rows.map((row) => row.toJSON()) });
  } catch (err) {
    console.error('Error fetching emergency logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve emergency logs' });
  }
}

/**
 * GET /logs/verify
 * Cryptographically verifies the hash chain and verifies against the latest anchor.
 */
export async function verifyChainHandler(req, res) {
  try {
    const result = await verifyChain();
    return res.json(result);
  } catch (err) {
    console.error('Error verifying chain:', err);
    return res.status(500).json({ error: 'Failed to verify cryptographic chain' });
  }
}

/**
 * GET /logs/overrides/summary
 * Returns a list of staff ranked by their count of EMERGENCY_ACCESS log entries, descending.
 */
export async function getOverridesSummary(req, res) {
  try {
    const [summary] = await sequelize.query(`
      SELECT 
        s.id AS staff_id,
        s.name AS staff_name,
        s.role AS staff_role,
        COUNT(l.id) AS emergency_access_count,
        MAX(l.timestamp) AS last_emergency_access_at
      FROM access_logs l
      JOIN staff s ON l.staff_id = s.id
      WHERE l.action = 'EMERGENCY_ACCESS'
      GROUP BY s.id, s.name, s.role
      ORDER BY emergency_access_count DESC, last_emergency_access_at DESC
    `);

    return res.json({
      description: 'Staff members ranked by emergency override frequency',
      totalEmergencyOverrides: summary.reduce((acc, row) => acc + Number(row.emergency_access_count), 0),
      rankings: summary
    });
  } catch (err) {
    console.error('Error computing overrides summary:', err);
    return res.status(500).json({ error: 'Failed to compute emergency override summary' });
  }
}

export default {
  getLogs,
  getEmergencyLogs,
  verifyChainHandler,
  getOverridesSummary
};
