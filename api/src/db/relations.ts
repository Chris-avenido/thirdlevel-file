import { relations } from "drizzle-orm/relations";
import { tloMasterlist, thirdLevelOfficialsProfiles, tloPersonnel, tloEducationRecords, tloOtherCourses, tloAccomplishmentRecords, tloEligibilityRecords, tloTrainingRecords, tloProfile, tloPositions, tloAssignments, tloItems } from "./schema";

export const thirdLevelOfficialsProfilesRelations = relations(thirdLevelOfficialsProfiles, ({one}) => ({
	tloMasterlist: one(tloMasterlist, {
		fields: [thirdLevelOfficialsProfiles.tloMasterlistId],
		references: [tloMasterlist.id]
	}),
}));

export const tloMasterlistRelations = relations(tloMasterlist, ({many}) => ({
	thirdLevelOfficialsProfiles: many(thirdLevelOfficialsProfiles),
	tloProfiles: many(tloProfile),
	tloAssignments: many(tloAssignments),
}));

export const tloEducationRecordsRelations = relations(tloEducationRecords, ({one}) => ({
	tloPersonnel: one(tloPersonnel, {
		fields: [tloEducationRecords.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloPersonnelRelations = relations(tloPersonnel, ({many}) => ({
	tloEducationRecords: many(tloEducationRecords),
	tloOtherCourses: many(tloOtherCourses),
	tloAccomplishmentRecords: many(tloAccomplishmentRecords),
	tloEligibilityRecords: many(tloEligibilityRecords),
	tloTrainingRecords: many(tloTrainingRecords),
}));

export const tloOtherCoursesRelations = relations(tloOtherCourses, ({one}) => ({
	tloPersonnel: one(tloPersonnel, {
		fields: [tloOtherCourses.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloAccomplishmentRecordsRelations = relations(tloAccomplishmentRecords, ({one}) => ({
	tloPersonnel: one(tloPersonnel, {
		fields: [tloAccomplishmentRecords.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloEligibilityRecordsRelations = relations(tloEligibilityRecords, ({one}) => ({
	tloPersonnel: one(tloPersonnel, {
		fields: [tloEligibilityRecords.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloTrainingRecordsRelations = relations(tloTrainingRecords, ({one}) => ({
	tloPersonnel: one(tloPersonnel, {
		fields: [tloTrainingRecords.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloProfileRelations = relations(tloProfile, ({one}) => ({
	tloMasterlist: one(tloMasterlist, {
		fields: [tloProfile.tloMasterlistId],
		references: [tloMasterlist.id]
	}),
}));

export const tloPositionsRelations = relations(tloPositions, ({many}) => ({
	tloAssignments: many(tloAssignments),
}));

export const tloAssignmentsRelations = relations(tloAssignments, ({one}) => ({
	tloMasterlist: one(tloMasterlist, {
		fields: [tloAssignments.tloMasterlistId],
		references: [tloMasterlist.id]
	}),
	tloItem: one(tloItems, {
		fields: [tloAssignments.tloPositionId],
		references: [tloItems.itemNumber]
	}),
	tloPosition: one(tloPositions, {
		fields: [tloAssignments.positionId],
		references: [tloPositions.id]
	}),
}));

export const tloItemsRelations = relations(tloItems, ({many}) => ({
	tloAssignments: many(tloAssignments),
}));