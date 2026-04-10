"use client";

import Link from "next/link";
import {
    ArrowUpRight,
    BarChart3,
    BookOpen,
    ChevronRight,
    Layers3,
    Sparkles,
    Users,
    CircleCheckBig,
    School,
    MessageSquare,
} from "lucide-react";

type SchoolDashboardOverviewProps = {
    schoolName: string;
    schoolUrl: string;
    courseCount: number;
    cohortCount: number;
    memberCount: number;
    activeTab: "courses" | "cohorts" | "members";
    onNavigate: (tab: "courses" | "cohorts" | "members") => void;
    onCreateCourse: () => void;
    onCreateCohort: () => void;
    onInviteMembers: () => void;
};

const statCards = [
    {
        key: "courses",
        label: "Courses",
        icon: BookOpen,
        accent: "from-[#ef4444] to-[#f97316]",
    },
    {
        key: "cohorts",
        label: "Cohorts",
        icon: Layers3,
        accent: "from-[#2563eb] to-[#38bdf8]",
    },
    {
        key: "members",
        label: "Team",
        icon: Users,
        accent: "from-[#f59e0b] to-[#f97316]",
    },
    {
        key: "health",
        label: "Platform health",
        icon: CircleCheckBig,
        accent: "from-[#14b8a6] to-[#22c55e]",
    },
];

export default function SchoolDashboardOverview({
    schoolName,
    schoolUrl,
    courseCount,
    cohortCount,
    memberCount,
    activeTab,
    onNavigate,
    onCreateCourse,
    onCreateCohort,
    onInviteMembers,
}: SchoolDashboardOverviewProps) {
    const summaryTotal = Math.max(courseCount + cohortCount + memberCount, 1);
    const healthScore = Math.min(98, 48 + courseCount * 6 + cohortCount * 5 + memberCount * 2);
    const coursesShare = (courseCount / summaryTotal) * 100;
    const cohortsShare = (cohortCount / summaryTotal) * 100;

    const activityValues = [
        Math.max(10, courseCount * 18),
        Math.max(12, cohortCount * 20),
        Math.max(14, memberCount * 6),
        Math.max(18, courseCount * 14 + cohortCount * 8),
        Math.max(22, memberCount * 5 + courseCount * 9),
        Math.max(16, cohortCount * 12 + memberCount * 4),
    ];

    const maxActivity = Math.max(...activityValues, 24);

    const donutStyle = {
        background: `conic-gradient(#ef4444 0 ${coursesShare}%, #2563eb ${coursesShare}% ${coursesShare + cohortsShare}%, #f59e0b ${coursesShare + cohortsShare}% 100%)`,
    };

    const sideItems: Array<{
        key: typeof activeTab;
        label: string;
        icon: typeof BookOpen;
    }> = [
            { key: "courses", label: "Courses", icon: BookOpen },
            { key: "cohorts", label: "Cohorts", icon: Layers3 },
            { key: "members", label: "Team", icon: Users },
        ];

    const activityLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <section className="rounded-[32px] border border-black/5 dark:border-white/10 bg-gradient-to-br from-[#f6f2ff] via-white to-[#effcfb] dark:from-[#17131f] dark:via-[#101010] dark:to-[#0b1716] p-4 sm:p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
            <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="rounded-[28px] bg-[linear-gradient(180deg,#6d28d9_0%,#4c1d95_100%)] text-white p-6 flex flex-col gap-6 shadow-[0_18px_40px_rgba(76,29,149,0.3)]">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Dashboard</p>
                        <h2 className="mt-4 text-3xl font-semibold leading-tight">{schoolName}</h2>
                        <p className="mt-3 text-sm text-white/75 break-all">{schoolUrl}</p>
                    </div>

                    <nav className="space-y-2">
                        {sideItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.key;

                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => onNavigate(item.key)}
                                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all cursor-pointer ${isActive
                                        ? "bg-white text-[#4c1d95] shadow-lg"
                                        : "bg-white/10 text-white/85 hover:bg-white/15"
                                        }`}
                                >
                                    <span className="flex items-center gap-3 font-medium">
                                        <Icon size={16} />
                                        {item.label}
                                    </span>
                                    <ChevronRight size={16} className={isActive ? "text-[#4c1d95]" : "text-white/70"} />
                                </button>
                            );
                        })}
                    </nav>

                    <div className="rounded-[24px] bg-white/10 p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.35em] text-white/55">School pulse</p>
                                <p className="mt-2 text-3xl font-semibold">{healthScore}%</p>
                            </div>
                            <Sparkles size={18} className="text-[#facc15]" />
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#facc15] via-[#fb7185] to-[#22c55e]" style={{ width: `${healthScore}%` }} />
                        </div>
                        <p className="mt-3 text-sm text-white/70">Your school is active across courses, cohorts, and team access.</p>
                    </div>
                </aside>

                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {statCards.map((card) => {
                            const Icon = card.icon;
                            const value =
                                card.key === "courses"
                                    ? courseCount
                                    : card.key === "cohorts"
                                        ? cohortCount
                                        : card.key === "members"
                                            ? memberCount
                                            : healthScore;

                            return (
                                <article
                                    key={card.key}
                                    className="rounded-[24px] bg-white dark:bg-[#111111] border border-black/5 dark:border-white/10 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                                            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
                                        </div>
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                                            <Icon size={20} />
                                        </div>
                                    </div>
                                    <div className="mt-4 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${card.accent}`}
                                            style={{ width: `${Math.min(100, 34 + value * 8)}%` }}
                                        />
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <article className="rounded-[28px] border border-black/5 dark:border-white/10 bg-white dark:bg-[#111111] p-6 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">School summary</p>
                                    <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">What is active right now</h3>
                                </div>
                                <div className="rounded-full bg-[#f3f4f6] px-4 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                                    {summaryTotal} total items
                                </div>
                            </div>

                            <div className="mt-6 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
                                <div className="flex items-center justify-center">
                                    <div className="relative h-52 w-52 rounded-full p-4" style={donutStyle}>
                                        <div className="absolute inset-10 rounded-full bg-white dark:bg-[#111111] shadow-inner flex flex-col items-center justify-center text-center">
                                            <p className="text-xs uppercase tracking-[0.35em] text-gray-400 dark:text-gray-500">Coverage</p>
                                            <p className="mt-2 text-4xl font-semibold text-gray-900 dark:text-white">{healthScore}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">school score</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { label: "Courses", value: courseCount, color: "bg-[#ef4444]" },
                                        { label: "Cohorts", value: cohortCount, color: "bg-[#2563eb]" },
                                        { label: "Team members", value: memberCount, color: "bg-[#f59e0b]" },
                                    ].map((item) => {
                                        const maxValue = Math.max(courseCount, cohortCount, memberCount, 1);

                                        return (
                                            <div key={item.label} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                                                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / maxValue) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="rounded-[22px] bg-[#fafafa] dark:bg-white/5 p-4">
                                        <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                            <School size={16} className="text-[#6d28d9]" />
                                            <span>{courseCount > 0 ? "Content is ready to present" : "Add your first course to unlock the dashboard"}</span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                            <MessageSquare size={16} />
                                            <span>Use the tabs below to manage courses, cohorts, and team members.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <article className="rounded-[28px] border border-black/5 dark:border-white/10 bg-white dark:bg-[#111111] p-6 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">Activity</p>
                                    <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">A quick pulse</h3>
                                </div>
                                <div className="rounded-full bg-[#ecfeff] px-4 py-2 text-sm text-[#0f766e] dark:bg-emerald-950/40 dark:text-emerald-200">
                                    Live overview
                                </div>
                            </div>

                            <div className="mt-6 h-56 rounded-[24px] border border-dashed border-black/10 dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.35))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-4">
                                <div className="flex h-full items-end gap-3">
                                    {activityValues.map((value, index) => (
                                        <div key={activityLabels[index]} className="flex flex-1 flex-col items-center gap-3">
                                            <div
                                                className="w-full max-w-10 rounded-full bg-gradient-to-t from-[#14b8a6] via-[#22c55e] to-[#60a5fa] shadow-[0_12px_24px_rgba(20,184,166,0.22)]"
                                                style={{ height: `${Math.max(22, (value / maxActivity) * 100)}%` }}
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{activityLabels[index]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {[
                                    {
                                        label: "Build a course",
                                        description: "Turn a topic into a live program.",
                                        action: "Start build",
                                        onClick: onCreateCourse,
                                        icon: BookOpen,
                                    },
                                    {
                                        label: "Add a cohort",
                                        description: "Group learners for a shared journey.",
                                        action: "Plan cohort",
                                        onClick: onCreateCohort,
                                        icon: Layers3,
                                    },
                                    {
                                        label: "Check insights",
                                        description: "Review mentoring and creator signals.",
                                        action: "View insights",
                                        href: "/insights",
                                        icon: BarChart3,
                                    },
                                    {
                                        label: "Invite your team",
                                        description: "Bring in admins and mentors.",
                                        action: "Open team",
                                        onClick: onInviteMembers,
                                        icon: Users,
                                    },
                                ].map((item) => {
                                    const Icon = item.icon;

                                    const card = (
                                        <div className="group h-full rounded-[22px] border border-black/5 dark:border-white/10 bg-[#fafafa] dark:bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <Icon size={18} className="text-[#6d28d9]" />
                                                <ArrowUpRight size={16} className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                            </div>
                                            <h4 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{item.label}</h4>
                                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                                            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#6d28d9]">
                                                {item.action}
                                                <ChevronRight size={14} />
                                            </div>
                                        </div>
                                    );

                                    if (item.href) {
                                        return (
                                            <Link key={item.label} href={item.href} className="block h-full">
                                                {card}
                                            </Link>
                                        );
                                    }

                                    return (
                                        <button key={item.label} type="button" onClick={item.onClick} className="block h-full text-left cursor-pointer">
                                            {card}
                                        </button>
                                    );
                                })}
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </section>
    );
}