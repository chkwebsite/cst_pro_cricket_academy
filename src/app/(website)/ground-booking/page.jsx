import PageHeader from "../components/layout/PageHeader";
import GroundBookingSection from "../components/ground-booking/GroundBookingSection";

export const metadata = {
  title: "Ground Booking & Availability | ST Cricket Academy",
  description:
    "Check cricket ground availability, view calendar schedules, and submit ground booking requests for matches, tournaments, and practice sessions.",
};

export default function GroundBookingPage() {
  return (
    <>
      <PageHeader
        title="Ground Booking"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Ground Booking"
      />
      <GroundBookingSection />
    </>
  );
}
