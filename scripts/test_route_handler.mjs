import { GET as getBranches } from "../src/app/api/branch/route.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

async function main() {
    // Generate token for Academy Admin 1 (id: 5, academy: 1, branch: 1)
    const token = jwt.sign({ id: 5, user_type: "Academy Admin" }, JWT_SECRET);
    
    const req = new Request("http://localhost:3000/api/branch", {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    const res = await getBranches(req);
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Branches returned:", json.data?.length);
    console.table(json.data?.map(b => ({ id: b.id, name: b.branch_name, academy_id: b.academy_id })));
    process.exit(0);
}

main().catch(console.error);
