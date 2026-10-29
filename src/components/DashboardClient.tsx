"use client";
import { Header } from "./layout/Header";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import axios from "axios";
import { Code2 } from "lucide-react";
import { toast } from "./ui/toast";
import { useRouter } from "next/navigation";

function DashboardClient({ userProfile }: { userProfile: any }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    userId: userProfile.id,
    businessName: "",
    businessEmail: "",
    knowledge: "",
  });
  const [loading, setLoading] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setIsChanged(true);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await axios.post("/api/setting", formData);
      const savedData = result.data;

      setFormData({
        userId: userProfile.id,
        businessName: savedData.data.businessName,
        businessEmail: savedData.data.businessEmail,
        knowledge: savedData.data.knowledge,
      });

      toast.add({
        type: "success",
        title: "Success!",
        description: result.data.message,
      });
    } catch (error: any) {
      console.log(error);
      toast.add({
        type: "error",
        title: "Uh oh! Something went wrong.",
        description: error.message,
      });
    }
    setLoading(false);
    setIsChanged(false);
  };

  useEffect(() => {
    if (userProfile.id) {
      const getSetting = async () => {
        try {
          const result = await axios.post("/api/setting/get", {
            userId: userProfile.id,
          });
          const res = result.data.data;
          setFormData({
            userId: userProfile.id,
            businessName: res.businessName,
            businessEmail: res.businessEmail,
            knowledge: res.knowledge,
          });
        } catch (error: any) {
          console.log(`get setting error: ${error}`);
          toast.add({
            type: "error",
            title: "Uh oh! Something went wrong.",
            description: error.message,
          });
        }
      };

      getSetting();
    }
  }, [userProfile?.id]);

  return (
    <div className="min-h-screen text-zinc-900">
      <Header userProfile={userProfile} />

      <div className="flex justify-center px-4 py-14 mt-15 bg-white">
        <motion.div className="w-full max-w-3xl rounded-2xl shadow-xl p-10">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold">Set up your pingit assistant</h1>
            <p className="text-zinc-500 mt-1">
              Give pingit the business details and answers it needs to help
              your customers.
            </p>
          </div>

          <div className="mb-10">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Business Details</FieldLegend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="businessName">
                        Name <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="businessName"
                        name="businessName"
                        placeholder="Business Name"
                        onChange={handleChange}
                        value={formData.businessName}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="businessEmail">
                        Email <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        name="businessEmail"
                        placeholder="Business Email"
                        onChange={handleChange}
                        value={formData.businessEmail}
                        required
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSet>
                  <FieldLegend>Knowledge Base</FieldLegend>
                  <FieldDescription>
                    Add FAQs, policies, delivery info, refund policies etc.
                  </FieldDescription>
                  <FieldGroup>
                    <Field>
                      <Textarea
                        name="knowledge"
                        placeholder={`Example: 
- Refund Policy: Refund eligible only in 7 days after purchase
- Delivery Time: 3-5 working days
- Cash on delivery available
- Support hours - 24/7`}
                        className="resize-none h-50"
                        required
                        onChange={handleChange}
                        value={formData.knowledge}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSet>
                  <FieldGroup data-slot="checkbox-group">
                    <Field orientation="horizontal">
                      <Checkbox id="push" defaultChecked disabled />
                      <FieldLabel htmlFor="push" className="font-normal">
                        Use this information to personalize my pingit assistant
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <Field orientation="responsive">
                  <Button
                    type="submit"
                    disabled={loading || !isChanged}
                    className="hover:cursor-pointer"
                  >
                    {loading ? "Saving..." : "Save"}
                  </Button>
                  {formData.businessEmail &&
                    formData.businessName &&
                    formData.knowledge && (
                      <Button
                        type="button"
                        disabled={!formData}
                        onClick={() => router.push("/embed")}
                        className="hover:cursor-pointer"
                      >
                        <Code2 /> Embed
                      </Button>
                    )}
                </Field>
              </FieldGroup>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default DashboardClient;
