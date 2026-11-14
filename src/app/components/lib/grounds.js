import pool from "./db.js";

const CODE_PREFIX = "GD-CODE-";

/**
 * Extracts numeric sequence from a ground_code string.
 * Handles formats like "GD-CODE-001", "GD-code-001", "GD-1", "001", "1", etc.
 *
 * @param {string|null|undefined} groundCode
 * @returns {number|null}
 */
export function extractGroundCodeNumber(groundCode) {
    if (!groundCode || typeof groundCode !== "string") return null;
    const trimmed = groundCode.trim();
    if (!trimmed) return null;

    // Matches GD-CODE-<number> or GD-<number>
    const gdMatch = trimmed.match(/^GD(?:-CODE)?-?(\d+)/i);
    if (gdMatch) {
        const n = parseInt(gdMatch[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    // Fallback: any digits in the string
    const anyDigit = trimmed.match(/(\d+)/);
    if (anyDigit) {
        const n = parseInt(anyDigit[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

/**
 * Formats a sequence number into "GD-CODE-001" structure (GD-CODE- followed by at least 3 digits).
 *
 * @param {number|string} num
 * @returns {string}
 */
export function formatGroundCode(num) {
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) {
        return `${CODE_PREFIX}001`;
    }
    return `${CODE_PREFIX}${String(n).padStart(3, "0")}`;
}

/**
 * Determines the next ground code academy-wise based on existing grounds in the database.
 * If academyId is provided, checks ONLY that academy's grounds.
 * If that academy has grounds, takes the last/highest ground code number + 1.
 * If that academy has 0 grounds, returns "GD-CODE-001".
 *
 * @param {object} options
 * @param {number|string|null} [options.academyId]
 * @param {object} [options.connection]
 * @returns {Promise<{success: boolean, academy_id: number|null, last_ground_code: string|null, last_number: number, next_number: number, next_ground_code: string}>}
 */
export async function getNextGroundCode({ academyId = null, connection = null } = {}) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
        const hasAcademy =
            academyId !== null &&
            academyId !== undefined &&
            String(academyId).trim() !== "" &&
            !Number.isNaN(Number(academyId));

        let sql = `
            SELECT id, ground_code
            FROM cst_ground
            WHERE is_deleted = 0
              AND ground_code IS NOT NULL
              AND TRIM(ground_code) != ''
        `;
        const values = [];

        if (hasAcademy) {
            // Strictly check ONLY the grounds of the specified academy
            sql += ` AND academy_id = ?`;
            values.push(Number(academyId));
        }

        sql += ` ORDER BY id DESC LIMIT 500`;

        const [rows] = await conn.execute(sql, values);

        let lastGroundCode = null;
        let lastNum = 0;
        let maxNum = 0;

        if (rows && rows.length > 0) {
            lastGroundCode = rows[0].ground_code;
            const extractedFirst = extractGroundCodeNumber(lastGroundCode);
            if (extractedFirst !== null) {
                lastNum = extractedFirst;
            }

            for (const row of rows) {
                const num = extractGroundCodeNumber(row.ground_code);
                if (num !== null && num > maxNum) {
                    maxNum = num;
                }
            }
        }

        const effectiveLast = Math.max(lastNum, maxNum);
        const nextNum = effectiveLast > 0 ? effectiveLast + 1 : 1;
        const nextGroundCode = formatGroundCode(nextNum);

        return {
            success: true,
            academy_id: hasAcademy ? Number(academyId) : null,
            last_ground_code: lastGroundCode,
            last_number: effectiveLast,
            next_number: nextNum,
            next_ground_code: nextGroundCode,
        };
    } catch (err) {
        console.error("getNextGroundCode error:", err);
        return {
            success: false,
            academy_id: academyId ? Number(academyId) : null,
            last_ground_code: null,
            last_number: 0,
            next_number: 1,
            next_ground_code: `${CODE_PREFIX}001`,
            error: err.message,
        };
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}
