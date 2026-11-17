console.log("=== Testing Balls Faced Validation ===");

const matchOvers = 20;
const matchMaxBalls = matchOvers * 6; // 120 balls
const maxBallsForInnings = 120; // 20.0 overs
const otherBattersBalls = 40; // e.g. other batters faced 40 balls
const maxAllowedBalls = Math.max(0, maxBallsForInnings - otherBattersBalls); // 80 balls

console.log(`Match Overs: ${matchOvers} (${matchMaxBalls} balls)`);
console.log(`Innings Max Balls: ${maxBallsForInnings}`);
console.log(`Other Batters Balls Faced: ${otherBattersBalls}`);
console.log(`Max Allowed Balls for This Batter: ${maxAllowedBalls}`);

const checkBallsExceeded = (balls) => {
    return balls > matchMaxBalls || (otherBattersBalls + balls > maxBallsForInnings);
};

// Test 1: User's screenshot input of 161 balls
console.log("\nTest 1: User enters 161 balls (from uploaded screenshot):");
const userEnteredBalls = 161;
const isExceeded161 = checkBallsExceeded(userEnteredBalls);
console.log(`161 balls check: isExceeded = ${isExceeded161}`);
if (!isExceeded161) {
    console.error("FAIL: 161 balls should be REJECTED in a 20-over match!");
    process.exit(1);
}
console.log("✓ 161 balls correctly blocked!");

// Test 2: User enters 121 balls
console.log("\nTest 2: User enters 121 balls:");
if (!checkBallsExceeded(121)) {
    console.error("FAIL: 121 balls should be REJECTED!");
    process.exit(1);
}
console.log("✓ 121 balls correctly blocked!");

// Test 3: User enters valid balls (e.g. 50 balls)
console.log("\nTest 3: User enters 50 balls (within 80 balls limit):");
if (checkBallsExceeded(50)) {
    console.error("FAIL: 50 balls should be ALLOWED!");
    process.exit(1);
}
console.log("✓ 50 balls correctly allowed!");

// Test 4: Boundary runs check
console.log("\nTest 4: Boundary runs check:");
const checkBoundaryRuns = (fours, sixes, runs) => (fours * 4 + sixes * 6) > runs;
if (checkBoundaryRuns(6, 1, 45)) { // 24 + 6 = 30 <= 45
    console.error("FAIL: 6 fours and 1 six (30 runs) should be ALLOWED for 45 runs!");
    process.exit(1);
}
if (!checkBoundaryRuns(10, 2, 45)) { // 40 + 12 = 52 > 45
    console.error("FAIL: 52 boundary runs should be REJECTED for 45 total runs!");
    process.exit(1);
}
console.log("✓ Boundary runs validation passed!");

console.log("\nALL BALLS FACED VALIDATION TESTS PASSED! 🎉");
