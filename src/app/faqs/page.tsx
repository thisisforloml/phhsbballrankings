export const metadata = {
  title: "FAQs",
  description: "Frequently asked questions about Peach Basket Rankings PH."
};

const faqs = [
  ["What is Peach Basket Rankings PH?", "A Philippine basketball visibility platform that turns verified game data into player profiles, ratings, and public rankings."],
  ["Do rankings guarantee recruitment?", "No. Rankings are informational and do not guarantee recruitment, scholarships, team selection, or opportunities."],
  ["How are players ranked?", "Formula v1 uses validated box-score production, converts game performance into a 1-100 score, and averages eligible performances into a current rating."],
  ["Can data be corrected?", "Yes. Players, parents or guardians, coaches, schools, and organizers may request correction or removal review."],
  ["Why do some players have missing height or position?", "Some player records are still profile stubs from stat imports. Bio fields can be completed through admin review or profile claims later."]
];

export default function FaqsPage() {
  return (
    <main className="bg-surface-50 pb-20 pt-28">
      <section className="container-px mx-auto max-w-4xl py-12">
        <p className="label">Support</p>
        <h1 className="mt-3 font-display text-stat-lg text-navy-800">FAQs</h1>
        <div className="mt-8 grid gap-4">
          {faqs.map(([question, answer]) => (
            <article key={question} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl text-ink-900">{question}</h2>
              <p className="mt-2 leading-7 text-ink-600">{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
