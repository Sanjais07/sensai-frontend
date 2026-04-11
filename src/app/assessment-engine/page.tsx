"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

const sectionCard = 'rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-[#222222] dark:bg-[#121212] dark:shadow-none'
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700 dark:text-gray-300'
const inputClass = 'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-[#333333] dark:bg-[#0f0f0f] dark:text-white dark:focus:border-[#555555]'

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

function parseSkillWeights(value: string): Record<string, number> | undefined {
    const pairs = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)

    if (pairs.length === 0) {
        return undefined
    }

    const parsed: Record<string, number> = {}
    pairs.forEach((pair) => {
        const [skill, rawWeight] = pair.split(':').map((p) => p.trim())
        if (!skill || !rawWeight) {
            return
        }
        const weight = Number(rawWeight)
        if (!Number.isNaN(weight) && weight > 0) {
            parsed[skill] = weight
        }
    })

    return Object.keys(parsed).length ? parsed : undefined
}

function normalizeDifficultyWeights(easy: number, medium: number, hard: number): Record<'easy' | 'medium' | 'hard', number> | undefined {
    const values = {
        easy: Math.max(0, easy),
        medium: Math.max(0, medium),
        hard: Math.max(0, hard),
    }
    const total = values.easy + values.medium + values.hard
    if (total <= 0) {
        return undefined
    }

    return {
        easy: Number((values.easy / total).toFixed(4)),
        medium: Number((values.medium / total).toFixed(4)),
        hard: Number((values.hard / total).toFixed(4)),
    }
}

function parseRoleSkillMap(value: string): Record<string, string[]> | undefined {
    if (!value.trim()) {
        return undefined
    }

    try {
        const parsed = JSON.parse(value) as Record<string, unknown>
        const out: Record<string, string[]> = {}
        Object.entries(parsed).forEach(([key, rawHints]) => {
            if (!Array.isArray(rawHints)) {
                return
            }
            const hints = rawHints.map((hint) => String(hint).trim()).filter(Boolean)
            if (hints.length > 0) {
                out[key] = hints
            }
        })
        return Object.keys(out).length ? out : undefined
    } catch {
        return undefined
    }
}

export default function AssessmentEnginePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [mode, setMode] = useState<AssessmentMode>('curriculum')
    const [isModeLocked, setIsModeLocked] = useState(false)
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
    const [skillWeightsText, setSkillWeightsText] = useState('')
    const [roleSkillMapText, setRoleSkillMapText] = useState('{\n  "sql": ["sql", "joins", "window function"],\n  "metrics": ["kpi", "retention", "funnel"]\n}')
    const [typeMcq, setTypeMcq] = useState(10)
    const [typeSaq, setTypeSaq] = useState(4)
    const [typeCaselet, setTypeCaselet] = useState(2)
    const [typeCoding, setTypeCoding] = useState(2)
    const [diffEasy, setDiffEasy] = useState(25)
    const [diffMedium, setDiffMedium] = useState(55)
    const [diffHard, setDiffHard] = useState(20)

    const [assessment, setAssessment] = useState<Assessment | null>(null)
    const [assessmentId, setAssessmentId] = useState<number | null>(null)
    const [courseId, setCourseId] = useState<number | null>(null)
    const [courseIds, setCourseIds] = useState<number[]>([])
    const [orgId, setOrgId] = useState<number | null>(null)
    const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null)
    const [reviewState, setReviewState] = useState<Record<string, PendingReviewState>>({})
    const [savePreview, setSavePreview] = useState<SavePreviewState | null>(null)
    const savePreviewResolverRef = useRef<((value: boolean) => void) | null>(null)
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

    useEffect(() => {
        const modeParam = searchParams.get('mode')
        const lockModeParam = searchParams.get('lockMode')
        const courseIdParam = searchParams.get('courseId')
        const courseIdsParam = searchParams.get('courseIds')
        const orgIdParam = searchParams.get('orgId')
        const courseNameParam = searchParams.get('courseName')
        const curriculumSkillsParam = searchParams.get('curriculumSkills')
        const modulesTextParam = searchParams.get('modulesText')
        const jdTitleParam = searchParams.get('jdTitle')
        const jdDescriptionParam = searchParams.get('jdDescription')
        const jdSkillsParam = searchParams.get('jdSkills')

        if (modeParam === 'curriculum' || modeParam === 'jd') {
            setMode(modeParam)
        }

        setIsModeLocked(lockModeParam === '1' || lockModeParam === 'true')

        if (courseIdParam) {
            const parsedCourseId = Number(courseIdParam)
            if (!Number.isNaN(parsedCourseId)) {
                setCourseId(parsedCourseId)
            }
        }

        if (courseIdsParam) {
            const parsedIds = courseIdsParam
                .split(',')
                .map((id) => Number(id.trim()))
                .filter((id) => !Number.isNaN(id) && id > 0)
            setCourseIds(Array.from(new Set(parsedIds)))
        }

        if (orgIdParam) {
            const parsedOrgId = Number(orgIdParam)
            if (!Number.isNaN(parsedOrgId) && parsedOrgId > 0) {
                setOrgId(parsedOrgId)
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

    const semanticRedundancySummary = useMemo(() => {
        const pairs = coverageReport?.redundancy?.semantic_duplicate_pairs ?? []
        if (pairs.length === 0) {
            return null
        }

        const averageScore = pairs.reduce((sum, pair) => sum + pair.semantic_score, 0) / pairs.length
        const highestScore = pairs.reduce((max, pair) => Math.max(max, pair.semantic_score), 0)

        return {
            averageScore,
            highestScore,
            count: pairs.length,
            pairs,
        }
    }, [coverageReport])

    const effectivenessSummary = useMemo(() => {
        const report = coverageReport?.effectiveness_report
        if (!report) {
            return null
        }

        const skillGapByLearner = Array.isArray(report.skill_gap_by_learner) ? report.skill_gap_by_learner : []
        const itemPassRates = Array.isArray(report.item_pass_rates) ? report.item_pass_rates : []
        const timeSpentPerItem = Array.isArray(report.time_spent_per_item) ? report.time_spent_per_item : []
        const discrimination = report.discrimination ?? {}
        const overDiscriminating = Array.isArray(discrimination.over_discriminating) ? discrimination.over_discriminating : []
        const underDiscriminating = Array.isArray(discrimination.under_discriminating) ? discrimination.under_discriminating : []

        return {
            summary: report.summary ?? {},
            skillGapByLearner,
            itemPassRates,
            timeSpentPerItem,
            overDiscriminating,
            underDiscriminating,
        }
    }, [coverageReport])

    const getMetricLabel = (entry: Record<string, unknown>, fallback: string) => {
        return String(
            entry.learner_name ??
            entry.candidate_name ??
            entry.person_name ??
            entry.user_name ??
            entry.skill ??
            entry.item_id ??
            fallback
        )
    }

    const getMetricValue = (entry: Record<string, unknown>, keys: string[]) => {
        for (const key of keys) {
            const value = entry[key]
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value
            }
        }
        return null
    }

    const starterKitConfig = useMemo(() => {
        const difficultyDistribution = normalizeDifficultyWeights(diffEasy, diffMedium, diffHard)
        const skillWeights = parseSkillWeights(skillWeightsText)
        const roleSkillMap = mode === 'jd' ? parseRoleSkillMap(roleSkillMapText) : undefined
        const typeDistribution = {
            mcq: Math.max(0, typeMcq),
            saq: Math.max(0, typeSaq),
            caselet: Math.max(0, typeCaselet),
            coding: Math.max(0, typeCoding),
        }

        return {
            difficulty_distribution: difficultyDistribution,
            skill_weights: skillWeights,
            role_skill_map: roleSkillMap,
            type_distribution: typeDistribution,
        }
    }, [diffEasy, diffHard, diffMedium, mode, roleSkillMapText, skillWeightsText, typeCaselet, typeCoding, typeMcq, typeSaq])

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
            type_distribution: starterKitConfig.type_distribution,
            difficulty_distribution: starterKitConfig.difficulty_distribution,
            skill_weights: starterKitConfig.skill_weights,
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
            type_distribution: starterKitConfig.type_distribution,
            difficulty_distribution: starterKitConfig.difficulty_distribution,
            skill_weights: starterKitConfig.skill_weights,
            role_skill_map: starterKitConfig.role_skill_map,
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
                    const saveResponse = await saveReview(
                        assessmentId,
                        userId,
                        actions,
                        response.coverage_report,
                        courseId ?? undefined,
                        courseIds.length > 0 ? courseIds : undefined
                    )
                    setError(null) // Clear any previous errors

                    const addedCount = saveResponse.created_task_ids?.length || 0
                    const suffix = addedCount > 0 ? ` (${addedCount} course${addedCount > 1 ? 's' : ''})` : ''
                    setSaveSuccessMessage(`Successfully questions added to the courses${suffix}. Redirecting...`)
                    const redirectOrgId = orgId || parseInt(localStorage.getItem('orgId') || '0', 10)
                    if (redirectOrgId > 0) {
                        window.setTimeout(() => {
                            router.push(`/school/admin/${redirectOrgId}#courses`)
                        }, 1200)
                    }
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
        <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-[#0A0A0A] dark:text-white md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className={sectionCard}>
                    <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Assessment Intelligence Engine</h1>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-gray-400">
                        Generate, validate, and review assessments for both trainer and recruiter workflows.
                    </p>
                </section>

                <section className={`${sectionCard} space-y-4`}>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className={labelClass}>Mode</label>
                            <select
                                className={inputClass}
                                value={mode}
                                onChange={(e) => setMode(e.target.value as AssessmentMode)}
                                disabled={isModeLocked}
                            >
                                {isModeLocked ? (
                                    mode === 'curriculum' ? (
                                        <option value="curriculum">Mode A: Curriculum</option>
                                    ) : (
                                        <option value="jd">Mode B: Job Description</option>
                                    )
                                ) : (
                                    <>
                                        <option value="curriculum">Mode A: Curriculum</option>
                                        <option value="jd">Mode B: Job Description</option>
                                    </>
                                )}
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
                                className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                                onClick={handleGenerate}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Working...' : 'Generate assessment'}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:border-[#2A2A2A] dark:bg-[#171717] dark:text-gray-300">
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

                    <details className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-[#2A2A2A] dark:bg-[#171717]">
                        <summary className="cursor-pointer text-sm font-semibold text-neutral-800 dark:text-gray-100">
                            Starter Kit Management
                        </summary>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className={labelClass}>Question type template</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input className={inputClass} type="number" min={0} value={typeMcq} onChange={(e) => setTypeMcq(Number(e.target.value) || 0)} placeholder="MCQ" />
                                    <input className={inputClass} type="number" min={0} value={typeSaq} onChange={(e) => setTypeSaq(Number(e.target.value) || 0)} placeholder="SAQ" />
                                    <input className={inputClass} type="number" min={0} value={typeCaselet} onChange={(e) => setTypeCaselet(Number(e.target.value) || 0)} placeholder="Caselet" />
                                    <input className={inputClass} type="number" min={0} value={typeCoding} onChange={(e) => setTypeCoding(Number(e.target.value) || 0)} placeholder="Coding" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>Difficulty taxonomy (%)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input className={inputClass} type="number" min={0} value={diffEasy} onChange={(e) => setDiffEasy(Number(e.target.value) || 0)} placeholder="Easy" />
                                    <input className={inputClass} type="number" min={0} value={diffMedium} onChange={(e) => setDiffMedium(Number(e.target.value) || 0)} placeholder="Medium" />
                                    <input className={inputClass} type="number" min={0} value={diffHard} onChange={(e) => setDiffHard(Number(e.target.value) || 0)} placeholder="Hard" />
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-gray-400">Auto-normalized to a valid distribution.</p>
                            </div>

                            <div>
                                <label className={labelClass}>Skill weights (format: skill:weight, ...)</label>
                                <input
                                    className={inputClass}
                                    value={skillWeightsText}
                                    onChange={(e) => setSkillWeightsText(e.target.value)}
                                    placeholder="sql:0.4, metrics:0.3, product_thinking:0.3"
                                />
                            </div>

                            {mode === 'jd' && (
                                <div>
                                    <label className={labelClass}>Role-skill mapping (JSON)</label>
                                    <textarea
                                        className={`${inputClass} min-h-28 font-mono text-xs`}
                                        value={roleSkillMapText}
                                        onChange={(e) => setRoleSkillMapText(e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-neutral-600 dark:text-gray-400">
                                        Invalid JSON is ignored safely; defaults remain active.
                                    </p>
                                </div>
                            )}
                        </div>
                    </details>

                    {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
                </section>

                <section className={`${sectionCard} space-y-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Coverage & Validation Report</h2>
                        <button
                            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-[#333333] dark:text-gray-200 dark:hover:bg-[#1D1D1D]"
                            onClick={handleValidate}
                            disabled={!assessment || isLoading}
                        >
                            Re-validate
                        </button>
                    </div>

                    {!coverageReport ? (
                        <p className="text-sm text-neutral-600 dark:text-gray-400">Generate an assessment to see validation metrics.</p>
                    ) : (
                        <div className="space-y-3">
                            {effectivenessSummary && (
                                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#2A2A2A] dark:bg-[#171717]">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Assessment Effectiveness Dashboard</h3>
                                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800 dark:bg-[#2A2A2A] dark:text-gray-200">
                                            after attempts
                                        </span>
                                    </div>

                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Attempts</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {effectivenessSummary.summary.attempt_count ?? 'n/a'}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Learners / Candidates</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {(effectivenessSummary.summary.learner_count ?? effectivenessSummary.summary.candidate_count) ?? 'n/a'}
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Tracked items</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {effectivenessSummary.itemPassRates.length || effectivenessSummary.timeSpentPerItem.length || effectivenessSummary.skillGapByLearner.length || 'n/a'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-[#2A2A2A] dark:bg-[#0f0f0f]">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">Skill gap by learner/candidate</h4>
                                            <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-gray-300">
                                                {effectivenessSummary.skillGapByLearner.length > 0 ? (
                                                    effectivenessSummary.skillGapByLearner.slice(0, 5).map((entry, index) => {
                                                        const normalized = entry as Record<string, unknown>
                                                        const label = getMetricLabel(normalized, `Person ${index + 1}`)
                                                        const gap = getMetricValue(normalized, ['gap', 'skill_gap', 'score_gap'])

                                                        return (
                                                            <div key={`${label}-${index}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 dark:border-[#222222]">
                                                                <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
                                                                <span>{gap !== null ? `${(gap * 100).toFixed(1)}% gap` : 'n/a'}</span>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="text-sm text-neutral-500 dark:text-gray-400">No skill gap data available yet.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-[#2A2A2A] dark:bg-[#0f0f0f]">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">Item pass rates</h4>
                                            <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-gray-300">
                                                {effectivenessSummary.itemPassRates.length > 0 ? (
                                                    effectivenessSummary.itemPassRates.slice(0, 5).map((entry, index) => {
                                                        const normalized = entry as Record<string, unknown>
                                                        const label = getMetricLabel(normalized, `Item ${index + 1}`)
                                                        const rate = getMetricValue(normalized, ['pass_rate', 'passRate', 'rate'])

                                                        return (
                                                            <div key={`${label}-${index}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 dark:border-[#222222]">
                                                                <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
                                                                <span>{rate !== null ? `${(rate * 100).toFixed(1)}%` : 'n/a'}</span>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="text-sm text-neutral-500 dark:text-gray-400">No pass-rate data available yet.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-[#2A2A2A] dark:bg-[#0f0f0f]">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">Time spent per item</h4>
                                            <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-gray-300">
                                                {effectivenessSummary.timeSpentPerItem.length > 0 ? (
                                                    effectivenessSummary.timeSpentPerItem.slice(0, 5).map((entry, index) => {
                                                        const normalized = entry as Record<string, unknown>
                                                        const label = getMetricLabel(normalized, `Item ${index + 1}`)
                                                        const seconds = getMetricValue(normalized, ['avg_seconds', 'seconds', 'avg_time_spent'])

                                                        return (
                                                            <div key={`${label}-${index}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 dark:border-[#222222]">
                                                                <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
                                                                <span>{seconds !== null ? `${seconds.toFixed(1)}s` : 'n/a'}</span>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="text-sm text-neutral-500 dark:text-gray-400">No time-spent data available yet.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-[#2A2A2A] dark:bg-[#0f0f0f]">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">Over / under-discriminating questions</h4>
                                            <div className="mt-2 space-y-3 text-sm text-neutral-700 dark:text-gray-300">
                                                <div>
                                                    <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-gray-400">Over-discriminating</div>
                                                    {effectivenessSummary.overDiscriminating.length > 0 ? (
                                                        effectivenessSummary.overDiscriminating.slice(0, 3).map((entry, index) => {
                                                            const normalized = entry as Record<string, unknown>
                                                            const label = getMetricLabel(normalized, `Item ${index + 1}`)
                                                            const value = getMetricValue(normalized, ['index', 'discrimination_index', 'score'])
                                                            return (
                                                                <div key={`over-${label}-${index}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 dark:border-[#222222]">
                                                                    <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
                                                                    <span>{value !== null ? value.toFixed(2) : 'n/a'}</span>
                                                                </div>
                                                            )
                                                        })
                                                    ) : (
                                                        <p className="text-sm text-neutral-500 dark:text-gray-400">No over-discriminating items flagged.</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-gray-400">Under-discriminating</div>
                                                    {effectivenessSummary.underDiscriminating.length > 0 ? (
                                                        effectivenessSummary.underDiscriminating.slice(0, 3).map((entry, index) => {
                                                            const normalized = entry as Record<string, unknown>
                                                            const label = getMetricLabel(normalized, `Item ${index + 1}`)
                                                            const value = getMetricValue(normalized, ['index', 'discrimination_index', 'score'])
                                                            return (
                                                                <div key={`under-${label}-${index}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 dark:border-[#222222]">
                                                                    <span className="font-medium text-neutral-900 dark:text-white">{label}</span>
                                                                    <span>{value !== null ? value.toFixed(2) : 'n/a'}</span>
                                                                </div>
                                                            )
                                                        })
                                                    ) : (
                                                        <p className="text-sm text-neutral-500 dark:text-gray-400">No under-discriminating items flagged.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {semanticRedundancySummary && (
                                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#2A2A2A] dark:bg-[#171717]">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Semantic Redundancy Score</h3>
                                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800 dark:bg-[#2A2A2A] dark:text-gray-200">
                                            {semanticRedundancySummary.count} pair{semanticRedundancySummary.count > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Average score</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {(semanticRedundancySummary.averageScore * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Highest score</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {(semanticRedundancySummary.highestScore * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="rounded-md bg-white p-3 dark:bg-[#0f0f0f]">
                                            <div className="text-xs text-neutral-500 dark:text-gray-400">Flagged pairs</div>
                                            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                                                {semanticRedundancySummary.count}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-gray-300">
                                        {semanticRedundancySummary.pairs.slice(0, 5).map((pair) => (
                                            <div key={`${pair.pair[0]}-${pair.pair[1]}`} className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-[#2A2A2A] dark:bg-[#0f0f0f]">
                                                <span className="font-medium text-neutral-900 dark:text-white">
                                                    {pair.pair[0]} · {pair.pair[1]}
                                                </span>{' '}
                                                <span className="text-neutral-500 dark:text-gray-400">
                                                    semantic {(pair.semantic_score * 100).toFixed(1)}% · lexical {(pair.lexical_score * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <pre className="max-h-72 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100 dark:bg-[#0b0b0b]">
                                {JSON.stringify(coverageReport, null, 2)}
                            </pre>
                        </div>
                    )}
                </section>

                <section className={`${sectionCard} space-y-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Review Interface</h2>
                        <button
                            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                            onClick={handleApplyReview}
                            disabled={!assessment || isLoading}
                        >
                            Apply review decisions
                        </button>
                    </div>

                    {assessmentItems.length === 0 ? (
                        <p className="text-sm text-neutral-600 dark:text-gray-400">No questions yet. Generate an assessment first.</p>
                    ) : (
                        <div className="space-y-3">
                            {assessmentItems.map((item) => {
                                const state = reviewState[item.item_id] || {
                                    action: 'accept',
                                    editedStem: item.stem,
                                    rejectReason: '',
                                }

                                return (
                                    <article key={item.item_id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-[#2A2A2A] dark:bg-[#171717]">
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 font-semibold text-neutral-900 dark:bg-[#2A2A2A] dark:text-white">{item.item_id}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-900 dark:bg-[#2A2A2A] dark:text-gray-200">{item.type}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-900 dark:bg-[#2A2A2A] dark:text-gray-200">{item.difficulty}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-900 dark:bg-[#2A2A2A] dark:text-gray-200">status: {item.review_status}</span>
                                            <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-900 dark:bg-[#2A2A2A] dark:text-gray-200">skills: {item.skill_tags.join(', ')}</span>
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
                        <div className="flex h-[85vh] w-[95vw] max-w-6xl flex-col rounded-xl bg-white shadow-2xl dark:bg-[#121212]">
                            <div className="border-b border-neutral-200 px-6 py-4 dark:border-[#2A2A2A]">
                                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">Confirm Save To Database</h3>
                                <p className="mt-1 text-sm text-neutral-600 dark:text-gray-400">
                                    You are about to save {savePreview.count} questions to the assessment_reviews table.
                                </p>
                            </div>

                            <div className="flex-1 overflow-auto px-6 py-4">
                                <p className="mb-3 text-sm font-medium text-neutral-700 dark:text-gray-300">Questions to be saved:</p>
                                <ol className="space-y-2 text-sm text-neutral-800 dark:text-gray-200">
                                    {savePreview.questions.map((question, index) => (
                                        <li key={`${index}-${question.slice(0, 30)}`} className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-[#2A2A2A] dark:bg-[#171717]">
                                            {question}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-4 dark:border-[#2A2A2A]">
                                <button
                                    type="button"
                                    className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-[#333333] dark:text-gray-200 dark:hover:bg-[#1D1D1D]"
                                    onClick={() => closeSavePreview(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                                    onClick={() => closeSavePreview(true)}
                                >
                                    OK, Save to DB
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {saveSuccessMessage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-[#121212]">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">Saved</h3>
                            <p className="mt-2 text-sm text-neutral-700 dark:text-gray-300">{saveSuccessMessage}</p>
                            <div className="mt-5 flex justify-end">
                                <button
                                    type="button"
                                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                                    onClick={() => {
                                        const redirectOrgId = orgId || parseInt(localStorage.getItem('orgId') || '0', 10)
                                        if (redirectOrgId > 0) {
                                            router.push(`/school/admin/${redirectOrgId}#courses`)
                                        }
                                    }}
                                >
                                    Go to courses
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
