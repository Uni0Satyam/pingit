"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StepsProps = React.ComponentProps<"ol">;

function Steps({ className, ...props }: StepsProps) {
  return (
    <ol
      data-slot="steps"
      className={cn(
        "relative grid list-none gap-6 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-zinc-200 md:grid-cols-3 md:before:bottom-auto md:before:left-[16.67%] md:before:right-[16.67%] md:before:top-5 md:before:h-px md:before:w-auto",
        className,
      )}
      {...props}
    />
  );
}

type StepProps = {
  number: string;
  title: string;
  description: string;
  index: number;
};

function Step({ number, title, description, index }: StepProps) {
  return (
    <motion.li
      data-slot="step"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      className="relative z-10 flex min-w-0 items-start gap-4 md:flex-col md:items-center md:gap-0"
    >
      <span className="mt-5 flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 shadow-sm md:mb-5 md:mt-0">
        {number}
      </span>
      <Card className="h-full w-full border-0 bg-white shadow-sm ring-1 ring-zinc-200">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-zinc-600">{description}</p>
        </CardContent>
      </Card>
    </motion.li>
  );
}

export { Steps, Step };
