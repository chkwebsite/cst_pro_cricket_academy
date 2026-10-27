import GalleryVideoForm from "../../GalleryVideoForm";

export const metadata = {
    title: "Edit Gallery Video | ST Academy Panel",
};

export default async function EditGalleryVideoPage({ params }) {
    const { id } = await params;
    return <GalleryVideoForm id={id} />;
}
