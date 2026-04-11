export type AssessmentMode = 'curriculum' | 'jd'
export type ReviewActionType = 'accept' | 'edit' | 'reject'

export interface CurriculumModuleInput {
    name: string
    skills: string[]
    learning_objectives: string[]
}

export interface CurriculumInput {
    course: string
    modules: CurriculumModuleInput[]
    skills: string[]
}

export interface JDInput {
    title: string
    description: string
    skills: string[]
}

export interface GenerateRequest {
    mode: AssessmentMode
    target_level: 'beginner' | 'intermediate' | 'advanced'
    curriculum?: CurriculumInput
    jd?: JDInput
    type_distribution?: Partial<Record<'mcq' | 'saq' | 'caselet' | 'coding', number>>
    difficulty_distribution?: Partial<Record<'easy' | 'medium' | 'hard', number>>
    skill_weights?: Record<string, number>
    role_skill_map?: Record<string, string[]>
}

export interface AssessmentItem {
    item_id: string
    type: 'mcq' | 'saq' | 'caselet' | 'coding'
    difficulty: 'easy' | 'medium' | 'hard'
    skill_tags: string[]
    stem: string
    review_status: 'pending' | 'accepted' | 'rejected' | 'edited'
    options?: string[]
    answer_key?: string
    rationale?: string
    answer_guidelines?: string[]
    rejection_reason?: string
}

export interface Assessment {
    mode: AssessmentMode
    title: string
    difficulty_distribution: Record<string, number>
    skill_targets: Record<string, number>
    type_distribution: Record<string, number>
    items: AssessmentItem[]
}

export interface CoverageReport {
    question_count: number
    skill_coverage?: {
        target_vs_achieved?: Record<string, { target: number; achieved: number; gap: number }>
        uncovered_skills?: string[]
    }
    difficulty_coverage?: {
        actual_distribution?: Record<string, number>
    }
    question_type_coverage?: Record<string, number>
    redundancy?: {
        duplicate_pair_count: number
        duplicate_pairs: Array<[string, string]>
        semantic_duplicate_pair_count?: number
        semantic_duplicate_pairs?: Array<{
            pair: [string, string]
            semantic_score: number
            lexical_score: number
        }>
    }
    review_summary?: {
        accepted: number
        rejected: number
        pending: number
    }
    effectiveness_report?: {
        summary?: {
            attempt_count?: number | null
            candidate_count?: number | null
            learner_count?: number | null
        }
        skill_gap_by_learner?: Array<Record<string, unknown>>
        item_pass_rates?: Array<Record<string, unknown>>
        time_spent_per_item?: Array<Record<string, unknown>>
        discrimination?: {
            over_discriminating?: Array<Record<string, unknown>>
            under_discriminating?: Array<Record<string, unknown>>
        }
    }
    error?: string
}

export interface GenerateResponse {
    assessment: Assessment
    coverage_report: CoverageReport
}

export interface ReviewAction {
    item_id: string
    action: ReviewActionType
    reason?: string
    edited_item?: Partial<AssessmentItem>
}

const getBackendUrl = (): string => {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL
    if (!url) {
        throw new Error('NEXT_PUBLIC_BACKEND_URL is not set')
    }
    return url
}

async function request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${getBackendUrl()}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Request failed with status ${response.status}`)
    }

    return (await response.json()) as T
}

export async function generateAssessment(payload: GenerateRequest): Promise<GenerateResponse> {
    return request<GenerateResponse>('/assessments/generate', payload)
}

export async function validateAssessment(assessment: Assessment): Promise<{ coverage_report: CoverageReport }> {
    return request<{ coverage_report: CoverageReport }>('/assessments/validate', { assessment })
}

export async function reviewAssessment(
    assessment: Assessment,
    actions: ReviewAction[]
): Promise<{ assessment: Assessment; coverage_report: CoverageReport }> {
    return request<{ assessment: Assessment; coverage_report: CoverageReport }>('/assessments/review', {
        assessment,
        actions,
    })
}

export async function saveAssessment(
    orgId: number,
    mode: AssessmentMode,
    title: string,
    assessmentJson: Assessment,
    cohortId?: number,
    userId?: number
): Promise<{ id: number; org_id: number; mode: AssessmentMode; title: string; created_at: string }> {
    return request<{ id: number; org_id: number; mode: AssessmentMode; title: string; created_at: string }>(
        '/assessments/save',
        {
            org_id: orgId,
            mode,
            title,
            assessment_json: assessmentJson,
            cohort_id: cohortId,
            user_id: userId,
        }
    )
}

export async function saveReview(
    assessmentId: number,
    userId: number,
    reviewActions: ReviewAction[],
    coverageReport: CoverageReport,
    courseId?: number,
    courseIds?: number[]
): Promise<{ review_id: number; assessment_id: number; created_task_ids?: number[]; message: string }> {
    return request<{ review_id: number; assessment_id: number; created_task_ids?: number[]; message: string }>(`/assessments/${assessmentId}/save-review`, {
        assessment_id: assessmentId,
        user_id: userId,
        review_actions: reviewActions,
        coverage_report: coverageReport,
        course_id: courseId,
        course_ids: courseIds,
    })
}

export async function getAssessment(assessmentId: number): Promise<{
    id: number
    org_id: number
    cohort_id?: number
    user_id?: number
    mode: AssessmentMode
    title: string
    assessment_json: Assessment
    created_at: string
    updated_at: string
}> {
    return request<{
        id: number
        org_id: number
        cohort_id?: number
        user_id?: number
        mode: AssessmentMode
        title: string
        assessment_json: Assessment
        created_at: string
        updated_at: string
    }>(`/assessments/${assessmentId}`, {})
}
