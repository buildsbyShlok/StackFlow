import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import Project from "../src/models/Project.js";
import Milestone from "../src/models/Milestone.js";
import Task from "../src/models/Task.js";
import User from "../src/models/User.js";
test("real MongoDB workflow, authentication and tenant isolation", {
  timeout: 120000
}, async t => {
  process.env.ACCESS_SECRET = randomBytes(40).toString("hex");
  process.env.REFRESH_SECRET = randomBytes(40).toString("hex");
  process.env.FRONTEND_URL = "http://localhost:5173";
  const dbName = "stackflow_test_" + randomBytes(8).toString("hex");
  let server;
  try {
    await mongoose.connect(process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017", {
      dbName,
      serverSelectionTimeoutMS: 5000
    });
    await Promise.all([User.init(), Project.init(), Milestone.init(), Task.init()]);
    server = createApp().listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    const password = "Stackflow-test-password!";
    function client() {
      return {
        token: "",
        cookie: "",
        user: null,
        async call(path, method = "GET", body, expected = 200, customHeaders = {}) {
          const response = await fetch(base + path, {
            method,
            headers: {
              ...(this.token ? {
                Authorization: "Bearer " + this.token
              } : {}),
              ...(this.cookie ? {
                Cookie: this.cookie
              } : {}),
              ...(body ? {
                "Content-Type": "application/json"
              } : {}),
              ...customHeaders
            },
            ...(body ? {
              body: JSON.stringify(body)
            } : {})
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) this.cookie = cookies.map(c => c.split(";")[0]).filter(c => !c.endsWith("=")).join("; ");
          const data = response.status === 204 ? {} : await response.json();
          assert.equal(response.status, expected, method + " " + path + ": " + JSON.stringify(data));
          if (data.accessToken) {
            this.token = data.accessToken;
            this.user = data.user;
          }
          return data;
        }
      };
    }
    const admin = client(),
      lead = client(),
      teammate = client(),
      other = client(),
      stranger = client(),
      free = client();
    let project, milestone, task, invite, otherProject;
    await t.test("register admin, reject invalid registration without orphan users", async () => {
      await admin.call("/auth/register", "POST", {
        name: "Admin",
        email: "admin@example.test",
        password,
        role: "admin",
        orgName: "Studio North"
      }, 201);
      invite = (await admin.call("/org/me")).org.inviteCode;
      await stranger.call("/auth/register", "POST", {
        name: "Invalid",
        email: "invalid@example.test",
        password,
        role: "teammate",
        inviteCode: "bad"
      }, 400);
      assert.equal(await User.countDocuments({
        email: "invalid@example.test"
      }), 0);
      await stranger.call("/auth/register", "POST", {
        name: "Injected",
        email: {
          $ne: ""
        },
        password,
        role: "admin"
      }, 400);
      await stranger.call("/auth/register", "POST", {
        name: "Escalated",
        email: "escalated@example.test",
        password,
        role: "techlead",
        inviteCode: invite
      }, 400);
      assert.equal((await admin.call("/org/me")).org.name, "Studio North");
    });
    await t.test("invite members and grant Tech Lead via admin", async () => {
      for (const [c, name] of [[lead, "Lead"], [teammate, "Teammate"], [free, "Free"]]) await c.call("/auth/register", "POST", {
        name,
        email: name.toLowerCase() + "@example.test",
        password,
        role: "teammate",
        inviteCode: invite
      }, 201);
      await teammate.call("/org/members/" + lead.user.id, "PATCH", {
        role: "techlead"
      }, 403);
      await admin.call("/org/members/" + lead.user.id, "PATCH", {
        role: "techlead"
      });
      assert.equal((await lead.call("/auth/profile")).user.role, "techlead");
      assert.equal((await teammate.call("/org/me")).org.inviteCode, undefined);
    });
    await t.test("login, refresh claims and invalid credentials", async () => {
      // Raw writes emulate accounts created before email normalization existed.
      await User.collection.updateOne({
        _id: new mongoose.Types.ObjectId(lead.user.id)
      }, {
        $set: {
          email: "Lead@Example.Test"
        }
      });
      await User.collection.updateOne({
        _id: new mongoose.Types.ObjectId(teammate.user.id)
      }, {
        $set: {
          email: "Teammate@Example.Test"
        }
      });
      await stranger.call("/auth/register", "POST", {
        name: "Duplicate",
        email: "LEAD@example.test",
        password,
        role: "admin"
      }, 409);
      await lead.call("/auth/login", "POST", {
        email: "lead@example.test",
        password
      });
      const refresh = await lead.call("/auth/refresh");
      assert.equal(jwt.decode(refresh.accessToken).orgId, admin.user.orgId);
      await stranger.call("/auth/login", "POST", {
        email: "lead@example.test",
        password: "wrong"
      }, 401);
      await stranger.call("/workspace", "GET", undefined, 401);
    });
    await t.test("create projects/milestones with valid role and assignment", async () => {
      await teammate.call("/projects/create", "POST", {
        name: "Denied"
      }, 403);
      project = (await admin.call("/projects/create", "POST", {
        name: "Portal launch",
        description: "Customer experience"
      }, 201)).project;
      await admin.call("/projects/create", "POST", {
        name: " "
      }, 400);
      milestone = (await admin.call("/milestones/create/" + project._id, "POST", {
        title: "Launch foundation",
        assignedToEmail: "lead@example.test",
        dueDate: "2026-12-20"
      }, 201)).milestone;
      await admin.call("/milestones/create/" + project._id, "POST", {
        title: "Bad lead",
        assignedToEmail: "teammate@example.test"
      }, 400);
    });
    await t.test("cross-workspace reads/writes/search/member removal rejected", async () => {
      await other.call("/auth/register", "POST", {
        name: "Other admin",
        email: "other@example.test",
        password,
        role: "admin",
        orgName: "Other workspace"
      }, 201);
      otherProject = (await other.call("/projects/create", "POST", {
        name: "Private other project"
      }, 201)).project;
      await other.call("/projects/details/" + project._id, "GET", undefined, 404);
      await other.call("/projects/" + project._id, "PATCH", {
        name: "Attack"
      }, 404);
      await other.call("/milestones/" + project._id, "GET", undefined, 404);
      await other.call("/tasks/create/" + milestone._id, "POST", {
        title: "Attack",
        assignedToEmail: "teammate@example.test"
      }, 404);
      await other.call("/org/remove-user", "POST", {
        userId: teammate.user.id
      }, 404);
      assert.equal((await other.call("/search?q=Portal")).projects.length, 0);
      await teammate.call("/org/join", "POST", {
        inviteCode: invite
      }, 409);
    });
    await t.test("create task, validate priority/deadline and preserve detail", async () => {
      await lead.call("/tasks/create/" + milestone._id, "POST", {
        title: "Bad priority",
        assignedToEmail: "teammate@example.test",
        priority: "not-valid"
      }, 400);
      task = (await lead.call("/tasks/create/" + milestone._id, "POST", {
        title: "Implement sign-in",
        description: "Persist sessions",
        assignedToEmail: "teammate@example.test",
        priority: "high",
        dueDate: "2026-12-10"
      }, 201)).task;
      assert.equal(task.status, "pending");
      const detail = (await teammate.call("/tasks/details/" + task._id)).task;
      assert.equal(detail.assignedTo.name, "Teammate");
      assert.equal(detail.history.length, 1);
      await other.call("/tasks/details/" + task._id, "GET", undefined, 404);
      await other.call("/tasks/verify/" + task._id, "POST", {}, 404);
      await free.call("/tasks/complete/" + task._id, "POST", {}, 403);
      await lead.call("/tasks/verify/" + task._id, "POST", {}, 409);
    });
    await t.test("submit, queue, reject with reason and history", async () => {
      await teammate.call("/tasks/start/" + task._id, "POST", {});
      await teammate.call("/tasks/complete/" + task._id, "POST", {});
      assert.equal((await lead.call("/queue/pending")).tasks.length, 1);
      await teammate.call("/queue/pending", "GET", undefined, 403);
      await lead.call("/tasks/reject/" + task._id, "POST", {
        reason: "  "
      }, 400);
      await lead.call("/tasks/reject/" + task._id, "POST", {
        reason: "Handle expired sessions"
      });
      const detail = (await teammate.call("/tasks/details/" + task._id)).task;
      assert.equal(detail.status, "changes_requested");
      assert.equal(detail.reviewedBy, lead.user.id);
      assert.equal(detail.reviewReason, "Handle expired sessions");
      assert.equal(detail.history.at(-1).action, "reject");
      assert.equal((await admin.call("/projects/details/" + project._id)).project.progress, 0);
    });
    await t.test("concurrent verification accepts exactly once", async () => {
      await teammate.call("/tasks/start/" + task._id, "POST", {});
      await teammate.call("/tasks/complete/" + task._id, "POST", {});
      const responses = await Promise.all([1, 2].map(() => fetch(base + "/tasks/verify/" + task._id, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + lead.token,
          "Content-Type": "application/json"
        },
        body: "{}"
      })));
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const detail = (await lead.call("/tasks/details/" + task._id)).task;
      assert.equal(detail.history.filter(e => e.action === "verify").length, 1);
      assert.ok(detail.verifiedAt);
      await teammate.call("/tasks/undo-complete/" + task._id, "POST", {}, 409);
      assert.equal((await lead.call("/queue/pending")).pendingCount, 0);
    });
    await t.test("progress ignores stale fields/arrays and updates after new tasks/deletion", async () => {
      await Project.updateOne({
        _id: project._id
      }, {
        $set: {
          progress: 0,
          milestones: []
        }
      });
      await Milestone.updateOne({
        _id: milestone._id
      }, {
        $set: {
          progress: 0,
          tasks: []
        }
      });
      let detail = (await admin.call("/projects/details/" + project._id)).project;
      assert.equal(detail.progress, 100);
      const second = (await lead.call("/tasks/create/" + milestone._id, "POST", {
        title: "Second task",
        assignedToEmail: "teammate@example.test"
      }, 201)).task;
      detail = (await admin.call("/projects/details/" + project._id)).project;
      assert.equal(detail.progress, 50);
      await lead.call("/tasks/" + second._id, "DELETE", undefined, 204);
      assert.equal((await admin.call("/projects/details/" + project._id)).project.progress, 100);
      await lead.call("/tasks/" + task._id, "DELETE", undefined, 409);
    });
    await t.test("reopen review requires reason and removes verified progress", async () => {
      await lead.call("/tasks/unverify/" + task._id, "POST", {}, 400);
      await lead.call("/tasks/unverify/" + task._id, "POST", {
        reason: "Regression found"
      });
      assert.equal((await admin.call("/projects/details/" + project._id)).project.progress, 0);
      await lead.call("/tasks/reject/" + task._id, "POST", {
        reason: "Please retest"
      });
      const current = (await lead.call("/tasks/details/" + task._id)).task;
      await lead.call("/tasks/" + task._id, "PATCH", {
        title: "Updated sign-in",
        assignedToEmail: "teammate@example.test",
        priority: "urgent",
        version: 0
      }, 409);
      await lead.call("/tasks/" + task._id, "PATCH", {
        title: "Updated sign-in",
        assignedToEmail: "teammate@example.test",
        priority: "urgent",
        version: current.__v
      });
      await teammate.call("/tasks/complete/" + task._id, "POST", {});
      await lead.call("/tasks/verify/" + task._id, "POST", {});
    });
    await t.test("only assigned lead can create/review milestone tasks", async () => {
      await admin.call("/org/members/" + free.user.id, "PATCH", {
        role: "techlead"
      });
      await free.call("/tasks/create/" + milestone._id, "POST", {
        title: "Wrong lead",
        assignedToEmail: "teammate@example.test"
      }, 403);
      await free.call("/tasks/unverify/" + task._id, "POST", {
        reason: "Not mine"
      }, 403);
      assert.equal((await free.call("/queue/pending")).pendingCount, 0);
    });
    await t.test("search groups and ordinary edits persist", async () => {
      const result = await teammate.call("/search?q=sign-in");
      assert.equal(result.tasks[0].id, task._id);
      assert.equal((await teammate.call("/search?q=Lead")).people.length, 1);
      assert.equal((await teammate.call("/search?q=foundation")).milestones.length, 1);
      await admin.call("/projects/" + project._id, "PATCH", {
        name: "Portal release",
        description: "Updated"
      });
      assert.equal((await teammate.call("/projects/details/" + project._id)).project.name, "Portal release");
      await admin.call("/milestones/" + milestone._id, "PATCH", {
        title: "Foundation",
        assignedToEmail: "lead@example.test",
        dueDate: "2026-12-31"
      });
      assert.equal((await teammate.call("/milestones/details/" + milestone._id)).milestone.title, "Foundation");
    });
    await t.test("member removal is constrained and immediately revokes sessions", async () => {
      await admin.call("/org/remove-user", "POST", {
        userId: {
          $ne: null
        }
      }, 400);
      await admin.call("/org/remove-user", "POST", undefined, 400);
      await admin.call("/org/remove-user", "POST", {
        userId: lead.user.id
      }, 409);
      await admin.call("/org/remove-user", "POST", {
        userId: admin.user.id
      }, 403);
      await admin.call("/org/remove-user", "POST", {
        userId: free.user.id
      });
      await free.call("/workspace", "GET", undefined, 401);
      await free.call("/auth/refresh", "GET", undefined, 401);
      await free.call("/auth/login", "POST", {
        email: "free@example.test",
        password
      });
      await free.call("/workspace", "GET", undefined, 403);
      await free.call("/org/join", "POST", {
        inviteCode: invite
      });
      assert.equal((await free.call("/auth/profile")).user.role, "teammate");
      await free.call("/org/leave", "POST", {});
      await free.call("/workspace", "GET", undefined, 403);
    });
    await t.test("deletion authorization, current confirmation and protected history", async () => {
      const p = (await admin.call("/projects/details/" + project._id)).project;
      const m = (await admin.call("/milestones/details/" + milestone._id)).milestone;
      const pb = {
        version: p.__v,
        confirmation: p.name
      };
      const mb = {
        version: m.__v,
        confirmation: m.title
      };
      await lead.call("/projects/" + p._id, "DELETE", pb, 403);
      await lead.call("/milestones/" + m._id, "DELETE", mb, 403);
      await other.call("/projects/" + p._id, "DELETE", pb, 404);
      await other.call("/milestones/" + m._id, "DELETE", mb, 404);
      await admin.call("/projects/" + p._id, "DELETE", {}, 400);
      await admin.call("/projects/" + p._id, "DELETE", {
        ...pb,
        confirmation: "wrong"
      }, 409);
      await Project.updateOne({
        _id: p._id
      }, {
        $set: {
          milestones: []
        }
      });
      await Milestone.updateOne({
        _id: m._id
      }, {
        $set: {
          tasks: []
        }
      });
      await admin.call("/projects/" + p._id, "DELETE", pb, 409);
      await admin.call("/milestones/" + m._id, "DELETE", mb, 409);
      assert.ok(await Task.exists({
        _id: task._id
      }));
      assert.ok((await Task.findById(task._id)).history.length > 0);
    });
    await t.test("empty lifecycle deletion removes references, rejects stale and duplicate requests", async () => {
      let p = (await admin.call("/projects/create", "POST", {
        name: "Disposable"
      }, 201)).project;
      await admin.call("/projects/" + p._id, "PATCH", {
        name: "Disposable edited"
      });
      await admin.call("/projects/" + p._id, "DELETE", {
        version: p.__v,
        confirmation: p.name
      }, 409);
      const m = (await admin.call("/milestones/create/" + p._id, "POST", {
        title: "Empty milestone",
        assignedToEmail: "lead@example.test"
      }, 201)).milestone;
      const draft = (await lead.call("/tasks/create/" + m._id, "POST", {
        title: "Draft task",
        assignedToEmail: "teammate@example.test"
      }, 201)).task;
      await admin.call("/milestones/" + m._id, "DELETE", {
        version: m.__v,
        confirmation: m.title
      }, 409);
      await lead.call("/tasks/" + draft._id, "DELETE", undefined, 204);
      const current = (await admin.call("/milestones/details/" + m._id)).milestone;
      await admin.call("/milestones/" + m._id, "DELETE", {
        version: current.__v,
        confirmation: current.title
      }, 204);
      assert.equal(await Milestone.countDocuments({
        _id: m._id
      }), 0);
      assert.equal((await Project.findById(p._id)).milestones.length, 0);
      await admin.call("/milestones/" + m._id, "DELETE", {
        version: current.__v,
        confirmation: current.title
      }, 404);
      p = (await admin.call("/projects/details/" + p._id)).project;
      const responses = await Promise.all([1, 2].map(() => fetch(base + "/projects/" + p._id, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + admin.token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          version: p.__v,
          confirmation: p.name
        })
      })));
      assert.equal(responses.filter(r => r.status === 204).length, 1);
      assert.ok(responses.every(r => [204, 404, 409].includes(r.status)));
      assert.equal(await Project.countDocuments({
        _id: p._id
      }), 0);
      assert.equal((await admin.call("/search?q=Disposable")).projects.length, 0);
    });
    await t.test("child creation racing deletion cannot create orphan records", async () => {
      const headers = {
        Authorization: "Bearer " + admin.token,
        "Content-Type": "application/json"
      };
      const p = (await admin.call("/projects/create", "POST", {
        name: "Race project"
      }, 201)).project;
      const responses = await Promise.all([fetch(base + "/milestones/create/" + p._id, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "Race milestone",
          assignedToEmail: "lead@example.test"
        })
      }), fetch(base + "/projects/" + p._id, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          version: p.__v,
          confirmation: p.name
        })
      })]);
      assert.ok(responses.every(r => [201, 204, 404, 409].includes(r.status)));
      for (const m of await Milestone.find({
        projectId: p._id
      })) assert.ok(await Project.exists({
        _id: m.projectId
      }));
      const parent = (await admin.call("/projects/create", "POST", {
        name: "Task race"
      }, 201)).project;
      const m = (await admin.call("/milestones/create/" + parent._id, "POST", {
        title: "Task race milestone",
        assignedToEmail: "lead@example.test"
      }, 201)).milestone;
      const taskResponses = await Promise.all([fetch(base + "/tasks/create/" + m._id, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "Racing task",
          assignedToEmail: "teammate@example.test"
        })
      }), fetch(base + "/milestones/" + m._id, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          version: m.__v,
          confirmation: m.title
        })
      })]);
      assert.ok(taskResponses.every(r => [201, 204, 404, 409].includes(r.status)));
      for (const t of await Task.find({
        milestoneId: m._id
      })) assert.ok(await Milestone.exists({
        _id: t.milestoneId
      }));
    });
    await t.test("interrupted lifecycle gate fails closed without deleting records", async () => {
      const p = (await admin.call("/projects/create", "POST", {
        name: "Locked"
      }, 201)).project;
      await Project.updateOne({
        _id: p._id
      }, {
        $set: {
          mutationToken: "simulated-interruption"
        }
      });
      await admin.call("/projects/" + p._id, "DELETE", {
        version: p.__v,
        confirmation: p.name
      }, 409);
      assert.ok(await Project.exists({
        _id: p._id
      }));
      assert.equal((await admin.call("/workspace")).projects.find(x => x._id === p._id).mutationToken, undefined);
      await Project.updateOne({
        _id: p._id
      }, {
        $unset: {
          mutationToken: 1
        }
      });
    });
    await t.test("profile name editing cannot modify identity, role, or workspace", async () => {
      await stranger.call("/auth/profile", "PATCH", {
        name: "No session"
      }, 401);
      for (const field of ["email", "role", "orgId", "password", "refreshToken", "sessionVersion"]) {
        await free.call("/auth/profile", "PATCH", {
          name: "Safe",
          [field]: "injected"
        }, 400);
      }
      await free.call("/auth/profile", "PATCH", {
        name: "  "
      }, 400);
      const result = await free.call("/auth/profile", "PATCH", {
        name: "Updated Free"
      });
      assert.equal(result.user.name, "Updated Free");
      assert.equal(result.user.orgId, null);
      assert.equal(result.user.role, "teammate");
      assert.equal(result.user.password, undefined);
      assert.equal(result.user.refreshToken, undefined);
      assert.equal((await free.call("/auth/profile")).user.name, "Updated Free");
    });
    await t.test("password changes validate current password and revoke every existing session", async () => {
      const next = "New-secure-password!";
      await free.call("/auth/password", "POST", {
        currentPassword: "wrong",
        newPassword: next
      }, 400);
      await free.call("/auth/password", "POST", {
        currentPassword: password,
        newPassword: "short"
      }, 400);
      await free.call("/auth/password", "POST", {
        currentPassword: password,
        newPassword: password
      }, 400);
      const oldToken = free.token,
        oldCookie = free.cookie;
      await free.call("/auth/password", "POST", {
        currentPassword: password,
        newPassword: next
      }, 204);
      assert.equal(free.cookie, "");
      free.token = oldToken;
      free.cookie = oldCookie;
      await free.call("/auth/profile", "GET", undefined, 401);
      await free.call("/auth/refresh", "GET", undefined, 401);
      await free.call("/auth/login", "POST", {
        email: "free@example.test",
        password
      }, 401);
      await free.call("/auth/login", "POST", {
        email: "free@example.test",
        password: next
      });
      assert.notEqual((await User.findById(free.user.id)).password, next);
      assert.equal((await free.call("/auth/profile")).user.name, "Updated Free");
    });
    await t.test("logout clears cookies and revokes access/refresh tokens", async () => {
      const oldToken = teammate.token,
        oldCookie = teammate.cookie;
      await teammate.call("/auth/logout", "POST", undefined, 204);
      assert.equal(teammate.cookie, "");
      teammate.token = oldToken;
      teammate.cookie = oldCookie;
      await teammate.call("/workspace", "GET", undefined, 401);
      await teammate.call("/auth/refresh", "GET", undefined, 401);
    });
    await t.test("malformed IDs, blocked origins and nonexistent routes are safe", async () => {
      await admin.call("/projects/details/not-an-id", "GET", undefined, 400);
      await admin.call("/workspace", "GET", undefined, 403, {
        Origin: "https://untrusted.example"
      });
      await admin.call("/does-not-exist", "GET", undefined, 404);
      assert.equal((await admin.call("/health")).status, "ready");
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && dbName.startsWith("stackflow_test_")) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
