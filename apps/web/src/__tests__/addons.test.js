import {
    CUSTOM_ADDONS,
    LOCKED_ADDONS,
    isPurchasableAddOn,
    assertPurchasableAddOns,
    canAccessFeature,
    getPlanLimits,
} from "@flexflow/plans";

describe("custom add-on catalog", () => {
    test("previously-purchased features are never locked out of ordering UI", () => {
        // Locked add-ons stay in the catalog so effective entitlements still work.
        expect(Object.keys(CUSTOM_ADDONS)).toEqual(expect.arrayContaining(LOCKED_ADDONS));
    });

    test("the three shipped add-ons are now purchasable", () => {
        expect(LOCKED_ADDONS).toEqual([]);
        for (const id of ["sso", "custom_integrations", "advanced_security"]) {
            expect(isPurchasableAddOn(id)).toBe(true);
        }
        expect(isPurchasableAddOn("audit_logs")).toBe(true);
        expect(isPurchasableAddOn("custom_roles")).toBe(true);
        expect(isPurchasableAddOn("data_retention")).toBe(true);
        expect(isPurchasableAddOn("dedicated_support")).toBe(true);
        expect(isPurchasableAddOn("enterprise_automation")).toBe(true);
        expect(isPurchasableAddOn("api_limit_scale")).toBe(true);
    });

    test("assertPurchasableAddOns accepts the three shipped add-ons for purchase", () => {
        expect(assertPurchasableAddOns(["sso"])).toBeNull();
        expect(assertPurchasableAddOns(["custom_integrations", "advanced_security"])).toBeNull();
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