import { ui, useUiLanguage } from "@/i18n/ui";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { learningResources } from "../../data/navigation";

export default function LearnShowcase() {
  useUiLanguage();
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#080d1c]/85 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <BookOpen className="text-indigo-300" />
        <h3 className="font-semibold">{ui("Choose something to learn")}</h3>
      </div>
      <div className="mt-5 space-y-3">
        {learningResources.map((resource) => (
          <Link
            key={resource.route}
            to={resource.route}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:bg-indigo-500/10"
          >
            <div className="flex-1">
              <h4 className="font-semibold">{ui(resource.title)}</h4>
              <p className="mt-2 text-sm text-zinc-400">
                {ui(resource.description)}
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-indigo-300 transition group-hover:translate-x-1"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
