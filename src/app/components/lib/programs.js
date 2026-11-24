import pool from "./db.js";

const DEFAULT_PREFIX = "PRG-";

/**
 * Extracts numeric sequence and prefix from a program_code string.
 * Examples:
 * - "CST-001" -> { num: 1, prefix: "CST-" }
 * - "SM-P-002" -> { num: 2, prefix: "SM-P-" }
 * - "PRG-003" -> { num: 3, prefix: "PRG-" }
 *
 * @param {string|null|undefined} programCode
 * @returns {{ num: number, prefix: string } | null}
 */
export function extractProgramCodeNumber(programCode) {
    if (!programCode || typeof programCode !== "string") return null;
    const trimmed = programCode.trim();
    if (!trimmed) return null;

    // 1. Prefix with hyphen before numbers: e.g. "CST-001", "SM-P-002", "PRG-001"
    const prefixMatch = trimmed.match(/^(.*?-)(\d+)$/);
    if (prefixMatch) {
        const num = parseInt(prefixMatch[2], 10);
        return Number.isFinite(num) ? { num, prefix: prefixMatch[1] } : null;
    }

    // 2. Letters followed directly by numbers: e.g. "PRG001"
    const lettersNumMatch = trimmed.match(/^([A-Za-z]+)(\d+)$/);
    if (lettersNumMatch) {
        const num = parseInt(lettersNumMatch[2], 10);
        return Number.isFinite(num) ? { num, prefix: `${lettersNumMatch[1]}-` } : null;
    }

    // 3. Just digits: e.g. "001"
    const justDigitsMatch = trimmed.match(/^(\d+)$/);
    if (justDigitsMatch) {
        const num = parseInt(justDigitsMatch[1], 10);
        return Number.isFinite(num) ? { num, prefix: DEFAULT_PREFIX } : null;
    }

    return null;
}

/**
 * Formats a sequence number into standard program code format.
 * Defaults to "PRG-001", "PRG-002", etc.
 *
 * @param {number|string} num
 * @param {string} [prefix]
 * @returns {string}
 */
export function formatProgramCode(num, prefix = DEFAULT_PREFIX) {
    const n = Number(num);
    const cleanPrefix = prefix || DEFAULT_PREFIX;
    if (!Number.isFinite(n) || n <= 0) {
        return `${cleanPrefix}001`;
    }
    return `${cleanPrefix}${String(n).padStart(3, "0")}`;
}

/**
 * Determines the next program code academy-wise.
 *
 * @param {object} options
 * @param {number|string|null} [options.academyId]
 * @param {object} [options.connection]
 * @returns {Promise<{success: boolean, academy_id: number|null, next_program_code: string}>}
 */
export async function getNextProgramCode({ academyId = null, connection = null } = {}) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
        const hasAcademy =
            academyId !== null &&
            academyId !== undefined &&
            String(academyId).trim() !== "" &&
            !Number.isNaN(Number(academyId));

        let detectedPrefix = DEFAULT_PREFIX;

        if (hasAcademy) {
            const [academies] = await conn.query(
                "SELECT academy_code, academy_name FROM cst_academy WHERE id = ? LIMIT 1",
                [Number(academyId)]
            );
            if (academies.length > 0) {
                const code = academies[0].academy_code || "";
                const prefixLetters = code.split("-")[0]?.trim();
                if (prefixLetters) {
                    detectedPrefix = `${prefixLetters}-P-`;
                }
            }
        }

        let sql = `
            SELECT id, program_code
            FROM cst_programs
            WHERE is_deleted = 0
              AND program_code IS NOT NULL
              AND TRIM(program_code) != ''
        `;
        const values = [];

        if (hasAcademy) {
            sql += ` AND academy_id = ?`;
            values.push(Number(academyId));
        }

        sql += ` ORDER BY id DESC LIMIT 500`;

        const [rows] = await conn.query(sql, values);

        let maxNum = 0;
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const parsed = extractProgramCodeNumber(row.program_code);
                if (parsed && parsed.num > maxNum) {
                    maxNum = parsed.num;
                    if (parsed.prefix) detectedPrefix = parsed.prefix;
                }
            }
        }

        const nextNum = maxNum > 0 ? maxNum + 1 : 1;
        let candidateCode = formatProgramCode(nextNum, detectedPrefix);

        // Ensure no collision with any existing program code in this academy
        let attempt = 0;
        while (attempt < 50) {
            const [check] = await conn.query(
                "SELECT id FROM cst_programs WHERE academy_id = ? AND program_code = ? LIMIT 1",
                [Number(academyId), candidateCode]
            );
            if (check.length === 0) break;
            attempt++;
            candidateCode = formatProgramCode(nextNum + attempt, detectedPrefix);
        }

        return {
            success: true,
            academy_id: hasAcademy ? Number(academyId) : null,
            next_program_code: candidateCode,
        };
    } finally {
        if (shouldRelease) {
            conn.release();
        }
    }
}
