/** Jest config. Tests cover the pure logic - context building and demo playback.
    The PCF lifecycle itself is exercised by `npm start` in the test harness. */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts"],
    transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs", target: "es2017", lib: ["es2019", "dom"] } }]
    },
    collectCoverageFrom: ["AgentChatWidget/auth.ts", "AgentChatWidget/demo.ts"]
};
