"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { COLORS } from "@/constants/COLORS";
import {
  Sparkles,
  Plus,
  Edit3,
  Copy,
  Mail,
  TrendingUp,
  Handshake,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { BackgroundBeams } from "@/components/magicui/background-beams";

// Default template data
const DEFAULT_TEMPLATES = [
  {
    id: "intro-email",
    name: "Introduction Email",
    description:
      "A professional introduction template for initial outreach to new contacts.",
    subject: "Introduction - [Your Name] from [Your Company]",
    content: `Hi [Individual's Name],

I hope this email finds you well. My name is [Your Name] and I'm reaching out from [Your Company].

[1-2 details about the company] and I believe there might be an opportunity for us to collaborate.

[Personal detail about the individual] - I'd love to connect and discuss how we might work together.

Would you be available for a brief call next week?

Best regards,
[Your Name]`,
    icon: <Mail className="w-5 h-5" />,
    color: COLORS.blue,
    category: "Outreach",
  },
  {
    id: "follow-up",
    name: "Follow-up Template",
    description:
      "Perfect for following up on previous conversations or meetings.",
    subject: "Following up on our conversation - [Topic]",
    content: `Hi [Individual's Name],

I wanted to follow up on our conversation about [Topic discussed].

As mentioned, [1-2 details about the company] and I think we could provide significant value to [Company name].

[Personal detail about the individual] - I'd be happy to send over some additional information or schedule a demo.

Looking forward to hearing from you.

Best,
[Your Name]`,
    icon: <TrendingUp className="w-5 h-5" />,
    color: COLORS.purple,
    category: "Follow-up",
  },
  {
    id: "partnership",
    name: "Partnership Proposal",
    description:
      "Reach out to potential business partners with this collaboration template.",
    subject: "Partnership Opportunity - [Your Company] & [Their Company]",
    content: `Dear [Individual's Name],

I hope you're doing well. I've been following [Company name] and I'm impressed by [1-2 details about the company].

At [Your Company], we specialize in [Your expertise] and I believe there's a strong synergy between our companies.

[Personal detail about the individual] - I'd love to explore how we might collaborate to mutual benefit.

Would you be open to a brief discussion about potential partnership opportunities?

Warm regards,
[Your Name]`,
    icon: <Handshake className="w-5 h-5" />,
    color: COLORS.teal,
    category: "Partnership",
  },
  {
    id: "meeting-request",
    name: "Meeting Request",
    description:
      "Schedule meetings with prospects using this professional template.",
    subject: "Meeting Request - [Purpose of Meeting]",
    content: `Hi [Individual's Name],

I hope this message finds you well. I'm reaching out to request a brief meeting to discuss [Meeting purpose].

Given that [1-2 details about the company], I believe [Your Company] could provide valuable insights for [Their goals/challenges].

[Personal detail about the individual] - I think you'd find our discussion particularly relevant.

Would you have 20-30 minutes available next week for a call?

Thank you for your time,
[Your Name]`,
    icon: <Calendar className="w-5 h-5" />,
    color: COLORS.amber,
    category: "Meetings",
  },
  {
    id: "thank-you",
    name: "Thank You Note",
    description:
      "Express gratitude after meetings, calls, or successful collaborations.",
    subject: "Thank you - [Occasion/Meeting Topic]",
    content: `Dear [Individual's Name],

Thank you for taking the time to meet with me yesterday. I really enjoyed our conversation about [Meeting topic].

Your insights about [Specific insight they shared] were particularly valuable, and I appreciate you sharing your perspective on [Company name]'s [1-2 details about the company].

[Personal detail about the individual] - I look forward to continuing our discussion and exploring how we can work together.

I'll follow up next week with the information we discussed.

Best regards,
[Your Name]`,
    icon: <CheckCircle className="w-5 h-5" />,
    color: COLORS.pink,
    category: "Follow-up",
  },
];

interface TemplateCardProps {
  template: (typeof DEFAULT_TEMPLATES)[0];
  isUserTemplate?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
}

function TemplateCard({
  template,
  isUserTemplate = false,
  onEdit,
  onSave,
}: TemplateCardProps) {
  return (
    <Card className="hover:shadow-md transition-all duration-200 group cursor-pointer border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${template.color.light_variant.class}`}
            >
              {template.icon}
            </div>
            <div>
              <CardTitle className="text-left group-hover:text-opacity-80 transition-colors">
                {template.name}
              </CardTitle>
              <CardDescription className="text-left text-sm">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isUserTemplate && (
              <Badge
                className={`text-xs ${template.color.light_variant.class} border-none`}
              >
                {template.category}
              </Badge>
            )}
            {isUserTemplate && (
              <Badge
                variant="secondary"
                className={`text-xs ${COLORS.indigo.light_variant.class} border-none`}
              >
                Custom
              </Badge>
            )}
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="hover:bg-muted/50"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              )}
              {onSave && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSave}
                  className={`hover:bg-muted/50 ${template.color.light_variant.class} hover:opacity-80`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm ">
          <strong>Subject:</strong> {template.subject}
        </div>
        <div className="text-sm text-muted-foreground mt-2 line-clamp-3">
          {template.content.slice(0, 150)}...
        </div>
        <div
          className={`w-full h-1 mt-3 rounded-full ${
            template.color.light_variant.class.includes("bg-")
              ? template.color.light_variant.class
                  .split(" ")
                  .find((c) => c.includes("bg-"))
              : "bg-gray-200"
          }`}
        ></div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const [aiPrompt, setAiPrompt] = useState("");
  const [templatePurpose, setTemplatePurpose] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    subject: "",
    content: "",
  });
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch user templates with TanStack Query
  const {
    data: userTemplates = [],
    isLoading: isLoadingTemplates,
    error: templatesError,
  } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Please log in to view your templates");
      }

      const { data: templates, error } = await supabase
        .from("template")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return templates || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle query errors
  if (templatesError) {
    console.error("Error fetching templates:", templatesError);
  }

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string;
      description?: string;
      subject: string;
      content: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Please log in to save templates");
      }

      const { error } = await supabase.from("template").insert({
        user_id: user.id,
        name: templateData.name.trim(),
        description: templateData.description?.trim() || null,
        subject: templateData.subject.trim(),
        content: templateData.content.trim(),
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Template created successfully!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      handleCloseTemplateSheet();
    },
    onError: (error) => {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      id,
      templateData,
    }: {
      id: string;
      templateData: {
        name: string;
        description?: string;
        subject: string;
        content: string;
      };
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Please log in to save templates");
      }

      const { error } = await supabase
        .from("template")
        .update({
          name: templateData.name.trim(),
          description: templateData.description?.trim() || null,
          subject: templateData.subject.trim(),
          content: templateData.content.trim(),
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Template updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      handleCloseTemplateSheet();
    },
    onError: (error) => {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    },
  });

  const handleCopyTemplate = async (
    template: (typeof DEFAULT_TEMPLATES)[0]
  ) => {
    try {
      const templateText = `Subject: ${template.subject}\n\n${template.content}`;
      await navigator.clipboard.writeText(templateText);
      toast.success(`"${template.name}" copied to clipboard!`);
    } catch (error) {
      toast.error("Failed to copy template");
    }
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      description: template.description || "",
      subject: template.subject,
      content: template.content,
    });
    setIsEditMode(true);
    setShowCreateTemplate(true);
  };

  const handleCreateTemplate = async () => {
    // Validate required fields
    if (
      !newTemplate.name.trim() ||
      !newTemplate.subject.trim() ||
      !newTemplate.content.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isEditMode) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        templateData: newTemplate,
      });
    } else {
      createTemplateMutation.mutate(newTemplate);
    }
  };

  const handleCloseTemplateSheet = () => {
    setShowCreateTemplate(false);
    setNewTemplate({ name: "", description: "", subject: "", content: "" });
    setEditingTemplate(null);
    setIsEditMode(false);
  };

  const handleSaveGeneratedTemplate = async () => {
    if (!generatedTemplate) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to save templates");
        return;
      }

      const { error } = await supabase.from("template").insert({
        user_id: user.id,
        name: generatedTemplate.name,
        description: generatedTemplate.description,
        subject: generatedTemplate.subject,
        content: generatedTemplate.content,
      });

      if (error) {
        console.error("Error saving generated template:", error);
        toast.error("Failed to save template");
      } else {
        toast.success("Template saved successfully!");
        setShowPreview(false);
        setGeneratedTemplate(null);
        setAiPrompt("");
        queryClient.invalidateQueries({ queryKey: ["templates"] });
      }
    } catch (error) {
      console.error("Error saving generated template:", error);
      toast.error("Failed to save template");
    }
  };

  const handleGenerateTemplate = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
      const mockTemplate = {
        id: "generated-" + Date.now(),
        name: `AI Generated: ${aiPrompt}`,
        description: `Custom template generated for: ${aiPrompt}`,
        subject: `[AI Generated Subject for ${aiPrompt}]`,
        content: `Hi [Individual's Name],

[AI-generated content based on: "${aiPrompt}"]

[1-2 details about the company]

[Personal detail about the individual]

Best regards,
[Your Name]`,
        icon: <Sparkles className="w-5 h-5" />,
        color: COLORS.indigo,
        category: "AI Generated",
      };

      setGeneratedTemplate(mockTemplate);
      setIsGenerating(false);
      setShowPreview(true);
    }, 2000);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 ">
      {/* <BackgroundBeams /> */}
      {/* Left Panel - Template Generator */}
      <div className="w-96">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className={``}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="">Template Generator</CardTitle>
                <CardDescription>
                  Create new templates with the help of AI
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-6">
            <div>
              <label className="text-sm font-medium mb-2 block">
                What type of email template are you looking for?
              </label>
              <Input
                placeholder="e.g., cold outreach for SaaS companies, follow-up after demo..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Template purpose and audience
              </label>
              <Input
                placeholder="Template Description"
                value={templatePurpose}
                onChange={(e) => setTemplatePurpose(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className={`mt-2 text-xs ${COLORS.amber.light_variant.class}`}
              >
                Add more details
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                More options
              </label>
              <p className="text-sm text-muted-foreground mb-3">
                How do you want this template to sound, look, and feel?
              </p>
              <Textarea
                placeholder="What tone should this template have? Who are you targeting? Include any other details here. Will this template be combined with specific industries?"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="mt-auto">
              <Button
                onClick={handleGenerateTemplate}
                disabled={!aiPrompt.trim() || isGenerating}
                className={`w-full justify-between ${COLORS.orange.light_variant_with_border.class} !text-foreground`}
              >
                {isGenerating
                  ? "Generating template..."
                  : "Ask AI to generate this template"}
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Template Lists */}
      <div className="flex-1">
        <Tabs defaultValue="default" className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="default">Default Templates</TabsTrigger>
              <TabsTrigger value="my-templates">My Templates</TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateTemplate(true)}
              className={`${COLORS.blue.light_variant_with_border.class}`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create template
            </Button>
          </div>

          <TabsContent value="default" className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto space-y-4 pr-2">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {DEFAULT_TEMPLATES.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <TemplateCard
                      template={template}
                      onSave={() => handleCopyTemplate(template)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="my-templates" className="flex-1 overflow-hidden">
            {isLoadingTemplates ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    Loading your templates...
                  </p>
                </div>
              </div>
            ) : userTemplates.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="p-8 rounded-full bg-muted/50 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg mb-2">No templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Save templates from defaults or create your own to get
                    started.
                  </p>
                  <Button onClick={() => setShowCreateTemplate(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create first template
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto space-y-4 pr-2">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {userTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <TemplateCard
                        template={{
                          ...template,
                          icon: <Mail className="w-5 h-5" />,
                          color: COLORS.indigo,
                          category: "Custom",
                        }}
                        isUserTemplate={true}
                        onSave={() => handleCopyTemplate(template)}
                        onEdit={() => handleEditTemplate(template)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Sheet */}
      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent
          side="right"
          className="w-[800px] sm:max-w-[800px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-2xl">
              Generated Template Preview
            </SheetTitle>
            <SheetDescription>
              Review your AI-generated template and save it to your collection
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            {generatedTemplate && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Template Name
                    </label>
                    <Input value={generatedTemplate.name} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Category
                    </label>
                    <Badge variant="secondary">
                      {generatedTemplate.category}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Subject Line
                  </label>
                  <Input value={generatedTemplate.subject} readOnly />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Template Content
                  </label>
                  <Textarea
                    value={generatedTemplate.content}
                    readOnly
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveGeneratedTemplate}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateTemplate()}
                    disabled={isGenerating}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button variant="ghost" onClick={() => setShowPreview(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Template Sheet */}
      <Sheet open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <SheetContent
          side="right"
          className="w-[600px] sm:max-w-[600px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-2xl !font-sans">
              {isEditMode ? "Edit Template" : "Create New Template"}
            </SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update your email template"
                : "Create a custom email template for your campaigns"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6 px-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Template Name
              </label>
              <Input
                placeholder="e.g., Cold Outreach for SaaS"
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Description
              </label>
              <Input
                placeholder="Brief description of when to use this template"
                value={newTemplate.description}
                onChange={(e) =>
                  setNewTemplate({
                    ...newTemplate,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Subject Line
              </label>
              <Input
                placeholder="e.g., Quick question about [Company name]"
                value={newTemplate.subject}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, subject: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Template Content
              </label>
              <Textarea
                placeholder="Write your email template here. Use brackets for AI placeholders like [Individual's Name], [Company name], [1-2 details about the company], etc."
                value={newTemplate.content}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, content: e.target.value })
                }
                rows={12}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Use brackets like [Individual's Name], [Company name],
                [Personal detail about the individual] for AI placeholders
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreateTemplate}
                className="flex-1"
                disabled={
                  !newTemplate.name ||
                  !newTemplate.subject ||
                  !newTemplate.content ||
                  createTemplateMutation.isPending ||
                  updateTemplateMutation.isPending
                }
              >
                <CheckCircle className="w-4 h-4 mr-2 " />
                {createTemplateMutation.isPending ||
                updateTemplateMutation.isPending
                  ? isEditMode
                    ? "Updating..."
                    : "Creating..."
                  : isEditMode
                  ? "Update Template"
                  : "Create Template"}
              </Button>
              <Button variant="ghost" onClick={handleCloseTemplateSheet}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
