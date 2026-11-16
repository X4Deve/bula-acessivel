import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches external leaflet detail without using the curated medicine route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const setId = "021cd76a-b093-4704-8410-5e7d01e20a54";

    const matches = router.matchRoutes(`/medicamentos/externos/openfda/${setId}`);

    expect(matches.at(-1)?.routeId).toBe("/medicamentos/externos/$provider/$externalId");
  });
});
