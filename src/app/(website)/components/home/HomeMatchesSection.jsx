import Link from "next/link";

export default function HomeMatchesSection() {
  return (
    <section className="section section--cream" id="matches">
      <div className="container">
        <div
          className="section-head section-head--left"
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "end",
            gap: "20px",
            maxWidth: "none",
          }}
        >
          <div>
            <span className="eyebrow">Matches &amp; Events</span>
            <h2 className="title">
              LIVE, UPCOMING &amp; <em>RESULTS</em>
            </h2>
          </div>
          <Link className="link-arrow" href="/matches">
            All Fixtures →
          </Link>
        </div>

        <div className="grid grid--3">
          <article className="card match match--live" data-reveal style={{ "--d": 0 }}>
            <span className="match__status">LIVE</span>
            <div className="match__row">
              <span>
                <i></i>CST Warriors
              </span>
              <span style={{ fontSize: "22px" }}>186/4</span>
            </div>
            <div className="match__row">
              <span>
                <i></i>Apex Titans
              </span>
              <span style={{ fontSize: "22px" }}>142/8</span>
            </div>
            <div className="match__foot">Main Ground · Live Now</div>
          </article>

          <article className="card match match--up" data-reveal style={{ "--d": 1 }}>
            <span className="match__status" style={{ color: "var(--green-d)" }}>
              UPCOMING
            </span>
            <div className="match__row">
              <span>
                <i></i>CST XI
              </span>
              <span style={{ color: "var(--muted)", fontSize: "14px" }}>vs</span>
              <span>
                Gurugram Lions<i style={{ margin: "0 0 0 10px" }}></i>
              </span>
            </div>
            <div className="match__foot">Turf Oval 1 · This Saturday, 8:30 AM</div>
          </article>

          <article className="card match" data-reveal style={{ "--d": 2 }}>
            <span className="match__status">RECENT RESULT</span>
            <div className="match__row">
              <span>
                <i></i>CST Academy
              </span>
              <span style={{ color: "var(--muted)", fontSize: "14px" }}>Won by 4 wkts</span>
              <span>
                Delhi Stars<i style={{ margin: "0 0 0 10px" }}></i>
              </span>
            </div>
            <div className="match__foot">Campus Arena · Yesterday</div>
          </article>
        </div>
      </div>
    </section>
  );
}
