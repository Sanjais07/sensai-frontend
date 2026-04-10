"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Assessment,
    AssessmentItem,
    AssessmentMode,
    CoverageReport,
    ReviewAction,
    generateAssessment,
    reviewAssessment,
    validateAssessment,
    saveAssessment,
    saveReview,
} from '@/lib/assessmentApi'

const sectionCard = 'rounded-xl border border-neutral-200 bg-white p-4 shadow-sm'
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700'
const inputClass = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500'

interface PendingReviewState {
    action: 'accept' | 'edit' | 'reject'
    editedStem: string
    rejectReason: string
}

interface SavePreviewState {
    count: number
    questions: string[]
}

function parseCSV(value: string): string[] {
    return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
}

export default function AssessmentEnginePage() {
    const searchParams = useSearchParams()
    const [mode, setMode] = useState<AssessmentMode>('curriculum')
    const [targetLevel, setTargetLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [courseName, setCourseName] = useState('Data Structures')
    const [curriculumSkills, setCurriculumSkills] = useState('Problem Solving, Complexity Analysis, Conceptual Understanding')
    const [modulesText, setModulesText] = useState(
        'Arrays|Problem Solving;Complexity Analysis\nLinked Lists|Problem Solving\nTrees|Recursion;Complexity Analysis'
    )

    const [jdTitle, setJdTitle] = useState('Product Analyst')
    const [jdDescription, setJdDescription] = useState('Looking for SQL, metrics design, and product thinking to drive experiments.')
    const [jdSkills, setJdSkills] = useState('SQL, Metrics, Product Thinking')

    const [assessment, setAssessment] = useState<Assessment | null>(null)
    const [assessmentId, setAssessmentId] = useState<number | null>(null)
    const [courseId, setCourseId] = useState<number | null>(null)
    const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null)
    const [reviewState, setReviewState] = useState<Record<string, PendingReviewState>>({})
    const [savePreview, setSavePreview] = useState<SavePreviewState | null>(null)
    const savePreviewResolverRef = useRef<((value: boolean) => void) | null>(null)

    useEffect(() => {
        const modeParam = searchParams.get('mode')
        const courseIdParam = searchParams.get('courseId')
        const courseNameParam = searchParams.get('courseName')
        const curriculumSkillsParam = searchParams.get('curriculumSkills')
        const modulesTextParam = searchParams.get('modulesText')
        const jdTitleParam = searchParams.get('jdTitle')
        const jdDescriptionParam = searchParams.get('jdDescription')
        const jdSkillsParam = searchParams.get('jdSkills')

        if (modeParam === 'curriculum' || modeParam === 'jd') {
            setMode(modeParam)
        }

        if (courseIdParam) {
            const parsedCourseId = Number(courseIdParam)
            if (!Number.isNaN(parsedCourseId)) {
                setCourseId(parsedCourseId)
            }
        }

        if (courseNameParam) {
            setCourseName(courseNameParam)
        }

        if (curriculumSkillsParam) {
            setCurriculumSkills(curriculumSkillsParam)
        }

        if (modulesTextParam) {
            setModulesText(modulesTextParam)
        }

        if (jdTitleParam) {
            setJdTitle(jdTitleParam)
        }

        if (jdDescriptionParam) {
            setJdDescription(jdDescriptionParam)
        }

        if (jdSkillsParam) {
            setJdSkills(jdSkillsParam)
        }
    }, [searchParams])

    const assessmentItems = assessment?.items ?? []

    const modeTitle = useMemo(() => {
        return mode === 'curriculum'
            ? 'Mode A · Curriculum to Skill Validation'
            : 'Mode B · JD to Role-Aligned Hiring Assessment'
    }, [mode])

    const initializeReviewState = (items: AssessmentItem[]) => {
        const nextState: Record<string, PendingReviewState> = {}
        items.forEach((item) => {
            nextState[item.item_id] = {
                action: 'accept',
                editedStem: item.stem,
                rejectReason: '',
            }
        })
        setReviewState(nextState)
    }

    const buildCurriculumPayload = () => {
        const modules = modulesText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [namePart, skillsPart = ''] = line.split('|')
                const moduleSkills = skillsPart
                    .split(';')
                    .map((s) => s.trim())
                    .filter(Boolean)
                return {
                    name: (namePart || 'Module').trim(),
                    skills: moduleSkills,
                    learning_objectives: moduleSkills.map((skill) => `Apply ${skill} to realistic problems`),
                }
            })

        return {
            mode: 'curriculum' as const,
            target_level: targetLevel,
            curriculum: {
                course: courseName,
                modules,
                skills: parseCSV(curriculumSkills),
            },
        }
    }

    const buildJdPayload = () => {
        return {
            mode: 'jd' as const,
            target_level: targetLevel,
            jd: {
                title: jdTitle,
                description: jdDescription,
                skills: parseCSV(jdSkills),
            },
        }
    }

    const handleGenerate = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const payload = mode === 'curriculum' ? buildCurriculumPayload() : buildJdPayload()
            const response = await generateAssessment(payload)
            setAssessment(response.assessment)
            setCoverageReport(response.coverage_report)
            initializeReviewState(response.assessment.items)

            // Save assessment to database
            try {
                const title = mode === 'curriculum' ? courseName : jdTitle
                // Get org_id from localStorage or use a default for now
                const orgId = parseInt(localStorage.getItem('orgId') || '1', 10)
                const saveResponse = await saveAssessment(
                    orgId,
                    mode,
                    title,
                    response.assessment
                )
                setAssessmentId(saveResponse.id)
            } catch (saveErr) {
                console.warn('Failed to save assessment to database:', saveErr)
                // Continue even if save fails - the assessment is still usable in memory
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate assessment')
        } finally {
            setIsLoading(false)
        }
    }

    const handleValidate = async () => {
        if (!assessment) {
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await validateAssessment(assessment)
            setCoverageReport(response.coverage_report)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to validate assessment')
        } finally {
            setIsLoading(false)
        }
    }

    const requestSaveConfirmation = (questions: string[]) => {
        return new Promise<boolean>((resolve) => {
            savePreviewResolverRef.current = resolve
            setSavePreview({
                count: questions.length,
                questions,
            })
        })
    }

    const closeSavePreview = (shouldProceed: boolean) => {
        setSavePreview(null)
        if (savePreviewResolverRef.current) {
            savePreviewResolverRef.current(shouldProceed)
            savePreviewResolverRef.current = null
        }
    }

    const handleApplyReview = async () => {
        if (!assessment) {
            return
        }

        const missingRejectReasonItem = Object.entries(reviewState).find(
            ([, state]) => state.action === 'reject' && !state.rejectReason.trim()
        )

        if (missingRejectReasonItem) {
            setError(`Provide a reject reason for ${missingRejectReasonItem[0]} before applying decisions`)
            return
        }

        const actions: ReviewAction[] = Object.entries(reviewState).map(([itemId, state]) => {
            if (state.action === 'accept') {
                return {
                    item_id: itemId,
                    action: 'accept',
                }
            }

            if (state.action === 'reject') {
                return {
                    item_id: itemId,
                    action: 'reject',
                    reason: state.rejectReason || 'Rejected by reviewer',
                }
            }

            return {
                item_id: itemId,
                action: 'edit',
                edited_item: {
                    stem: state.editedStem,
                },
            }
        })

        const itemById = new Map(assessment.items.map((item) => [item.item_id, item]))
        const questionsPreview = actions
            .map((action, index) => {
                const original = itemById.get(action.item_id)
                const stem = action.action === 'edit'
                    ? action.edited_item?.stem || original?.stem || ''
                    : original?.stem || ''

                return `${index + 1}. ${action.item_id}: ${stem}`
            })
        const shouldProceed = await requestSaveConfirmation(questionsPreview)

        if (!shouldProceed) {
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await reviewAssessment(assessment, actions)
            setAssessment(response.assessment)
            setCoverageReport(response.coverage_report)
            initializeReviewState(response.assessment.items)

            // Save review to database if assessment was previously saved
            if (assessmentId) {
                try {
                    const userId = parseInt(localStorage.getItem('userId') || '1', 10)
                    await saveReview(
                        assessmentId,
                        userId,
                        actions,
                        response.coverage_report,
                        courseId ?? undefined
                    )
                    setError(null) // Clear any previous errors
                } catch (reviewSaveErr) {
                    console.warn('Failed to save review to database:', reviewSaveErr)
                    // Continue even if save fails - the review is still applied in memory
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply review changes')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className={sectionCard}>
                    <h1 className="text-2xl font-semibold">Assessment Intelligence Engine</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Generate, validate, and review assessments for both trainer and recruiter workflows.
                    </p>
                </section>

                <section className={`${sectionCard} space-y-4`}>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className={labelClass}>Mode</label>
                            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as AssessmentMode)}>
                                <option value="curriculum">Mode A: Curriculum</option>
                                <option value="jd">Mode B: Job Description</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Target level</label>
                            <select
                                className={inputClass}
                                value={targetLevel}
                                onChange={(e) => setTargetLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                                onClick={handleGenerate}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Working...' : 'Generate assessment'}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                        {modeTitle}
                    </div>

                    {mode === 'curriculum' ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>Course name</label>
                                <input className={inputClass} value={courseName} onChange={(e) => setCourseName(e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Global skills (comma separated)</label>
                                <input className={inputClass} value={curriculumSkills} onChange={(e) => setCurriculumSkills(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Modules (one per line, format: Module Name|Skill1;Skill2)</label>
                                <textarea className={`${inputClass} min-h-28`} value={modulesText} onChange={(e) => setModulesText(e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>JD title</label>
                                <input className={inputClass} value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>JD skills (comma separated)</label>
                                <input className={inputClass} value={jdSkills} onChange={(e) => setJdSkills(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>JD description</label>
                                <textarea
                                    className={`${inputClass} min-h-28`}
                                    value={jdDescription}
                                    onChange={(e) => setJdDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                </section>

                <section className={`${sectionCard} space-y-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Coverage & Validation Report</h2>
                        <button
                            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                            onClick={handleValidate}
                            disabled={!assessment || isLoading}
                        >
                            Re-validate
                        </button>
                    </div>

                    {!coverageReport ? (
                        <p className="text-sm text-neutral-600">Generate an assessment to see validation metrics.</p>
                    ) : (
                        <pre className="max-h-72 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
                            {JSON.stringify(coverageReport, null, 2)}
                        </pre>
                    )}
                </section>

                <section className={`${sectionCard} space-y-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Review Interface</h2>
                        <button
                            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                            onClick={handleApplyReview}
                            disabled={!assessment || isLoading}
                        >
                            Apply review decisions
                        </button>
                    </div>

                    {assessmentItems.length === 0 ? (
                        <p className="text-sm text-neutral-600">No questions yet. Generate an assessment first.</p>
                    ) : (
                        <div className="space-y-3">
                            {assessmentItems.map((item) => {
                                const state = reviewState[item.item_id] || {
                                    action: 'accept',
                                    editedStem: item.stem,
                                    rejectReason: '',
                                }

                                return (
                                    <article key={item.item_id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 font-semibold">{item.item_id}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5">{item.type}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5">{item.difficulty}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5">status: {item.review_status}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5">skills: {item.skill_tags.join(', ')}</span>
                                        </div>

                                        <label className={labelClass}>Question stem</label>
                                        <textarea
                                            className={`${inputClass} min-h-20`}
                                            value={state.editedStem}
                                            onChange={(e) => {
                                                setReviewState((prev) => ({
                                                    ...prev,
                                                    [item.item_id]: {
                                                        ...state,
                                                        editedStem: e.target.value,
                                                    },
                                                }))
                                            }}
                                        />

                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                            <div>
                                                <label className={labelClass}>Action</label>
                                                <select
                                                    className={inputClass}
                                                    value={state.action}
                                                    onChange={(e) => {
                                                        setReviewState((prev) => ({
                                                            ...prev,
                                                            [item.item_id]: {
                                                                ...state,
                                                                action: e.target.value as PendingReviewState['action'],
                                                            },
                                                        }))
                                                    }}
                                                >
                                                    <option value="accept">Accept</option>
                                                    <option value="edit">Edit</option>
                                                    <option value="reject">Reject</option>
                                                </select>
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className={labelClass}>Reject reason (used when action is reject)</label>
                                                <input
                                                    className={inputClass}
                                                    value={state.rejectReason}
                                                    onChange={(e) => {
                                                        setReviewState((prev) => ({
                                                            ...prev,
                                                            [item.item_id]: {
                                                                ...state,
                                                                rejectReason: e.target.value,
                                                            },
                                                        }))
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </section>

                {savePreview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="flex h-[85vh] w-[95vw] max-w-6xl flex-col rounded-xl bg-white shadow-2xl">
                            <div className="border-b border-neutral-200 px-6 py-4">
                                <h3 className="text-xl font-semibold text-neutral-900">Confirm Save To Database</h3>
                                <p className="mt-1 text-sm text-neutral-600">
                                    You are about to save {savePreview.count} questions to the assessment_reviews table.
                                </p>
                            </div>

                            <div className="flex-1 overflow-auto px-6 py-4">
                                <p className="mb-3 text-sm font-medium text-neutral-700">Questions to be saved:</p>
                                <ol className="space-y-2 text-sm text-neutral-800">
                                    {savePreview.questions.map((question, index) => (
                                        <li key={`${index}-${question.slice(0, 30)}`} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                                            {question}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-4">
                                <button
                                    type="button"
                                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                    onClick={() => closeSavePreview(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
                                    onClick={() => closeSavePreview(true)}
                                >
                                    OK, Save to DB
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
