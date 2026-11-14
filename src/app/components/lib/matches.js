import pool from "./db.js";

/**
 * Extracts numeric sequence from a match_no string.
 * Handles formats like "M-001", "M001", "M-1", "001", "1", etc.
 *
 * @param {string|null|undefined} matchNo
 * @returns {number|null}
 */
export function extractMatchNumber(matchNo) {
    if (!matchNo || typeof matchNo !== "string") return null;
    const trimmed = matchNo.trim();
    if (!trimmed) return null;

    // Check for M-<number> or M<number>
    const mMatch = trimmed.match(/^M-?(\d+)/i);
    if (mMatch) {
        const n = parseInt(mMatch[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    // Fallback: check any contiguous digits
    const anyDigit = trimmed.match(/(\d+)/);
    if (anyDigit) {
        const n = parseInt(anyDigit[1], 10);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

/**
 * Formats a sequence number into "M-001" structure (M- followed by at least 3 digits).
 *
 * @param {number|string} num
 * @returns {string}
 */
export function formatMatchNo(num) {
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) {
        return "M-001";
    }
    return `M-${String(n).padStart(3, "0")}`;
}

/**
 * Determines the next match number academy-wise based on existing matches in the database.
 * If academyId is provided, checks ONLY that academy's matches.
 * If that academy has matches, takes the last/highest match number + 1.
 * If that academy has 0 matches, returns "M-001".
 *
 * @param {object} options
 * @param {number|string|null} [options.academyId]
 * @param {object} [options.connection]
 * @returns {Promise<{success: boolean, academy_id: number|null, last_match_no: string|null, last_number: number, next_number: number, next_match_no: string}>}
 */
export async function getNextMatchNumber({ academyId = null, connection = null } = {}) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
        const hasAcademy =
            academyId !== null &&
            academyId !== undefined &&
            String(academyId).trim() !== "" &&
            !Number.isNaN(Number(academyId));

        let sql = `
            SELECT id, match_no
            FROM cst_matches
            WHERE match_no IS NOT NULL AND TRIM(match_no) != ''
        `;
        const values = [];

        if (hasAcademy) {
            // Strictly check ONLY the matches of the specified academy
            sql += ` AND academy_id = ?`;
            values.push(Number(academyId));
        }

        sql += ` ORDER BY id DESC LIMIT 500`;

        const [rows] = await conn.execute(sql, values);

        let lastMatchNo = null;
        let lastNum = 0;
        let maxNum = 0;

        if (rows && rows.length > 0) {
            lastMatchNo = rows[0].match_no;
            const extractedFirst = extractMatchNumber(lastMatchNo);
            if (extractedFirst !== null) {
                lastNum = extractedFirst;
            }

            for (const row of rows) {
                const num = extractMatchNumber(row.match_no);
                if (num !== null && num > maxNum) {
                    maxNum = num;
                }
            }
        }

        const effectiveLast = Math.max(lastNum, maxNum);
        const nextNum = effectiveLast > 0 ? effectiveLast + 1 : 1;
        const nextMatchNo = formatMatchNo(nextNum);

        return {
            success: true,
            academy_id: hasAcademy ? Number(academyId) : null,
            last_match_no: lastMatchNo,
            last_number: effectiveLast,
            next_number: nextNum,
            next_match_no: nextMatchNo,
        };
    } catch (err) {
        console.error("getNextMatchNumber error:", err);
        return {
            success: false,
            academy_id: academyId ? Number(academyId) : null,
            last_match_no: null,
            last_number: 0,
            next_number: 1,
            next_match_no: "M-001",
            error: err.message,
        };
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}
