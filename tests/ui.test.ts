import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error jsdom is a test-only dependency without bundled declarations.
import { JSDOM } from "jsdom";
import React from "react";
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost:3000/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  localStorage: { value: dom.window.localStorage, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { default: CRM } = await import("../components/crm");
const { seed } = await import("../lib/domain");
const STORE = "biai-vercel-demo-v1";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function demo() {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ mode: "demo", authenticated: false, ai: false }),
      { status: 200 },
    );
  return render(React.createElement(CRM));
}
async function ready() {
  await screen.findByText("Local demo");
}
async function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}
test("navigation renders all four screens and original message", async () => {
  demo();
  await ready();
  assert.ok(screen.getByText("Total enquiries"));
  await click("AI Enquiry Processor");
  assert.ok(screen.getByText(seed()[0].message));
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Analyse enquiry",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  await click("Enquiry List");
  assert.ok(screen.getByRole("table"));
  await click("Pipeline");
  assert.equal(screen.getAllByText("No enquiries yet").length, 5);
  await click(/All enquiries/);
  assert.equal(
    screen.getAllByRole("button", { name: /Unclassified Rafi Ahmed/ }).length,
    2,
  );
});
test("search finds repeated contact and filters to no matches", async () => {
  demo();
  await ready();
  await click("Enquiry List");
  fireEvent.change(screen.getByLabelText("Search enquiries"), {
    target: { value: "01711000001" },
  });
  assert.equal(screen.getAllByRole("button", { name: "Rafi Ahmed" }).length, 2);
  fireEvent.change(screen.getByLabelText("Programme"), {
    target: { value: "Masterclass" },
  });
  assert.ok(screen.getByText("No matching enquiries"));
});
test("manual review saves, enters sales pipeline and survives remount", async () => {
  demo();
  await ready();
  await click("AI Enquiry Processor");
  fireEvent.change(screen.getByLabelText("Enquiry type"), {
    target: { value: "Sales" },
  });
  fireEvent.change(screen.getByLabelText("Programme"), {
    target: { value: "Bootcamp" },
  });
  fireEvent.change(screen.getByLabelText("Pipeline stage"), {
    target: { value: "Interested" },
  });
  await click("Save reviewed enquiry");
  await screen.findByText("Changes saved.");
  assert.equal(
    JSON.parse(localStorage.getItem(STORE)!)[0].status,
    "Interested",
  );
  cleanup();
  demo();
  await ready();
  await click("Pipeline");
  assert.ok(screen.getByRole("button", { name: /Bootcamp Rafi Ahmed/ }));
});
test("payment guard blocks unverified save then allows verified save", async () => {
  demo();
  await ready();
  await click("AI Enquiry Processor");
  fireEvent.change(screen.getByLabelText("Pipeline stage"), {
    target: { value: "Paid" },
  });
  await click("Save reviewed enquiry");
  await screen.findByText(
    "Verify payment independently before moving to Paid.",
  );
  assert.equal(localStorage.getItem(STORE), null);
  fireEvent.click(
    screen.getByLabelText("I independently verified the payment."),
  );
  await click("Save reviewed enquiry");
  await screen.findByText("Changes saved.");
  assert.equal(JSON.parse(localStorage.getItem(STORE)!)[0].status, "Paid");
});
test("pasted text needs explicit target confirmation", async () => {
  demo();
  await ready();
  await click("AI Enquiry Processor");
  await click("Paste a message");
  fireEvent.change(screen.getByLabelText("Pasted message"), {
    target: { value: "A different message" },
  });
  await click("Save reviewed enquiry");
  await screen.findByText(
    "Confirm the target enquiry before saving pasted-text results.",
  );
});
test("detail panel updates stage and Escape closes it", async () => {
  demo();
  await ready();
  await click("Enquiry List");
  await click("Rafi Ahmed");
  assert.ok(screen.getByRole("dialog", { name: "Enquiry details" }));
  fireEvent.change(screen.getByLabelText("Pipeline stage"), {
    target: { value: "Contacted" },
  });
  await click("Save changes");
  await screen.findByText("Changes saved.");
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(screen.queryByRole("dialog"), null);
  assert.ok(screen.getByRole("table").textContent?.includes("Contacted"));
});
test("live AI draft is reviewed before it can be saved; regenerate keeps classifications", async () => {
  let saves = 0;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    let body: any;
    if (String(url) === "/api/session")
      body = { mode: "database", authenticated: true, ai: true };
    else if (String(url) === "/api/crm" && !init?.method)
      body = { rows: seed() };
    else if (String(url) === "/api/ai") {
      calls++;
      const current = JSON.parse(String(init?.body)).current;
      body = {
        analysis: current
          ? { ...current, suggested_reply: "Second draft" }
          : {
              customer_name: null,
              phone_number: null,
              programme: "Bootcamp",
              enquiry_type: "Sales",
              detected_language: "Banglish",
              customer_intent: "Asks about price",
              suggested_reply: "Our team can confirm pricing.",
              needs_human_review: false,
            },
      };
    } else {
      saves++;
      body = { row: seed()[0] };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  };
  render(React.createElement(CRM));
  await screen.findByText("Total enquiries");
  await click("AI Enquiry Processor");
  await click("Analyse enquiry");
  await screen.findByText("Your draft is ready to review.");
  assert.equal(saves, 0);
  assert.equal(
    (screen.getByLabelText("Programme") as HTMLSelectElement).value,
    "Bootcamp",
  );
  fireEvent.change(screen.getByLabelText("Programme"), {
    target: { value: "Fellowship" },
  });
  await click("Regenerate");
  await waitFor(() =>
    assert.equal(
      (screen.getByLabelText("Suggested reply") as HTMLTextAreaElement).value,
      "Second draft",
    ),
  );
  assert.equal(
    (screen.getByLabelText("Programme") as HTMLSelectElement).value,
    "Fellowship",
  );
  assert.equal(calls, 2);
  assert.equal(saves, 0);
});

test("new enquiry is independent, keeps missing identity blank, saves once and appears across views", async () => {
  const { newDb } = await import("pg-mem");
  const { list, create } = await import("../lib/db");
  const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
  const p = new Pool();
  let posts = 0;
  globalThis.fetch = async (url, options) => {
    let body: unknown;
    if (String(url).endsWith("/session"))
      body = { mode: "database", authenticated: true, ai: true };
    else if (String(url).endsWith("/ai"))
      body = {
        analysis: {
          customer_name: null,
          phone_number: null,
          programme: "Bootcamp",
          enquiry_type: "Sales",
          detected_language: "Banglish",
          customer_intent: "Bootcamp price",
          suggested_reply: "Please review the programme details.",
          needs_human_review: true,
        },
      };
    else if (options?.method === "POST") {
      posts++;
      body = { row: await create(p, JSON.parse(String(options.body))) };
    } else body = { rows: await list(p) };
    return Response.json(body);
  };
  render(React.createElement(CRM));
  await screen.findByText("Total enquiries");
  await click("AI Enquiry Processor");
  assert.equal(
    (screen.getByLabelText("Phone number") as HTMLInputElement).value,
    seed()[0].phone,
  );
  assert.ok(screen.getAllByText("From official dataset").length >= 2);
  await click("New Enquiry");
  assert.equal(
    (screen.getByLabelText("Contact name") as HTMLInputElement).value,
    "",
  );
  assert.equal(
    (screen.getByLabelText("Phone number") as HTMLInputElement).value,
    "",
  );
  fireEvent.change(screen.getByLabelText("Message source"), {
    target: { value: "Website" },
  });
  fireEvent.change(screen.getByLabelText("Raw customer message"), {
    target: { value: seed()[0].message },
  });
  await click("Analyze with AI");
  await waitFor(() =>
    assert.equal(
      (screen.getByLabelText("Programme") as HTMLSelectElement).value,
      "Bootcamp",
    ),
  );
  assert.equal(
    (screen.getByLabelText("Phone number") as HTMLInputElement).value,
    "",
  );
  assert.ok(screen.getAllByText("Extracted by AI").length > 0);
  const button = screen.getByRole("button", { name: "Save New Enquiry" });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText(
    "New enquiry saved · Manual Entry. Official dataset preserved.",
  );
  assert.equal(posts, 1);
  assert.deepEqual((await list(p)).slice(0, 20), seed());
  assert.equal((await list(p))[20].channel, "Website");
  await click("Dashboard");
  assert.ok(screen.getAllByText("21").length > 0);
  await click("Enquiry List");
  fireEvent.change(screen.getByLabelText("Dataset view"), {
    target: { value: "Manual entries" },
  });
  assert.ok(screen.getByRole("button", { name: "Unnamed customer" }));
  await click("Pipeline");
  assert.ok(screen.getByRole("button", { name: /Bootcamp Unnamed customer/ }));
  cleanup();
  await p.end();
});

test("detail review dropdown persists Reviewed and Pending without changing stage or reply", async () => {
  demo();
  await ready();
  await click("Enquiry List");
  fireEvent.click(screen.getAllByRole("button", { name: "Rafi Ahmed" })[0]);
  fireEvent.change(screen.getByLabelText("Review status"), {
    target: { value: "Reviewed" },
  });
  await click("Save changes");
  await screen.findByText("Changes saved.");
  assert.equal(
    JSON.parse(localStorage.getItem(STORE)!)[0].needs_human_review,
    false,
  );
  await click("Close detail panel");
  await click("Dashboard");
  assert.ok(!document.querySelector(".inbox-list")!.textContent!.includes(seed()[0].message));
  await click("Enquiry List");
  fireEvent.click(screen.getAllByRole("button", { name: "Rafi Ahmed" })[0]);
  fireEvent.change(screen.getByLabelText("Review status"), {
    target: { value: "Pending" },
  });
  await click("Save changes");
  await waitFor(() =>
    assert.equal(
      JSON.parse(localStorage.getItem(STORE)!)[0].needs_human_review,
      true,
    ),
  );
  assert.equal(JSON.parse(localStorage.getItem(STORE)!)[0].status, "New");
  await click("Close detail panel");
  await click("Dashboard");
  assert.ok(document.querySelector(".inbox-list")!.textContent!.includes(seed()[0].message));
});

test("AI stage recommendation stays in draft until explicit save and appears on pipeline cards", async () => {
  const { applySave } = await import("../lib/domain");
  let rows = seed();
  let saves = 0;
  const message =
    "Ami admission nite interested. Registration process ta bolben?";
  const analysis = {
    customer_name: null,
    phone_number: null,
    programme: "Bootcamp",
    enquiry_type: "Sales",
    detected_language: "Banglish",
    customer_intent: "Wants to join",
    suggested_reply: "Our team can help.",
    needs_human_review: false,
    recommended_pipeline_stage: "Interested",
    pipeline_reason: "Customer explicitly expresses interest in joining.",
    pipeline_confidence: "high",
    requires_staff_approval: true,
    payment_verification_required: false,
    pipeline_signal: "explicit_interest",
    pipeline_evidence: message,
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/session"))
      return Response.json({ mode: "database", authenticated: true, ai: true });
    if (String(url).endsWith("/ai")) return Response.json({ analysis });
    if (options?.method === "PATCH") {
      saves++;
      const input = JSON.parse(String(options.body));
      const row = applySave(
        rows.find((r) => r.id === input.id)!,
        input,
      );
      rows = rows.map((r) => (r.id === row.id ? row : r));
      return Response.json({ row });
    }
    return Response.json({ rows });
  };
  render(React.createElement(CRM));
  await screen.findByText("Total enquiries");
  assert.ok(screen.getByRole("heading", { name: "Dashboard", level: 1 }));
  assert.equal(screen.queryByText("AI-assisted pipeline"), null);
  for (const label of [
    "Total enquiries",
    "Needs review",
    "Sales opportunities",
    "Paid enquiries",
  ])
    assert.ok(
      screen
        .getByRole("heading", { name: label, level: 2 })
        .classList.contains("stat-title"),
    );
  await click("AI Enquiry Processor");
  await click("Paste a message");
  fireEvent.change(screen.getByLabelText("Pasted message"), {
    target: { value: message },
  });
  await click("Analyse enquiry");
  await screen.findByRole("region", { name: "AI Pipeline Recommendation" });
  assert.equal(saves, 0);
  assert.equal(rows[0].status, "New");
  assert.equal(
    (screen.getByLabelText("Pipeline stage") as HTMLSelectElement).value,
    "New",
  );
  await click("Apply Recommendation");
  assert.equal(
    (screen.getByLabelText("Pipeline stage") as HTMLSelectElement).value,
    "Interested",
  );
  assert.equal(saves, 0);
  assert.equal(rows[0].status, "New");
  fireEvent.click(screen.getByLabelText(/Apply this pasted-message review/));
  await click("Save reviewed enquiry");
  await screen.findByText("Changes saved.");
  assert.equal(saves, 1);
  assert.equal(rows[0].status, "Interested");
  await click("Pipeline");
  assert.ok(screen.getByText("AI suggestion · review"));
  fireEvent.click(
    screen.getByRole("button", { name: /Bootcamp AI suggestion.*Rafi Ahmed/ }),
  );
  assert.ok(screen.getByRole("region", { name: "AI Pipeline Recommendation" }));
  fireEvent.change(screen.getByLabelText("Pipeline stage"), {
    target: { value: "Lost" },
  });
  await click("Save changes");
  await waitFor(() => assert.equal(rows[0].status, "Lost"));
});

test("payment claim recommendation cannot apply Paid; existing manual verification stays required", async () => {
  const { groundPipeline } = await import("../lib/domain");
  const message = "Ami payment korechi.";
  const analysis = groundPipeline(
    {
      customer_name: null,
      phone_number: null,
      programme: "Bootcamp",
      enquiry_type: "Sales",
      detected_language: "Banglish",
      customer_intent: "Payment claimed",
      suggested_reply: "Staff will check.",
      needs_human_review: true,
      recommended_pipeline_stage: "Paid",
      pipeline_reason: "Customer claims payment.",
      pipeline_confidence: "high",
      requires_staff_approval: true,
      pipeline_signal: "payment_claim",
      pipeline_evidence: message,
    },
    message,
    { status: "New", contactRecorded: false },
  );
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).endsWith("/session")
        ? { mode: "database", authenticated: true, ai: true }
        : String(url).endsWith("/ai")
          ? { analysis }
          : { rows: seed() },
    );
  render(React.createElement(CRM));
  await screen.findByText("Total enquiries");
  await click("AI Enquiry Processor");
  await click("Analyse enquiry");
  await screen.findByRole("region", { name: "AI Pipeline Recommendation" });
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Apply Recommendation",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  assert.equal(
    (screen.getByLabelText("Pipeline stage") as HTMLSelectElement).value,
    "New",
  );
  fireEvent.change(screen.getByLabelText("Pipeline stage"), {
    target: { value: "Paid" },
  });
  assert.ok(screen.getByLabelText("I independently verified the payment."));
});

test("theme toggle persists through navigation and remount; unwanted sidebar cards are removed", async () => {
  delete document.documentElement.dataset.theme;
  demo(); await ready();
  const toggle = screen.getByRole("switch", { name: "Dark mode" });
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  assert.equal(screen.queryByText("BIAI workspace"), null);
  assert.equal(screen.queryByText("A little AI. A lot less admin."), null);
  assert.ok(screen.getByRole("button", {name:"Workspace guide"}));
  assert.ok(screen.getByRole("button", {name:"Process enquiry"}));
  fireEvent.click(toggle);
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(localStorage.getItem("biai-theme"), "dark");
  for (const name of ["AI Enquiry Processor", "Enquiry List", "Pipeline", "Dashboard"]) {
    await click(name);
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(screen.getByRole("switch", {name:"Dark mode"}).getAttribute("aria-checked"), "true");
  }
  cleanup(); demo(); await ready();
  assert.equal(screen.getByRole("switch", {name:"Dark mode"}).getAttribute("aria-checked"), "true");
  fireEvent.click(screen.getByRole("switch", {name:"Dark mode"}));
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(localStorage.getItem("biai-theme"), "light");
});

test("login screen supports theme selection and storage errors do not break the toggle", async () => {
  document.documentElement.dataset.theme = "dark";
  globalThis.fetch = async () => Response.json({mode:"database", authenticated:false, ai:false});
  render(React.createElement(CRM));
  await screen.findByRole("button", {name:"Open workspace"});
  const toggle=screen.getByRole("switch", {name:"Dark mode"});
  await waitFor(()=>assert.equal(toggle.getAttribute("aria-checked"),"true"));
  const original=dom.window.Storage.prototype.setItem;
  try {
    dom.window.Storage.prototype.setItem=()=>{throw new Error("Blocked storage")};
    fireEvent.click(toggle);
    assert.equal(document.documentElement.dataset.theme,"light");
    assert.equal(toggle.getAttribute("aria-checked"),"false");
  } finally {dom.window.Storage.prototype.setItem=original;}
});


test("Dashboard inbox only shows pending rows, counts pending and retains reviewed records in list", async () => {
  const records = seed();
  records[0].needs_human_review = false;
  records[1].needs_human_review = false;
  localStorage.setItem(STORE, JSON.stringify(records));
  const { container } = demo();
  await ready();
  const inbox = container.querySelector(".inbox-list")!;
  assert.equal(inbox.querySelectorAll(".inbox-row").length, 6);
  assert.ok(!inbox.textContent!.includes(records[0].message));
  assert.ok(inbox.textContent!.includes(records[2].message));
  assert.equal(inbox.closest("section")!.querySelector(".count")!.textContent, "18");
  assert.equal(screen.queryByText("AI-assisted pipeline"), null);
  await click("Enquiry List");
  assert.ok(screen.getAllByRole("button", { name: "Rafi Ahmed" }).length);
});

test("Dashboard inbox shows an empty state when all entries are reviewed", async () => {
  localStorage.setItem(STORE, JSON.stringify(seed().map(r => ({ ...r, needs_human_review: false }))));
  const { container } = demo();
  await ready();
  assert.equal(container.querySelectorAll(".inbox-row").length, 0);
  assert.ok(screen.getByText("No pending enquiries. You’re all caught up."));
  assert.equal(JSON.parse(localStorage.getItem(STORE)!).length, 20);
});
