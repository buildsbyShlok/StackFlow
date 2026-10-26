import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Project from "../models/Project.js";
import { requireValue } from "./errors.js";

// A durable project gate serializes child creation and lifecycle changes across
// API processes. Never expire a gate while its owner might still be writing.
export async function withProjectMutation(id, orgId, operation) {
  const token = randomUUID();
  const project = await Project.findOneAndUpdate({
    _id: id,
    orgId,
    mutationToken: null
  }, {
    $set: {
      mutationToken: token
    }
  }, {
    new: true,
    timestamps: false
  });
  if (!project) {
    requireValue(await Project.exists({
      _id: id,
      orgId
    }), 404, "Project not found.");
    requireValue(false, 409, "Another project change is in progress. Refresh and retry. If this persists, contact your administrator.");
  }
  let session;
  try {
    const topology = await mongoose.connection.db.admin().command({
      hello: 1
    });
    const execute = async () => operation(project, session);
    if (topology.setName || topology.msg === "isdbgrid") {
      session = await mongoose.startSession();
      return await session.withTransaction(execute, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    }
    return await execute();
  } finally {
    await session?.endSession();
    await Project.updateOne({
      _id: id,
      orgId,
      mutationToken: token
    }, {
      $unset: {
        mutationToken: 1
      }
    }, {
      timestamps: false
    });
  }
}
export function confirmDeletion(body, record, name) {
  requireValue(Number.isSafeInteger(body.version) && body.version >= 0, 400, "Refresh before deleting this record.");
  requireValue(body.version === (record.__v || 0) && body.confirmation === name, 409, "This record changed. Close this dialog, refresh, and confirm its current name again.");
}
