"use client";
import { motion } from "motion/react";
import { Header } from "./layout/Header";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LucideArrowLeftCircle } from "lucide-react";
import { toast } from "./ui/toast";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type EmbedFramework = "javascript" | "react" | "next";

const frameworkOptions: { value: EmbedFramework; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "react", label: "React" },
  { value: "next", label: "Next.js" },
];

const EmbedClient = ({ userProfile }: { userProfile: { id: string } }) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isBotOpen, setIsBotOpen] = useState(true);
  const [framework, setFramework] = useState<EmbedFramework>("javascript");
  const widgetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chatBot.js`;

  const instructions = {
    javascript: {
      code: `<script src="${widgetUrl}" data-user-id="${userProfile.id}"></script>`,
      steps: [
        "Copy the script below.",
        "Paste it just before the closing </body> tag in your website HTML.",
        "Publish or reload your site, then open the chat bubble to test it.",
      ],
      note: "Works with a plain HTML website or any site where you can edit the page HTML.",
    },
    react: {
      code: `<script src="${widgetUrl}" data-user-id="${userProfile.id}"></script>`,
      steps: [
        "Copy the script below.",
        "For Vite, paste it into the root index.html. For Create React App, use public/index.html.",
        "Place it just before </body>, then restart or redeploy your site.",
      ],
      note: "Add the script to the HTML entry point rather than inside a React component. This keeps it from being injected again when React re-renders.",
    },
    next: {
      code: `import Script from "next/script";\n\n// Add this inside the <body> in app/layout.tsx\n<Script\n  src="${widgetUrl}"\n  data-user-id="${userProfile.id}"\n  strategy="afterInteractive"\n/>`,
      steps: [
        "Import Script from next/script in your root app/layout.tsx.",
        "Place the snippet inside the root layout’s <body> element.",
        "Restart or redeploy your Next.js site and test the chat on a page.",
      ],
      note: "For the Pages Router, add the same next/script element to pages/_app.tsx instead.",
    },
  } satisfies Record<
    EmbedFramework,
    { code: string; steps: string[]; note: string }
  >;

  const selectedInstructions = instructions[framework];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(selectedInstructions.code);
      toast.add({
        type: "success",
        title: "Success!",
        description: "Code copied",
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy embed code:", error);
      toast.add({
        type: "error",
        title: "Could not copy code",
        description: "Select and copy the code manually.",
      });
    }
  };

  return (
    <div className="min-h-screen text-zinc-900">
      <Header userProfile={userProfile} />

      <div className="flex justify-center px-4 py-14 mt-15 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl rounded-2xl shadow-xl p-10"
        >
          <div
            className="flex justify-start items-center mb-6 hover:cursor-pointer"
            onClick={() => router.push("/dashboard")}
          >
            <LucideArrowLeftCircle className="mr-2" size={15} /> Back to
            dashboard
          </div>
          <h1 className="text-2xl font-semibold mb-8">Embed pingit assistant</h1>

          <div className="mb-5 w-40 space-y-2">
            <Label htmlFor="embed-framework">Choose framework</Label>
            <Select
              value={framework}
              onValueChange={(value) => {
                const selectedOption = frameworkOptions.find(
                  (option) => option.value === value,
                );
                if (selectedOption) {
                  setFramework(selectedOption.value);
                  setCopied(false);
                }
              }}
            >
              <SelectTrigger id="embed-framework" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frameworkOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative rounded-xl bg-zinc-900 p-5 pr-24 text-sm font-medium text-zinc-100">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all">
              {selectedInstructions.code}
            </pre>
            <button
              className="absolute top-3 right-3 bg-white text-zinc-900 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition hover:cursor-pointer"
              onClick={copyCode}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <ol className="mt-6 list-inside list-decimal space-y-3 text-sm text-zinc-600">
            {selectedInstructions.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm leading-6 text-zinc-500">
            {selectedInstructions.note}
          </p>

          <div className="mt-14">
            <h1 className="text-lg font-medium mb-2">Live Preview</h1>
            <p className="text-sm text-zinc-500 mb-6">
              This is how the chatbot will appear on your website
            </p>

            <div className="rounded-xl border border-zinc-300 bg-white shadow-md overflow-hidden">
              <div className="flex items-center gap-2 px-4 h-9 bg-zinc-100 border-b border-zinc-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="ml-4 text-xs text-zinc-500">
                  Your-website.com
                </span>
              </div>

              <div className="relative h-64 sm:h-72 p-6 text-zinc-400 text-sm">
                Your website goes here
                {isBotOpen && (
                  <div className="absolute bottom-24 right-6 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden">
                    <div
                      className="flex gap-2 h-9 border-b border-zinc-200
                    bg-black text-white text-xs px-3 py-2 justify-between items-center"
                    >
                      <div className="flex justify-start items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        <span className="ml-2">Customer Support</span>
                      </div>
                      <span
                        onClick={() => setIsBotOpen(!isBotOpen)}
                        className="hover:cursor-pointer"
                      >
                        X
                      </span>
                    </div>

                    <div className="p-3 space-y-2 bg-zinc-50">
                      <div className="bg-zinc-200 text-zinc-800 text-xs px-3 py-2 rounded-lg w-fit">
                        Hi! how can I help you today?
                      </div>
                      <div className="bg-black text-white text-xs px-3 py-2 rounded-lg ml-auto w-fit">
                        What is the expected delivery time
                      </div>
                    </div>
                  </div>
                )}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-black flex items-center justify-center shadow-2xl text-white cursor-pointer"
                  onClick={() => setIsBotOpen(!isBotOpen)}
                >
                  💬
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EmbedClient;
