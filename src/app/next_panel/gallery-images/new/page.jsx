import GalleryImageForm from "../GalleryImageForm";

export const metadata = {
    title: "Upload Gallery Photos | ST Academy Panel",
};

export default async function NewGalleryImagePage({ searchParams }) {
    const sp = await searchParams;
    return <GalleryImageForm defaultAlbumId={sp?.album_id || ""} />;
}
