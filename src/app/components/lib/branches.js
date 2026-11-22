import pool from "./db.js";

const DEFAULT_PREFIX = "BR-";

/**
 * Extracts numeric sequence and optional prefix from a branch_code string.
 * Handles formats like:
 * - "BR-001" -> { num: 1, prefix: "BR-" }
 * - "BR-CODE-001" -> { num: 1, prefix: "BR-CODE-" }
 * - "GGN-BR-001" -> { num: 1, prefix: "GGN-BR-" }
 * - "BR001" -> { num: 1, prefix: "BR-" }
 * - "001" -> { num: 1, prefix: "BR-" }
 *
 * @param {string|null|undefined} branchCode
 * @returns {{ num: number, prefix: string } | null}
 */
export function extractBranchCodeNumber(branchCode) {
    if (!branchCode || typeof branchCode !== "string") return null;
    const trimmed = branchCode.trim();
    if (!trimmed) return null;

    // 1. Prefix with hyphen before numbers: e.g. "BR-001", "BR-CODE-001", "GGN-BR-001"
    const prefixMatch = trimmed.match(/^(.*?-)(\d+)$/);
    if (prefixMatch) {
        const num = parseInt(prefixMatch[2], 10);
        return Number.isFinite(num) ? { num, prefix: prefixMatch[1] } : null;
    }

    // 2. Letters followed directly by numbers: e.g. "BR001"
    const lettersNumMatch = trimmed.match(/^([A-Za-z]+)(\d+)$/);
    if (lettersNumMatch) {
        const num = parseInt(lettersNumMatch[2], 10);
        return Number.isFinite(num) ? { num, prefix: `${lettersNumMatch[1]}-` } : null;
    }

    // 3. Just digits: e.g. "001", "1"
    const justDigitsMatch = trimmed.match(/^(\d+)$/);
    if (justDigitsMatch) {
        const num = parseInt(justDigitsMatch[1], 10);
        return Number.isFinite(num) ? { num, prefix: DEFAULT_PREFIX } : null;
    }

    // 4. Any ending digits: e.g. "Branch 001"
    const anyEndDigits = trimmed.match(/^(.*?)(\d+)$/);
    if (anyEndDigits) {
        const num = parseInt(anyEndDigits[2], 10);
        return Number.isFinite(num) ? { num, prefix: anyEndDigits[1] || DEFAULT_PREFIX } : null;
    }

    return null;
}

/**
 * Formats a sequence number into standard branch code format.
 * Defaults to "BR-001", "BR-002", etc.
 *
 * @param {number|string} num
 * @param {string} [prefix]
 * @returns {string}
 */
export function formatBranchCode(num, prefix = DEFAULT_PREFIX) {
    const n = Number(num);
    const cleanPrefix = prefix || DEFAULT_PREFIX;
    if (!Number.isFinite(n) || n <= 0) {
        return `${cleanPrefix}001`;
    }
    return `${cleanPrefix}${String(n).padStart(3, "0")}`;
}

/**
 * Determines the next branch code academy-wise based on existing branches in the database.
 * If academyId is provided, checks ONLY that academy's branches.
 * If that academy has branches, takes the highest numeric sequence + 1.
 * If that academy has 0 branches, returns "BR-001".
 *
 * @param {object} options
 * @param {number|string|null} [options.academyId]
 * @param {object} [options.connection]
 * @returns {Promise<{success: boolean, academy_id: number|null, last_branch_code: string|null, last_number: number, next_number: number, next_branch_code: string}>}
 */
export async function getNextBranchCode({ academyId = null, connection = null } = {}) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
        const hasAcademy =
            academyId !== null &&
            academyId !== undefined &&
            String(academyId).trim() !== "" &&
            !Number.isNaN(Number(academyId));

        let sql = `
            SELECT id, branch_code
            FROM cst_branch
            WHERE is_deleted = 0
              AND branch_code IS NOT NULL
              AND TRIM(branch_code) != ''
        `;
        const values = [];

        if (hasAcademy) {
            sql += ` AND academy_id = ?`;
            values.push(Number(academyId));
        }

        sql += ` ORDER BY id DESC LIMIT 500`;

        const [rows] = await conn.execute(sql, values);

        let lastBranchCode = null;
        let lastNum = 0;
        let maxNum = 0;
        let detectedPrefix = DEFAULT_PREFIX;

        if (rows && rows.length > 0) {
            lastBranchCode = rows[0].branch_code;
            const firstParsed = extractBranchCodeNumber(lastBranchCode);
            if (firstParsed) {
                lastNum = firstParsed.num;
                if (firstParsed.prefix) detectedPrefix = firstParsed.prefix;
            }

            for (const row of rows) {
                const parsed = extractBranchCodeNumber(row.branch_code);
                if (parsed && parsed.num > maxNum) {
                    maxNum = parsed.num;
                    if (parsed.prefix) detectedPrefix = parsed.prefix;
                }
            }
        }

        const nextNum = maxNum > 0 ? maxNum + 1 : 1;
        const nextBranchCode = formatBranchCode(nextNum, detectedPrefix);

        return {
            success: true,
            academy_id: hasAcademy ? Number(academyId) : null,
            last_branch_code: lastBranchCode,
            last_number: lastNum,
            next_number: nextNum,
            next_branch_code: nextBranchCode,
        };
    } finally {
        if (shouldRelease) {
            conn.release();
        }
    }
}
