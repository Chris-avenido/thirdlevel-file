// Barrel kept so existing imports of this controller keep working. Implementation lives in ./thirdLevel/.
export {
  cleanDesignationOrPosition,
  STANDARD_DESIGNATIONS
} from './thirdLevel/shared.js';
export {
  initializeProfile,
  getByEmail,
  uploadDocument,
  getProfile,
  updateProfile,
  submitApplication
} from './thirdLevel/profile.js';
export {
  getPositions,
  getVacancies,
  getApplications,
  processApplication,
  processRegistration,
  processScheduledVacancies,
  processAnticipatedVacancies,
  triggerCron,
  reassignOfficial
} from './thirdLevel/applications.js';
export {
  buildOfficialsFilterConditions,
  getOfficials,
  getKpiSummary,
  getLastVacateUpdate,
  getCareerPath,
  getPositionIncumbents,
  getActiveOfficials,
  createUnassignedPersonnel,
  registerPersonnel,
  getUnassignedPersonnel,
  adminAction,
  getNotableAchievements,
  toggleTestAccount
} from './thirdLevel/registry.js';
