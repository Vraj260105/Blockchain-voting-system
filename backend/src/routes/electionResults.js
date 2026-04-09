const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const ElectionResult = require('../models/ElectionResult');
const AuditService = require('../services/auditService');
const { sequelize } = require('../config/database');
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/election-results
//  Public — returns all stored election results (no blockchain call needed)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      status,           // 'active' | 'closed' | 'scheduled' | 'upcoming'
      page   = 1,
      limit  = 20,
    } = req.query;

    const where = {};
    if (status) where.status = status;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await ElectionResult.findAndCountAll({
      where,
      order: [['electionId', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      data: {
        results: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('List election results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch election results' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/election-results/stats
//  Public — aggregate stats: totals per status, grand vote total
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [byStatus] = await sequelize.query(`
      SELECT status,
             COUNT(*)::int       AS election_count,
             SUM("totalVotes")::int AS total_votes
      FROM   election_results
      GROUP  BY status
    `);

    const [totals] = await sequelize.query(`
      SELECT COUNT(*)::int           AS total_elections,
             SUM("totalVotes")::int  AS grand_total_votes,
             SUM("candidateCount")::int AS total_candidates
      FROM   election_results
    `);

    res.json({
      success: true,
      data: {
        byStatus,
        totals: totals[0] || { total_elections: 0, grand_total_votes: 0, total_candidates: 0 },
      },
    });
  } catch (error) {
    console.error('Election results stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/election-results/:electionId
//  Public — full detail for one election including candidate breakdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:electionId', async (req, res) => {
  try {
    const result = await ElectionResult.findOne({
      where: { electionId: parseInt(req.params.electionId) },
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No stored result found for this election. Try syncing first.',
      });
    }

    res.json({ success: true, data: { result } });
  } catch (error) {
    console.error('Get election result error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch election result' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/election-results/sync
//  Admin only — accepts election + candidates payload, upserts into DB.
//  The frontend calls this after fetching data from the blockchain.
//
//  Body:
//  {
//    election:   { id, name, description, organizationName, scheduledStart,
//                  scheduledEnd, startTime, endTime, isActive, totalVotes, candidateCount },
//    candidates: [{ id, name, description, votes }, ...]
//  }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { election, candidates } = req.body;

    if (!election || !election.id) {
      return res.status(400).json({ success: false, message: 'election.id is required' });
    }
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ success: false, message: 'candidates must be an array' });
    }

    const { record, created } = await ElectionResult.upsertFromBlockchain(
      election,
      candidates,
      req.user.userId
    );

    await AuditService.logAdminAction(
      created ? 'ELECTION_RESULT_CREATED' : 'ELECTION_RESULT_SYNCED',
      req.user.userId,
      'election_result',
      election.id,
      req,
      { electionName: election.name, totalVotes: record.totalVotes }
    );

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Election result created' : 'Election result updated',
      data: { result: record },
    });
  } catch (error) {
    console.error('Sync election result error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync election result' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/election-results/sync-batch
//  Admin only — sync multiple elections at once.
//  Body: { elections: [{ election, candidates }] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync-batch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { elections } = req.body;
    if (!Array.isArray(elections) || elections.length === 0) {
      return res.status(400).json({ success: false, message: 'elections array is required' });
    }

    const results = [];
    for (const item of elections) {
      const { record, created } = await ElectionResult.upsertFromBlockchain(
        item.election,
        item.candidates || [],
        req.user.userId
      );
      results.push({ electionId: item.election.id, created, status: record.status });
    }

    await AuditService.logAdminAction(
      'ELECTION_RESULTS_BATCH_SYNCED',
      req.user.userId,
      'election_result',
      null,
      req,
      { count: results.length }
    );

    res.json({
      success: true,
      message: `Synced ${results.length} election result(s)`,
      data: { results },
    });
  } catch (error) {
    console.error('Batch sync error:', error);
    res.status(500).json({ success: false, message: 'Batch sync failed' });
  }
});

module.exports = router;
