import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  type ChessLanguage,
} from "../../../games/chess/i18n/chessLanguage";

export type RuleItem = {
  icon: string;
  title: string;
  text: ReactNode;
};

export type FeatureItem = {
  icon: string;
  title: string;
  text: string;
};

type VariantRulesPageProps = {
  variantLabel?: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: "violet" | "amber" | "orange" | "red" | "fuchsia";
  backRoute: string;
  backLabel: string;
  coreIdea: string;
  features?: FeatureItem[];
  rules: RuleItem[];
  children?: ReactNode;
  language: ChessLanguage;
  onLanguageChange: (language: ChessLanguage) => void;
  languageLabel: string;
  coreIdeaLabel: string;
  ruleLabel?: string;
  playLabel: string;
};

const accents = {
  violet: {
    text: "text-violet-300",
    border: "border-violet-400/15",
    bg: "bg-violet-400/10",
    subtle: "bg-violet-400/[0.04]",
  },
  amber: {
    text: "text-amber-300",
    border: "border-amber-400/15",
    bg: "bg-amber-400/10",
    subtle: "bg-amber-400/[0.04]",
  },
  orange: {
    text: "text-orange-300",
    border: "border-orange-400/15",
    bg: "bg-orange-400/10",
    subtle: "bg-orange-400/[0.04]",
  },
  red: {
    text: "text-red-300",
    border: "border-red-400/15",
    bg: "bg-red-400/10",
    subtle: "bg-red-400/[0.04]",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    border: "border-fuchsia-400/15",
    bg: "bg-fuchsia-400/10",
    subtle: "bg-fuchsia-400/[0.04]",
  },
} as const;

export default function VariantRulesPage({
  variantLabel = "Chess Variant",
  title,
  subtitle,
  icon,
  accent,
  backRoute,
  backLabel,
  coreIdea,
  features = [],
  rules,
  children,
  coreIdeaLabel,
  playLabel,
}: VariantRulesPageProps) {
  useUiLanguage();
  const colors = accents[accent];

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <ChessPageHeader className={`
            mb-6
            rounded-3xl
            border
            ${colors.border}
            bg-zinc-900/70
            px-5
            py-5
            shadow-xl
            shadow-black/20
            backdrop-blur-md
          `} description={<> {ui(subtitle)} </>}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`
                  flex
                  h-14
                  w-14
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  ${colors.border}
                  ${colors.bg}
                  text-3xl
                `}
              >
                {icon}
              </div>

              <div>
                <p
                  className={`
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.28em]
                    ${colors.text}
                  `}
                >
                  {variantLabel}
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {ui(title)}
                </h1>

                <p className="mt-1 text-sm text-zinc-500">{ui(subtitle)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                to={backRoute}
                className={`
                inline-flex
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                ${colors.border}
                ${colors.bg}
                px-4
                py-2.5
                text-xs
                font-black
                ${colors.text}
                transition
                hover:brightness-125
              `}
              >
                ← {backLabel}
              </Link>
            </div>
          </div>
        </ChessPageHeader>

        <section
          className={`
            mb-5
            rounded-3xl
            border
            ${colors.border}
            ${colors.subtle}
            p-5
          `}
        >
          <p
            className={`
              text-[10px]
              font-black
              uppercase
              tracking-[0.2em]
              ${colors.text}
            `}
          >
            {coreIdeaLabel}
          </p>

          <p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-300">
            {coreIdea}
          </p>
        </section>

        {features.length > 0 && (
          <section className="mb-5 grid gap-3 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4"
              >
                <div className="text-2xl">{feature.icon}</div>

                <h2 className="mt-3 text-sm font-black text-white">
                  {ui(feature.title)}
                </h2>

                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {ui(feature.text)}
                </p>
              </div>
            ))}
          </section>
        )}

        {children}

        <div className="space-y-4">
          {rules.map((rule, index) => (
            <section
              key={`${index}-${rule.title}`}
              className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg shadow-black/10"
            >
              <div className="flex items-start gap-4">
                <span
                  className={`
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    ${colors.border}
                    ${colors.bg}
                    text-lg
                  `}
                >
                  {rule.icon}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`
                        text-[10px]
                        font-black
                        uppercase
                        tracking-wider
                        ${colors.text}
                      `}
                    >{ui("Rule")}{index + 1}
                    </span>

                    <h2 className="font-black text-white">{ui(rule.title)}</h2>
                  </div>

                  <div className="mt-2 text-sm leading-7 text-zinc-400">
                    {ui(rule.text)}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            to={backRoute}
            className={`
              rounded-xl
              border
              ${colors.border}
              ${colors.bg}
              px-5
              py-3
              text-sm
              font-black
              ${colors.text}
              transition
              hover:brightness-125
            `}
          >
            {playLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}

export function VisualCard({
  eyebrow = "Example",
  title,
  children,
  accent = "violet",
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  accent?: VariantRulesPageProps["accent"];
}) {
  useUiLanguage();
  const colors = accents[accent];

  return (
    <section
      className={`
        mb-5
        rounded-3xl
        border
        ${colors.border}
        bg-zinc-900/60
        p-5
      `}
    >
      <p
        className={`
          text-[10px]
          font-black
          uppercase
          tracking-[0.18em]
          ${colors.text}
        `}
      >
        {ui(eyebrow)}
      </p>

      <h3 className="mt-2 text-lg font-black text-white">{ui(title)}</h3>

      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Flow({
  steps,
}: {
  steps: Array<{
    icon: string;
    label: string;
    detail?: string;
  }>;
}) {
  useUiLanguage();
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={`${index}-${step.label}`}
          className="relative rounded-2xl border border-white/10 bg-black/20 px-3 py-4 text-center"
        >
          <div className="text-2xl">{step.icon}</div>

          <p className="mt-2 text-xs font-black text-zinc-200">{ui(step.label)}</p>

          {step.detail && (
            <p className="mt-1 text-[10px] leading-4 text-zinc-600">
              {step.detail}
            </p>
          )}

          {index < steps.length - 1 && (
            <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-zinc-700 lg:block">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function EffectGrid({
  items,
}: {
  items: Array<{
    icon: string;
    title: string;
    text: string;
  }>;
}) {
  useUiLanguage();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>

            <p className="text-sm font-black text-white">{ui(item.title)}</p>
          </div>

          <p className="mt-2 text-xs leading-5 text-zinc-500">{ui(item.text)}</p>
        </div>
      ))}
    </div>
  );
}
