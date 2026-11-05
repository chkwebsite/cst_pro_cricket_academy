import PageHeader from "../components/layout/PageHeader";
import GalleryGridSection from "../components/gallery/GalleryGridSection";
import CtaSection from "../components/home/CtaSection";

export const metadata = {
  title: "Photo & Video Gallery | CST Cricket Academy",
  description:
    "Explore unforgettable moments from intense coaching drills, net practice, live tournament matches, trophy celebrations, and academy events at CST Cricket Academy.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        title="Moments From The Field"
        eyebrow="Our Galleries"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Gallery"
      />
      <GalleryGridSection />
      <CtaSection />
    </>
  );
}
