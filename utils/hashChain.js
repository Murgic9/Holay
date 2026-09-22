import crypto from 'crypto';
import { AccessLog, ChainAnchor } from '../models/index.js';

export const GENESIS_PREV_HASH = '0'.repeat(64);

export function buildCanonicalString(entry) {
  const normalize = (v) => (v === null || v === undefined ? '' : String(v));

  let ts = entry.timestamp;
  if (ts instanceof Date) {
    ts = ts.toISOString();
  }

  return [
    normalize(entry.prev_hash),
    normalize(entry.staff_id),
    normalize(entry.patient_id),
    normalize(entry.action),
    normalize(entry.result),
    normalize(entry.reason),
    normalize(entry.staff_ward_at_time),
    normalize(entry.patient_ward_at_time),
    normalize(ts)
  ].join('|');
}

export function computeHash(canonicalString) {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export async function appendAuditLog({
  staff_id,
  patient_id = null,
  action,
  result,
  reason = null,
  staff_ward_at_time,
  patient_ward_at_time = null,
  timestamp = new Date().toISOString()
}) {
  const lastRow = await AccessLog.findOne({
    order: [['id', 'DESC']]
  });
  const prev_hash = lastRow ? lastRow.entry_hash : GENESIS_PREV_HASH;

  const canonicalString = buildCanonicalString({
    prev_hash,
    staff_id,
    patient_id,
    action,
    result,
    reason,
    staff_ward_at_time,
    patient_ward_at_time,
    timestamp
  });

  const entry_hash = computeHash(canonicalString);

  const newLog = await AccessLog.create({
    staff_id,
    patient_id,
    action,
    result,
    reason,
    staff_ward_at_time,
    patient_ward_at_time,
    timestamp,
    prev_hash,
    entry_hash
  });

  return newLog.toJSON();
}


export async function anchorChain() {
  const latestRow = await AccessLog.findOne({
    order: [['id', 'DESC']]
  });
  if (!latestRow) {
    return null;
  }

  const now = new Date();
  const anchor = await ChainAnchor.create({
    anchor_hash: latestRow.entry_hash,
    row_id_at_anchor: latestRow.id,
    created_at: now.toISOString()
  });

  return anchor.toJSON();
}

export async function verifyChain() {
  const rows = await AccessLog.findAll({
    order: [['id', 'ASC']]
  });

  if (rows.length === 0) {
    const latestAnchor = await ChainAnchor.findOne({
      order: [['id', 'DESC']]
    });
    return {
      valid: true,
      totalEntries: 0,
      lastAnchorCheckedAt: latestAnchor ? latestAnchor.created_at : null
    };
  }

  let expectedPrevHash = GENESIS_PREV_HASH;
  const seenHashes = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].toJSON();

    if (seenHashes.has(row.entry_hash)) {
      return {
        valid: false,
        brokenAtId: row.id,
        reason: `Duplicate entry hash at row id ${row.id}. The log may have been replayed or copied.`
      };
    }
    seenHashes.add(row.entry_hash);

    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtId: row.id,
        reason: `Previous hash mismatch at row id ${row.id}. Expected prev_hash '${expectedPrevHash}', but found '${row.prev_hash}'.`
      };
    }

    const canonical = buildCanonicalString(row);
    const recomputedHash = computeHash(canonical);

    if (recomputedHash !== row.entry_hash) {
      return {
        valid: false,
        brokenAtId: row.id,
        reason: `Hash mismatch at row id ${row.id}. Data has been altered. Stored entry_hash is '${row.entry_hash}', recomputed is '${recomputedHash}'.`
      };
    }

    expectedPrevHash = row.entry_hash;
  }

  const latestAnchor = await ChainAnchor.findOne({
    order: [['id', 'DESC']]
  });
  if (latestAnchor) {
    const targetRow = rows.find((r) => r.id === latestAnchor.row_id_at_anchor);
    if (!targetRow || targetRow.entry_hash !== latestAnchor.anchor_hash) {
      return {
        valid: false,
        reason: 'anchor mismatch — the log may have been fully rewritten after this checkpoint'
      };
    }

    return {
      valid: true,
      totalEntries: rows.length,
      lastAnchorCheckedAt: latestAnchor.created_at
    };
  }

  return {
    valid: true,
    totalEntries: rows.length,
    lastAnchorCheckedAt: null
  };
}
