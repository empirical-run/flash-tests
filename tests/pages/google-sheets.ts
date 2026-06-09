import { Page, expect } from "@playwright/test";

export const GOOGLE_SHEET_ID = "1mIOb6YDfN1Qs7G5hij3qmPEdOVvpNzL-cl2XbGFbkiA";
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit?gid=0#gid=0`;
export const GOOGLE_SHEET_RESOURCE_NAME = "Empirical Google Sheet E2E Resource";

const PROJECT_ID = process.env.LOREM_IPSUM_PROJECT_ID || "3";
const RESOURCE_HEADERS = { "x-project-id": PROJECT_ID };
const RESOURCE_API_PARAMS = `project_id=${encodeURIComponent(PROJECT_ID)}`;

type Resource = {
  id: number;
  name?: string;
  title?: string;
  url?: string;
  resource_url?: string;
};

type SheetProperties = {
  sheetId: number;
  title: string;
};

type GoogleSheetProxyOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
};

async function googleSheetProxy(page: Page, options: GoogleSheetProxyOptions) {
  const response = await page.request.post(`/api/gsheet/proxy?${RESOURCE_API_PARAMS}`, {
    data: options,
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const json = await response.json();
  return json.data ?? json;
}

function encodeRange(sheetTitle: string, range: string): string {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  return encodeURIComponent(`'${escapedTitle}'!${range}`);
}

function matchesGoogleSheetResource(resource: Resource): boolean {
  return JSON.stringify(resource).includes(GOOGLE_SHEET_ID);
}

export async function listGoogleSheetResources(page: Page): Promise<Resource[]> {
  const resources: Resource[] = [];
  let pageNumber = 1;

  while (true) {
    const response = await page.request.get(`/api/resources?${RESOURCE_API_PARAMS}&page=${pageNumber}&per_page=100`, {
      headers: RESOURCE_HEADERS,
    });
    expect(response.ok(), await response.text()).toBeTruthy();

    const json = await response.json();
    const pageResources: Resource[] = json.data?.resources ?? json.resources ?? [];
    resources.push(...pageResources.filter(matchesGoogleSheetResource));

    if (pageResources.length < 100) {
      break;
    }
    pageNumber++;
  }

  return resources;
}

export async function deleteResource(page: Page, resourceId: number): Promise<void> {
  const response = await page.request.delete(`/api/resources/${resourceId}?${RESOURCE_API_PARAMS}`, {
    headers: RESOURCE_HEADERS,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function ensureGoogleSheetResource(page: Page): Promise<{ resource: Resource; created: boolean }> {
  const existingResources = await listGoogleSheetResources(page);
  if (existingResources.length > 0) {
    return { resource: existingResources[0], created: false };
  }

  await page.goto("/lorem-ipsum/resources");
  await page.getByRole("button", { name: "Add resource" }).first().click();
  await page.getByRole("menuitem", { name: "Add a URL" }).click();

  const dialog = page.getByRole("dialog", { name: "Add URL" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "URL" }).fill(GOOGLE_SHEET_URL);
  await dialog.getByRole("textbox", { name: "Name" }).fill(GOOGLE_SHEET_RESOURCE_NAME);

  const createResponsePromise = page.waitForResponse(
    response => response.url().includes("/api/resources") && response.request().method() === "POST" && response.ok(),
    { timeout: 30000 }
  );
  await dialog.getByRole("button", { name: "Add" }).click();
  await createResponsePromise;

  const updatedResources = await listGoogleSheetResources(page);
  expect(updatedResources.length).toBeGreaterThan(0);
  return { resource: updatedResources[0], created: true };
}

export async function getFirstSheetProperties(page: Page): Promise<SheetProperties> {
  const spreadsheet = await googleSheetProxy(page, {
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?fields=sheets(properties(sheetId,title))`,
  });

  const firstSheet = spreadsheet.sheets?.[0]?.properties;
  expect(firstSheet?.title).toBeTruthy();
  return firstSheet;
}

export async function resetGoogleSheetTestData(page: Page, sheetTitle: string): Promise<void> {
  const range = encodeRange(sheetTitle, "A1:Z50");
  await googleSheetProxy(page, {
    method: "POST",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:clear`,
    body: {},
  });

  await googleSheetProxy(page, {
    method: "PUT",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
    body: {
      values: [
        ["Task ID", "Owner", "Status", "Agent Note"],
        ["EMP-GSHEET-E2E", "Empirical QA", "Pending", ""],
        ["CONTROL-ROW", "Do not edit", "Leave alone", "unchanged"],
      ],
    },
  });
}

export async function readGoogleSheetValues(page: Page, sheetTitle: string, range: string): Promise<string[][]> {
  const valuesResponse = await googleSheetProxy(page, {
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeRange(sheetTitle, range)}`,
  });

  return valuesResponse.values ?? [];
}
