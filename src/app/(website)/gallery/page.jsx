import PageHeader from "../components/layout/PageHeader";
import GalleryGridSection from "../components/gallery/GalleryGridSection";

export const metadata = {
  title: "Photo & Video Gallery | CST Cricket Academy",
  description:
    "Explore unforgettable moments from intense coaching drills, net practice, live tournament matches, trophy celebrations, and academy events at CST Cricket Academy.",
  keywords: [
    "Cricket Academy Gallery",
    "Cricket Practice Photos",
    "Cricket Tournament Images",
    "Cricket Match Highlights",
    "Turf Pitch Photos",
    "Cricket Coaching Drills Gallery",
  ],
  openGraph: {
    title: "Photo & Video Gallery | CST Cricket Academy",
    description:
      "Explore unforgettable moments from coaching drills, matches, and trophy celebrations at CST Cricket Academy.",
  },
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        title="Gallery"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Gallery"
      />
      <GalleryGridSection />
    </>
  );
}
