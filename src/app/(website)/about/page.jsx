import Link from "next/link";
import PageHeader from "../components/layout/PageHeader";
import CtaSection from "../components/home/CtaSection";

export const metadata = {
  title: "About Us | CST Cricket Academy",
  description:
    "Discover the vision, journey, and facilities of CST Cricket Academy. Dedicated to nurturing grassroots talent into professional cricketers with world-class facilities and expert mentorship.",
};

const COACHES = [
  { name: "Rajneesh Kumar", role: "Batting Coach", img: "/assets/img/about-2.jpg" },
  { name: "Deepak Walia", role: "Batting & Fitness Coach", img: "/assets/img/about-3.jpg" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About CST Cricket Academy"
        eyebrow="The Academy"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="About Us"
      />

      {/* Our Story */}
      <section className="section">
        <div className="container split">
          <div
            className="media ratio-43"
            style={{ borderRadius: "26px", boxShadow: "var(--shadow)" }}
            data-reveal="left"
          >
            <img
              src="/assets/img/about-1.jpg"
              alt="Players training on the CST Cricket Academy ground"
              loading="lazy"
              width="1000"
              height="670"
            />
          </div>
          <div className="prose" data-reveal="right">
            <span className="eyebrow">Our Story</span>
            <h2 className="title">
              25+ YEARS OF <em>CRAFTING CRICKETERS</em>
            </h2>
            <p>
              CST Cricket Academy blends traditional technique with modern sports science. From first grip to first-class ambition, every player follows a clear development pathway with regular assessments and personal feedback.
            </p>
            <p>
              Founded with the belief that champions are built through discipline, technique, and high-quality coaching, our academy has trained more than 1,150 players across Gurugram and Delhi NCR. Our alumni represent state teams, university squads, and top-tier clubs across India.
            </p>
          </div>
        </div>
      </section>

      {/* Technique & Coaching Spotlight */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid grid--2">
          <figure className="card" style={{ margin: 0, overflow: "hidden" }} data-reveal>
            <div className="media ratio-43">
              <img
                src="/assets/img/about-2.jpg"
                alt="Coach correcting a batter's stance at the stumps"
                loading="lazy"
                width="1000"
                height="746"
              />
            </div>
            <figcaption style={{ padding: "20px 24px" }}>
              <b>Technique, up close</b>
              <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
                Hands-on correction of stance, bat flow, and grip by certified coaches.
              </p>
            </figcaption>
          </figure>

          <figure className="card" style={{ margin: 0, overflow: "hidden", "--d": 1 }} data-reveal>
            <div className="media ratio-43">
              <img
                src="/assets/img/about-3.jpg"
                alt="Coach guiding a young batter in the nets"
                loading="lazy"
                width="1000"
                height="746"
              />
            </div>
            <figcaption style={{ padding: "20px 24px" }}>
              <b>One-on-one coaching</b>
              <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
                Personal feedback, video swing breakdown, and match-style net simulations.
              </p>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="section section--cream" id="facilities">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Facilities &amp; Campus</span>
            <h2 className="title">
              WORLD-CLASS <em>FACILITIES</em>
            </h2>
          </div>
          <div className="grid grid--4">
            <div className="feature" data-reveal style={{ "--d": 0 }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 12h18" />
                </svg>
              </div>
              <h3>Turf Wickets</h3>
              <p>Natural match-quality curated turf pitches with genuine bounce and seam movement.</p>
            </div>
            <div className="feature" data-reveal style={{ "--d": 1 }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 4v16M20 4v16M4 8h16M4 14h16" />
                </svg>
              </div>
              <h3>Practice Nets</h3>
              <p>Dedicated astro, concrete, and grass nets for intense batting and bowling drills.</p>
            </div>
            <div className="feature" data-reveal style={{ "--d": 2 }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <h3>Bowling Machines</h3>
              <p>Dual-wheel automated speed machines up to 150 km/h with swing and spin variations.</p>
            </div>
            <div className="feature" data-reveal style={{ "--d": 3 }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v3M5 6l2 2M19 6l-2 2M12 22V10" />
                </svg>
              </div>
              <h3>Floodlights</h3>
              <p>High-intensity 800-lux LED masts enabling evening and post-work cricket matches.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Coaches Section */}
      <section className="section section--dark" id="coaches">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Coach Profiles</span>
            <h2 className="title">
              LEARN FROM THE <em>BEST</em>
            </h2>
          </div>
          <div className="grid grid--2">
            {COACHES.map((coach, idx) => (
              <article className="coach" data-reveal style={{ "--d": idx }} key={idx}>
                <div className="media">
                  <img
                    src={coach.img}
                    alt={coach.name}
                    loading="lazy"
                    width="800"
                    height="600"
                  />
                </div>
                <span className="coach__no">0{idx + 1}</span>
                <div className="coach__info">
                  <small>{coach.role}</small>
                  <h3>{coach.name}</h3>
                  <Link className="btn btn--red btn--sm" href="/coaches">
                    View Profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Hall of Fame Section */}
      <section className="section" id="hall">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Hall of Fame</span>
            <h2 className="title">
              OUR <em>ACHIEVERS</em>
            </h2>
            <p className="lead">
              Celebrating academy cadets who have excelled in district, state, and national tournaments.
            </p>
          </div>
          <div className="grid grid--3">
            <div className="card feature" data-reveal style={{ "--d": 0, background: "#fff" }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
              </div>
              <h3>State U-19 Championship</h3>
              <p>Gold medal winners in the State Inter-Club Championship 2025.</p>
            </div>
            <div className="card feature" data-reveal style={{ "--d": 1, background: "#fff" }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
              </div>
              <h3>District Cricket League</h3>
              <p>Champions of District Junior League across U-14 and U-16 divisions.</p>
            </div>
            <div className="card feature" data-reveal style={{ "--d": 2, background: "#fff" }}>
              <div className="feature__icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
              </div>
              <h3>Ranji Trophy Selections</h3>
              <p>3 academy alumni represented state senior squads in Ranji &amp; Vijay Hazare Trophy.</p>
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
