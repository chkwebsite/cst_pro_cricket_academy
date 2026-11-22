import fs from 'fs';
import path from 'path';

const schema = JSON.parse(fs.readFileSync('scratch/db_schema.json', 'utf8'));

// Define the mapping between Form files, API routes, and DB tables
const moduleMappings = [
    {
        name: 'Academies',
        formFile: 'src/app/next_panel/academies/AcademyForm.jsx',
        apiRoute: 'src/app/api/academies/route.js',
        apiIdRoute: 'src/app/api/academies/[id]/route.js',
        table: 'cst_academy'
    },
    {
        name: 'Admission Players',
        formFile: 'src/app/next_panel/admission-players/AdmissionPlayerForm.jsx',
        apiRoute: 'src/app/api/admission-players/route.js',
        apiIdRoute: 'src/app/api/admission-players/[id]/route.js',
        table: 'cst_admission_players'
    },
    {
        name: 'Age Groups',
        formFile: 'src/app/next_panel/age-groups/AgeGroupForm.jsx',
        apiRoute: 'src/app/api/age-groups/route.js',
        apiIdRoute: 'src/app/api/age-groups/[id]/route.js',
        table: 'cst_age_groups'
    },
    {
        name: 'Batch Coaches',
        formFile: 'src/app/next_panel/batch-coaches/BatchCoachForm.jsx',
        apiRoute: 'src/app/api/batch-coaches/route.js',
        apiIdRoute: 'src/app/api/batch-coaches/[id]/route.js',
        table: 'cst_batch_coaches'
    },
    {
        name: 'Batch Players',
        formFile: 'src/app/next_panel/batch-players/BatchPlayerForm.jsx',
        apiRoute: 'src/app/api/batch-players/route.js',
        apiIdRoute: 'src/app/api/batch-players/[id]/route.js',
        table: 'cst_batch_players'
    },
    {
        name: 'Batches',
        formFile: 'src/app/next_panel/batches/BatchForm.jsx',
        apiRoute: 'src/app/api/batches/route.js',
        apiIdRoute: 'src/app/api/batches/[id]/route.js',
        table: 'cst_batches'
    },
    {
        name: 'Branches',
        formFile: 'src/app/next_panel/branches/BranchForm.jsx',
        apiRoute: 'src/app/api/branch/route.js',
        apiIdRoute: 'src/app/api/branch/[id]/route.js',
        table: 'cst_branch'
    },
    {
        name: 'Coaches',
        formFile: 'src/app/next_panel/coaches/CoachForm.jsx',
        apiRoute: 'src/app/api/coaches/route.js',
        apiIdRoute: 'src/app/api/coaches/[id]/route.js',
        table: 'cst_coaches'
    },
    {
        name: 'Fee Payments',
        formFile: 'src/app/next_panel/fee-payments/FeePaymentForm.jsx',
        apiRoute: 'src/app/api/fee-payments/route.js',
        apiIdRoute: 'src/app/api/fee-payments/[id]/route.js',
        table: 'cst_fee_payments'
    },
    {
        name: 'Fee Status',
        formFile: 'src/app/next_panel/fee-status/FeeStatusForm.jsx',
        apiRoute: 'src/app/api/fee-status/route.js',
        apiIdRoute: 'src/app/api/fee-status/[id]/route.js',
        table: 'cst_fee_status'
    },
    {
        name: 'Gallery Albums',
        formFile: 'src/app/next_panel/gallery-albums/GalleryAlbumForm.jsx',
        apiRoute: 'src/app/api/gallery-albums/route.js',
        apiIdRoute: 'src/app/api/gallery-albums/[id]/route.js',
        table: 'cst_gallery_albums'
    },
    {
        name: 'Gallery Categories',
        formFile: 'src/app/next_panel/gallery-categories/GalleryCategoryForm.jsx',
        apiRoute: 'src/app/api/gallery-categories/route.js',
        apiIdRoute: 'src/app/api/gallery-categories/[id]/route.js',
        table: 'cst_gallery_categories'
    },
    {
        name: 'Gallery Images',
        formFile: 'src/app/next_panel/gallery-images/GalleryImageForm.jsx',
        apiRoute: 'src/app/api/gallery-images/route.js',
        apiIdRoute: 'src/app/api/gallery-images/[id]/route.js',
        table: 'cst_gallery_images'
    },
    {
        name: 'Gallery Videos',
        formFile: 'src/app/next_panel/gallery-videos/GalleryVideoForm.jsx',
        apiRoute: 'src/app/api/gallery-videos/route.js',
        apiIdRoute: 'src/app/api/gallery-videos/[id]/route.js',
        table: 'cst_gallery_videos'
    },
    {
        name: 'Ground Booking Requests',
        formFile: 'src/app/next_panel/ground-booking-requests/GroundBookingRequestForm.jsx',
        apiRoute: 'src/app/api/ground-booking-requests/route.js',
        apiIdRoute: 'src/app/api/ground-booking-requests/[id]/route.js',
        table: 'cst_ground_booking_requests'
    },
    {
        name: 'Ground Bookings',
        formFile: 'src/app/next_panel/ground-bookings/GroundBookingForm.jsx',
        apiRoute: 'src/app/api/ground-bookings/route.js',
        apiIdRoute: 'src/app/api/ground-bookings/[id]/route.js',
        table: 'cst_ground_bookings'
    },
    {
        name: 'Ground Images',
        formFile: 'src/app/next_panel/ground-images/GroundImageForm.jsx',
        apiRoute: 'src/app/api/ground-images/route.js',
        apiIdRoute: 'src/app/api/ground-images/[id]/route.js',
        table: 'cst_ground_images'
    },
    {
        name: 'Ground Payments',
        formFile: 'src/app/next_panel/ground-payments/GroundPaymentForm.jsx',
        apiRoute: 'src/app/api/ground-payments/route.js',
        apiIdRoute: 'src/app/api/ground-payments/[id]/route.js',
        table: 'cst_ground_payments'
    },
    {
        name: 'Ground Slots',
        formFile: 'src/app/next_panel/ground-slots/GroundSlotForm.jsx',
        apiRoute: 'src/app/api/ground-slots/route.js',
        apiIdRoute: 'src/app/api/ground-slots/[id]/route.js',
        table: 'cst_ground_slots'
    },
    {
        name: 'Grounds',
        formFile: 'src/app/next_panel/grounds/GroundForm.jsx',
        apiRoute: 'src/app/api/ground/route.js',
        apiIdRoute: 'src/app/api/ground/[id]/route.js',
        table: 'cst_ground'
    },
    {
        name: 'Individual Training',
        formFile: 'src/app/next_panel/individual-training/IndividualTrainingForm.jsx',
        apiRoute: 'src/app/api/individual-training/route.js',
        apiIdRoute: 'src/app/api/individual-training/[id]/route.js',
        table: 'cst_individual_training'
    },
    {
        name: 'Match Bowling Scorecard',
        formFile: 'src/app/next_panel/match-bowling-scorecard/MatchBowlingScorecardForm.jsx',
        apiRoute: 'src/app/api/match-bowling-scorecard/route.js',
        apiIdRoute: 'src/app/api/match-bowling-scorecard/[id]/route.js',
        table: 'cst_match_bowling_scorecard'
    },
    {
        name: 'Match Innings',
        formFile: 'src/app/next_panel/match-innings/MatchInningsForm.jsx',
        apiRoute: 'src/app/api/match-innings/route.js',
        apiIdRoute: 'src/app/api/match-innings/[id]/route.js',
        table: 'cst_match_innings'
    },
    {
        name: 'Match Players',
        formFile: 'src/app/next_panel/match-players/MatchPlayerForm.jsx',
        apiRoute: 'src/app/api/match-players/route.js',
        apiIdRoute: 'src/app/api/match-players/[id]/route.js',
        table: 'cst_match_players'
    },
    {
        name: 'Match Scorecard',
        formFile: 'src/app/next_panel/match-scorecard/MatchScorecardForm.jsx',
        apiRoute: 'src/app/api/match-scorecard/route.js',
        apiIdRoute: 'src/app/api/match-scorecard/[id]/route.js',
        table: 'cst_match_scorecard'
    },
    {
        name: 'Match Types',
        formFile: 'src/app/next_panel/match-types/MatchTypeForm.jsx',
        apiRoute: 'src/app/api/match-types/route.js',
        apiIdRoute: 'src/app/api/match-types/[id]/route.js',
        table: 'cst_match_types'
    },
    {
        name: 'Matches',
        formFile: 'src/app/next_panel/matches/MatchForm.jsx',
        apiRoute: 'src/app/api/matches/route.js',
        apiIdRoute: 'src/app/api/matches/[id]/route.js',
        table: 'cst_matches'
    },
    {
        name: 'Menu',
        formFile: 'src/app/next_panel/menu/MenuForm.jsx',
        apiRoute: 'src/app/api/menu/route.js',
        apiIdRoute: 'src/app/api/menu/[id]/route.js',
        table: 'cst_menu'
    },
    {
        name: 'Menu Permissions',
        formFile: 'src/app/next_panel/menu-permissions/MenuPermissionForm.jsx',
        apiRoute: 'src/app/api/menu-permissions/route.js',
        apiIdRoute: 'src/app/api/menu-permissions/[id]/route.js',
        table: 'cst_menu_permissions'
    },
    {
        name: 'Outside Players',
        formFile: 'src/app/next_panel/outside-players/OutsidePlayerForm.jsx',
        apiRoute: 'src/app/api/outside-players/route.js',
        apiIdRoute: 'src/app/api/outside-players/[id]/route.js',
        table: 'cst_outside_players'
    },
    {
        name: 'Permissions',
        formFile: 'src/app/next_panel/permissions/PermissionsForm.jsx',
        apiRoute: 'src/app/api/permissions/route.js',
        apiIdRoute: 'src/app/api/permissions/[id]/route.js',
        table: 'cst_permissions'
    },
    {
        name: 'Player Attendance',
        formFile: 'src/app/next_panel/player-attendance/PlayerAttendanceForm.jsx',
        apiRoute: 'src/app/api/player-attendance/route.js',
        apiIdRoute: 'src/app/api/player-attendance/[id]/route.js',
        table: 'cst_player_attendance'
    },
    {
        name: 'Player Payments',
        formFile: 'src/app/next_panel/player-payments/PlayerPaymentForm.jsx',
        apiRoute: 'src/app/api/player-payments/route.js',
        apiIdRoute: 'src/app/api/player-payments/[id]/route.js',
        table: 'cst_player_payments'
    },
    {
        name: 'Player Program Fees',
        formFile: 'src/app/next_panel/player-program-fees/PlayerProgramFeeForm.jsx',
        apiRoute: 'src/app/api/player-program-fees/route.js',
        apiIdRoute: 'src/app/api/player-program-fees/[id]/route.js',
        table: 'cst_player_program_fees'
    },
    {
        name: 'Programs',
        formFile: 'src/app/next_panel/programs/ProgramForm.jsx',
        apiRoute: 'src/app/api/programs/route.js',
        apiIdRoute: 'src/app/api/programs/[id]/route.js',
        table: 'cst_program'
    },
    {
        name: 'Role Permissions',
        formFile: 'src/app/next_panel/role-permissions/RolePermissionForm.jsx',
        apiRoute: 'src/app/api/role-permissions/route.js',
        apiIdRoute: 'src/app/api/role-permissions/[id]/route.js',
        table: 'cst_role_permissions'
    },
    {
        name: 'Roles',
        formFile: 'src/app/next_panel/roles/RoleForm.jsx',
        apiRoute: 'src/app/api/roles/route.js',
        apiIdRoute: 'src/app/api/roles/[id]/route.js',
        table: 'cst_roles'
    },
    {
        name: 'Staff',
        formFile: 'src/app/next_panel/staff/StaffForm.jsx',
        apiRoute: 'src/app/api/staff/route.js',
        apiIdRoute: 'src/app/api/staff/[id]/route.js',
        table: 'cst_staff'
    },
    {
        name: 'Student Enquiries',
        formFile: 'src/app/next_panel/student-enquiries/StudentEnquiryForm.jsx',
        apiRoute: 'src/app/api/student-enquiries/route.js',
        apiIdRoute: 'src/app/api/student-enquiries/[id]/route.js',
        table: 'cst_student_enquiries'
    },
    {
        name: 'Team Players',
        formFile: 'src/app/next_panel/team-players/TeamPlayerForm.jsx',
        apiRoute: 'src/app/api/team-players/route.js',
        apiIdRoute: 'src/app/api/team-players/[id]/route.js',
        table: 'cst_team_players'
    },
    {
        name: 'Teams',
        formFile: 'src/app/next_panel/teams/TeamForm.jsx',
        apiRoute: 'src/app/api/teams/route.js',
        apiIdRoute: 'src/app/api/teams/[id]/route.js',
        table: 'cst_teams'
    },
    {
        name: 'Tournament Matches',
        formFile: 'src/app/next_panel/tournament-matches/TournamentMatchForm.jsx',
        apiRoute: 'src/app/api/tournament-matches/route.js',
        apiIdRoute: 'src/app/api/tournament-matches/[id]/route.js',
        table: 'cst_tournament_matches'
    },
    {
        name: 'Tournament Team Players',
        formFile: 'src/app/next_panel/tournament-team-players/TournamentTeamPlayerForm.jsx',
        apiRoute: 'src/app/api/tournament-team-players/route.js',
        apiIdRoute: 'src/app/api/tournament-team-players/[id]/route.js',
        table: 'cst_tournament_team_players'
    },
    {
        name: 'Tournament Teams',
        formFile: 'src/app/next_panel/tournament-teams/TournamentTeamForm.jsx',
        apiRoute: 'src/app/api/tournament-teams/route.js',
        apiIdRoute: 'src/app/api/tournament-teams/[id]/route.js',
        table: 'cst_tournament_teams'
    },
    {
        name: 'Tournaments',
        formFile: 'src/app/next_panel/tournaments/TournamentForm.jsx',
        apiRoute: 'src/app/api/tournaments/route.js',
        apiIdRoute: 'src/app/api/tournaments/[id]/route.js',
        table: 'cst_tournaments'
    },
    {
        name: 'Umpire Payments',
        formFile: 'src/app/next_panel/umpire-payments/UmpirePaymentForm.jsx',
        apiRoute: 'src/app/api/umpire-payments/route.js',
        apiIdRoute: 'src/app/api/umpire-payments/[id]/route.js',
        table: 'cst_umpire_payments'
    },
    {
        name: 'Umpires',
        formFile: 'src/app/next_panel/umpires/UmpireForm.jsx',
        apiRoute: 'src/app/api/umpires/route.js',
        apiIdRoute: 'src/app/api/umpires/[id]/route.js',
        table: 'cst_umpires'
    },
    {
        name: 'User Branches',
        formFile: 'src/app/next_panel/user-branches/UserBranchForm.jsx',
        apiRoute: 'src/app/api/user-branches/route.js',
        apiIdRoute: 'src/app/api/user-branches/[id]/route.js',
        table: 'cst_user_branches'
    },
    {
        name: 'User Programs',
        formFile: 'src/app/next_panel/user-programs/UserProgramForm.jsx',
        apiRoute: 'src/app/api/user-programs/route.js',
        apiIdRoute: 'src/app/api/user-programs/[id]/route.js',
        table: 'cst_user_programs'
    },
    {
        name: 'User Roles',
        formFile: 'src/app/next_panel/user-roles/UserRoleForm.jsx',
        apiRoute: 'src/app/api/user-roles/route.js',
        apiIdRoute: 'src/app/api/user-roles/[id]/route.js',
        table: 'cst_user_roles'
    },
    {
        name: 'Users',
        formFile: 'src/app/next_panel/users/UserForm.jsx',
        apiRoute: 'src/app/api/users/route.js',
        apiIdRoute: 'src/app/api/users/[id]/route.js',
        table: 'cst_users'
    }
];

// In addition, page-based modal/inline forms:
const pageModalMappings = [
    {
        name: 'Menu Management Modal',
        formFile: 'src/app/next_panel/menu-management/components/MenuFormModal.jsx',
        apiRoute: 'src/app/api/menu/route.js',
        table: 'cst_menu'
    },
    {
        name: 'Product Categories Modal',
        formFile: 'src/app/next_panel/product-categories/page.jsx',
        apiRoute: 'src/app/api/product-categories/route.js',
        table: 'cst_product_categories'
    },
    {
        name: 'Product Stock Modal',
        formFile: 'src/app/next_panel/product-stock/page.jsx',
        apiRoute: 'src/app/api/product-stock/route.js',
        table: 'cst_product_stock'
    },
    {
        name: 'Product Images Modal',
        formFile: 'src/app/next_panel/product-images/page.jsx',
        apiRoute: 'src/app/api/product-images/route.js',
        table: 'cst_product_images'
    },
    {
        name: 'Products Page Form',
        formFile: 'src/app/next_panel/products/page.jsx',
        apiRoute: 'src/app/api/products/route.js',
        table: 'cst_products'
    },
    {
        name: 'Staff Salary Page Modal',
        formFile: 'src/app/next_panel/staff-salary/page.jsx',
        apiRoute: 'src/app/api/staff-salary/route.js',
        table: 'cst_staff_salary'
    },
    {
        name: 'Staff Salary Payments Modal',
        formFile: 'src/app/next_panel/staff-salary-payments/page.jsx',
        apiRoute: 'src/app/api/staff-salary-payments/route.js',
        table: 'cst_staff_salary_payments'
    },
    {
        name: 'Student Enquiry Followup Modal',
        formFile: 'src/app/next_panel/student-enquiries/[id]/followup/page.jsx',
        apiRoute: 'src/app/api/student-enquiries-flowup/route.js',
        table: 'cst_student_enquiries_flowup'
    },
    {
        name: 'Orders Page Modal',
        formFile: 'src/app/next_panel/orders/page.jsx',
        apiRoute: 'src/app/api/orders/route.js',
        table: 'cst_orders'
    },
    {
        name: 'Order Payments Modal',
        formFile: 'src/app/next_panel/order-payments/page.jsx',
        apiRoute: 'src/app/api/order-payments/route.js',
        table: 'cst_order_payments'
    },
    {
        name: 'User Weekly Off Page Form',
        formFile: 'src/app/next_panel/user-weekly-off/page.jsx',
        apiRoute: 'src/app/api/user-weekly-off/route.js',
        table: 'cst_user_weekly_off'
    }
];

const allModules = [...moduleMappings, ...pageModalMappings];

console.log(`Checking ${allModules.length} form modules against DB schema & API routes...`);

const report = [];

for (const mod of allModules) {
    const tableInfo = schema[mod.table];
    const formExists = fs.existsSync(mod.formFile);
    const apiExists = fs.existsSync(mod.apiRoute);

    const formContent = formExists ? fs.readFileSync(mod.formFile, 'utf8') : '';
    const apiContent = apiExists ? fs.readFileSync(mod.apiRoute, 'utf8') : '';

    // Check optional text in form
    const hasOptional = /\(?optional\)?/i.test(formContent);

    // Check asterisks in form
    const asteriskMatches = [...formContent.matchAll(/<span[^>]*>[^<]*\*[^<]*<\/span>/g)];
    const plainAsterisks = [...formContent.matchAll(/[a-zA-Z0-9\)]\s*\*/g)];

    // Check required fields in DB
    const requiredDbColumns = tableInfo ? tableInfo.columns.filter(c => 
        c.null === 'NO' && 
        c.default === null && 
        c.extra !== 'auto_increment' &&
        !['created_at', 'updated_at', 'is_deleted'].includes(c.field)
    ).map(c => c.field) : [];

    report.push({
        name: mod.name,
        formFile: mod.formFile,
        apiRoute: mod.apiRoute,
        table: mod.table,
        hasTable: Boolean(tableInfo),
        requiredDbColumns,
        hasOptional,
        asteriskCount: asteriskMatches.length + plainAsterisks.length
    });
}

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync('scratch/modules_audit_report.json', JSON.stringify(report, null, 2));
