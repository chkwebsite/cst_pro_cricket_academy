import GalleryAlbumForm from "../../GalleryAlbumForm";

export const metadata = {
    title: "Edit Gallery Album | ST Academy Panel",
};

export default async function EditGalleryAlbumPage({ params }) {
    const { id } = await params;
    return <GalleryAlbumForm id={id} />;
}
