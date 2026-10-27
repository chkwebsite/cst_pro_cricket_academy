export default function WhatsAppButton({ phoneNumber = "918285831503" }) {
  return (
    <a
      href={`https://wa.me/${phoneNumber}`}
      className="whatsapp"
      aria-label="Chat on WhatsApp"
      target="_blank"
      rel="noopener noreferrer"
      title="Chat with us on WhatsApp"
    >
      <i className="bi bi-whatsapp"></i>
    </a>
  );
}
