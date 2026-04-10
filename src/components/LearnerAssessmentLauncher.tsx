"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, FileText, Sparkles, Upload } from "lucide-react"

interface CourseLite {
    id: number
    name: string
}

interface LearnerAssessmentLauncherProps {
    courses: CourseLite[]
    orgId: number
}

export default function LearnerAssessmentLauncher({ courses, orgId }: LearnerAssessmentLauncherProps) {
    const router = useRouter()
    const [availableCourses, setAvailableCourses] = useState<CourseLite[]>(courses)
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(courses[0]?.id ?? null)
    const [jdTitle, setJdTitle] = useState("Product Analyst")
    const [jdText, setJdText] = useState("")
    const [jdFileName, setJdFileName] = useState("")
    const [extractedTopics, setExtractedTopics] = useState<string[]>([])
    const [isExtractingTopics, setIsExtractingTopics] = useState(false)
    const [isLaunchingJd, setIsLaunchingJd] = useState(false)
    const [jdError, setJdError] = useState<string | null>(null)

    const launchCurriculum = () => {
        if (!selectedCourseId) {
            return
        }

        const selectedCourse = availableCourses.find((course) => course.id === selectedCourseId)
        if (!selectedCourse) {
            return
        }

        const query = new URLSearchParams({
            mode: "curriculum",
            courseId: String(selectedCourse.id),
            orgId: String(orgId),
            courseName: selectedCourse.name,
            curriculumSkills: "Problem Solving, Conceptual Understanding",
            modulesText: `${selectedCourse.name}|Problem Solving;Conceptual Understanding`,
        })

        router.push(`/assessment-engine?${query.toString()}`)
    }

    const extractTopicsFromFile = async (file: File) => {
        const allowed = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]
        const lower = file.name.toLowerCase()
        const byExtension = lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx")

        if (!allowed.includes(file.type) && !byExtension) {
            setJdError("Please upload a PDF or Word file (.pdf, .doc, .docx).")
            return
        }

        setIsExtractingTopics(true)
        setJdError(null)
        setJdFileName(file.name)

        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("jd_title", jdTitle || "Role Assessment")

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/assessments/jd-topics`, {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                const message = await response.text()
                throw new Error(message || "Failed to extract JD topics")
            }

            const data = await response.json() as { topics?: string[]; extracted_text?: string }
            const topics = Array.isArray(data.topics) ? data.topics.slice(0, 1) : []

            setExtractedTopics(topics)
            setJdText(data.extracted_text || "")

            if (topics.length === 0) {
                setJdError("No clear topics were extracted from the uploaded JD.")
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to extract JD topics"
            setJdError(message)
        } finally {
            setIsExtractingTopics(false)
        }
    }

    const resolveOrCreateTopicCourses = async (): Promise<number[]> => {
        const topicCourseIds: number[] = []
        let localCourses = [...availableCourses]

        for (const topic of extractedTopics.slice(0, 1)) {
            const existing = localCourses.find(
                (course) => course.name.trim().toLowerCase() === topic.trim().toLowerCase()
            )

            if (existing) {
                topicCourseIds.push(existing.id)
                continue
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: topic,
                    org_id: Number(orgId),
                }),
            })

            if (!response.ok) {
                throw new Error(`Failed to create course for topic: ${topic}`)
            }

            const created = await response.json() as { id: number }
            const newCourse = {
                id: Number(created.id),
                name: topic,
            }
            localCourses = [...localCourses, newCourse]
            topicCourseIds.push(newCourse.id)
        }

        setAvailableCourses(localCourses)
        return Array.from(new Set(topicCourseIds))
    }

    const launchJd = async () => {
        if (extractedTopics.length === 0 || !jdText.trim()) {
            return
        }

        setIsLaunchingJd(true)
        setJdError(null)

        try {
            const topicCourseIds = await resolveOrCreateTopicCourses()

            if (topicCourseIds.length === 0) {
                throw new Error("Unable to map JD topics to courses")
            }

            const primaryTopic = extractedTopics[0] || jdTitle || "Role Assessment"
            const modulesText = extractedTopics
                .slice(0, 1)
                .map((topic) => `${topic}|Problem Solving;Conceptual Understanding`)
                .join("\n")

            const curriculumSkills = extractedTopics.join(", ")

        const query = new URLSearchParams({
                mode: "curriculum",
                courseId: String(topicCourseIds[0]),
                courseIds: topicCourseIds.join(","),
                orgId: String(orgId),
                courseName: primaryTopic,
                curriculumSkills,
                modulesText,
                jdTitle: jdTitle || "Role Assessment",
                jdDescription: jdText,
                jdSkills: extractedTopics.join(", "),
        })

            router.push(`/assessment-engine?${query.toString()}`)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to launch JD flow"
            setJdError(message)
        } finally {
            setIsLaunchingJd(false)
        }
    }

    return (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-medium text-black dark:text-white">Assessment Engine</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Launch assessments from existing courses or from a job description.
                    </p>
                </div>
                <Sparkles size={18} className="text-gray-500 dark:text-gray-400" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                        <FileText size={16} />
                        Curriculum based
                    </div>
                    <div className="space-y-2">
                        {availableCourses.length === 0 ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400">No courses available yet.</p>
                        ) : (
                            <>
                                <select
                                    value={selectedCourseId ?? ""}
                                    onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-[#0f0f0f]"
                                >
                                    {availableCourses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={launchCurriculum}
                                    disabled={!selectedCourseId}
                                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-xs font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-[#2a2a2a]"
                                >
                                    Generate from curriculum
                                    <ArrowRight size={12} />
                                </button>
                            </>
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
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm dark:border-gray-700">
                            <Upload size={14} />
                            <span>{jdFileName || "Upload JD (PDF or Word)"}</span>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    if (file) {
                                        void extractTopicsFromFile(file)
                                    }
                                }}
                            />
                        </label>
                        {isExtractingTopics && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">Extracting text and topics from JD file...</p>
                        )}
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            Extracted topics (max 1): {extractedTopics.length ? extractedTopics.join(", ") : "Upload a JD file to extract topics"}
                        </p>
                        {jdError && <p className="text-xs text-red-600 dark:text-red-400">{jdError}</p>}
                        <button
                            type="button"
                            onClick={() => {
                                void launchJd()
                            }}
                            disabled={!jdText.trim() || extractedTopics.length === 0 || isExtractingTopics || isLaunchingJd}
                            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
                        >
                            {isLaunchingJd ? "Preparing courses..." : "Generate questions"}
                            <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
