import { sequelize, DataTypes } from '../db/index.js';

const AccessLog = sequelize.define('AccessLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  staff_id: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  patient_id: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  action: {
    type: DataTypes.ENUM('LOGIN', 'VIEW_RECORD', 'EMERGENCY_ACCESS', 'DELETE_RECORD', 'DENIED'),
    allowNull: false
  },
  result: {
    type: DataTypes.ENUM('GRANTED', 'DENIED'),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  staff_ward_at_time: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  patient_ward_at_time: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  timestamp: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  prev_hash: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  entry_hash: {
    type: DataTypes.STRING(64),
    allowNull: false
  }
}, {
  tableName: 'access_logs'
});


export default AccessLog;