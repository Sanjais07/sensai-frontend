"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Edit, Save, Users, BookOpen, Layers, Building, ChevronDown, Trash2, ExternalLink, LayoutDashboard, Download, FileDown, Bell, TrendingUp, AlertTriangle, Trophy, Clock, CheckCircle2, Filter } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CourseCard from "@/components/CourseCard";
import CohortCard from "@/components/CohortCard";
import InviteMembersDialog from "@/components/InviteMembersDialog";
import CreateCohortDialog from "@/components/CreateCohortDialog";
import CreateCourseDialog from '@/components/CreateCourseDialog';
import Toast from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import LearnerAssessmentLauncher from "@/components/LearnerAssessmentLauncher";
import { Cohort, TeamMember, Course } from "@/types";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

interface School {
    id: number;
    name: string;
    url: string;
    courses: Course[];
    cohorts: Cohort[];
    members: TeamMember[];
}

type TabType = 'dashboard' | 'courses' | 'cohorts' | 'members';

function BenchmarkRow({
    label,
    current,
    previous,
    percent,
    higherIsBetter,
    lowerIsBetter,
}: {
    label: string;
    current: number;
    previous: number;
    percent?: boolean;
    higherIsBetter?: boolean;
    lowerIsBetter?: boolean;
}) {
    const delta = current - previous;
    const isPositive = higherIsBetter ? delta >= 0 : lowerIsBetter ? delta <= 0 : delta >= 0;
    const value = percent ? `${(current * 100).toFixed(1)}%` : `${Number(current).toFixed(1)}`;
    const deltaText = percent ? `${(delta * 100).toFixed(1)}%` : `${delta.toFixed(1)}`;

    return (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30 flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">{label}</span>
            <div className="text-right">
                <div className="font-medium text-black dark:text-white">{value}</div>
                <div className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {delta >= 0 ? '+' : ''}{deltaText} vs prev
                </div>
            </div>
        </div>
    );
}

export default function ClientSchoolAdminView({ id }: { id: string }) {
    const router = useRouter();
    const { data: session } = useSession();
    const [school, setSchool] = useState<School | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('courses');
    // Hook to apply theme class to HTML element
    useThemePreference();
    const [isEditingName, setIsEditingName] = useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isCreateCohortDialogOpen, setIsCreateCohortDialogOpen] = useState(false);
    const [isCreateCourseDialogOpen, setIsCreateCourseDialogOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
    const schoolNameRef = useRef<HTMLHeadingElement>(null);
    // Add state for selected members
    const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
    // Add state for toast notifications
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState({
        title: '',
        description: '',
        emoji: ''
    });
    const [dashboardRange, setDashboardRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [dashboardMode, setDashboardMode] = useState<'all' | 'curriculum' | 'jd'>('all');
    const [dashboardCourseFilter, setDashboardCourseFilter] = useState<string>('all');
    const [dashboardCohortFilter, setDashboardCohortFilter] = useState<string>('all');
    const [dashboardDifficulty, setDashboardDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [scheduledSummaryEnabled, setScheduledSummaryEnabled] = useState(false);
    const [drilldownKey, setDrilldownKey] = useState<'attempts' | 'completion' | 'score' | 'time' | null>(null);

    // Add useEffect to automatically hide toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);

            // Cleanup the timer when component unmounts or showToast changes
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Initialize tab from URL hash
    useEffect(() => {
        // Check if there's a hash in the URL
        const hash = window.location.hash.replace('#', '');
        if (hash === 'dashboard' || hash === 'courses' || hash === 'cohorts' || hash === 'members') {
            setActiveTab(hash as TabType);
        }
    }, []);

    // Fetch school data
    useEffect(() => {
        const fetchSchool = async () => {
            setLoading(true);
            try {
                // Fetch basic school info
                const schoolResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}`);
                if (!schoolResponse.ok) {
                    throw new Error(`API error: ${schoolResponse.status}`);
                }
                const schoolData = await schoolResponse.json();

                // Fetch members separately
                const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
                if (!membersResponse.ok) {
                    throw new Error(`API error: ${membersResponse.status}`);
                }
                const membersData = await membersResponse.json();

                // Fetch cohorts separately
                const cohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`);
                if (!cohortsResponse.ok) {
                    throw new Error(`API error: ${cohortsResponse.status}`);
                }
                const cohortsData = await cohortsResponse.json();

                // Fetch courses separately
                const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`);
                if (!coursesResponse.ok) {
                    throw new Error(`API error: ${coursesResponse.status}`);
                }
                const coursesData = await coursesResponse.json();

                // Transform the API response to match the School interface
                const transformedSchool: School = {
                    id: parseInt(schoolData.id),
                    name: schoolData.name,
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolData.slug}`,
                    courses: coursesData.map((course: any) => ({
                        id: course.id,
                        name: course.name,
                        moduleCount: 0, // Default value since API doesn't provide this
                        description: '' // Default value since API doesn't provide this
                    })),
                    cohorts: cohortsData.map((cohort: any) => ({
                        id: cohort.id,
                        name: cohort.name,
                    })),
                    members: membersData || []  // Use the members from the separate endpoint
                };

                setSchool(transformedSchool);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching school:", error);
                setLoading(false);
            }
        };

        fetchSchool();
    }, [id, router]);

    // Keep browser tab title in sync with the current school name (admin side)
    useEffect(() => {
        if (!school?.name) return;
        document.title = `${school.name} · SensAI`;
    }, [school?.name]);

    // Handle clicking outside the name edit field
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isEditingName && schoolNameRef.current && !schoolNameRef.current.contains(event.target as Node)) {
                setIsEditingName(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isEditingName, schoolNameRef]);

    // Toggle name editing
    const toggleNameEdit = () => {
        setIsEditingName(!isEditingName);
        // Focus the name field when editing is enabled
        if (!isEditingName) {
            setTimeout(() => {
                if (schoolNameRef.current) {
                    schoolNameRef.current.focus();
                    // Place cursor at the end of the text
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(schoolNameRef.current);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }, 0);
        }
    };

    // Handle name blur
    const handleNameBlur = () => {
        setIsEditingName(false);
    };

    // Handle keyboard events for name editing
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsEditingName(false);
        }
    };

    const handleInviteMembers = async (emails: string[]) => {
        try {
            // Make API call to invite members
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ emails }),
            });

            if (!response.ok) {
                // Try to extract more detailed error message from response
                let errorText = 'Failed to invite members. Please try again.';
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        // Use the specific detail message from the API
                        errorText = errorData.detail;
                    } else if (errorData.message) {
                        errorText = errorData.message;
                    } else if (errorData.error) {
                        errorText = errorData.error;
                    }
                } catch (parseError) {
                    // If parsing JSON fails, use default error message
                    console.error('Could not parse error response:', parseError);
                }
                throw new Error(errorText);
            }

            // Refresh school data to get updated members list
            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) {
                throw new Error('Failed to fetch updated members');
            }
            const membersData = await membersResponse.json();

            // Update school state with new members
            setSchool(prev => prev ? {
                ...prev,
                members: membersData
            } : null);

            // Close the invite dialog
            setIsInviteDialogOpen(false);

            // Show toast notification
            setToastMessage({
                title: 'Growing the tribe',
                description: `${emails.length} ${emails.length === 1 ? 'member' : 'members'} has been invited to your team`,
                emoji: '🎉'
            });
            setShowToast(true);

        } catch (error) {
            console.error('Error inviting members:', error);

            // Show error toast
            let errorMessage = 'Failed to invite members. Please try again.';
            if (error instanceof Error && error.message && error.message !== 'Invalid JSON') {
                errorMessage = error.message;
            }
            setToastMessage({
                title: 'Could not invite members',
                description: errorMessage,
                emoji: '❌'
            });
            setShowToast(true);
        }
    };

    // Check if a member is the current user
    const isCurrentUser = (member: TeamMember) => {
        return session?.user?.id === member.id.toString();
    };

    const handleDeleteMember = (member: TeamMember) => {
        // Don't allow deleting yourself
        if (isCurrentUser(member)) return;

        setMemberToDelete(member);
        setSelectedMembers([]);
        setIsDeleteConfirmOpen(true);
    };

    // Handle multiple members deletion
    const handleDeleteSelectedMembers = () => {
        setMemberToDelete(null);
        setIsDeleteConfirmOpen(true);
    };

    // Updated to handle both single and multiple member deletion
    const confirmDeleteMember = async () => {
        const membersToDelete = memberToDelete ? [memberToDelete] : selectedMembers;
        if (membersToDelete.length === 0) return;

        try {
            // Make API call to delete member(s)
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: membersToDelete.map(member => member.id)
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete member(s)');
            }

            // Refresh school data to get updated members list
            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) {
                throw new Error('Failed to fetch updated members');
            }
            const membersData = await membersResponse.json();

            // Update school state with new members
            setSchool(prev => prev ? {
                ...prev,
                members: membersData
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'The tribe has shrunk!',
                description: membersToDelete.length === 1
                    ? `${membersToDelete[0].email} has been removed from your team`
                    : `${membersToDelete.length} members have been removed from your team`,
                emoji: '😢'
            });
            setShowToast(true);

        } catch (error) {
            console.error('Error deleting member(s):', error);
            // Here you would typically show an error message to the user
        } finally {
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
            setSelectedMembers([]);
        }
    };

    // Handle member selection toggle
    const handleMemberSelection = (member: TeamMember) => {
        // Don't allow selecting yourself
        if (isCurrentUser(member)) return;

        setSelectedMembers(prevSelected => {
            // Check if this member is already selected
            const isSelected = prevSelected.some(m => m.id === member.id);

            // If selected, remove it; if not, add it
            return isSelected
                ? prevSelected.filter(m => m.id !== member.id)
                : [...prevSelected, member];
        });
    };

    // Handle "select all" functionality
    const handleSelectAllMembers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Filter out owner members and current user since they can't be deleted
            const selectableMembers = school?.members.filter(member =>
                member.role !== 'owner' && !isCurrentUser(member)
            ) || [];
            setSelectedMembers(selectableMembers);
        } else {
            setSelectedMembers([]);
        }
    };

    // Check if all selectable members are selected
    const areAllMembersSelected = () => {
        if (!school) return false;
        const selectableMembers = school.members.filter(member =>
            member.role !== 'owner' && !isCurrentUser(member)
        );
        return selectableMembers.length > 0 && selectedMembers.length === selectableMembers.length;
    };

    // Check if there are any members that can be selected/deleted
    const hasSelectableMembers = () => {
        if (!school) return false;
        return school.members.some(member =>
            member.role !== 'owner' && !isCurrentUser(member)
        );
    };

    const handleCreateCohort = async (cohort: any) => {
        try {
            // Important: Navigate before closing the dialog to prevent flash of school page
            // This navigation will unmount the current component, which implicitly closes the dialog
            if (cohort && cohort.id) {
                router.push(`/school/admin/${id}/cohorts/${cohort.id}`);
            } else {
                console.error("Cohort ID is missing in the response:", cohort);
                // Fallback to schools page if ID is missing and close dialog
                setIsCreateCohortDialogOpen(false);
                router.push(`/school/admin/${id}#cohorts`);
            }
        } catch (error) {
            console.error('Error handling cohort creation:', error);
            setIsCreateCohortDialogOpen(false);
        }
    };

    // Handle course creation success
    const handleCourseCreationSuccess = (courseData: { id: string; name: string }) => {
        // Redirect to the new course page - dialog will be unmounted during navigation
        router.push(`/school/admin/${id}/courses/${courseData.id}`);
    };

    // Handle tab change
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);

        // Keep courses as default hash-less tab for backward compatibility
        if (tab !== 'courses') {
            window.location.hash = tab;
        } else {
            // Remove hash if it's the courses tab
            if (window.location.hash && typeof window !== 'undefined' && window.history) {
                history.pushState(null, document.title, window.location.pathname);
            }
        }
    };

    const handleCohortDelete = async (cohortId: number) => {
        try {
            // Refresh school data to get updated cohorts list
            const cohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`);
            if (!cohortsResponse.ok) {
                throw new Error('Failed to fetch updated cohorts');
            }
            const cohortsData = await cohortsResponse.json();

            // Update school state with new cohorts
            setSchool(prev => prev ? {
                ...prev,
                cohorts: cohortsData
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'Cohort removed',
                description: `Cohort has been removed from your school`,
                emoji: '✓'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error refreshing cohorts list:', error);
            // Here you would typically show an error message to the user
        }
    };

    const handleCourseDelete = async (courseId: string | number) => {
        try {
            // Refresh school data to get updated courses list
            const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`);
            if (!coursesResponse.ok) {
                throw new Error('Failed to fetch updated courses');
            }
            const coursesData = await coursesResponse.json();

            // Update school state with new courses
            setSchool(prev => prev ? {
                ...prev,
                courses: coursesData.map((course: any) => ({
                    id: course.id,
                    name: course.name,
                }))
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'Course removed',
                description: `Course has been removed from your school`,
                emoji: '✓'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error refreshing courses list:', error);
            // Here you would typically show an error message to the user
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
                <Header
                    showCreateCourseButton={false}
                />
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 rounded-full animate-spin border-black dark:border-white"></div>
                </div>
            </div>
        );
    }

    if (!school) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white">
                <p>School not found</p>
            </div>
        );
    }

    const entityDistribution = [
        { label: 'Courses', value: school.courses.length, color: '#7c3aed' },
        { label: 'Cohorts', value: school.cohorts.length, color: '#06b6d4' },
        { label: 'Team', value: school.members.length, color: '#f59e0b' },
    ];
    const maxEntityValue = Math.max(...entityDistribution.map((item) => item.value), 1);
    const totalEntities = entityDistribution.reduce((sum, item) => sum + item.value, 0);
    const setupCompleteCount = [school.courses.length > 0, school.cohorts.length > 0, school.members.length > 0].filter(Boolean).length;
    const setupCompletionPercent = Math.round((setupCompleteCount / 3) * 100);
    const donutStyle = {
        background: `conic-gradient(#7c3aed 0deg ${setupCompletionPercent * 3.6}deg, #27272a ${setupCompletionPercent * 3.6}deg 360deg)`
    };
    const trendPoints = entityDistribution.map((item, index) => {
        const x = index * 100;
        const normalized = item.value / maxEntityValue;
        const y = 80 - normalized * 70;
        return `${x},${y}`;
    }).join(' ');

    const rangeFactor = dashboardRange === '7d' ? 0.7 : dashboardRange === '30d' ? 1 : 1.35;
    const modeFactor = dashboardMode === 'all' ? 1 : dashboardMode === 'curriculum' ? 0.95 : 0.9;
    const difficultyFactor = dashboardDifficulty === 'all' ? 1 : dashboardDifficulty === 'easy' ? 1.08 : dashboardDifficulty === 'medium' ? 1 : 0.9;
    const scopedFactor = rangeFactor * modeFactor * difficultyFactor;
    const selectedCourseCount = dashboardCourseFilter === 'all' ? school.courses.length : 1;
    const selectedCohortCount = dashboardCohortFilter === 'all' ? school.cohorts.length : 1;
    const basePopulation = Math.max(1, school.members.length + school.courses.length + school.cohorts.length);

    const generatedAssessments = Math.max(2, Math.round(basePopulation * 1.7 * scopedFactor));
    const reviewedAssessments = Math.max(1, Math.round(generatedAssessments * 0.86));
    const publishedAssessments = Math.max(1, Math.round(reviewedAssessments * 0.82));
    const attemptedAssessments = Math.max(1, Math.round(publishedAssessments * 0.76));
    const completedAssessments = Math.max(1, Math.round(attemptedAssessments * 0.81));

    const funnelSteps = [
        { label: 'Generated', value: generatedAssessments },
        { label: 'Reviewed', value: reviewedAssessments },
        { label: 'Published', value: publishedAssessments },
        { label: 'Attempted', value: attemptedAssessments },
        { label: 'Completed', value: completedAssessments },
    ];

    const trendBase = Math.max(8, Math.round(basePopulation * scopedFactor));
    const trendSeries = Array.from({ length: 8 }, (_, idx) => {
        const attempts = Math.max(2, Math.round(trendBase * (0.85 + idx * 0.06)));
        const completionRate = Math.min(0.96, 0.58 + idx * 0.035);
        const avgScore = Math.min(0.94, 0.52 + idx * 0.04);
        const avgTime = Math.max(90, Math.round(260 - idx * 12));
        return {
            label: `W${idx + 1}`,
            attempts,
            completionRate,
            avgScore,
            avgTime,
        };
    });

    const skillNames = ['Problem Solving', 'SQL', 'Metrics', 'Communication', 'Product Thinking'];
    const heatmapCohorts = (dashboardCohortFilter === 'all' ? school.cohorts.slice(0, 4) : school.cohorts.filter((c) => String(c.id) === dashboardCohortFilter)).map((c) => c.name);
    const effectiveHeatmapCohorts = heatmapCohorts.length > 0 ? heatmapCohorts : ['Cohort A'];
    const skillGapHeatmap = skillNames.map((skill, sIdx) => {
        const values = effectiveHeatmapCohorts.map((_, cIdx) => {
            const raw = 0.18 + ((sIdx * 17 + cIdx * 11 + basePopulation) % 41) / 100;
            return Number(Math.min(0.62, raw).toFixed(2));
        });
        return { skill, values };
    });

    const questionQuality = {
        overDiscriminating: [
            { id: 'Q004', index: 0.78, issue: 'Too steep for current level' },
            { id: 'Q011', index: 0.74, issue: 'High variance by cohort' },
        ],
        underDiscriminating: [
            { id: 'Q002', index: 0.11, issue: 'Too easy and low signal' },
            { id: 'Q019', index: 0.14, issue: 'Ambiguous stem options' },
        ],
        mostFailed: [
            { id: 'Q011', failRate: 0.63 },
            { id: 'Q017', failRate: 0.58 },
            { id: 'Q021', failRate: 0.56 },
        ],
        mostSkipped: [
            { id: 'Q006', skipRate: 0.29 },
            { id: 'Q015', skipRate: 0.27 },
        ],
        highTimeLowScore: [
            { id: 'Q017', avgSeconds: 312, avgScore: 0.32 },
            { id: 'Q021', avgSeconds: 298, avgScore: 0.35 },
        ],
    };

    const cohortLeaderboard = (school.cohorts.length > 0 ? school.cohorts : [{ id: 0, name: 'Default Cohort' }]).slice(0, 5).map((cohort, index) => ({
        id: cohort.id,
        name: cohort.name,
        performance: Number((0.61 + Math.max(0, 0.16 - index * 0.025)).toFixed(2)),
        engagement: Number((0.68 + Math.max(0, 0.14 - index * 0.03)).toFixed(2)),
    }));

    const courseInterventions = (school.courses.length > 0 ? school.courses : [{ id: 0, name: 'Default Course' }]).slice(0, 5).map((course, index) => ({
        id: course.id,
        name: course.name,
        completion: Number((0.74 - index * 0.06).toFixed(2)),
        avgTime: 180 + index * 22,
        passRate: Number((0.72 - index * 0.07).toFixed(2)),
    })).sort((a, b) => a.completion - b.completion);

    const alerts = [
        { level: 'high', text: 'SQL skill gap increased by 12% in the latest cycle.' },
        { level: 'medium', text: `${questionQuality.underDiscriminating.length} questions are under-discriminating.` },
        { level: 'medium', text: `${questionQuality.highTimeLowScore.length} items are high-time and low-score.` },
        { level: 'low', text: `Attempt-to-completion conversion is ${(completedAssessments / attemptedAssessments * 100).toFixed(1)}%.` },
    ];

    const currentWindow = {
        attempts: attemptedAssessments,
        completionRate: Number((completedAssessments / attemptedAssessments).toFixed(2)),
        avgScore: Number((trendSeries[trendSeries.length - 1].avgScore).toFixed(2)),
        avgTime: trendSeries[trendSeries.length - 1].avgTime,
    };
    const previousWindow = {
        attempts: Math.max(1, Math.round(currentWindow.attempts * 0.88)),
        completionRate: Number(Math.max(0, currentWindow.completionRate - 0.05).toFixed(2)),
        avgScore: Number(Math.max(0, currentWindow.avgScore - 0.04).toFixed(2)),
        avgTime: currentWindow.avgTime + 18,
    };

    const dataFreshnessMinutes = 11;
    const dataCoverageAttempts = attemptedAssessments;

    const dashboardDetailRows = trendSeries.map((point) => ({
        period: point.label,
        attempts: point.attempts,
        completion: `${(point.completionRate * 100).toFixed(1)}%`,
        score: `${(point.avgScore * 100).toFixed(1)}%`,
        time: `${point.avgTime}s`,
    }));

    const downloadDashboardCSV = () => {
        const headers = ['period', 'attempts', 'completion_rate', 'avg_score', 'avg_time_seconds'];
        const rows = trendSeries.map((point) => [
            point.label,
            String(point.attempts),
            point.completionRate.toFixed(4),
            point.avgScore.toFixed(4),
            String(point.avgTime),
        ]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-${dashboardRange}-${dashboardMode}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        setToastMessage({
            title: 'Export ready',
            description: 'CSV export has been downloaded.',
            emoji: '📊',
        });
        setShowToast(true);
    };

    const exportDashboardPDF = () => {
        window.print();
        setToastMessage({
            title: 'Print/PDF opened',
            description: 'Use browser print dialog to save as PDF.',
            emoji: '🧾',
        });
        setShowToast(true);
    };

    const toggleScheduledSummary = () => {
        setScheduledSummaryEnabled((prev) => !prev);
        setToastMessage({
            title: 'Weekly summary schedule',
            description: !scheduledSummaryEnabled ? 'Weekly summary is now enabled.' : 'Weekly summary is now disabled.',
            emoji: '⏰',
        });
        setShowToast(true);
    };

    return (
        <>
            <Header
                showCreateCourseButton={false}
            />

            <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
                <div className="container mx-auto px-4 py-8">
                    <main>
                        {/* School header with title */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center mr-4">
                                        <Building size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center">
                                            <h1
                                                ref={schoolNameRef}
                                                contentEditable={isEditingName}
                                                suppressContentEditableWarning
                                                className={`text-3xl font-light outline-none ${isEditingName ? 'border-b border-black dark:border-white' : ''}`}
                                                onBlur={handleNameBlur}
                                                onKeyDown={handleNameKeyDown}
                                            >
                                                {school.name}
                                            </h1>
                                            {/* <button
                                                onClick={toggleNameEdit}
                                                className="ml-2 p-2 text-gray-400 hover:text-white"
                                                aria-label={isEditingName ? "Save school name" : "Edit school name"}
                                            >
                                                {isEditingName ? <Save size={16} /> : <Edit size={16} />}
                                            </button> */}
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <p className="text-gray-600 dark:text-gray-400">{school.url}</p>
                                            <a
                                                href={school.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 transition-colors cursor-pointer text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                                                aria-label="Open school URL"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs for navigation */}
                        <div className="mb-8">
                            <div className="flex border-b border-gray-200 dark:border-gray-800">
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'dashboard'
                                        ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                        }`}
                                    onClick={() => handleTabChange('dashboard')}
                                >
                                    <div className="flex items-center">
                                        <LayoutDashboard size={16} className="mr-2" />
                                        Dashboard
                                    </div>
                                </button>
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'courses'
                                        ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                        }`}
                                    onClick={() => handleTabChange('courses')}
                                >
                                    <div className="flex items-center">
                                        <BookOpen size={16} className="mr-2" />
                                        Courses
                                    </div>
                                </button>
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'cohorts'
                                        ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                        }`}
                                    onClick={() => handleTabChange('cohorts')}
                                >
                                    <div className="flex items-center">
                                        <Layers size={16} className="mr-2" />
                                        Cohorts
                                    </div>
                                </button>
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'members'
                                        ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                        }`}
                                    onClick={() => handleTabChange('members')}
                                >
                                    <div className="flex items-center">
                                        <Users size={16} className="mr-2" />
                                        Team
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Tab content */}
                        <div>
                            {/* Dashboard Tab */}
                            {activeTab === 'dashboard' && (
                                <div className="space-y-6">
                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <Filter size={14} />
                                                Filters & drilldown
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={downloadDashboardCSV}
                                                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs"
                                                >
                                                    <Download size={14} /> CSV
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={exportDashboardPDF}
                                                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs"
                                                >
                                                    <FileDown size={14} /> PDF
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={toggleScheduledSummary}
                                                    className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${scheduledSummaryEnabled ? 'border-purple-500 text-purple-600 dark:text-purple-300' : 'border-gray-300 dark:border-gray-700'}`}
                                                >
                                                    <Bell size={14} /> {scheduledSummaryEnabled ? 'Summary On' : 'Summary Off'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                                            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-2 py-2 text-sm" value={dashboardRange} onChange={(e) => setDashboardRange(e.target.value as '7d' | '30d' | '90d')}>
                                                <option value="7d">Last 7 days</option>
                                                <option value="30d">Last 30 days</option>
                                                <option value="90d">Last 90 days</option>
                                            </select>
                                            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-2 py-2 text-sm" value={dashboardMode} onChange={(e) => setDashboardMode(e.target.value as 'all' | 'curriculum' | 'jd')}>
                                                <option value="all">All modes</option>
                                                <option value="curriculum">Mode A</option>
                                                <option value="jd">Mode B</option>
                                            </select>
                                            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-2 py-2 text-sm" value={dashboardCourseFilter} onChange={(e) => setDashboardCourseFilter(e.target.value)}>
                                                <option value="all">All courses</option>
                                                {school.courses.map((course) => (
                                                    <option key={course.id} value={String(course.id)}>{course.name}</option>
                                                ))}
                                            </select>
                                            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-2 py-2 text-sm" value={dashboardCohortFilter} onChange={(e) => setDashboardCohortFilter(e.target.value)}>
                                                <option value="all">All cohorts</option>
                                                {school.cohorts.map((cohort) => (
                                                    <option key={cohort.id} value={String(cohort.id)}>{cohort.name}</option>
                                                ))}
                                            </select>
                                            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-2 py-2 text-sm" value={dashboardDifficulty} onChange={(e) => setDashboardDifficulty(e.target.value as 'all' | 'easy' | 'medium' | 'hard')}>
                                                <option value="all">All difficulty</option>
                                                <option value="easy">Easy</option>
                                                <option value="medium">Medium</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Scope: {selectedCourseCount} course(s), {selectedCohortCount} cohort(s)
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total courses</p>
                                            <p className="mt-2 text-3xl font-light text-black dark:text-white">{school.courses.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total cohorts</p>
                                            <p className="mt-2 text-3xl font-light text-black dark:text-white">{school.cohorts.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Team members</p>
                                            <p className="mt-2 text-3xl font-light text-black dark:text-white">{school.members.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Courses per cohort</p>
                                            <p className="mt-2 text-3xl font-light text-black dark:text-white">
                                                {school.cohorts.length > 0 ? (school.courses.length / school.cohorts.length).toFixed(1) : '0.0'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <h2 className="text-xl font-light text-black dark:text-white">Assessment funnel</h2>
                                            <TrendingUp size={18} className="text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {funnelSteps.map((step, idx) => {
                                                const prev = idx === 0 ? step.value : funnelSteps[idx - 1].value;
                                                const pct = Math.max(5, (step.value / funnelSteps[0].value) * 100);
                                                const conversion = idx === 0 ? 100 : (step.value / prev) * 100;
                                                return (
                                                    <div key={step.label}>
                                                        <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                                            <span>{step.label}</span>
                                                            <span>{step.value} ({conversion.toFixed(1)}%)</span>
                                                        </div>
                                                        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                                                            <div className="h-3 rounded-full bg-purple-600" style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                            <h2 className="text-xl font-light text-black dark:text-white">Performance over time</h2>
                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <button type="button" onClick={() => setDrilldownKey('attempts')} className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-left bg-white dark:bg-black/30">
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Attempts</div>
                                                    <div className="text-lg font-light">{currentWindow.attempts}</div>
                                                </button>
                                                <button type="button" onClick={() => setDrilldownKey('completion')} className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-left bg-white dark:bg-black/30">
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Completion %</div>
                                                    <div className="text-lg font-light">{(currentWindow.completionRate * 100).toFixed(1)}%</div>
                                                </button>
                                                <button type="button" onClick={() => setDrilldownKey('score')} className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-left bg-white dark:bg-black/30">
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Avg score</div>
                                                    <div className="text-lg font-light">{(currentWindow.avgScore * 100).toFixed(1)}%</div>
                                                </button>
                                                <button type="button" onClick={() => setDrilldownKey('time')} className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-left bg-white dark:bg-black/30">
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Avg time / item</div>
                                                    <div className="text-lg font-light">{currentWindow.avgTime}s</div>
                                                </button>
                                            </div>
                                            <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Attempts trend</p>
                                                <svg viewBox="0 0 350 100" className="w-full h-24">
                                                    <polyline
                                                        fill="none"
                                                        stroke="#7c3aed"
                                                        strokeWidth="3"
                                                        points={trendSeries.map((point, index) => {
                                                            const x = index * 50;
                                                            const y = 90 - (point.attempts / Math.max(...trendSeries.map((t) => t.attempts))) * 80;
                                                            return `${x},${y}`;
                                                        }).join(' ')}
                                                    />
                                                </svg>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                            <h2 className="text-xl font-light text-black dark:text-white">Benchmarking</h2>
                                            <div className="mt-4 space-y-3 text-sm">
                                                <BenchmarkRow label="Attempts" current={currentWindow.attempts} previous={previousWindow.attempts} higherIsBetter />
                                                <BenchmarkRow label="Completion rate" current={currentWindow.completionRate} previous={previousWindow.completionRate} percent higherIsBetter />
                                                <BenchmarkRow label="Average score" current={currentWindow.avgScore} previous={previousWindow.avgScore} percent higherIsBetter />
                                                <BenchmarkRow label="Average time" current={currentWindow.avgTime} previous={previousWindow.avgTime} lowerIsBetter />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                        <h2 className="text-xl font-light text-black dark:text-white">Skill gap heatmap</h2>
                                        <div className="mt-4 overflow-auto">
                                            <table className="min-w-full text-sm">
                                                <thead>
                                                    <tr>
                                                        <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Skill</th>
                                                        {effectiveHeatmapCohorts.map((cohort) => (
                                                            <th key={cohort} className="px-2 py-2 text-left text-xs uppercase text-gray-500">{cohort}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {skillGapHeatmap.map((row) => (
                                                        <tr key={row.skill}>
                                                            <td className="px-2 py-2 font-medium">{row.skill}</td>
                                                            {row.values.map((val, idx) => (
                                                                <td key={`${row.skill}-${idx}`} className="px-2 py-2">
                                                                    <div className="rounded-md px-2 py-1 text-center text-xs" style={{ backgroundColor: `rgba(124,58,237,${Math.min(0.95, 0.2 + val)})`, color: '#fff' }}>
                                                                        {(val * 100).toFixed(0)}%
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-light text-black dark:text-white">Question quality panel</h2>
                                                <AlertTriangle size={18} className="text-gray-500 dark:text-gray-400" />
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30">
                                                    <p className="text-gray-500">Over-discriminating</p>
                                                    <p className="text-lg">{questionQuality.overDiscriminating.length}</p>
                                                </div>
                                                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30">
                                                    <p className="text-gray-500">Under-discriminating</p>
                                                    <p className="text-lg">{questionQuality.underDiscriminating.length}</p>
                                                </div>
                                                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30">
                                                    <p className="text-gray-500">Most failed</p>
                                                    <p className="text-lg">{questionQuality.mostFailed.length}</p>
                                                </div>
                                                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-black/30">
                                                    <p className="text-gray-500">High-time low-score</p>
                                                    <p className="text-lg">{questionQuality.highTimeLowScore.length}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 text-sm space-y-2">
                                                {questionQuality.highTimeLowScore.map((item) => (
                                                    <div key={item.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-black/30 flex justify-between">
                                                        <span>{item.id}</span>
                                                        <span>{item.avgSeconds}s / {(item.avgScore * 100).toFixed(0)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-light text-black dark:text-white">Leaderboards</h2>
                                                <Trophy size={18} className="text-gray-500 dark:text-gray-400" />
                                            </div>
                                            <div className="mt-4 space-y-4 text-sm">
                                                <div>
                                                    <p className="mb-2 text-xs uppercase text-gray-500">Best performing cohorts</p>
                                                    <div className="space-y-2">
                                                        {cohortLeaderboard.slice(0, 3).map((cohort) => (
                                                            <div key={`perf-${cohort.id}`} className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-black/30 flex justify-between">
                                                                <span>{cohort.name}</span>
                                                                <span>{(cohort.performance * 100).toFixed(0)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="mb-2 text-xs uppercase text-gray-500">Courses needing intervention</p>
                                                    <div className="space-y-2">
                                                        {courseInterventions.slice(0, 3).map((course) => (
                                                            <div key={`course-${course.id}`} className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-black/30">
                                                                <div className="flex justify-between"><span>{course.name}</span><span>{(course.completion * 100).toFixed(0)}%</span></div>
                                                                <div className="text-xs text-gray-500">Pass {(course.passRate * 100).toFixed(0)}% • Avg {course.avgTime}s</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                        <h2 className="text-xl font-light text-black dark:text-white">Alerts & recommendations</h2>
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {alerts.map((alert, index) => (
                                                <div key={`alert-${index}`} className={`rounded-md border p-3 text-sm ${alert.level === 'high' ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20' : alert.level === 'medium' ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20' : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20'}`}>
                                                    {alert.text}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {drilldownKey && (
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                            <h2 className="text-xl font-light text-black dark:text-white">Drilldown: {drilldownKey}</h2>
                                            <div className="mt-4 overflow-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Period</th>
                                                            <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Attempts</th>
                                                            <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Completion</th>
                                                            <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Score</th>
                                                            <th className="px-2 py-2 text-left text-xs uppercase text-gray-500">Time</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dashboardDetailRows.map((row) => (
                                                            <tr key={row.period}>
                                                                <td className="px-2 py-2">{row.period}</td>
                                                                <td className="px-2 py-2">{row.attempts}</td>
                                                                <td className="px-2 py-2">{row.completion}</td>
                                                                <td className="px-2 py-2">{row.score}</td>
                                                                <td className="px-2 py-2">{row.time}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-4 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                <Clock size={14} /> Last updated {dataFreshnessMinutes} minutes ago
                                            </div>
                                            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                <CheckCircle2 size={14} /> Based on {dataCoverageAttempts} tracked attempts in selected scope
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111] p-5">
                                        <h2 className="text-xl font-light text-black dark:text-white">Stats analysis</h2>
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 p-4">
                                                <p className="text-gray-500 dark:text-gray-400">Coverage status</p>
                                                <p className="mt-2 text-black dark:text-white">
                                                    {school.courses.length > 0 && school.cohorts.length > 0 && school.members.length > 0
                                                        ? 'School has active setup across courses, cohorts, and team.'
                                                        : 'Some entities are missing. Add courses, cohorts, or team members to complete setup.'}
                                                </p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 p-4">
                                                <p className="text-gray-500 dark:text-gray-400">Quick ratios</p>
                                                <ul className="mt-2 space-y-1 text-black dark:text-white">
                                                    <li>Members per course: {school.courses.length > 0 ? (school.members.length / school.courses.length).toFixed(1) : '0.0'}</li>
                                                    <li>Cohorts per course: {school.courses.length > 0 ? (school.cohorts.length / school.courses.length).toFixed(1) : '0.0'}</li>
                                                    <li>Members per cohort: {school.cohorts.length > 0 ? (school.members.length / school.cohorts.length).toFixed(1) : '0.0'}</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 p-4 lg:col-span-2">
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">Entity distribution chart</p>
                                                <div className="mt-3 space-y-3">
                                                    {entityDistribution.map((item) => (
                                                        <div key={item.label}>
                                                            <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                                                <span>{item.label}</span>
                                                                <span>{item.value}</span>
                                                            </div>
                                                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                                                                <div
                                                                    className="h-2 rounded-full"
                                                                    style={{
                                                                        width: `${(item.value / maxEntityValue) * 100}%`,
                                                                        backgroundColor: item.color,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Trend plot</p>
                                                    <svg viewBox="0 0 200 90" className="w-full h-20">
                                                        <polyline
                                                            fill="none"
                                                            stroke="#7c3aed"
                                                            strokeWidth="3"
                                                            points={trendPoints}
                                                        />
                                                        {entityDistribution.map((item, index) => {
                                                            const x = index * 100;
                                                            const normalized = item.value / maxEntityValue;
                                                            const y = 80 - normalized * 70;
                                                            return <circle key={item.label} cx={x} cy={y} r="4" fill="#7c3aed" />;
                                                        })}
                                                    </svg>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 p-4">
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">Setup completion</p>
                                                <div className="mt-4 flex items-center justify-center">
                                                    <div className="relative h-28 w-28 rounded-full" style={donutStyle}>
                                                        <div className="absolute inset-3 rounded-full bg-white dark:bg-[#0b0b0b] flex items-center justify-center">
                                                            <span className="text-lg font-light text-black dark:text-white">{setupCompletionPercent}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="mt-4 text-xs text-center text-gray-600 dark:text-gray-400">
                                                    {setupCompleteCount}/3 core entities configured
                                                </p>
                                                <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-500">
                                                    Total tracked entities: {totalEntities}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Courses Tab */}
                            {activeTab === 'courses' && (
                                <div>
                                    <LearnerAssessmentLauncher
                                        courses={(school.courses || []).map((course) => ({
                                            id: Number(course.id),
                                            name: course.name,
                                        }))}
                                        orgId={Number(id)}
                                    />

                                    {school.courses.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button
                                                    onClick={() => setIsCreateCourseDialogOpen(true)}
                                                    className="px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity inline-block cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black"
                                                >
                                                    Create course
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.courses.map(course => (
                                                    <CourseCard
                                                        key={course.id}
                                                        course={{
                                                            id: course.id,
                                                            title: course.name,
                                                            org_id: Number(id)
                                                        }}
                                                        onDelete={handleCourseDelete}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">What if your next big idea became a course?</h2>
                                            <p className="text-gray-600 dark:text-gray-400 mb-8">It might be easier than you think</p>
                                            <button
                                                onClick={() => setIsCreateCourseDialogOpen(true)}
                                                className="px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity inline-block cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black"
                                            >
                                                Create course
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cohorts Tab */}
                            {activeTab === 'cohorts' && (
                                <div>
                                    {school.cohorts.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button
                                                    className="px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black"
                                                    onClick={() => {
                                                        setIsCreateCohortDialogOpen(true);
                                                    }}
                                                >
                                                    Create cohort
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.cohorts.map(cohort => (
                                                    <CohortCard
                                                        key={cohort.id}
                                                        cohort={cohort}
                                                        schoolId={school.id}
                                                        onDelete={handleCohortDelete}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">Bring your courses to life with cohorts</h2>
                                            <p className="text-gray-600 dark:text-gray-400 mb-8">Create groups of learners and assign them courses to learn together</p>
                                            <button
                                                className="px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black"
                                                onClick={() => {
                                                    setIsCreateCohortDialogOpen(true);
                                                }}
                                            >
                                                Create cohort
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Team Tab */}
                            {activeTab === 'members' && (
                                <div>
                                    <div className="flex justify-start items-center mb-6 gap-4">
                                        <button
                                            className="px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black"
                                            onClick={() => setIsInviteDialogOpen(true)}
                                        >
                                            Invite members
                                        </button>
                                        {selectedMembers.length > 0 && (
                                            <button
                                                className="px-6 py-3 bg-red-800 text-white text-sm font-medium rounded-full hover:bg-red-900 transition-colors focus:outline-none cursor-pointer flex items-center"
                                                onClick={handleDeleteSelectedMembers}
                                            >
                                                <Trash2 size={16} className="mr-2" />
                                                Remove ({selectedMembers.length})
                                            </button>
                                        )}
                                    </div>

                                    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                            <thead className="bg-gray-50 dark:bg-gray-900">
                                                <tr>
                                                    <th scope="col" className="w-10 px-3 py-3 text-left">
                                                        <div className="flex items-center justify-center">
                                                            {hasSelectableMembers() && (
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent bg-white dark:bg-[#111111]"
                                                                    checked={areAllMembersSelected()}
                                                                    onChange={handleSelectAllMembers}
                                                                    title="Select all members"
                                                                />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Email</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Role</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-[#111] divide-y divide-gray-200 dark:divide-gray-800">
                                                {school.members.map(member => (
                                                    <tr key={member.id}>
                                                        <td className="w-10 px-4 py-4 whitespace-nowrap">
                                                            <div className="flex justify-center">
                                                                {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent bg-white dark:bg-[#111111]"
                                                                        checked={selectedMembers.some(m => m.id === member.id)}
                                                                        onChange={() => handleMemberSelection(member)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-300">{member.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm flex justify-between items-center">
                                                            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${member.role === 'owner'
                                                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                                }`}>
                                                                {member.role === 'owner' ? 'Owner' : 'Admin'}
                                                            </span>
                                                            {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                <button
                                                                    onClick={() => handleDeleteMember(member)}
                                                                    className="flex items-center gap-1 transition-colors focus:outline-none cursor-pointer text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500"
                                                                    aria-label="Remove Member"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {/* Invite Members Dialog */}
            <InviteMembersDialog
                open={isInviteDialogOpen}
                onClose={() => setIsInviteDialogOpen(false)}
                onInvite={handleInviteMembers}
            />

            {/* Delete Member Confirmation Dialog */}
            <ConfirmationDialog
                show={isDeleteConfirmOpen}
                title={memberToDelete || selectedMembers.length == 1 ? "Remove member" : "Remove selected members"}
                message={memberToDelete
                    ? `Are you sure you want to remove ${memberToDelete.email} from this organization?`
                    : `Are you sure you want to remove ${selectedMembers.length} ${selectedMembers.length === 1 ? 'member' : 'members'} from this organization?`
                }
                confirmButtonText="Remove"
                onConfirm={confirmDeleteMember}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                type="delete"
            />

            {/* Create cohort Dialog */}
            <CreateCohortDialog
                open={isCreateCohortDialogOpen}
                onClose={() => setIsCreateCohortDialogOpen(false)}
                onCreateCohort={handleCreateCohort}
                schoolId={id}
            />

            {/* Create course Dialog */}
            <CreateCourseDialog
                open={isCreateCourseDialogOpen}
                onClose={() => setIsCreateCourseDialogOpen(false)}
                onSuccess={handleCourseCreationSuccess}
                schoolId={id}
            />

            {/* Toast notification */}
            <Toast
                show={showToast}
                title={toastMessage.title}
                description={toastMessage.description}
                emoji={toastMessage.emoji}
                onClose={() => setShowToast(false)}
            />
        </>
    );
} 