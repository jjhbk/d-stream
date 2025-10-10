const faqs = [
  {
    q: "Is this legal?",
    a: "100% — only creator-owned or licensed content is uploaded.",
  },
  { q: "What currencies are supported?", a: "ETH, Polygon, USDC, PayPal USD." },
  {
    q: "How much does it cost to watch?",
    a: "Pay-per-minute — you control your spending.",
  },
];

export default function FAQ() {
  return (
    <section className="py-20 max-w-4xl mx-auto px-4">
      <h2 className="text-4xl font-bold text-center mb-12">FAQ</h2>
      <div className="space-y-6">
        {faqs.map((f, idx) => (
          <div
            key={idx}
            className="p-6 border-l-4 border-purple-600 bg-gray-900 rounded-lg"
          >
            <p className="font-bold text-xl mb-2">{f.q}</p>
            <p className="text-gray-300">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
