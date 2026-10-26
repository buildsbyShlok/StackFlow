import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    dueDate: Date,
    description: { type: String, default: "" },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tech Lead
      required: true,
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    progress: { type: Number, default: 0 }, // % completion
  },
  { timestamps: true },
);

milestoneSchema.index({ orgId: 1, projectId: 1 });
export default mongoose.model("Milestone", milestoneSchema);
