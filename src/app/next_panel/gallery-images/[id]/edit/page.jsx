import GalleryImageForm from "../../GalleryImageForm";

export const metadata = {
    title: "Edit Gallery Photo | ST Academy Panel",
};

export default async function EditGalleryImagePage({ params }) {
    const { id } = await params;
    return <GalleryImageForm id={id} />;
}
