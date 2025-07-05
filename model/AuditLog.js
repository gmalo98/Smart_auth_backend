const mongoose=require('mongoose');
const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
  },
  userId: String,
  email: String,
  reason: String,
  performedBy: {
    type: String,
    default: 'system',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);