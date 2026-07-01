const Level = require('../models/Level');
const Exam = require('../models/Exam');
const User = require('../models/User');

// @desc    Get all levels
// @route   GET /api/levels
// @access  Private
const getLevels = async (req, res) => {
  try {
    const { status, includeInactive } = req.query;
    
    let query = {};
    if (status) {
      query.isActive = status === 'active';
    } else if (!includeInactive) {
      query.isActive = true;
    }

    const levels = await Level.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .populate('createdBy', 'fullName');

    res.json(levels);
  } catch (error) {
    console.error('Get levels error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get level by ID
// @route   GET /api/levels/:id
// @access  Private
const getLevelById = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id)
      .populate('createdBy', 'fullName');

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    res.json(level);
  } catch (error) {
    console.error('Get level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new level
// @route   POST /api/levels
// @access  Private/SuperAdmin
const createLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive, subLevels } = req.body;

    // Check if level with same name already exists
    const existingLevel = await Level.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existingLevel) {
      return res.status(400).json({ message: 'Level with this name already exists' });
    }

    const level = await Level.create({
      name: name.trim(),
      description,
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      subLevels: subLevels || [],
      createdBy: req.user._id
    });

    res.status(201).json(level);
  } catch (error) {
    console.error('Create level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update level
// @route   PUT /api/levels/:id
// @access  Private/SuperAdmin
const updateLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive, subLevels } = req.body;

    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== level.name) {
      const existingLevel = await Level.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingLevel) {
        return res.status(400).json({ message: 'Level with this name already exists' });
      }
    }

    if (name !== undefined) level.name = name.trim();
    if (description !== undefined) level.description = description;
    if (displayOrder !== undefined) level.displayOrder = displayOrder;
    if (isActive !== undefined) level.isActive = isActive;
    if (subLevels !== undefined) level.subLevels = subLevels;

    await level.save();

    res.json(level);
  } catch (error) {
    console.error('Update level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete level
// @route   DELETE /api/levels/:id
// @access  Private/SuperAdmin
const deleteLevel = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    // Check if level is being used by exams
    const examCount = await Exam.countDocuments({ level: req.params.id });
    if (examCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete level. It is being used by ${examCount} exam(s).` 
      });
    }

    // Check if level is being used by users
    const userCount = await User.countDocuments({ level: req.params.id });
    if (userCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete level. It is assigned to ${userCount} user(s).` 
      });
    }

    await Level.findByIdAndDelete(req.params.id);

    res.json({ message: 'Level deleted successfully' });
  } catch (error) {
    console.error('Delete level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate/Deactivate level
// @route   PATCH /api/levels/:id/status
// @access  Private/SuperAdmin
const updateLevelStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    level.isActive = isActive;
    await level.save();

    res.json(level);
  } catch (error) {
    console.error('Update level status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add sub-level to level
// @route   POST /api/levels/:id/sublevels
// @access  Private/SuperAdmin
const addSubLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    try {
      const subLevel = await level.addSubLevel({
        name: name.trim(),
        description,
        displayOrder: displayOrder || 0,
        isActive: isActive !== undefined ? isActive : true
      });

      res.status(201).json(subLevel);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error('Add sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update sub-level
// @route   PUT /api/levels/:id/sublevels/:subLevelId
// @access  Private/SuperAdmin
const updateSubLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    try {
      const subLevel = await level.updateSubLevel(req.params.subLevelId, {
        name,
        description,
        displayOrder,
        isActive
      });

      res.json(subLevel);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error('Update sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete sub-level
// @route   DELETE /api/levels/:id/sublevels/:subLevelId
// @access  Private/SuperAdmin
const deleteSubLevel = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    try {
      await level.removeSubLevel(req.params.subLevelId);
      res.json({ message: 'Sub-level deleted successfully' });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error('Delete sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getLevels,
  getLevelById,
  createLevel,
  updateLevel,
  deleteLevel,
  updateLevelStatus,
  addSubLevel,
  updateSubLevel,
  deleteSubLevel
};
