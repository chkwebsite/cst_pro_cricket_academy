export default function GoogleMapSection({
  mapEmbedUrl = "https://www.google.com/maps?q=cricket+stadium&output=embed",
  caption = "Replace the map embed with your academy's Google Maps location link.",
}) {
  return (
    <section className="bg-cream pt-0">
      <div className="container map-wrap reveal pt-5">
        <iframe
          title="Academy location map"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapEmbedUrl}
        ></iframe>
        {caption && (
          <p className="text-center text-secondary small mt-2">{caption}</p>
        )}
      </div>
    </section>
  );
}
