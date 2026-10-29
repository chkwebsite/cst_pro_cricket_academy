"use client";

import { useEffect, useState } from "react";

const ACADEMY_ID = 1; // CCST Cricket Academy (Default)

export default function ContactFormSection({
  tag = "Get in Touch",
  title = "Book a Free Trial",
  description = "Fill in the form and our team will call you within 24 hours.",
  contactDetails = {
    address: "Sports Complex, Your City, State - 000000",
    phone: "+91 8285831503",
    email: "chandankeshri100@gmail.com",
    hours: "Mon – Sat: 6:00 AM – 7:30 PM",
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

  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch branches filtered by academy_id = 1
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
        console.error("Failed to load branches for academy:", err);
      } finally {
        if (isMounted) setBranchesLoading(false);
      }
    };

    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch available programs
  useEffect(() => {
    let isMounted = true;
    const fetchPrograms = async () => {
      try {
        const res = await fetch("/api/programs?status=1");
        const json = await res.json();
        if (isMounted && res.ok && json.success) {
          setProgramsList(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load programs:", err);
      }
    };

    fetchPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSubmitted(false);

    const form = e.currentTarget;
    if (!form.checkValidity()) {
      e.stopPropagation();
      setValidated(true);
      return;
    }

    setSubmitting(true);
    setValidated(false);

    try {
      const payload = {
        academy_id: ACADEMY_ID,
        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
        student_name: formData.student_name.trim(),
        age: formData.age !== "" ? Number(formData.age) : null,
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        program_id: formData.program_id ? Number(formData.program_id) : null,
        message: formData.message.trim() || null,
        enquiry_source: "Website",
        enquiry_status: "New",
      };

      const res = await fetch("/api/student-enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to submit enquiry. Please try again.");
      }

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
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="container">
        <div className="row g-4 g-lg-5">
          {/* Left Column: Contact info */}
          <div className="col-lg-5 reveal">
            <span className="section-tag">{tag}</span>
            <h2 className="section-title">{title}</h2>
            <div className="divider"></div>
            <p className="text-secondary mb-4">{description}</p>
            <div className="contact-info">
              <div className="d-flex align-items-center mb-3">
                <i className="bi bi-geo-alt-fill"></i>
                <div>
                  <strong>Address</strong>
                  <br />
                  <span className="text-secondary">
                    {contactDetails.address}
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center mb-3">
                <i className="bi bi-telephone-fill"></i>
                <div>
                  <strong>Phone</strong>
                  <br />
                  <a
                    href={`tel:${contactDetails.phone.replace(/[^0-9+]/g, "")}`}
                    className="text-secondary"
                  >
                    {contactDetails.phone}
                  </a>
                </div>
              </div>
              <div className="d-flex align-items-center mb-3">
                <i className="bi bi-envelope-fill"></i>
                <div>
                  <strong>Email</strong>
                  <br />
                  <a
                    href={`mailto:${contactDetails.email}`}
                    className="text-secondary"
                  >
                    {contactDetails.email}
                  </a>
                </div>
              </div>
              <div className="d-flex align-items-center mb-3">
                <i className="bi bi-clock-fill"></i>
                <div>
                  <strong>Hours</strong>
                  <br />
                  <span className="text-secondary">
                    {contactDetails.hours}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Enquiry Form */}
          <div className="col-lg-7 reveal">
            <form
              className={`card-x p-4 p-md-5 ${
                validated ? "was-validated" : ""
              }`}
              onSubmit={handleSubmit}
              noValidate
            >
              {/* Hidden academy_id fixed to 1 */}
              <input type="hidden" name="academy_id" value={ACADEMY_ID} />

              {submitted && (
                <div className="alert alert-success form-success mb-4" role="alert">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>
                      <strong>Thank you!</strong> Your enquiry has been received successfully.
                      Our team will contact you shortly.
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="alert alert-danger mb-4" role="alert">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              <div className="row g-3">
                {/* Student Name */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="student_name">
                    Student name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="student_name"
                    name="student_name"
                    placeholder="Enter student's full name"
                    value={formData.student_name}
                    onChange={handleChange}
                    required
                  />
                  <div className="invalid-feedback">Please enter the student&apos;s name.</div>
                </div>

                {/* Age */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="age">
                    Age
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="65"
                    className="form-control"
                    id="age"
                    name="age"
                    placeholder="e.g. 14"
                    value={formData.age}
                    onChange={handleChange}
                  />
                  <div className="invalid-feedback">Enter a valid age (4-65).</div>
                </div>

                {/* Phone */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="phone">
                    Phone number <span className="text-danger">*</span>
                  </label>
                  <input
                    type="tel"
                    pattern="[0-9+\- ]{10,15}"
                    className="form-control"
                    id="phone"
                    name="phone"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                  <div className="invalid-feedback">
                    Please enter a valid contact phone number.
                  </div>
                </div>

                {/* Email */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="email">
                    Email address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    placeholder="e.g. student@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  <div className="invalid-feedback">Enter a valid email address.</div>
                </div>

                {/* Branch Selection (filtered by academy_id = 1) */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="branch_id">
                    Preferred Branch
                  </label>
                  <select
                    className="form-select"
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

                {/* Program Selection */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="program_id">
                    Interested Program
                  </label>
                  <select
                    className="form-select"
                    id="program_id"
                    name="program_id"
                    value={formData.program_id}
                    onChange={handleChange}
                  >
                    <option value="">Select Program (Optional)</option>
                    {programsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.program_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div className="col-12">
                  <label className="form-label fw-semibold" htmlFor="message">
                    Questions or Special Requirements
                  </label>
                  <textarea
                    className="form-control"
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell us about the student's cricket experience, preferred batch timings, or any queries..."
                    value={formData.message}
                    onChange={handleChange}
                  ></textarea>
                </div>

                {/* Submit Button */}
                <div className="col-12">
                  <button
                    type="submit"
                    className="btn btn-red btn-lg w-100 py-3"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span className="d-flex align-items-center justify-content-center gap-2">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Submitting Enquiry...
                      </span>
                    ) : (
                      "Send Enquiry & Book Trial"
                    )}
                  </button>
                  <p className="text-muted small text-center mt-2 mb-0">
                    <i className="bi bi-shield-lock-fill me-1"></i> Your information is kept safe and confidential.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
