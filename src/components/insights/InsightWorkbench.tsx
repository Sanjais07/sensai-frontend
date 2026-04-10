"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    BarChart3,
    BrainCircuit,
    CheckCircle2,
    Copy,
    Layers3,
    RefreshCcw,
    ShieldAlert,
    Sparkles,
    TriangleAlert,
    Users,
} from "lucide-react";

type PersonaFilter = "all" | "mentor" | "creator" | "operator";
type Priority = "high" | "medium" | "low";
type Scope = "learner" | "module" | "cohort" | "cross-cutting";
type SignalType = "individual" | "systemic" | "mixed";

interface LearnerSignal {
    learner_id: string;
    learner_name: string;
    module_name: string;
    retries: number;
    average_score: number;
    time_spent_minutes: number;
    last_active_days: number;
    error_signature?: string | null;
    feedback_tags: string[];
}

interface ModuleSignal {
    module_id: string;
    module_name: string;
    completion_rate: number;
    failure_rate: number;
    affected_learners: number;
    repeated_error_signatures: string[];
    learning_objectives: string[];
}

interface CohortSignal {
    cohort_id: string;
    cohort_name: string;
    week_over_week_engagement_change: number;
    attendance_rate: number;
    active_learner_rate: number;
    drop_rate: number;
}

interface FeedbackSignal {
    source: "ai" | "human";
    scope: Scope;
    target_id: string;
    sentiment: "positive" | "neutral" | "negative";
    text: string;
}

interface InsightWorkspaceRequest {
    workspace_name: string;
    personas: Array<Exclude<PersonaFilter, "all">>;
    learners: LearnerSignal[];
    modules: ModuleSignal[];
    cohorts: CohortSignal[];
    feedback: FeedbackSignal[];
}

interface InsightAction {
    label: string;
    rationale: string;
    execution: "manual" | "suggested" | "auto";
    urgency: Priority;
    target_scope: Scope;
}

interface PersonaInsight {
    persona: Exclude<PersonaFilter, "all">;
    title: string;
    summary: string;
    priority: Priority;
    scope: Scope;
    signal_type: SignalType;
    confidence: number;
    evidence: string[];
    impacted_entities: string[];
    recommended_actions: InsightAction[];
    auto_trigger: boolean;
}

interface ValidationReport {
    individual_signal_count: number;
    systemic_signal_count: number;
    redundancy_score: number;
    noise_score: number;
    coverage_gaps: string[];
    notes: string[];
}

interface InsightAnalysisResponse {
    workspace_name: string;
    generated_at: string;
    summary: string;
    insights: PersonaInsight[];
    validation: ValidationReport;
    export_json: Record<string, unknown>;
}

const demoWorkspace: InsightWorkspaceRequest = {
    workspace_name: "DP Cohort Intelligence Demo",
    personas: ["mentor", "creator", "operator"],
    learners: [
        {
            learner_id: "learner-101",
            learner_name: "Aarav",
            module_name: "Dynamic Programming Module 2",
            retries: 4,
            average_score: 0.42,
            time_spent_minutes: 118,
            last_active_days: 1,
            error_signature: "state transition confusion",
            feedback_tags: ["stuck", "needs practice"],
        },
        {
            learner_id: "learner-102",
            learner_name: "Meera",
            module_name: "Dynamic Programming Module 2",
            retries: 3,
            average_score: 0.51,
            time_spent_minutes: 104,
            last_active_days: 2,
            error_signature: "base-case miss",
            feedback_tags: ["needs walkthrough"],
        },
        {
            learner_id: "learner-103",
            learner_name: "Rohan",
            module_name: "Trees Module 1",
            retries: 1,
            average_score: 0.79,
            time_spent_minutes: 62,
            last_active_days: 0,
            feedback_tags: ["good progress"],
        },
        {
            learner_id: "learner-104",
            learner_name: "Zoya",
            module_name: "Dynamic Programming Module 2",
            retries: 2,
            average_score: 0.47,
            time_spent_minutes: 91,
            last_active_days: 6,
            error_signature: "overlapping subproblems gap",
            feedback_tags: ["slow", "needs hint"],
        },
    ],
    modules: [
        {
            module_id: "module-dp-2",
            module_name: "Dynamic Programming Module 2",
            completion_rate: 0.58,
            failure_rate: 0.41,
            affected_learners: 3,
            repeated_error_signatures: [
                "state transition confusion",
                "base-case miss",
                "overlapping subproblems gap",
            ],
            learning_objectives: ["identify states", "build transitions", "reason about complexity"],
        },
        {
            module_id: "module-trees-1",
            module_name: "Trees Module 1",
            completion_rate: 0.84,
            failure_rate: 0.14,
            affected_learners: 1,
            repeated_error_signatures: ["recursive traversal ordering"],
            learning_objectives: ["tree traversal patterns", "recursion"],
        },
    ],
    cohorts: [
        {
            cohort_id: "cohort-1",
            cohort_name: "Spring 2026 Cohort",
            week_over_week_engagement_change: -0.2,
            attendance_rate: 0.74,
            active_learner_rate: 0.69,
            drop_rate: 0.12,
        },
    ],
    feedback: [
        {
            source: "ai",
            scope: "module",
            target_id: "module-dp-2",
            sentiment: "negative",
            text: "Learners repeatedly miss the state transition and need alternate explanations.",
        },
        {
            source: "human",
            scope: "cohort",
            target_id: "cohort-1",
            sentiment: "negative",
            text: "Attendance feels inconsistent and learners are asking for a live revision session.",
        },
    ],
};

const personaMeta: Record<Exclude<PersonaFilter, "all">, { label: string; accent: string; icon: React.ReactNode }> = {
    mentor: {
        label: "Mentor",
        accent: "from-cyan-400/20 to-sky-500/5",
        icon: <Users className="h-5 w-5" />,
    },
    creator: {
        label: "Creator",
        accent: "from-emerald-400/20 to-teal-500/5",
        icon: <Layers3 className="h-5 w-5" />,
    },
    operator: {
        label: "Operator",
        accent: "from-amber-400/20 to-orange-500/5",
        icon: <BarChart3 className="h-5 w-5" />,
    },
};

const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8001";

interface OrganizationOption {
    id: number;
    name: string;
}

interface CohortOption {
    id: number;
    name: string;
    org_id: number;
}

interface CourseOption {
    id: number;
    name: string;
}

function priorityStyles(priority: Priority) {
    switch (priority) {
        case "high":
            return "border-rose-500/30 bg-rose-500/10 text-rose-200";
        case "medium":
            return "border-amber-500/30 bg-amber-500/10 text-amber-100";
        default:
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    }
}

function scopeLabel(scope: Scope) {
    switch (scope) {
        case "learner":
            return "Learner";
        case "module":
            return "Module";
        case "cohort":
            return "Cohort";
        default:
            return "Cross-cutting";
    }
}

function signalLabel(signalType: SignalType) {
    switch (signalType) {
        case "individual":
            return "Individual";
        case "systemic":
            return "Systemic";
        default:
            return "Mixed";
    }
}

export function InsightWorkbench() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [draft, setDraft] = useState(JSON.stringify(demoWorkspace, null, 2));
    const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
    const [cohorts, setCohorts] = useState<CohortOption[]>([]);
    const [coursesForCohort, setCoursesForCohort] = useState<CourseOption[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [selectedCohortId, setSelectedCohortId] = useState("");
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [isLoadingLiveSources, setIsLoadingLiveSources] = useState(false);
    const [analysis, setAnalysis] = useState<InsightAnalysisResponse | null>(null);
    const [selectedPersona, setSelectedPersona] = useState<PersonaFilter>("all");
    const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoadingSample, setIsLoadingSample] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
    const [hasTriedAutoLiveLoad, setHasTriedAutoLiveLoad] = useState(false);

    useEffect(() => {
        document.title = "Insights · SensAI";
    }, []);

    const parseDraft = useCallback((): InsightWorkspaceRequest => {
        const parsed = JSON.parse(draft) as InsightWorkspaceRequest;
        return parsed;
    }, [draft]);

    const runAnalysis = useCallback(async (payload?: InsightWorkspaceRequest) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const workspace = payload ?? parseDraft();
            const response = await fetch(`${backendBaseUrl}/insights/analyze`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(workspace),
            });

            if (!response.ok) {
                throw new Error(`Analysis failed with status ${response.status}`);
            }

            const data = (await response.json()) as InsightAnalysisResponse;
            setAnalysis(data);
            setAcknowledged({});
            setDraft(JSON.stringify(workspace, null, 2));
        } catch (analysisError) {
            const message = analysisError instanceof Error ? analysisError.message : "Unable to generate insights";
            setError(message);
        } finally {
            setIsAnalyzing(false);
        }
    }, [parseDraft]);

    const runLiveAnalysis = useCallback(async (cohortId: string, courseId?: string) => {
        if (!cohortId) {
            setError("Select a cohort to run live analysis.");
            return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (courseId) {
                params.set("course_id", courseId);
            }

            const query = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(
                `${backendBaseUrl}/insights/live/cohorts/${encodeURIComponent(cohortId)}/analyze${query}`,
                {
                    method: "POST",
                },
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Cohort not found for live analysis.");
                }
                throw new Error(`Live analysis failed with status ${response.status}`);
            }

            const data = (await response.json()) as InsightAnalysisResponse;
            setAnalysis(data);
            setAcknowledged({});
        } catch (analysisError) {
            const message = analysisError instanceof Error ? analysisError.message : "Unable to analyze live cohort";
            setError(message);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const loadSample = useCallback(async () => {
        setIsLoadingSample(true);
        setError(null);

        try {
            const response = await fetch(`${backendBaseUrl}/insights/sample`);
            if (!response.ok) {
                throw new Error(`Sample request failed with status ${response.status}`);
            }

            const payload = (await response.json()) as InsightWorkspaceRequest;
            setDraft(JSON.stringify(payload, null, 2));
            await runAnalysis(payload);
        } catch (sampleError) {
            const message = sampleError instanceof Error ? sampleError.message : "Unable to load sample workspace";
            setError(message);
            setDraft(JSON.stringify(demoWorkspace, null, 2));
            await runAnalysis(demoWorkspace);
        } finally {
            setIsLoadingSample(false);
        }
    }, [runAnalysis]);

    useEffect(() => {
        if (authLoading || !isAuthenticated || !user?.id) {
            return;
        }

        const loadLiveSources = async () => {
            setIsLoadingLiveSources(true);

            try {
                const orgResponse = await fetch(`${backendBaseUrl}/insights/live/users/${user.id}/organizations`);
                if (!orgResponse.ok) {
                    throw new Error(`Failed to load organizations (${orgResponse.status})`);
                }

                const orgData = (await orgResponse.json()) as Array<{ id: number; name: string }>;
                const normalizedOrgs = orgData.map((org) => ({ id: Number(org.id), name: org.name }));
                setOrganizations(normalizedOrgs);

                if (!normalizedOrgs.length) {
                    return;
                }

                const cohortResponses = await Promise.all(
                    normalizedOrgs.map(async (org) => {
                        const response = await fetch(`${backendBaseUrl}/insights/live/organizations/${org.id}/cohorts`);
                        if (!response.ok) {
                            return [] as CohortOption[];
                        }

                        const raw = (await response.json()) as Array<{ id: number; name: string }>;
                        return raw.map((cohort) => ({
                            id: Number(cohort.id),
                            name: cohort.name,
                            org_id: org.id,
                        }));
                    }),
                );

                const mergedCohorts = cohortResponses.flat();
                setCohorts(mergedCohorts);

                if (!selectedOrgId) {
                    setSelectedOrgId(String(normalizedOrgs[0].id));
                }

                if (!selectedCohortId && mergedCohorts.length) {
                    setSelectedCohortId(String(mergedCohorts[0].id));
                }
            } catch (sourceError) {
                const message = sourceError instanceof Error ? sourceError.message : "Unable to load live sources";
                setError(message);
            } finally {
                setIsLoadingLiveSources(false);
            }
        };

        void loadLiveSources();
    }, [authLoading, isAuthenticated, user?.id, selectedOrgId, selectedCohortId]);

    useEffect(() => {
        if (!selectedOrgId) {
            return;
        }

        const cohortsForOrg = cohorts.filter((cohort) => String(cohort.org_id) === selectedOrgId);
        if (!cohortsForOrg.length) {
            setSelectedCohortId("");
            setCoursesForCohort([]);
            setSelectedCourseId("");
            return;
        }

        if (!cohortsForOrg.some((cohort) => String(cohort.id) === selectedCohortId)) {
            setSelectedCohortId(String(cohortsForOrg[0].id));
        }
    }, [selectedOrgId, cohorts, selectedCohortId]);

    useEffect(() => {
        if (!selectedCohortId) {
            setCoursesForCohort([]);
            setSelectedCourseId("");
            return;
        }

        const loadCohortCourses = async () => {
            try {
                const response = await fetch(`${backendBaseUrl}/insights/live/cohorts/${selectedCohortId}/courses`);
                if (!response.ok) {
                    setCoursesForCohort([]);
                    setSelectedCourseId("");
                    return;
                }

                const cohortCourses = (await response.json()) as Array<{ id: number; name: string }>;
                const normalizedCourses = cohortCourses.map((course) => ({
                    id: Number(course.id),
                    name: course.name,
                }));

                setCoursesForCohort(normalizedCourses);

                if (!normalizedCourses.length) {
                    setSelectedCourseId("");
                    return;
                }

                if (!selectedCourseId || !normalizedCourses.some((course) => String(course.id) === selectedCourseId)) {
                    setSelectedCourseId(String(normalizedCourses[0].id));
                }
            } catch {
                setCoursesForCohort([]);
                setSelectedCourseId("");
            }
        };

        void loadCohortCourses();
    }, [selectedCohortId, selectedCourseId]);

    useEffect(() => {
        if (hasTriedAutoLiveLoad) {
            return;
        }

        if (selectedCohortId) {
            setHasTriedAutoLiveLoad(true);
            void runLiveAnalysis(selectedCohortId, selectedCourseId || undefined);
            return;
        }

        if (!isLoadingLiveSources) {
            setHasTriedAutoLiveLoad(true);
            void loadSample();
        }
    }, [hasTriedAutoLiveLoad, selectedCohortId, selectedCourseId, runLiveAnalysis, isLoadingLiveSources, loadSample]);

    const filteredInsights = useMemo(() => {
        if (!analysis) {
            return [] as PersonaInsight[];
        }

        return selectedPersona === "all"
            ? analysis.insights
            : analysis.insights.filter((insight) => insight.persona === selectedPersona);
    }, [analysis, selectedPersona]);

    const insightCounts = useMemo(() => {
        if (!analysis) {
            return { mentor: 0, creator: 0, operator: 0 };
        }

        return analysis.insights.reduce(
            (accumulator, insight) => {
                accumulator[insight.persona] += 1;
                return accumulator;
            },
            { mentor: 0, creator: 0, operator: 0 },
        );
    }, [analysis]);

    const autoTriggers = analysis?.insights.filter((insight) => insight.auto_trigger).length ?? 0;
    const acknowledgedCount = Object.values(acknowledged).filter(Boolean).length;

    const handleAnalyzeClick = useCallback(() => {
        void runAnalysis();
    }, [runAnalysis]);

    const handleLoadDemoClick = useCallback(() => {
        setDraft(JSON.stringify(demoWorkspace, null, 2));
        void runAnalysis(demoWorkspace);
    }, [runAnalysis]);

    const handleLoadBackendSampleClick = useCallback(async () => {
        setIsLoadingSample(true);
        setError(null);

        try {
            const response = await fetch(`${backendBaseUrl}/insights/sample`);
            if (!response.ok) {
                throw new Error(`Sample request failed with status ${response.status}`);
            }

            const payload = (await response.json()) as InsightWorkspaceRequest;
            setDraft(JSON.stringify(payload, null, 2));
            await runAnalysis(payload);
        } catch (sampleError) {
            const message = sampleError instanceof Error ? sampleError.message : "Unable to load backend sample";
            setError(message);
        } finally {
            setIsLoadingSample(false);
        }
    }, [runAnalysis]);

    const handleAnalyzeLiveCohort = useCallback(async () => {
        if (!selectedCohortId) {
            setError("Select a cohort to run live analysis.");
            return;
        }

        await runLiveAnalysis(selectedCohortId, selectedCourseId || undefined);
    }, [selectedCohortId, selectedCourseId, runLiveAnalysis]);

    const handleCopyJson = useCallback(async () => {
        if (!analysis) {
            return;
        }

        await navigator.clipboard.writeText(JSON.stringify(analysis.export_json, null, 2));
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 1600);
    }, [analysis]);

    const toggleAcknowledged = useCallback((insightKey: string) => {
        setAcknowledged((current) => ({
            ...current,
            [insightKey]: !current[insightKey],
        }));
    }, []);

    return (
        <div className="min-h-screen bg-[#050816] text-white">
            <style jsx global>{`
        body {
          background: #050816;
        }
      `}</style>

            <Header showCreateCourseButton={false} showTryDemoButton={false} />

            <main className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
                <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur xl:p-8">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_35%)]" />
                    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                                <Sparkles className="h-4 w-4" />
                                Mentor, creator, and operator signals in one place
                            </div>
                            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                                Turn learner data into prioritized actions for every persona.
                            </h1>
                            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                                This workspace separates individual struggles from systemic issues, ranks what matters now,
                                and packages the next best action for mentors, course creators, and program operators.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            {([
                                { label: "Mentor focus", value: `${insightCounts.mentor} insights`, icon: Users },
                                { label: "Creator focus", value: `${insightCounts.creator} insights`, icon: Layers3 },
                                { label: "Operator focus", value: `${insightCounts.operator} insights`, icon: BarChart3 },
                            ] as const).map((card) => (
                                <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
                                    <div className="flex items-center justify-between text-sm text-slate-300">
                                        <span>{card.label}</span>
                                        <card.icon className="h-4 w-4 text-cyan-300" />
                                    </div>
                                    <div className="mt-3 text-2xl font-semibold text-white">{card.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-[1.02fr_1.38fr]">
                    <Card className="border-white/10 bg-slate-950/75 text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                        <CardHeader className="space-y-3 border-b border-white/10">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl text-white">Signal Builder</CardTitle>
                                    <CardDescription className="mt-1 max-w-xl text-slate-300">
                                        Edit the workspace payload, load a demo cohort, or fetch the backend sample and re-run analysis.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                                        onClick={handleLoadDemoClick}
                                        disabled={isAnalyzing || isLoadingSample}
                                    >
                                        Demo data
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                                        onClick={handleLoadBackendSampleClick}
                                        disabled={isAnalyzing || isLoadingSample}
                                    >
                                        <RefreshCcw className={`mr-2 h-4 w-4 ${isLoadingSample ? "animate-spin" : ""}`} />
                                        Sample
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="rounded-2xl border border-white/10 bg-[#07101d] p-4">
                                <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                                    <span>Workspace JSON</span>
                                    <span>{analysis?.workspace_name || "Unsaved workspace"}</span>
                                </div>
                                <textarea
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    className="min-h-[420px] w-full rounded-xl border border-white/10 bg-slate-950/80 p-4 font-mono text-[13px] leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/40"
                                    spellCheck={false}
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    onClick={handleAnalyzeClick}
                                    className="h-11 rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                                    disabled={isAnalyzing}
                                >
                                    {isAnalyzing ? "Analyzing..." : "Generate intelligence"}
                                </Button>
                                <div className="flex items-center justify-end gap-2 text-sm text-slate-300">
                                    <ShieldAlert className="h-4 w-4 text-amber-300" />
                                    High-priority items are marked for potential auto-triggering.
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-[#07101d] p-4">
                                <div className="mb-3 text-sm text-slate-300">Analyze live cohort data</div>
                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                                    <select
                                        value={selectedOrgId}
                                        onChange={(event) => setSelectedOrgId(event.target.value)}
                                        className="h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                                        disabled={isLoadingLiveSources || organizations.length === 0}
                                    >
                                        <option value="">Select organization</option>
                                        {organizations.map((org) => (
                                            <option key={org.id} value={String(org.id)}>
                                                {org.name}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedCohortId}
                                        onChange={(event) => setSelectedCohortId(event.target.value)}
                                        className="h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                                        disabled={isLoadingLiveSources || cohorts.length === 0}
                                    >
                                        <option value="">Select cohort</option>
                                        {cohorts
                                            .filter((cohort) => !selectedOrgId || String(cohort.org_id) === selectedOrgId)
                                            .map((cohort) => (
                                                <option key={cohort.id} value={String(cohort.id)}>
                                                    {cohort.name}
                                                </option>
                                            ))}
                                    </select>
                                    <select
                                        value={selectedCourseId}
                                        onChange={(event) => setSelectedCourseId(event.target.value)}
                                        className="h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                                        disabled={!selectedCohortId || coursesForCohort.length === 0}
                                    >
                                        <option value="">All courses</option>
                                        {coursesForCohort.map((course) => (
                                            <option key={course.id} value={String(course.id)}>
                                                {course.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        type="button"
                                        onClick={handleAnalyzeLiveCohort}
                                        className="h-11 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
                                        disabled={isAnalyzing || !selectedCohortId}
                                    >
                                        Run live
                                    </Button>
                                </div>
                                <p className="mt-3 text-xs text-slate-400">
                                    {isLoadingLiveSources
                                        ? "Loading organizations and cohorts from database..."
                                        : "Selections above are loaded from live DB-backed APIs."}
                                </p>
                            </div>

                            <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <summary className="cursor-pointer text-sm font-medium text-white">What the engine looks for</summary>
                                <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                                    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                                        Learner retries, low scores, and inactivity
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                                        Module failure rates, error patterns, and content gaps
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                                        Cohort engagement drops and attendance decline
                                    </div>
                                </div>
                            </details>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-slate-950/75 text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                        <CardHeader className="space-y-4 border-b border-white/10">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl text-white">Action Center</CardTitle>
                                    <CardDescription className="mt-1 max-w-xl text-slate-300">
                                        Persona-specific insight cards ranked by priority, with clear recommendations instead of raw observations.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
                                    {(["all", "mentor", "creator", "operator"] as PersonaFilter[]).map((persona) => (
                                        <button
                                            key={persona}
                                            type="button"
                                            onClick={() => setSelectedPersona(persona)}
                                            className={`rounded-full px-4 py-2 capitalize transition-colors ${selectedPersona === persona
                                                ? "bg-white text-slate-950"
                                                : "text-slate-300 hover:text-white"
                                                }`}
                                        >
                                            {persona}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {analysis && (
                                <div className="grid gap-3 sm:grid-cols-4">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Insights</div>
                                        <div className="mt-2 text-2xl font-semibold text-white">{analysis.insights.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Auto-trigger</div>
                                        <div className="mt-2 text-2xl font-semibold text-white">{autoTriggers}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Redundancy</div>
                                        <div className="mt-2 text-2xl font-semibold text-white">{Math.round((analysis.validation.redundancy_score || 0) * 100)}%</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Noise</div>
                                        <div className="mt-2 text-2xl font-semibold text-white">{Math.round((analysis.validation.noise_score || 0) * 100)}%</div>
                                    </div>
                                </div>
                            )}
                        </CardHeader>

                        <CardContent className="space-y-4 pt-6">
                            {error && (
                                <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                                    <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {analysis && (
                                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Summary</div>
                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-200">{analysis.summary}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                                                onClick={handleCopyJson}
                                            >
                                                <Copy className="mr-2 h-4 w-4" />
                                                {copyState === "copied" ? "Copied" : "Copy JSON"}
                                            </Button>
                                            <Button
                                                type="button"
                                                className="rounded-full bg-white px-5 text-slate-950 hover:bg-slate-200"
                                                onClick={handleAnalyzeClick}
                                                disabled={isAnalyzing}
                                            >
                                                <BrainCircuit className="mr-2 h-4 w-4" />
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {analysis && analysis.validation.coverage_gaps.length > 0 && (
                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                                        <div className="flex items-center gap-2 font-medium">
                                            <TriangleAlert className="h-4 w-4" />
                                            Coverage gaps
                                        </div>
                                        <ul className="mt-3 list-disc space-y-2 pl-5 text-amber-50/90">
                                            {analysis.validation.coverage_gaps.map((gap) => (
                                                <li key={gap}>{gap}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {analysis && analysis.validation.notes.length > 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                        <div className="flex items-center gap-2 font-medium text-white">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                            Validation notes
                                        </div>
                                        <ul className="mt-3 list-disc space-y-2 pl-5">
                                            {analysis.validation.notes.map((note) => (
                                                <li key={note}>{note}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {analysis && filteredInsights.length > 0 ? (
                                    filteredInsights.map((insight) => {
                                        const insightKey = `${insight.persona}-${insight.title}`;
                                        const isAcknowledged = acknowledged[insightKey];
                                        const meta = personaMeta[insight.persona];

                                        return (
                                            <article
                                                key={insightKey}
                                                className={`rounded-3xl border p-5 transition-all ${isAcknowledged
                                                    ? "border-emerald-400/20 bg-emerald-400/10"
                                                    : "border-white/10 bg-white/5"
                                                    }`}
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`rounded-2xl bg-gradient-to-br ${meta.accent} p-3 text-white`}>
                                                            {meta.icon}
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                                                                    {meta.label}
                                                                </span>
                                                                <span className={`rounded-full border px-3 py-1 text-xs ${priorityStyles(insight.priority)}`}>
                                                                    {insight.priority} priority
                                                                </span>
                                                                {insight.auto_trigger && (
                                                                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                                                                        auto trigger suggested
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h3 className="mt-3 text-xl font-semibold text-white">{insight.title}</h3>
                                                            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{insight.summary}</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAcknowledged(insightKey)}
                                                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${isAcknowledged
                                                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                                                            : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                                                            }`}
                                                    >
                                                        {isAcknowledged ? "Acknowledged" : "Acknowledge"}
                                                    </button>
                                                </div>

                                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Evidence</div>
                                                        <ul className="mt-3 space-y-2 text-sm text-slate-200">
                                                            {insight.evidence.map((item) => (
                                                                <li key={item} className="flex gap-2">
                                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                                                                    <span>{item}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Recommended actions</div>
                                                        <div className="mt-3 space-y-3">
                                                            {insight.recommended_actions.map((action) => (
                                                                <div key={action.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="font-medium text-white">{action.label}</span>
                                                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityStyles(action.urgency)}`}>
                                                                            {action.urgency}
                                                                        </span>
                                                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                                                                            {scopeLabel(action.target_scope)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2 text-sm leading-6 text-slate-300">{action.rationale}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        Scope: {scopeLabel(insight.scope)}
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        Signal: {signalLabel(insight.signal_type)}
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        Confidence: {Math.round(insight.confidence * 100)}%
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                                        Acknowledged: {isAcknowledged ? "Yes" : "No"}
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
                                        No insights available for the selected persona.
                                    </div>
                                )}
                            </div>

                            {analysis && (
                                <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <summary className="cursor-pointer text-sm font-medium text-white">Raw export JSON</summary>
                                    <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950/80 p-4 text-[12px] leading-6 text-slate-200">
                                        {JSON.stringify(analysis.export_json, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="mt-8 grid gap-4 md:grid-cols-3">
                    {[
                        {
                            title: "Actionable",
                            description: "Every insight comes with a next action, not just a dashboard observation.",
                        },
                        {
                            title: "Prioritized",
                            description: "High-severity signals rise first, so teams know what to handle now.",
                        },
                        {
                            title: "Low-noise",
                            description: "Repeated and overlapping signals are collapsed before they reach the reviewer.",
                        },
                    ].map((card) => (
                        <Card key={card.title} className="border-white/10 bg-white/5 text-white">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 text-white">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                    <h3 className="font-medium">{card.title}</h3>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{card.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            </main>
        </div>
    );
}
