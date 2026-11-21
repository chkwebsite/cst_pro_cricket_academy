export const DISMISSAL_TYPES = [
    "Not Out",
    "Bowled",
    "Caught",
    "LBW",
    "Run Out",
    "Stumped",
    "Hit Wicket",
    "Retired Hurt",
    "Retired Out",
    "Obstructing Field",
    "Timed Out",
];

export const INNINGS_STATUSES = [
    "Not Started",
    "In Progress",
    "Completed",
];

export const INNINGS_STATUS_BADGE = {
    "Not Started": "bg-secondary",
    "In Progress": "bg-warning text-dark",
    "Completed": "bg-success",
};

export function formatDate(value) {
    if (!value) return "—";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

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

export function isMatchDateInFuture(matchDate) {
    const dStr = normalizeDateString(matchDate);
    if (!dStr) return false;
    const todayStr = getTodayDateString();
    return dStr > todayStr;
}

export function validateMatchDateForScoring(matchDate, actionName = "Scores and innings") {
    if (!matchDate) return { allowed: true };
    const future = isMatchDateInFuture(matchDate);
    const dateFormatted = formatDate(matchDate);
    if (future) {
        return {
            allowed: false,
            matchDateStr: dateFormatted,
            message: `${actionName} cannot be created or updated before the scheduled match date (${dateFormatted}).`,
        };
    }
    return { allowed: true, matchDateStr: dateFormatted };
}

export function isValidCricketOvers(value) {
    if (value === "" || value === null || value === undefined) return false;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return false;
    const completeOvers = Math.floor(num);
    const balls = Math.round((num - completeOvers) * 10);
    if (balls < 0 || balls > 5) return false;
    return Math.abs(num - (completeOvers + balls / 10)) < 0.0001;
}

export function oversToBalls(overs) {
    const num = Number(overs) || 0;
    const complete = Math.floor(num);
    const balls = Math.round((num - complete) * 10);
    return complete * 6 + (balls >= 0 && balls <= 5 ? balls : 0);
}

export function ballsToOvers(balls) {
    const b = Number(balls) || 0;
    const complete = Math.floor(b / 6);
    const rem = b % 6;
    return rem === 0 ? Number(complete) : Number(`${complete}.${rem}`);
}

export function calculateStrikeRate(runs, balls) {
    const r = Number(runs) || 0;
    const b = Number(balls) || 0;
    if (b <= 0) return "0.00";
    return ((r / b) * 100).toFixed(2);
}

export function calculateEconomy(runsConceded, ballsBowled) {
    const r = Number(runsConceded) || 0;
    const b = Number(ballsBowled) || 0;
    if (b <= 0) return "0.00";
    return ((r * 6) / b).toFixed(2);
}

export function getPlayerDisplayName(player) {
    if (!player) return "Unknown Player";
    if (player.player_name) return player.player_name;
    const parts = [player.first_name, player.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    if (player.outside_player_name) return player.outside_player_name;
    if (player.outside_player_id) return `Outside player #${player.outside_player_id}`;
    if (player.tournament_team_player_id) return `Tournament player #${player.tournament_team_player_id}`;
    return `Player #${player.id || player.match_player_id || "—"}`;
}
