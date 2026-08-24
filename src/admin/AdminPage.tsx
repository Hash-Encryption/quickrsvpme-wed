import { BarChart3, CalendarDays, CreditCard, Headphones, LayoutTemplate, Users } from 'lucide-react';
import { Link } from 'wouter';

const areas = [
  ['Customers', 'Future customer support workspace', Users],
  ['Events', 'Wedding and Party inventory', CalendarDays],
  ['Templates', 'Invitation catalog management', LayoutTemplate],
  ['Usage', 'Future product activity', BarChart3],
  ['Support', 'Troubleshooting workspace', Headphones],
  ['Subscriptions', 'Reserved for a later backend phase', CreditCard],
] as const;

export function AdminPage() {
  return <div className="min-h-[100dvh] bg-[#0C2D24] px-5 py-8 text-[#F9F6F0] sm:px-10"><header className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-xl font-semibold">Quick<span className="text-[#D4B363]">RSVP</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">Super Admin · frontend shell</p></div><Link href="/" className="focus-ring rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">Projects</Link></header><main className="mx-auto max-w-6xl py-12"><h1 className="text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Product operations,<br /><span className="text-[#D4B363]">ready for later.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-white/55">This is navigation and information architecture only. Authentication, authorization, customer data, billing, and impersonation are not implemented.</p><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{areas.map(([title, note, Icon]) => <section key={title} className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><Icon size={19} className="text-[#D4B363]" /><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-white/45">{note}</p></section>)}</div></main></div>;
}
