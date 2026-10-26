import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import mongoose from "mongoose";
import { createApp } from "../stackflow-backend/src/app.js";
process.env.ACCESS_SECRET = randomBytes(40).toString("hex");
process.env.REFRESH_SECRET = randomBytes(40).toString("hex");
process.env.FRONTEND_URL = "http://localhost:5175";
const dbName = "stackflow_browser_test_" + randomBytes(8).toString("hex");
let server, vite, browser;
const password = "Stackflow-browser-test!";
const output = ".artifacts/browser";
const errors = [];
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Server did not start: " + url);
}
try {
  await mongoose.connect(process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017", {
    dbName,
    serverSelectionTimeoutMS: 5000
  });
  server = createApp().listen(0);
  await once(server, "listening");
  const apiOrigin = "http://localhost:" + server.address().port;
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5175", "--strictPort"], {
    cwd: "stackflow-frontend",
    env: {
      ...process.env,
      VITE_API_BASE_URL: apiOrigin
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  vite.stderr.on("data", chunk => process.stderr.write(chunk));
  await waitFor("http://localhost:5175");
  browser = await chromium.launch({
    headless: true
  });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000
    }
  });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", msg => {
    if (msg.type() === "error" && !["401", "400", "409"].some(status => msg.text().includes(status))) errors.push(msg.text());
  });
  await mkdir(output, {
    recursive: true
  });
  async function visible(locator) {
    await locator.waitFor({
      state: "visible",
      timeout: 15000
    });
  }
  async function fill(label, value) {
    await page.getByLabel(label, {
      exact: true
    }).fill(value);
  }
  async function click(label) {
    await page.getByRole("button", {
      name: label,
      exact: true
    }).click();
  }
  async function login(email) {
    await page.goto("http://localhost:5175/login");
    await fill("Email address", email);
    await fill("Password", password);
    await click("Sign in");
    await visible(page.getByRole("heading", {
      name: "A clear view of what’s next."
    }));
  }
  async function signOut() {
    await page.getByRole("button", {
      name: "Sign out",
      exact: true
    }).click();
    await visible(page.getByRole("heading", {
      name: "Welcome back."
    }));
  }
  async function api(path, body, token) {
    const r = await fetch(apiOrigin + "/api" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? {
          Authorization: "Bearer " + token
        } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    assert.ok(r.ok, JSON.stringify(data));
    return data;
  }
  await page.goto("http://localhost:5175/register");
  await fill("Your name", "Maya Chen");
  await fill("Email address", "maya@browser.test");
  await fill("Password", password);
  await fill("Confirm password", password);
  await fill("Workspace name", "Northstar Studio");
  await click("Create account");
  await visible(page.getByRole("heading", {
    name: "A clear view of what’s next."
  }));
  await visible(page.getByRole("heading", {
    name: "Every outcome starts with a project."
  }));
  console.log("PASS: browser registration and empty workspace");
  await page.getByRole("link", {
    name: "Team",
    exact: true
  }).click();
  const invite = await page.locator(".invite-strip code").innerText();
  await api("/auth/register", {
    name: "Alex Rivera",
    email: "alex@browser.test",
    password,
    role: "teammate",
    inviteCode: invite
  });
  await api("/auth/register", {
    name: "Sam Brooks",
    email: "sam@browser.test",
    password,
    role: "teammate",
    inviteCode: invite
  });
  await page.reload();
  await page.getByLabel("Role for Alex Rivera").selectOption("techlead");
  await visible(page.getByRole("status"));
  assert.equal(await page.getByLabel("Role for Alex Rivera").inputValue(), "techlead");
  await page.getByRole("link", {
    name: "Projects",
    exact: true
  }).click();
  await click("New project");
  await fill("Project name", "Customer portal");
  await fill("Description", "A thoughtful home for our customers. Ship a reliable first release.");
  await click("Save");
  await visible(page.getByRole("link").filter({
    hasText: "Customer portal"
  }).first());
  await page.getByRole("link").filter({
    hasText: "Customer portal"
  }).first().click();
  await click("New milestone");
  const projectPath = new URL(page.url()).pathname;
  await fill("Milestone name", "Authentication & onboarding");
  await fill("Description", "Give every customer a reliable start.");
  await page.getByLabel("Tech Lead", {
    exact: true
  }).selectOption({
    label: "Alex Rivera"
  });
  await fill("Deadline", "2026-12-20");
  await click("Save");
  await visible(page.locator("summary").filter({
    hasText: "Authentication & onboarding"
  }));
  console.log("PASS: project, lead role and milestone created through UI");
  await signOut();
  await login("alex@browser.test");
  await page.getByRole("link", {
    name: "Projects",
    exact: true
  }).click();
  await page.getByRole("link").filter({
    hasText: "Customer portal"
  }).first().click();
  await click("Add task");
  await fill("Task title", "Implement session recovery");
  await fill("Description", "Keep customers signed in securely. Handle expired sessions gracefully.");
  await page.getByLabel("Assigned teammate").selectOption({
    label: "Sam Brooks — sam@browser.test"
  });
  await page.getByLabel("Priority", {
    exact: true
  }).selectOption("high");
  await page.locator('input[name="dueDate"]').fill("2026-12-10");
  await click("Save");
  await visible(page.getByRole("button", {
    name: "Implement session recovery",
    exact: true
  }));
  await page.screenshot({
    path: output + "/project-desktop.png",
    fullPage: true
  });
  await signOut();
  await login("sam@browser.test");
  assert.equal(await page.getByRole("link", {
    name: /^Verification/
  }).count(), 0);
  await page.getByRole("navigation").getByRole("link", {
    name: "My tasks",
    exact: true
  }).click();
  await visible(page.locator("tbody").getByText("Dec 10, 2026", {
    exact: true
  }));
  await page.getByLabel("Filter by priority").selectOption("low");
  await visible(page.getByRole("heading", {
    name: "No matches",
    exact: true
  }));
  await page.getByLabel("Filter by priority").selectOption("high");
  await page.getByLabel("Filter tasks", {
    exact: true
  }).fill("session");
  await page.getByLabel("Sort tasks", {
    exact: true
  }).selectOption("due");
  await click("Implement session recovery");
  await click("Start work");
  await visible(page.locator(".task-meta").getByText("In progress", {
    exact: true
  }));
  await click("Submit for review");
  await click("Withdraw submission");
  await visible(page.locator(".task-meta").getByText("In progress", { exact: true }));
  await click("Submit for review");
  await visible(page.locator(".task-meta").getByText("In review", {
    exact: true
  }));
  await page.getByRole("button", {
    name: "Close",
    exact: true
  }).click();
  await page.reload();
  await visible(page.locator("tbody").getByText("In review", {
    exact: true
  }));
  await signOut();
  console.log("PASS: task assignment, start, submission and refresh persistence");
  await login("alex@browser.test");
  await page.getByRole("link", {
    name: /^Verification/
  }).click();
  await click("Implement session recovery");
  await click("Request changes");
  await fill("What needs to change?", "Cover the expired-cookie case, then resubmit.");
  await click("Save review");
  await visible(page.locator(".task-meta").getByText("Changes requested", {
    exact: true
  }));
  await page.getByRole("button", {
    name: "Close",
    exact: true
  }).click();
  await signOut();
  await login("sam@browser.test");
  await page.getByRole("navigation").getByRole("link", {
    name: "My tasks",
    exact: true
  }).click();
  await click("Implement session recovery");
  await visible(page.locator(".review-note").getByText("Cover the expired-cookie case, then resubmit."));
  await click("Submit for review");
  await visible(page.locator(".task-meta").getByText("In review", {
    exact: true
  }));
  await page.getByRole("button", {
    name: "Close",
    exact: true
  }).click();
  await signOut();
  await login("alex@browser.test");
  await page.getByRole("link", {
    name: /^Verification/
  }).click();
  await click("Implement session recovery");
  await click("Verify work");
  await visible(page.locator(".task-meta").getByText("Verified", {
    exact: true
  }));
  await page.screenshot({
    path: output + "/task-review-desktop.png",
    fullPage: true
  });
  await page.getByRole("button", {
    name: "Close",
    exact: true
  }).click();
  await visible(page.getByRole("heading", {
    name: "Nothing waiting on you."
  }));
  await page.getByRole("link", {
    name: "Projects",
    exact: true
  }).click();
  await page.getByRole("link").filter({
    hasText: "Customer portal"
  }).first().click();
  assert.equal(await page.locator(".project-overview [role=progressbar]").getAttribute("aria-valuenow"), "100");
  console.log("PASS: changes requested, resubmitted, verified and progress 100%");

  // Keyboard search, result navigation, focus containment and session recovery.
  await page.keyboard.press("Control+k");
  await fill("Search workspace", "session");
  await visible(page.getByRole("button").filter({
    hasText: "Implement session recovery"
  }));
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
  await page.getByLabel("Search workspace").focus();
  await page.keyboard.press("Enter");
  await visible(page.locator(".standalone-task"));
  const taskPath = new URL(page.url()).pathname;
  const fixtureMilestone = await mongoose.connection.collection("milestones").findOne({
    title: "Authentication & onboarding"
  });
  await page.reload();
  await visible(page.locator(".standalone-task"));
  let refreshRequests = 0;
  const watch = req => {
    if (req.url().endsWith("/api/auth/refresh")) refreshRequests++;
  };
  page.on("request", watch);
  let intercepted = false;
  await page.route("**/api/workspace", async route => {
    if (!intercepted) {
      intercepted = true;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: '{"message":"Expired"}'
      });
    } else await route.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1000);
  assert.ok(refreshRequests >= 1);
  await page.unroute("**/api/workspace");
  console.log("PASS: keyboard search, focus trap, deep link, cookie refresh and access-token retry");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({
      width,
      height: 900
    });
    for (const path of ["/", "/projects", "/my-tasks", "/verification", "/team", "/profile", projectPath, "/tasks/" + fixtureMilestone._id, taskPath]) {
      await page.goto("http://localhost:5175" + path);
      await visible(page.locator("#main-content h1, .standalone-task h2").first());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Page overflow: " + width + " " + path);
      await page.screenshot({
        path: output + "/" + (path.replaceAll("/", "") || "overview") + "-" + width + ".png",
        fullPage: true
      });
    }
    if (width === 390) {
      await click("Open navigation");
      await page.getByRole("dialog").getByRole("link", {
        name: "Projects",
        exact: true
      }).click();
      await visible(page.getByRole("heading", {
        name: "Projects",
        exact: true
      }));
    }
  }
  await page.setViewportSize({
    width: 1440,
    height: 1000
  });
  await signOut();
  await login("maya@browser.test");
  await page.getByRole("link", {
    name: "Your profile",
    exact: true
  }).click();
  await visible(page.getByRole("heading", {
    name: "Profile",
    exact: true
  }));
  await fill("Name", "Discarded name");
  await page.locator(".settings-section").first().getByRole("button", {
    name: "Cancel",
    exact: true
  }).click();
  assert.equal(await page.getByLabel("Name", {
    exact: true
  }).inputValue(), "Maya Chen");
  await fill("Name", "Maya Chen Updated");
  await click("Save changes");
  await visible(page.getByText("Personal details saved.", {
    exact: true
  }));
  await page.reload();
  assert.equal(await page.getByLabel("Name", {
    exact: true
  }).inputValue(), "Maya Chen Updated");
  assert.equal(await page.getByLabel("Email address", {
    exact: true
  }).getAttribute("readonly"), "");
  await page.screenshot({
    path: output + "/profile-desktop.png",
    fullPage: true
  });
  await page.goto("http://localhost:5175/projects");
  await click("New project");
  await fill("Project name", "Lifecycle exercise");
  await click("Save");
  await page.getByRole("link").filter({
    hasText: "Lifecycle exercise"
  }).first().click();
  await click("Edit project");
  await fill("Project name", "Lifecycle revised");
  await click("Save");
  await visible(page.getByRole("heading", {
    name: "Lifecycle revised",
    exact: true
  }));
  const disposablePath = new URL(page.url()).pathname;
  await click("Delete project");
  await fill("Confirm name", "wrong name");
  assert.equal(await page.getByRole("dialog").getByRole("button", {
    name: "Delete project",
    exact: true
  }).isDisabled(), true);
  await page.getByRole("dialog").getByRole("button", {
    name: "Cancel",
    exact: true
  }).click();
  assert.equal(await page.getByRole("button", {
    name: "Delete project",
    exact: true
  }).evaluate(el => el === document.activeElement), true);
  await click("New milestone");
  await fill("Milestone name", "Lifecycle milestone");
  await page.getByLabel("Tech Lead", {
    exact: true
  }).selectOption({
    label: "Alex Rivera"
  });
  await fill("Deadline", "2026-12-20");
  await click("Save");
  await click("Edit milestone");
  await fill("Milestone name", "Lifecycle milestone revised");
  await click("Save");
  await click("Delete project");
  await fill("Confirm name", "Lifecycle revised");
  await page.getByRole("dialog").getByRole("button", {
    name: "Delete project",
    exact: true
  }).click();
  await visible(page.getByRole("dialog").getByRole("alert"));
  assert.match(await page.getByRole("dialog").getByRole("alert").innerText(), /milestones/);
  await page.getByRole("dialog").getByRole("button", {
    name: "Cancel",
    exact: true
  }).click();
  await click("Add task");
  await fill("Task title", "Disposable task");
  await page.getByLabel("Assigned teammate").selectOption({
    label: "Sam Brooks — sam@browser.test"
  });
  await click("Save");
  await click("Delete milestone");
  await fill("Confirm name", "Lifecycle milestone revised");
  await page.getByRole("dialog").getByRole("button", {
    name: "Delete milestone",
    exact: true
  }).click();
  await visible(page.getByRole("dialog").getByRole("alert"));
  assert.match(await page.getByRole("dialog").getByRole("alert").innerText(), /contains tasks/);
  await page.getByRole("dialog").getByRole("button", {
    name: "Cancel",
    exact: true
  }).click();
  await click("Disposable task");
  await click("Edit task");
  await fill("Task title", "Disposable task revised");
  await page.getByLabel("Priority", {
    exact: true
  }).selectOption("urgent");
  await click("Save");
  await visible(page.getByRole("heading", {
    name: "Disposable task revised",
    exact: true
  }));
  await click("Delete task");
  await page.getByRole("dialog", {
    name: "Delete this task?",
    exact: true
  }).getByRole("button", {
    name: "Delete task",
    exact: true
  }).click();
  await visible(page.getByRole("heading", {
    name: "Task deleted",
    exact: true
  }));
  await page.getByRole("button", {
    name: "Close",
    exact: true
  }).click();
  await click("Delete milestone");
  await fill("Confirm name", "Lifecycle milestone revised");
  await page.getByRole("dialog").getByRole("button", {
    name: "Delete milestone",
    exact: true
  }).click();
  await visible(page.getByRole("heading", {
    name: "Break the outcome into milestones.",
    exact: true
  }));
  await click("Delete project");
  await fill("Confirm name", "Lifecycle revised");
  await page.getByRole("dialog").getByRole("button", {
    name: "Delete project",
    exact: true
  }).click();
  await visible(page.getByRole("heading", {
    name: "Projects",
    exact: true
  }));
  assert.equal(await page.getByRole("link").filter({
    hasText: "Lifecycle revised"
  }).count(), 0);
  await page.goto("http://localhost:5175" + disposablePath);
  await visible(page.getByRole("heading", {
    name: "Project not found",
    exact: true
  }));
  await page.goto("http://localhost:5175/profile");
  await fill("Current password", "incorrect-current-password");
  await fill("New password", "Changed-browser-password!");
  await fill("Confirm new password", "Changed-browser-password!");
  await click("Change password");
  await visible(page.getByRole("alert"));
  await fill("Current password", password);
  await click("Change password");
  await visible(page.getByText("Password changed. Sign in with your new password.", {
    exact: true
  }));
  await fill("Email address", "maya@browser.test");
  await fill("Password", "Changed-browser-password!");
  await click("Sign in");
  await visible(page.getByRole("heading", {
    name: "A clear view of what’s next."
  }));
  console.log("PASS: profile save/cancel, password change, full editable draft lifecycle, protected deletion, confirmation focus and deleted deep links");

  const sessionResponse = await context.request.get(apiOrigin + "/api/auth/refresh");
  const adminSession = await sessionResponse.json();
  for (let n = 1; n <= 16; n++) await api("/tasks/create/" + fixtureMilestone._id, { title: "Pagination task " + String(n).padStart(2, "0"), assignedToEmail: "sam@browser.test", priority: "medium" }, adminSession.accessToken);
  await page.goto("http://localhost:5175/tasks/" + fixtureMilestone._id);
  await page.getByLabel("Filter by status").selectOption("pending");
  await visible(page.getByText("1–15 of 16", { exact: true }));
  await click("Next");
  await visible(page.getByText("16–16 of 16", { exact: true }));
  await click("Previous");
  await page.getByLabel("Filter tasks", { exact: true }).fill("Pagination task 01");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Filter tasks", { exact: true }).fill("");
  await page.getByLabel("Filter by status").selectOption("");
  await page.getByLabel("Filter by priority").selectOption("high");
  await click("Implement session recovery");
  await click("Reopen review");
  await fill("Why reopen this review?", "Recheck the completed outcome.");
  await click("Save review");
  await visible(page.locator(".task-meta").getByText("In review", { exact: true }));
  await click("Verify work");
  await visible(page.locator(".task-meta").getByText("Verified", { exact: true }));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log("PASS: task status/priority filters, search, pagination, and reopen/reverify controls");

  // Exercise a reachable error state, then recover.
  await page.route("**/api/workspace", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: '{"message":"Unavailable"}'
  }));
  await page.goto("http://localhost:5175/projects");
  await visible(page.getByRole("alert"));
  await page.unroute("**/api/workspace");
  await click("Try again");
  await visible(page.getByRole("heading", {
    name: "Projects",
    exact: true
  }));
  await context.clearCookies();
  for (const width of [1440, 390]) {
    await page.setViewportSize({
      width,
      height: 900
    });
    for (const path of ["/login", "/register"]) {
      await page.goto("http://localhost:5175" + path);
      await visible(page.locator(".auth-form h2"));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Auth page overflow: " + width + " " + path);
      await page.screenshot({
        path: output + path + "-" + width + ".png",
        fullPage: true
      });
    }
  }
  // The deliberate 503 produces a browser network diagnostic; it is not a runtime error.
  assert.deepEqual(errors.filter(e => !e.includes("503")), []);
  console.log("PASS: all major routes at desktop, tablet and mobile widths; mobile navigation; recoverable server error");
  console.log("Browser checks passed. Screenshots: " + output);
} catch (error) {
  const pages = browser?.contexts()[0]?.pages() || [];
  if (pages[0]) {
    await pages[0].screenshot({
      path: output + "/failure.png",
      fullPage: true
    });
    console.error("Browser failure page:", await pages[0].locator("body").innerText());
  }
  throw error;
} finally {
  await browser?.close();
  if (vite) vite.kill();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && dbName.startsWith("stackflow_browser_test_")) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
