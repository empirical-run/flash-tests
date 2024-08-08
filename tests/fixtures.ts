import { test as base } from "@playwright/test";
import { baseTestFixture } from "@empiricalrun/playwright-utils/test";

export const test = baseTestFixture(base);
export const expect = test.expect;
