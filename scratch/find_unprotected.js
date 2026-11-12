import fs from "fs";
import path from "path";

function scanDir(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
            results.push(...scanDir(full));
        } else if (item.isFile() && item.name.startsWith("route.")) {
            const content = fs.readFileSync(full, "utf8");
            const rel = path.relative("src/app/api", full).replace(/\\/g, "/");
            const hasAuth = content.includes("getAuthUser") || content.includes("jwt.verify") || content.includes("verifyAuthToken");
            const isPublic = ["auth/", "public/", "cron/", "health"].some(p => rel.startsWith(p));
            if (!hasAuth && !isPublic) {
                results.push(rel);
            }
        }
    }
    return results;
}

const noAuth = scanDir("src/app/api");
console.log(`Found ${noAuth.length} routes without auth:`);
console.log(noAuth.join("\n"));
