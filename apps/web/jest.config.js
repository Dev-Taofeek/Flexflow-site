const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterFramework: ["<rootDir>/jest.setup.js"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^socket.io-client$": "<rootDir>/src/__mocks__/socket.io-client.js",
    },
    testMatch: ["<rootDir>/src/__tests__/**/*.test.{js,jsx}"],
    collectCoverageFrom: [
        "src/components/**/*.{js,jsx}",
        "src/app/**/*.{js,jsx}",
        "!src/**/*.test.{js,jsx}",
        "!src/**/__mocks__/**",
    ],
};

module.exports = createJestConfig(config);
