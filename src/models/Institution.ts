import mongoose, { Document, Schema } from "mongoose";

// Define interfaces for each nested structure

interface IDepartment {
  name: string;
  headOfDepartment?: string;
  isOnTrial: boolean;
  trialStartDate: string;
  subscriptionStartDate: string;
}

interface ISchool {
  name: string;
  dean?: string;
  departments: IDepartment[];
}

interface ICentre {
  name: string;
  director?: string;
  isOnTrial: boolean;
  trialStartDate: string;
  subscriptionStartDate: string;
}

interface IInstitute {
  name: string;
  director?: string;
  isOnTrial: boolean;
  trialStartDate: string;
  subscriptionStartDate: string;
}

interface IConstituentCollege {
  name: string;
  principal?: string;
  schools: ISchool[];
}

// Define the main Institution interface extending Mongoose's Document
export interface IInstitution extends Document {
  name: string;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  establishedYear: number;
  website?: string;
  schools: ISchool[];
  centres: ICentre[];
  institutes: IInstitute[];
  constituentColleges: IConstituentCollege[];
}

// Define the schema for each nested structure
const DepartmentSchema: Schema<IDepartment> = new Schema({
  name: { type: String, required: true },
  headOfDepartment: { type: String },
});

const SchoolSchema: Schema<ISchool> = new Schema({
  name: { type: String, required: true },
  dean: { type: String },
  departments: [DepartmentSchema],
});

const CentreSchema: Schema<ICentre> = new Schema({
  name: { type: String, required: true },
  director: { type: String },
});

const InstituteSchema: Schema<IInstitute> = new Schema({
  name: { type: String, required: true },
  director: { type: String },
});

const ConstituentCollegeSchema: Schema<IConstituentCollege> = new Schema({
  name: { type: String, required: true },
  principal: { type: String },
  schools: [SchoolSchema],
});

// Define the main Institution schema
const InstitutionSchema: Schema<IInstitution> = new Schema({
  name: { type: String, required: true },
  location: {
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, required: true },
  },
  establishedYear: { type: Number, required: true },
  website: { type: String },
  schools: [SchoolSchema],
  centres: [CentreSchema],
  institutes: [InstituteSchema],
  constituentColleges: [ConstituentCollegeSchema],
});

// Create and export the Institution model
const Institution = mongoose.model<IInstitution>(
  "Institution",
  InstitutionSchema
);
export default Institution;
