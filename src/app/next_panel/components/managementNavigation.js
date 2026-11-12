const MANAGEMENT_PATHS = [
    "/next_panel/match-management",
    "/next_panel/tournament-management",
    "/next_panel/match-innings",
    "/next_panel/match-scorecard",
    "/next_panel/match-bowling-scorecard",
    "/next_panel/student-enquiries",
    "/next_panel/student-enquiries-flowup",
];

const MANAGEMENT_LABELS = {
    "/next_panel/match-management": "Back to Match Management",
    "/next_panel/tournament-management": "Back to Tournament Management",
    "/next_panel/match-innings": "Back to Match Innings",
    "/next_panel/match-scorecard": "Back to Batting Scorecard",
    "/next_panel/match-bowling-scorecard": "Back to Bowling Scorecard",
    "/next_panel/student-enquiries": "Back to Student Enquiries",
    "/next_panel/student-enquiries-flowup": "Back to Enquiry Follow-ups",
};

export function resolveManagementNavigation(searchParams, fallbackHref, fallbackLabel) {
    const requestedHref = searchParams?.returnTo;
    const href = MANAGEMENT_PATHS.includes(requestedHref) ? requestedHref : fallbackHref;

    return {
        href,
        label: MANAGEMENT_LABELS[href] || fallbackLabel,
    };
}
