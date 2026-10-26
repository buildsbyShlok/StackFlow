import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    inviteCode: { type: String, unique: true },
    isPaid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
