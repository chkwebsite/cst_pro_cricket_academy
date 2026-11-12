export default function WeeklyScheduleSection({
  tag = "Weekly Schedule",
  title = "Sample Batch Timings",
  schedules = [
    {
      batch: "Morning",
      days: "Mon – Sat",
      timing: "6:00 – 8:30 AM",
      ageGroup: "12 – 19 yrs",
    },
    {
      batch: "Evening",
      days: "Mon – Sat",
      timing: "4:30 – 7:00 PM",
      ageGroup: "8 – 16 yrs",
    },
    {
      batch: "Weekend",
      days: "Sat – Sun",
      timing: "7:00 – 10:00 AM",
      ageGroup: "All ages",
    },
    {
      batch: "Women's Batch",
      days: "Tue, Thu, Sat",
      timing: "5:00 – 7:00 PM",
      ageGroup: "12+ yrs",
    },
  ],
}) {
  return (
    <section className="bg-cream">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>
        <div className="table-responsive reveal">
          <table className="table table-schedule table-hover bg-white rounded-4 overflow-hidden shadow-sm">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Days</th>
                <th>Timing</th>
                <th>Age Group</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.batch}</td>
                  <td>{row.days}</td>
                  <td>{row.timing}</td>
                  <td>{row.ageGroup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
