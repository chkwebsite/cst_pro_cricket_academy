import PageHeader from "../components/layout/PageHeader";
import GalleryGridSection from "../components/gallery/GalleryGridSection";

export const metadata = {
  title: "Photo Gallery | ST Cricket Academy",
  description:
    "Moments from the field, matches, tournaments, and events at ST Cricket Academy.",
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
