import fs from "fs";
import path from "path";

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const apiFiles = getAllFiles("src/app/api");

const report = [];

for (const f of apiFiles) {
  // Exclude auth routes (login, forgot-password, register, public-auth)
  const rel = path.relative("src/app/api", f).replace(/\\/g, "/");
  if (rel.startsWith("auth/") || rel.startsWith("public-auth/")) continue;

  const content = fs.readFileSync(f, "utf-8");

  const hasGetAuthUser = content.includes("getAuthUser");
  const hasAuthToken = content.includes("auth_token") || content.includes("jwt.verify") || content.includes("getServerSession");
  const hasAcademyScope = content.includes("academy_id") || content.includes("isSuperAdmin") || content.includes("isAcademyAdmin");
  const hasBranchScope = content.includes("branch_id") || content.includes("isBranchAdmin");

  const methods = [];
  if (content.includes("export async function GET") || content.includes("export function GET")) methods.push("GET");
  if (content.includes("export async function POST") || content.includes("export function POST")) methods.push("POST");
  if (content.includes("export async function PUT") || content.includes("export function PUT")) methods.push("PUT");
  if (content.includes("export async function DELETE") || content.includes("export function DELETE")) methods.push("DELETE");

  report.push({
    file: rel,
    methods,
    hasAuth: hasGetAuthUser || hasAuthToken,
    hasAcademyScope,
    hasBranchScope,
  });
}

console.log(`Total API route files scanned: ${report.length}`);
const unauthenticated = report.filter(r => !r.hasAuth && r.methods.length > 0);
console.log(`\nRoutes WITHOUT getAuthUser / session verification (${unauthenticated.length}):`);
unauthenticated.forEach(r => console.log(` - ${r.file} [${r.methods.join(", ")}]`));

const noTenantScope = report.filter(r => r.hasAuth && !r.hasAcademyScope && r.methods.length > 0);
console.log(`\nRoutes WITH auth but NO academy_id/role scope checks (${noTenantScope.length}):`);
noTenantScope.forEach(r => console.log(` - ${r.file} [${r.methods.join(", ")}]`));
