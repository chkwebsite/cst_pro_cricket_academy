import PageHeader from "../components/layout/PageHeader";
import GroundBookingSection from "../components/ground-booking/GroundBookingSection";

export const metadata = {
  title: "Cricket Ground & Turf Pitch Booking Online | CST Cricket Academy",
  description:
    "Book premium natural turf cricket grounds and practice nets online. Perfect for corporate tournaments, club matches, weekend friendly games, and individual net practice sessions.",
  keywords: [
    "Cricket Ground Booking",
    "Turf Pitch Booking Online",
    "Cricket Ground on Rent",
    "Box Cricket Booking",
    "Cricket Net Practice Booking",
    "Corporate Cricket Tournament Booking",
    "Floodlight Cricket Ground Rent",
    "Weekend Match Ground Booking",
  ],
  openGraph: {
    title: "Cricket Ground & Turf Pitch Booking Online | CST Cricket Academy",
    description:
      "Book premium natural turf cricket grounds and practice nets online with live slot availability.",
  },
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
