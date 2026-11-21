/**
 * Match Date Validator Helper
 * 
 * Ensures that scoring (batting scorecard, bowling scorecard, quick score)
 * and innings creation/updates cannot occur before the match date.
 */

export function getTodayDateString() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function normalizeDateString(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(val);
    }
    const s = String(val).trim();
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
    }
    return s.slice(0, 10);
}

export function formatDisplayDate(val) {
    const s = normalizeDateString(val);
    if (!s) return "—";
    const parts = s.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return s;
}

/**
 * Returns true if the match date is strictly after today's date in Asia/Kolkata timezone.
 * @param {string|Date|null} matchDate 
 * @returns {boolean}
 */
export function isMatchDateInFuture(matchDate) {
    const dStr = normalizeDateString(matchDate);
    if (!dStr) return false;
    const todayStr = getTodayDateString();
    return dStr > todayStr;
}

/**
 * Validates match date for scoring and innings operations.
 * Returns an object { allowed: boolean, message?: string, matchDateStr?: string }
 */
export function validateMatchDateForScoring(matchDate, actionName = "Scores and innings") {
    if (!matchDate) {
        return { allowed: true };
    }

    const future = isMatchDateInFuture(matchDate);
    const dateFormatted = formatDisplayDate(matchDate);

    if (future) {
        return {
            allowed: false,
            matchDateStr: dateFormatted,
            message: `${actionName} cannot be created or updated before the scheduled match date (${dateFormatted}).`,
        };
    }

    return { allowed: true, matchDateStr: dateFormatted };
}

/**
 * Automatically updates match status to 'Live' on match date in Asia/Kolkata timezone.
 * Operates on both regular matches (cst_matches) and tournament matches (cst_tournament_matches).
 * Matches already 'Completed' or 'Cancelled' are untouched.
 */
export async function autoUpdateTodayLiveMatches(connection) {
    if (!connection) return;
    try {
        const todayIST = getTodayDateString();

        // 1) Update cst_matches scheduled for today -> 'Live'
        await connection.execute(
            `UPDATE cst_matches
             SET status = 'Live', updated_at = NOW()
             WHERE (match_date = CURDATE() OR match_date = DATE(DATE_ADD(NOW(), INTERVAL 330 MINUTE)) OR match_date = ?)
               AND status NOT IN ('Completed', 'Cancelled', 'Live')`,
            [todayIST]
        );

        // 2) Update cst_tournament_matches scheduled for today -> 'Live'
        await connection.execute(
            `UPDATE cst_tournament_matches
             SET status = 'Live', updated_at = NOW()
             WHERE (scheduled_date = CURDATE() OR scheduled_date = DATE(DATE_ADD(NOW(), INTERVAL 330 MINUTE)) OR scheduled_date = ?)
               AND status NOT IN ('Completed', 'Cancelled', 'Live')`,
            [todayIST]
        );

        // 3) Synchronize linked tournament match and regular match records for today's live matches
        await connection.execute(
            `UPDATE cst_matches m
             JOIN cst_tournament_matches tm ON m.id = tm.match_id
             SET m.status = 'Live', m.updated_at = NOW()
             WHERE tm.status = 'Live'
               AND (m.match_date = CURDATE() OR m.match_date = DATE(DATE_ADD(NOW(), INTERVAL 330 MINUTE)) OR m.match_date = ?)
               AND m.status NOT IN ('Completed', 'Cancelled', 'Live')`,
            [todayIST]
        );

        await connection.execute(
            `UPDATE cst_tournament_matches tm
             JOIN cst_matches m ON tm.match_id = m.id
             SET tm.status = 'Live', tm.updated_at = NOW()
             WHERE m.status = 'Live'
               AND (tm.scheduled_date = CURDATE() OR tm.scheduled_date = DATE(DATE_ADD(NOW(), INTERVAL 330 MINUTE)) OR tm.scheduled_date = ?)
               AND tm.status NOT IN ('Completed', 'Cancelled', 'Live')`,
            [todayIST]
        );

        // 4) Reset any future matches that were mistakenly set to 'Live' before their scheduled date
        await connection.execute(
            `UPDATE cst_matches
             SET status = 'Scheduled', updated_at = NOW()
             WHERE match_date > ?
               AND status = 'Live'`,
            [todayIST]
        );

        await connection.execute(
            `UPDATE cst_tournament_matches
             SET status = 'Scheduled', updated_at = NOW()
             WHERE scheduled_date > ?
               AND status = 'Live'`,
            [todayIST]
        );
    } catch (err) {
        console.error("Auto-update live matches status error:", err);
    }
}
