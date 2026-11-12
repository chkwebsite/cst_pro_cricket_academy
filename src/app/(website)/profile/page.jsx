"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useUser } from "@/app/next_panel/components/UserContext";

function ProfileContent() {
  const { user, isLoggedIn, logout, login } = useUser();

  // Profile Edit State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim());
      setEmail(user.email || "");
      setPhone(user.phone || "");
      if (user.profile_image) {
        setImagePreview(user.profile_image);
      }
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUpdateError("Image cannot exceed 2MB.");
      e.target.value = "";
      return;
    }
    setProfileImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdateMsg("");
    setUpdateError("");
    setIsUpdating(true);

    try {
      let res;
      if (profileImageFile) {
        const fd = new FormData();
        fd.append("id", user.id);
        fd.append("name", name.trim());
        fd.append("email", email.trim().toLowerCase());
        fd.append("phone", phone.trim());
        fd.append("profile_image", profileImageFile);

        res = await fetch("/api/public-auth/register", {
          method: "PUT",
          body: fd,
        });
      } else {
        res = await fetch("/api/public-auth/register", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
          }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update profile.");
      }

      // Update session storage
      const updatedUser = {
        ...user,
        name: name.trim(),
        first_name: name.trim().split(" ")[0] || name.trim(),
        last_name: name.trim().split(" ").slice(1).join(" ") || "",
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        profile_image: json.data?.profile_image || json.user?.profile_image || imagePreview || user.profile_image,
      };

      login({
        user: updatedUser,
        permissions: ["public_user", "ground_booking"],
      });

      setUpdateMsg("Profile updated successfully!");
    } catch (err) {
      setUpdateError(err.message || "Update failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  // If NOT logged in
  if (!isLoggedIn || !user) {
    return (
      <div className="bg-cream min-vh-100 py-5">
        <div className="container py-4">
          <div className="row justify-content-center">
            <div className="col-12 col-md-8 col-lg-6 text-center">
              <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-navy mb-3"
                  style={{ width: "70px", height: "70px", fontSize: "2rem" }}
                >
                  <i className="bi bi-person-lock text-red"></i>
                </div>
                <h3 className="fw-bold text-navy mb-2">Sign In Required</h3>
                <p className="text-secondary small mb-4">
                  Please log in to your CST Pro account to access your user profile and account details.
                </p>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <Link href="/login?tab=public" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold">
                    <i className="bi bi-box-arrow-in-right me-1"></i> Sign In as Public User
                  </Link>
                  <Link href="/login?tab=academy" className="btn btn-outline-dark px-4 py-2 rounded-pill fw-semibold">
                    Academy User Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User";

  return (
    <div className="bg-cream min-vh-100 py-5">
      <div className="container py-3" style={{ maxWidth: "900px" }}>
        {/* Top Header Card */}
        <div className="bg-white rounded-4 shadow-sm border p-4 mb-4">
          <div className="row align-items-center g-3">
            <div className="col-auto">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white shadow-sm overflow-hidden"
                style={{
                  width: "76px",
                  height: "76px",
                  background: "var(--navy)",
                  fontSize: "1.8rem",
                  border: "3px solid var(--lime)",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={displayName}
                    className="w-100 h-100 object-fit-cover"
                  />
                ) : (
                  (displayName[0] || "U").toUpperCase()
                )}
              </div>
            </div>

            <div className="col">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h3 className="fw-bold text-navy mb-0">
                  {displayName}
                </h3>
                <span
                  className="badge"
                  style={{
                    backgroundColor: "var(--navy)",
                    color: "var(--lime)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.3rem 0.75rem",
                    borderRadius: "50px",
                  }}
                >
                  {user.user_type || "Public User"}
                </span>
              </div>
              <div className="text-secondary small d-flex flex-wrap gap-3">
                {user.email && (
                  <span>
                    <i className="bi bi-envelope me-1 text-red"></i>
                    {user.email}
                  </span>
                )}
                {user.phone && (
                  <span>
                    <i className="bi bi-telephone me-1 text-red"></i>
                    {user.phone}
                  </span>
                )}
              </div>
            </div>

            <div className="col-12 col-md-auto text-md-end d-flex gap-2">
              <Link
                href="/orders"
                className="btn btn-outline-navy btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
              >
                <i className="bi bi-bag-check"></i>
                <span>My Orders</span>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout("/");
                }}
                className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1.5 fw-semibold"
              >
                <i className="bi bi-box-arrow-right me-1"></i> Logout
              </button>
            </div>
          </div>
        </div>

        {/* User Profile Form */}
        <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
            <div>
              <h4 className="fw-bold text-navy mb-0 display-font">USER PROFILE DETAILS</h4>
              <p className="text-muted small mb-0 mt-1">
                Manage your personal profile, contact information, and avatar.
              </p>
            </div>
            <i className="bi bi-person-badge fs-2 text-teal opacity-75"></i>
          </div>

          {updateMsg && (
            <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-4 rounded-3" role="alert">
              <i className="bi bi-check-circle-fill me-2 fs-5"></i>
              <div className="small">{updateMsg}</div>
            </div>
          )}

          {updateError && (
            <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-4 rounded-3" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              <div className="small">{updateError}</div>
            </div>
          )}

          <form onSubmit={handleProfileUpdate}>
            <div className="row g-3">
              {/* Full Name */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-navy mb-1">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isUpdating}
                />
              </div>

              {/* Mobile Number */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-navy mb-1">
                  Mobile Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={isUpdating}
                />
              </div>

              {/* Email Address */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-navy mb-1">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isUpdating}
                />
              </div>

              {/* User Type (Readonly) */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-navy mb-1">
                  User Role / Type
                </label>
                <input
                  type="text"
                  className="form-control bg-light"
                  value={user.user_type || "Public User"}
                  disabled
                />
              </div>

              {/* Profile Photo */}
              <div className="col-12">
                <label className="form-label fw-semibold small text-navy mb-1">
                  Profile Photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="form-control"
                  onChange={handleImageChange}
                  disabled={isUpdating}
                />
                <div className="form-text small text-muted">
                  Upload JPG, PNG or WEBP format image (maximum 2MB).
                </div>
              </div>

              {/* Submit Button */}
              <div className="col-12 mt-4 d-flex align-items-center justify-content-between">
                <button
                  type="submit"
                  className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold shadow-sm"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-1"></i> Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-vh-100 bg-cream d-flex align-items-center justify-content-center">
          <div className="spinner-border text-navy" role="status">
            <span className="visually-hidden">Loading Profile...</span>
          </div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
