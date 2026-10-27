import GalleryVideoForm from "../GalleryVideoForm";

export const metadata = {
    title: "Add Gallery Video | ST Academy Panel",
};

export default async function NewGalleryVideoPage({ searchParams }) {
    const sp = await searchParams;
    return <GalleryVideoForm defaultAlbumId={sp?.album_id || ""} />;
}
