import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    role: {
      type: String,
      enum: ["admin", "teammate", "techlead"],
      default: "teammate",
    },
    refreshToken: { type: String },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.index({ orgId: 1, role: 1 });
export default mongoose.model("User", userSchema);
