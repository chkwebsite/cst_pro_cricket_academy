import { isValidCricketOvers, oversToBalls, ballsToOvers } from "../src/app/next_panel/components/cricketHelpers.js";

console.log("=== Testing Cricket Helpers & Validations ===");

// 1. Overs format tests
console.log("Testing overs format:");
const oversCases = [
    { input: "20.0", valid: true, expectedBalls: 120 },
    { input: "19.5", valid: true, expectedBalls: 119 },
    { input: "4.2", valid: true, expectedBalls: 26 },
    { input: "20.6", valid: false },
    { input: "15.7", valid: false },
    { input: "-1", valid: false },
];

for (const c of oversCases) {
    const isVal = isValidCricketOvers(c.input);
    if (isVal !== c.valid) {
        console.error(`FAIL: isValidCricketOvers("${c.input}") returned ${isVal}, expected ${c.valid}`);
        process.exit(1);
    }
    if (isVal && oversToBalls(c.input) !== c.expectedBalls) {
        console.error(`FAIL: oversToBalls("${c.input}") returned ${oversToBalls(c.input)}, expected ${c.expectedBalls}`);
        process.exit(1);
    }
}
console.log("✓ All overs format tests passed!");

// 2. Batting runs mismatch test
console.log("\nTesting batting runs mismatch logic:");
const inningsTotalRuns = 200;
const inningsExtras = 15;
const otherBatters = [{ runs: 50 }, { runs: 80 }]; // sum = 130
const otherBattersRuns = otherBatters.reduce((acc, b) => acc + b.runs, 0); // 130
const maxAllowedForBatter = Math.max(0, inningsTotalRuns - inningsExtras - otherBattersRuns); // 200 - 15 - 130 = 55

console.log(`Innings Total: ${inningsTotalRuns}, Extras: ${inningsExtras}, Other Batters: ${otherBattersRuns}`);
console.log(`Max Allowed for Batter: ${maxAllowedForBatter}`);

if (maxAllowedForBatter !== 55) {
    console.error(`FAIL: expected 55, got ${maxAllowedForBatter}`);
    process.exit(1);
}

const testExceeded = (runs) => (otherBattersRuns + runs + inningsExtras) > inningsTotalRuns;
if (!testExceeded(56)) {
    console.error("FAIL: 56 runs should exceed 200!");
    process.exit(1);
}
if (testExceeded(55)) {
    console.error("FAIL: 55 runs should NOT exceed 200!");
    process.exit(1);
}
console.log("✓ Batting runs mismatch logic passed!");

// 3. Bowling overs mismatch test
console.log("\nTesting bowling overs mismatch logic:");
const matchOvers = 20;
const maxMatchBalls = matchOvers * 6; // 120
const inningsTotalBalls = oversToBalls("18.4"); // 18 * 6 + 4 = 112
const otherBowlers = [{ balls: 24 }, { balls: 24 }]; // 48
const otherBowlersBalls = otherBowlers.reduce((acc, b) => acc + b.balls, 0);
const maxAllowedBalls = Math.max(0, inningsTotalBalls - otherBowlersBalls); // 112 - 48 = 64 balls

console.log(`Match Overs: ${matchOvers} (${maxMatchBalls} balls)`);
console.log(`Innings Balls: ${inningsTotalBalls}, Other Bowlers Balls: ${otherBowlersBalls}`);
console.log(`Max Allowed Balls: ${maxAllowedBalls} (~${ballsToOvers(maxAllowedBalls)} ov)`);

if (maxAllowedBalls !== 64) {
    console.error(`FAIL: expected 64 balls, got ${maxAllowedBalls}`);
    process.exit(1);
}

const testBowlerExceeded = (overs) => {
    const balls = oversToBalls(overs);
    return balls > maxMatchBalls || (otherBowlersBalls + balls > inningsTotalBalls);
};

if (!testBowlerExceeded("11.0")) {
    console.error("FAIL: 11.0 overs (66 balls) should exceed remaining 64 balls!");
    process.exit(1);
}
if (testBowlerExceeded("10.4")) {
    console.error("FAIL: 10.4 overs (64 balls) should NOT exceed remaining 64 balls!");
    process.exit(1);
}
console.log("✓ Bowling overs mismatch logic passed!");

console.log("\nALL VALIDATION LOGIC TESTS PASSED SUCCESSFULLY! 🎉");
