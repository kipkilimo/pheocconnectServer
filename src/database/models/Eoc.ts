import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IEOC extends Document {
  name: string;

  level: "NATIONAL" | "COUNTY" | "SUBCOUNTY" | "WARD";

  country?: string;
  county?: string;
  subCounty?: string;

  /* ============================================
   HIERARCHY
  ============================================ */

  parentId?: mongoose.Types.ObjectId;

  /* ============================================
   ORGANIZATION
  ============================================ */

  organizationId?: mongoose.Types.ObjectId;

  /* ============================================
   OPERATIONAL STATUS (PHEOC CORE)
  ============================================ */

  alertLevel: "NORMAL" | "STANDBY" | "ACTIVATED" | "ESCALATED" | "DEACTIVATED";

  /* ============================================
   GIS SUPPORT (NEW - IMPORTANT)
  ============================================ */

  location?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };

  bbox?: {
    type: "Polygon";
    coordinates: number[][][];
  };

  centroid?: {
    lat: number;
    lng: number;
  };

  /* ============================================
   METADATA
  ============================================ */

  createdAt: string;
  updatedAt?: string;
}

/* ============================================
 SCHEMA
============================================ */

const EOCSchema = new Schema<IEOC>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      
    },

    level: {
      type: String,
      enum: ["NATIONAL", "COUNTY", "SUBCOUNTY", "WARD"],
      required: true,
      
    },

    country: { type: String,  },
    county: { type: String,  },
    subCounty: { type: String,  },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "EOC",
      
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      
    },

    alertLevel: {
      type: String,
      enum: ["NORMAL", "STANDBY", "ACTIVATED", "ESCALATED", "DEACTIVATED"],
      default: "NORMAL",
      
    },

    /* ============================================
     GIS FIELD (POINT LOCATION)
    ============================================ */

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
    },

    /* ============================================
     OPTIONAL BOUNDARY (COUNTY / SUBCOUNTY)
    ============================================ */

    bbox: {
      type: {
        type: String,
        enum: ["Polygon"],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },

    centroid: {
      lat: Number,
      lng: Number,
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
      
    },

    updatedAt: {
      type: String,
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 GEO INDEXES (CRITICAL FOR GIS)
============================================ */

EOCSchema.index({ location: "2dsphere" }); // spatial queries
EOCSchema.index({ parentId: 1 });
EOCSchema.index({ level: 1, county: 1 });
EOCSchema.index({ organizationId: 1 });
EOCSchema.index({ alertLevel: 1 });

/* ============================================
 TRANSFORM
============================================ */

EOCSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString?.() ?? ret.id;

    if (ret._id) {
      delete ret._id;
    }

    return ret;
  },
});

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IEOC>("EOC", EOCSchema);
