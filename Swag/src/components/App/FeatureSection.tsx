import { ui, useUiLanguage } from "@/i18n/ui";
import type { ReactNode } from "react";

import { ArrowRight } from "lucide-react";

import { Link } from "react-router-dom";

type FeatureSectionProps = {
  index: string;
  eyebrow: string;

  title: ReactNode;

  description: string;

  href: string;
  action: string;

  children: ReactNode;

  reverse?: boolean;
};

export default function FeatureSection({
  index,
  eyebrow,
  title,
  description,
  href,
  action,
  children,
  reverse = false,
}: FeatureSectionProps) {
  useUiLanguage();
  return (
    <section
      className="
        relative

        border-b
        border-white/[0.08]

        py-24

        md:py-32

        xl:min-h-[760px]
        xl:py-40
      "
    >
      <div
        className="
          mx-auto

          grid
          max-w-[1500px]

          gap-16

          px-5

          sm:px-8

          lg:grid-cols-2
          lg:items-center
          lg:gap-20
          lg:px-10

          xl:gap-28
        "
      >
        {/* TEXT */}
        <div className={reverse ? "lg:order-2" : ""}>
          <div
            className="
              grid

              grid-cols-[32px_1fr]

              gap-4

              sm:grid-cols-[48px_1fr]
              sm:gap-6
            "
          >
            {/* NUMBER */}
            <span
              className="
                pt-1

                text-xs
                font-medium

                text-zinc-700
              "
            >
              {index}
            </span>

            {/* CONTENT */}
            <div>
              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.3em]

                  text-indigo-300
                "
              >
                {ui(eyebrow)}
              </p>

              <h2
                className="
                  mt-5

                  max-w-xl

                  text-4xl
                  font-black
                  leading-[1.02]
                  tracking-[-0.045em]

                  text-white

                  sm:text-5xl

                  xl:text-6xl
                "
              >
                {ui(title)}
              </h2>

              <p
                className="
                  mt-6

                  max-w-lg

                  text-base
                  leading-7

                  text-zinc-400

                  sm:text-lg
                  sm:leading-8
                "
              >
                {ui(description)}
              </p>

              <Link
                to={href}
                className="
                  group

                  mt-8

                  inline-flex
                  items-center
                  gap-2

                  rounded-xl

                  bg-indigo-500

                  px-5
                  py-3

                  text-sm
                  font-semibold
                  text-white

                  transition-all

                  hover:bg-indigo-400

                  active:scale-[0.98]
                "
              >
                {ui(action)}

                <ArrowRight
                  size={16}
                  className="
                    transition-transform
                    duration-200

                    group-hover:translate-x-1
                  "
                />
              </Link>
            </div>
          </div>
        </div>

        {/* SHOWCASE */}
        <div className={reverse ? "lg:order-1" : ""}>{children}</div>
      </div>
    </section>
  );
}
