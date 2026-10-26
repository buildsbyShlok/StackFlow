import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    milestones: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Milestone",
      },
    ],
    progress: { type: Number, default: 0 },
    mutationToken: { type: String, select: false },
  },
  { timestamps: true },
);

projectSchema.index({ orgId: 1, createdAt: -1 });
export default mongoose.model("Project", projectSchema);
