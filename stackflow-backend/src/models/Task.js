import mongoose from "mongoose";
const { Schema } = mongoose;
const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 10000 },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: "Milestone",
      required: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    dueDate: Date,
    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "completed",
        "verified",
        "changes_requested",
      ],
      default: "pending",
    },
    completedAt: Date,
    verifiedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewReason: String,
    history: [
      {
        _id: false,
        action: String,
        from: String,
        to: String,
        actorId: Schema.Types.ObjectId,
        actorName: String,
        at: Date,
        reason: String,
      },
    ],
  },
  { timestamps: true },
);
taskSchema.index({ orgId: 1, milestoneId: 1 });
taskSchema.index({ orgId: 1, status: 1, completedAt: 1 });
taskSchema.index({ orgId: 1, assignedTo: 1 });
export default mongoose.model("Task", taskSchema);
