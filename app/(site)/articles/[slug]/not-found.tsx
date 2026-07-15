import Link from 'next/link';

export default function ArticleNotFound() {
  return (
    <div className="min-h-[60vh] bg-bone">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="bb-eyebrow !text-breaking">Article unavailable</p>
        <h1 className="mt-3 font-serif text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl">
          That take isn&rsquo;t published here.
        </h1>
        <p className="mt-4 text-lg text-charcoal/85">
          It may never have been approved, it may have been unpublished, or the link is wrong.
          Comments only open on published catalog pieces.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/articles" className="bb-button-primary min-h-[44px] inline-flex items-center">
            Browse the archive
          </Link>
          <Link href="/search" className="bb-button-ghost min-h-[44px] inline-flex items-center">
            Search takes
          </Link>
          <Link href="/" className="bb-button-ghost min-h-[44px] inline-flex items-center">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
