import {
    CUSTOM_ADDONS,
    LOCKED_ADDONS,
    isPurchasableAddOn,
    lockedAddOns,
    assertPurchasableAddOns,
    canAccessFeature,
    getPlanLimits,
} from "@flexflow/plans";

describe("custom add-on catalog", () => {
    test("previously-purchased features are never locked out of ordering UI", () => {
        // Locked add-ons stay in the catalog so effective entitlements still work.
        expect(Object.keys(CUSTOM_ADDONS)).toEqual(expect.arrayContaining(LOCKED_ADDONS));
    });

    test("non-implemented add-ons are locked for purchase", () => {
        expect(LOCKED_ADDONS).toEqual(["sso", "custom_integrations", "advanced_security"]);
        for (const id of LOCKED_ADDONS) {
            expect(isPurchasableAddOn(id)).toBe(false);
        }
        expect(lockedAddOns().map((a) => a.id)).toEqual(expect.arrayContaining(LOCKED_ADDONS));
        expect(isPurchasableAddOn("audit_logs")).toBe(true);
        expect(isPurchasableAddOn("custom_roles")).toBe(true);
        expect(isPurchasableAddOn("data_retention")).toBe(true);
        expect(isPurchasableAddOn("dedicated_support")).toBe(true);
        expect(isPurchasableAddOn("enterprise_automation")).toBe(true);
        expect(isPurchasableAddOn("api_limit_scale")).toBe(true);
    });

    test("assertPurchasableAddOns rejects locked ids and accepts new purchases", () => {
        expect(assertPurchasableAddOns(["sso"])).toMatch(/not yet available/);
        expect(assertPurchasableAddOns(["custom_integrations", "audit_logs"])).toMatch(/not yet available/);
        expect(assertPurchasableAddOns(["audit_logs", "enterprise_automation"])).toBeNull();
        expect(assertPurchasableAddOns([])).toBeNull();
        expect(assertPurchasableAddOns(["not-an-add-on"])).toBeNull();
    });

    test("enterprise_automation is a gated Custom feature", () => {
        expect(canAccessFeature("custom", [], "enterprise_automation")).toBe(false);
        expect(canAccessFeature("custom", ["enterprise_automation"], "enterprise_automation")).toBe(true);
        expect(canAccessFeature("pro", ["enterprise_automation"], "enterprise_automation")).toBe(false);
    });

    test("custom automation allowance is capped unless enterprise_automation is bought", () => {
        expect(getPlanLimits("free", []).automationRunsPerMonth).toBe(100);
        expect(getPlanLimits("pro", []).automationRunsPerMonth).toBe(5000);
        expect(getPlanLimits("custom", []).automationRunsPerMonth).toBe(5000);
        expect(getPlanLimits("custom", ["enterprise_automation"]).automationRunsPerMonth).toBe(Infinity);
    });

    test("api_limit_scale scales the custom API allowance", () => {
        const base = getPlanLimits("custom", []).apiRequestsPerMonth;
        expect(getPlanLimits("custom", ["api_limit_scale"]).apiRequestsPerMonth).toBe(base * 10);
    });
});