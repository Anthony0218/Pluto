import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { learningResources } from "../../data/navigation";

export default function LearnPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-10 text-white">
      <BookOpen className="text-indigo-300" size={32} />
      <h1 className="mt-4 text-3xl font-bold">Learn</h1>
      <p className="mt-3 text-zinc-400">
        Explore the rules and build your skills at your own pace.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {learningResources.map((item) => (
          <Link
            key={item.route}
            to={item.route}
            className="rounded-2xl border border-white/10 bg-[#0b1020]/80 p-6 transition hover:border-indigo-400/40"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm text-indigo-300">
              Start learning
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
