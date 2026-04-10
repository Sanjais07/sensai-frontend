"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, FileText, Sparkles } from "lucide-react"

interface CourseLite {
    id: number
    name: string
}

interface LearnerAssessmentLauncherProps {
    courses: CourseLite[]
}

const SKILL_HINTS: Record<string, string[]> = {
    sql: ["sql", "query", "joins", "database", "etl", "window"],
    metrics: ["metric", "kpi", "retention", "funnel", "conversion", "a/b"],
    product_thinking: ["product", "roadmap", "prioritization", "tradeoff", "user journey"],
    python: ["python", "pandas", "numpy"],
    statistics: ["statistics", "hypothesis", "regression", "significance"],
    communication: ["communication", "stakeholder", "presentation", "storytelling"],
}

function extractJdTopics(text: string): string[] {
    const lower = text.toLowerCase()
    const topics: string[] = []

    for (const [skill, hints] of Object.entries(SKILL_HINTS)) {
        if (hints.some((hint) => lower.includes(hint))) {
            topics.push(skill.replace("_", " "))
        }
    }

    if (topics.length > 0) {
        return topics
    }

    const tokens = lower.match(/[a-z][a-z0-9+.#-]{2,}/g) || []
    const stopWords = new Set([
        "with",
        "and",
        "for",
        "the",
        "role",
        "team",
        "work",
        "from",
        "that",
        "this",
        "will",
        "you",
        "your",
        "our",
        "have",
        "has",
        "are",
        "into",
        "using",
        "ability",
        "experience",
    ])

    const unique = Array.from(new Set(tokens)).filter((token) => !stopWords.has(token))
    return unique.slice(0, 6)
}

export default function LearnerAssessmentLauncher({ courses }: LearnerAssessmentLauncherProps) {
    const router = useRouter()
    const [jdTitle, setJdTitle] = useState("Product Analyst")
    const [jdText, setJdText] = useState("")

    const extractedTopics = useMemo(() => extractJdTopics(jdText), [jdText])

    const launchCurriculum = (courseName: string) => {
        const query = new URLSearchParams({
            mode: "curriculum",
            courseName,
            curriculumSkills: "Problem Solving, Conceptual Understanding",
            modulesText: `${courseName}|Problem Solving;Conceptual Understanding`,
        })

        router.push(`/assessment-engine?${query.toString()}`)
    }

    const launchJd = () => {
        const query = new URLSearchParams({
            mode: "jd",
            jdTitle: jdTitle || "Role Assessment",
            jdDescription: jdText,
            jdSkills: extractedTopics.join(", "),
        })

        router.push(`/assessment-engine?${query.toString()}`)
    }

    return (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-medium text-black dark:text-white">Assessment Engine for Learners</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Launch assessments from enrolled cohort courses or from a job description.
                    </p>
                </div>
                <Sparkles size={18} className="text-gray-500 dark:text-gray-400" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                        <FileText size={16} />
                        Curriculum based (from enrolled courses)
                    </div>
                    <div className="space-y-2">
                        {courses.length === 0 ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400">No enrolled courses linked to this cohort yet.</p>
                        ) : (
                            courses.map((course) => (
                                <div
                                    key={course.id}
                                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-[#1e1e1e]"
                                >
                                    <span className="truncate pr-3">{course.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => launchCurriculum(course.name)}
                                        className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-[#2a2a2a]"
                                    >
                                        Use course
                                        <ArrowRight size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="mb-2 text-sm font-medium text-black dark:text-white">JD based (topic extraction)</div>
                    <div className="space-y-2">
                        <input
                            value={jdTitle}
                            onChange={(e) => setJdTitle(e.target.value)}
                            placeholder="Role title"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0f0f0f]"
                        />
                        <textarea
                            value={jdText}
                            onChange={(e) => setJdText(e.target.value)}
                            placeholder="Paste JD text here"
                            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0f0f0f]"
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            Extracted topics: {extractedTopics.length ? extractedTopics.join(", ") : "Add JD text to extract topics"}
                        </p>
                        <button
                            type="button"
                            onClick={launchJd}
                            disabled={!jdText.trim()}
                            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
                        >
                            Generate from JD topics
                            <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
