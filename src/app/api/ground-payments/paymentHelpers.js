export const toCents = (value) => Math.round(Number(value || 0) * 100);

export const fromCents = (value) => Number((value / 100).toFixed(2));

export async function lockGroundBookings(connection, bookingIds) {
    const ids = [...new Set(bookingIds.map(Number))].sort((a, b) => a - b);
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await connection.execute(
        `
        SELECT id, total_amount, paid_amount, balance_amount
        FROM cst_ground_bookings
        WHERE id IN (${placeholders})
        ORDER BY id
        FOR UPDATE
        `,
        ids
    );

    return new Map(rows.map((booking) => [Number(booking.id), booking]));
}

export const getOutstandingCents = (booking) =>
    Math.max(0, toCents(booking.total_amount) - toCents(booking.paid_amount));

export async function applyGroundBookingPaymentDelta(connection, booking, deltaCents) {
    const totalCents = toCents(booking.total_amount);
    const paidCents = Math.max(0, toCents(booking.paid_amount) + deltaCents);
    const balanceCents = Math.max(0, totalCents - paidCents);
    const paymentStatus = totalCents > 0 && balanceCents === 0
        ? "Paid"
        : paidCents > 0
            ? "Partial"
            : "Pending";

    await connection.execute(
        `
        UPDATE cst_ground_bookings
        SET paid_amount = ?, balance_amount = ?, payment_status = ?
        WHERE id = ?
        `,
        [fromCents(paidCents), fromCents(balanceCents), paymentStatus, booking.id]
    );
}