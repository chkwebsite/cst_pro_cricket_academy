"use client";

import { useEffect, useState } from "react";

const ACADEMY_ID = 1;

export default function ContactFormSection({
  contactDetails = {
    address: "Maruti Kunj Road, Gurugram, Haryana, 122002",
    phone: "+91 8285831503",
    email: "chandankeshri100@gmail.com",
    hours: "Mon–Sat, 6 AM – 7:30 PM · Sunday, 6 AM – 11 AM",
  },
}) {
  const [formData, setFormData] = useState({
    academy_id: ACADEMY_ID,
    branch_id: "",
    student_name: "",
    age: "",
    phone: "",
    email: "",
    program_id: "",
    message: "",
  });

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [programsList, setProgramsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchBranches = async () => {
      try {
        setBranchesLoading(true);
        const res = await fetch(`/api/branch?academy_id=${ACADEMY_ID}&status=1`);
        const json = await res.json();
        if (isMounted && res.ok && json.success) {
          setBranches(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      } finally {
        if (isMounted) setBranchesLoading(false);
      }
    };

    const fetchPrograms = async () => {
      try {
        const res = await fetch(`/api/programs?academy_id=${ACADEMY_ID}&status=1`);
        const json = await res.json();
        if (isMounted && res.ok && json.success) {
          setProgramsList(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load programs:", err);
      }
    };

    fetchBranches();
    fetchPrograms();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.student_name || !formData.phone) {
      setErrorMessage("Please fill in player name and phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admission-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          enquiry_date: new Date().toISOString().slice(0, 10),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
        setFormData({
          academy_id: ACADEMY_ID,
          branch_id: "",
          student_name: "",
          age: "",
          phone: "",
          email: "",
          program_id: "",
          message: "",
        });
      } else {
        setErrorMessage(data.message || "Failed to submit enquiry. Please try again.");
      }
    } catch (err) {
      setErrorMessage("Network error occurred. Please call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section">
      <div className="container split" style={{ alignItems: "start" }}>
        {/* Left Column: Booking Form Panel */}
        <div className="panel" data-reveal="left">
          <h2 style={{ fontSize: "28px", marginBottom: "24px", fontWeight: 800 }}>
            Book your free trial
          </h2>

          {submitted && (
            <div
              className="form__ok is-show mb-4"
              role="status"
              style={{ display: "block" }}
            >
              ✓ Thanks! Your trial enquiry has been received. We’ll call you shortly to confirm your slot.
            </div>
          )}

          {errorMessage && (
            <div
              className="p-3 mb-3 rounded-3"
              style={{ background: "#FDE6EA", color: "var(--red)", fontWeight: 600 }}
              role="alert"
            >
              ⚠ {errorMessage}
            </div>
          )}

          <form className="form" onSubmit={handleSubmit} noValidate>
            <div className="form__row">
              <div className="field">
                <label htmlFor="student_name">Player name *</label>
                <input
                  id="student_name"
                  name="student_name"
                  type="text"
                  required
                  placeholder="Full name"
                  value={formData.student_name}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min="4"
                  max="65"
                  placeholder="e.g. 14"
                  value={formData.age}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="field">
                <label htmlFor="phone">Phone *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="field">
                <label htmlFor="branch_id">Preferred Branch</label>
                <select
                  id="branch_id"
                  name="branch_id"
                  value={formData.branch_id}
                  onChange={handleChange}
                >
                  <option value="">
                    {branchesLoading ? "Loading branches..." : "Select Branch (Optional)"}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} {b.city ? `(${b.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="program_id">Program</label>
                <select
                  id="program_id"
                  name="program_id"
                  value={formData.program_id}
                  onChange={handleChange}
                >
                  <option value="">Select Program (Optional)</option>
                  {programsList.length > 0 ? (
                    programsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.program_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="1">Junior Cricket Program</option>
                      <option value="2">Beginner Cricket Training</option>
                      <option value="3">Residential</option>
                      <option value="4">Day Mini Camp</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="message">Message / Queries</label>
              <textarea
                id="message"
                name="message"
                placeholder="Tell us about batting/bowling preference or current skill level..."
                value={formData.message}
                onChange={handleChange}
              />
            </div>

            <button className="btn btn--red" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Enquiry"}
            </button>
          </form>
        </div>

        {/* Right Column: Quick Contact Panel */}
        <div className="panel" data-reveal="right">
          <h2 style={{ fontSize: "28px", marginBottom: "24px", fontWeight: 800 }}>
            Quick contact
          </h2>

          <div className="info">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div>
              <b>Address</b>
              <span>{contactDetails.address}</span>
            </div>
          </div>

          <div className="info">
            <svg viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <div>
              <b>Phone</b>
              <a href={`tel:${contactDetails.phone.replace(/[^0-9+]/g, "")}`}>
                {contactDetails.phone}
              </a>
            </div>
          </div>

          <div className="info">
            <svg viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="m22 6-10 7L2 6" />
            </svg>
            <div>
              <b>Email</b>
              <a href={`mailto:${contactDetails.email}`}>{contactDetails.email}</a>
            </div>
          </div>

          <div className="info">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <div>
              <b>Training hours</b>
              <span>{contactDetails.hours}</span>
            </div>
          </div>

          <div style={{ marginTop: "24px" }}>
            <a
              className="btn btn--outline btn--sm"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactDetails.address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
