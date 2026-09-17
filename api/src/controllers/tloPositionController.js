import pool from '../config/db.js';
import {
  queryPositions,
  getPositionKpis,
  getPositionFilterOptions,
  getPositionById,
  createPosition as repoCreatePosition,
  updatePosition as repoUpdatePosition,
  countPositionAssignments,
  deletePosition as repoDeletePosition
} from '../repositories/tloPositionRepository.js';

/**
 * Controller: TLO Positions Management
 * CRUD and analytics for public.tlo_positions master catalog.
 */

// 1. Fetch positions with search, filters, pagination (Strict base order: id ASC)
export const getPositions = async (req, res) => {
  try {
    const {
      search = '',
      region = '',
      salary_grade = '',
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'ASC'
    } = req.query;

    const result = await queryPositions(pool, {
      search,
      region,
      salary_grade,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      sortBy,
      sortOrder
    });

    const kpis = await getPositionKpis(pool);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      },
      kpis
    });
  } catch (error) {
    console.error('[tloPositionController] Error in getPositions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve positions catalog.'
    });
  }
};

// 2. Fetch distinct filter options (regions, salary grades, titles)
export const getFilterOptions = async (req, res) => {
  try {
    const options = await getPositionFilterOptions(pool);
    return res.status(200).json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('[tloPositionController] Error in getFilterOptions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve position filter options.'
    });
  }
};

// 3. Fetch single position by ID
export const getPositionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const positionId = parseInt(id, 10);
    if (isNaN(positionId)) {
      return res.status(400).json({ success: false, error: 'Invalid position ID.' });
    }

    const position = await getPositionById(pool, positionId);
    if (!position) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    const references = await countPositionAssignments(pool, positionId);

    return res.status(200).json({
      success: true,
      data: position,
      references
    });
  } catch (error) {
    console.error('[tloPositionController] Error in getPositionDetails:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve position details.'
    });
  }
};

// 4. Check references for a position before delete
export const checkReferences = async (req, res) => {
  try {
    const { id } = req.params;
    const positionId = parseInt(id, 10);
    if (isNaN(positionId)) {
      return res.status(400).json({ success: false, error: 'Invalid position ID.' });
    }

    const position = await getPositionById(pool, positionId);
    if (!position) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    const references = await countPositionAssignments(pool, positionId);

    return res.status(200).json({
      success: true,
      position_title: position.position_title,
      total_assignments: references.total_assignments,
      active_assignments: references.active_assignments,
      assignments: references.assignments
    });
  } catch (error) {
    console.error('[tloPositionController] Error in checkReferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check position references.'
    });
  }
};

// 5. Create new position
export const createPosition = async (req, res) => {
  try {
    const {
      position_title,
      position_code,
      salary_grade,
      description,
      region,
      division,
      bureau
    } = req.body;

    if (!position_title || !String(position_title).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Position title is required.'
      });
    }

    const created = await repoCreatePosition(pool, {
      position_title: position_title.trim(),
      position_code,
      salary_grade,
      description,
      region,
      division,
      bureau
    });

    return res.status(201).json({
      success: true,
      message: 'Position created successfully.',
      data: created
    });
  } catch (error) {
    console.error('[tloPositionController] Error in createPosition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create position.'
    });
  }
};

// 6. Update position
export const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const positionId = parseInt(id, 10);
    if (isNaN(positionId)) {
      return res.status(400).json({ success: false, error: 'Invalid position ID.' });
    }

    const existing = await getPositionById(pool, positionId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    const {
      position_title,
      position_code,
      salary_grade,
      description,
      region,
      division,
      bureau
    } = req.body;

    if (position_title !== undefined && (!position_title || !String(position_title).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Position title cannot be empty.'
      });
    }

    const updated = await repoUpdatePosition(pool, positionId, {
      position_title: position_title !== undefined ? position_title.trim() : existing.position_title,
      position_code,
      salary_grade,
      description,
      region,
      division,
      bureau
    });

    return res.status(200).json({
      success: true,
      message: 'Position updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('[tloPositionController] Error in updatePosition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update position.'
    });
  }
};

// 7. Delete position with FK safety check and explicit confirmation
export const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const positionId = parseInt(id, 10);
    if (isNaN(positionId)) {
      return res.status(400).json({ success: false, error: 'Invalid position ID.' });
    }

    const existing = await getPositionById(pool, positionId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    // Check FK references in tlo_assignments
    const references = await countPositionAssignments(pool, positionId);
    const isForce = req.query.force === 'true' || req.body?.force === true;

    if (references.active_assignments > 0 && !isForce) {
      return res.status(409).json({
        success: false,
        conflict: true,
        total_assignments: references.total_assignments,
        active_assignments: references.active_assignments,
        assignments: references.assignments,
        message: `This position has ${references.active_assignments} active official assignment(s). Deleting it will detach these assignments (setting position_id to NULL). Explicit confirmation is required.`
      });
    }

    await repoDeletePosition(pool, positionId);

    return res.status(200).json({
      success: true,
      message: `Position '${existing.position_title}' deleted successfully.`
    });
  } catch (error) {
    console.error('[tloPositionController] Error in deletePosition:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete position.'
    });
  }
};
