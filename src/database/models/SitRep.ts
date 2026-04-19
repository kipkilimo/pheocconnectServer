import mongoose from "mongoose";

const sitRepSchema = new mongoose.Schema(
  {
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: [true, "Incident ID is required"],
      
    },
    summary: {
      type: String,
      required: [true, "Summary is required"],
      trim: true,
    },
    actions: {
      type: String,
      trim: true,
    },
    recommendations: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user ID is required"],
      
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id, ...rest };
      },
    },
  },
);

// Indexes
sitRepSchema.index({ incidentId: 1, createdAt: -1 });
sitRepSchema.index({ createdBy: 1 });

const SitRep = mongoose.model("SitRep", sitRepSchema);

export default SitRep;
