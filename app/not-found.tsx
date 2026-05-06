import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="bg-bone min-h-[60vh]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="bb-eyebrow">404</p>
        <h1 className="mt-3 font-serif font-extrabold text-navy-900 text-4xl sm:text-6xl tracking-tight">
          That play isn’t in the playbook.
        </h1>
        <p className="mt-4 text-lg text-charcoal/85">
          The page you’re looking for doesn’t exist on BB Sports.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link href="/" className="bb-button-primary">Back to home</Link>
          <Link href="/articles" className="bb-button-ghost">Read the takes</Link>
        </div>
      </div>
    </div>
  );
}
