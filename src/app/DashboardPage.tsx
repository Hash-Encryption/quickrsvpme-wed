import { ArrowRight, CalendarDays, Heart, PartyPopper, Shield } from 'lucide-react';
import { Link } from 'wouter';

import { buildProjectRoute, type ProjectSummary } from './projects';

export function DashboardPage({ projects }: { projects: ProjectSummary[] }) {
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]">
    <header className="flex min-h-16 items-center justify-between border-b border-[#D9D2C5] bg-[#FAF8F4] px-5 sm:px-10"><p className="text-xl font-semibold tracking-[-.04em]">Quick<span className="text-[#A4813C]">RSVP</span></p><Link href="/admin" className="focus-ring flex min-h-11 items-center gap-2 rounded-full border border-[#D9D2C5] px-4 text-xs font-semibold"><Shield size={15} />Admin</Link></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8B7040]">Project dashboard</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Every invitation has its own place.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#756F66]">Open a Wedding or Party project. Each keeps its own creation experience while sharing the wider QuickRSVP product.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">{projects.map((project) => {
        const Icon = project.type === 'wedding' ? Heart : PartyPopper;
        return <Link key={`${project.type}-${project.id}`} href={buildProjectRoute(project.type, project.id, 'overview')} className="focus-ring group rounded-3xl border border-[#D9D2C5] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#A4813C] sm:p-8"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0C2D24] text-[#D4B363]"><Icon size={20} /></span><ArrowRight className="text-[#A4813C] transition group-hover:translate-x-1" /></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{project.type}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{project.name}</h2><p className="mt-4 flex items-center gap-2 text-xs text-[#756F66]"><CalendarDays size={14} />{project.date} · {project.venue}</p></Link>;
      })}</div>
      <p className="mt-8 text-xs text-[#756F66]">Local frontend workspace · no production account or customer data</p>
    </main>
  </div>;
}
