import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IDeployment {
  _id?: mongoose.Types.ObjectId;
  resourceId: mongoose.Types.ObjectId;
  incidentId: mongoose.Types.ObjectId;
  deployedTo: string;
  deployedAt: string;
  returnedAt?: string;
}

export interface IResource extends Document {
  name: string;
  type: "VEHICLE" | "EQUIPMENT" | "PERSONNEL" | "SUPPLY";
  quantity: number;
  location?: string;
  deployments: IDeployment[];
  createdAt: string;
}

/* ============================================
 SCHEMA
============================================ */

const DeploymentSubSchema = new Schema<IDeployment>(
  {
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    incidentId: {
      type: Schema.Types.ObjectId,
      required: true,
      
    },

    deployedTo: {
      type: String,
      required: true,
    },

    deployedAt: {
      type: String,
      required: true,
    },

    returnedAt: {
      type: String,
    },
  },
  { _id: true },
);

const ResourceSchema = new Schema<IResource>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["VEHICLE", "EQUIPMENT", "PERSONNEL", "SUPPLY"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    location: String,

    deployments: {
      type: [DeploymentSubSchema],
      default: [],
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 TRANSFORM
============================================ */

ResourceSchema.set("toJSON", {
  transform: (_doc, ret) => {
    // normalize id safely
    ret.id = ret._id?.toString?.() ?? ret.id;

    // safe delete (TS-safe via cast)
    delete (ret as any)._id;

    // normalize deployments
    if (ret.deployments && Array.isArray(ret.deployments)) {
      ret.deployments = ret.deployments.map((d: any) => ({
        ...d,
        id: d._id?.toString?.() ?? d._id,
        resourceId: ret.id,
      }));
    }

    return ret;
  },
});

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IResource>("Resource", ResourceSchema);
