import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema({
  incidentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    
  },
  classification: {
    type: String,
    enum: ["SUSPECTED", "PROBABLE", "CONFIRMED"],
    required: true,
  },
  patientAge: Number,
  patientSex: String,
  location: String,
  reportedAt: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
});

export default mongoose.model("Case", CaseSchema);