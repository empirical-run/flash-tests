import { Page, expect } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

export const GOOGLE_SHEET_ID = "1mIOb6YDfN1Qs7G5hij3qmPEdOVvpNzL-cl2XbGFbkiA";
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit?gid=0#gid=0`;

const PROJECT_ID = process.env.LOREM_IPSUM_PROJECT_ID || "3";
const GOOGLE_SHEET_API_PARAMS = `project_id=${encodeURIComponent(PROJECT_ID)}`;

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
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.post(
    `${getApiBaseUrl()}/api/gsheet/proxy?${GOOGLE_SHEET_API_PARAMS}`,
    { headers, data: options },
  );
  expect(response.ok(), await response.text()).toBeTruthy();

  const json = await response.json();
  return json.data ?? json;
}

function encodeRange(sheetTitle: string, range: string): string {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  return encodeURIComponent(`'${escapedTitle}'!${range}`);
}

export async function getFirstSheetProperties(
  page: Page,
): Promise<SheetProperties> {
  const spreadsheet = await googleSheetProxy(page, {
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?fields=sheets(properties(sheetId,title))`,
  });

  const firstSheet = spreadsheet.sheets?.[0]?.properties;
  expect(firstSheet?.title).toBeTruthy();
  return firstSheet;
}

export async function resetGoogleSheetTestData(
  page: Page,
  sheetTitle: string,
): Promise<void> {
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

export async function readGoogleSheetValues(
  page: Page,
  sheetTitle: string,
  range: string,
): Promise<string[][]> {
  const valuesResponse = await googleSheetProxy(page, {
    method: "GET",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeRange(sheetTitle, range)}`,
  });

  return valuesResponse.values ?? [];
}
