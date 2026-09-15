import { relations } from "drizzle-orm/relations";
import { tloPersonnel, tloEducationRecords, tloOtherCourses, tloAccomplishmentRecords, tloEligibilityRecords, tloTrainingRecords, tloItems, tloAssignments } from "./schema.js";

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
	tloAssignments: many(tloAssignments),
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

export const tloAssignmentsRelations = relations(tloAssignments, ({one}) => ({
	tloItem: one(tloItems, {
		fields: [tloAssignments.itemNumber],
		references: [tloItems.itemNumber]
	}),
	tloPersonnel: one(tloPersonnel, {
		fields: [tloAssignments.personnelId],
		references: [tloPersonnel.id]
	}),
}));

export const tloItemsRelations = relations(tloItems, ({many}) => ({
	tloAssignments: many(tloAssignments),
}));