export async function syncTournamentStatuses(connection) {
    await connection.query(
        `
        UPDATE cst_tournaments
        SET status = CASE
            WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE() THEN 'Completed'
            WHEN registration_end IS NOT NULL AND registration_end < CURRENT_DATE() THEN 'Running'
            ELSE status
        END
        WHERE is_deleted = 0
        AND status <> 'Cancelled'
        AND (
            (end_date IS NOT NULL AND end_date < CURRENT_DATE() AND status <> 'Completed')
            OR (
                registration_end IS NOT NULL
                AND registration_end < CURRENT_DATE()
                AND status NOT IN ('Running', 'Completed')
            )
        )
        `
    );
}