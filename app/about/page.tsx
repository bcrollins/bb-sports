import Link from 'next/link';
import { getConfig } from '@/lib/queries';

export const metadata = {
  title: 'About Brad',
  description:
    'Brad Benson — University of Florida journalism and sports media (2027). Founder, editor, and only contributor of BB Sports.'
};

// Revalidate every 60s so admin edits to about_bio in /admin/site surface
// without requiring a redeploy.
export const revalidate = 60;

// Default bio used when no DB or no site_config.about_bio — keeps the page
// fully renderable in local dev and before the admin has edited the bio.
const DEFAULT_BIO: string[] = [];

export default async function AboutPage() {
  const adminBio = await getConfig<string[] | null>('about_bio', null);
  const bioParagraphs =
    Array.isArray(adminBio) && adminBio.filter((p) => p?.trim()).length > 0
      ? adminBio.filter((p) => p?.trim())
      : DEFAULT_BIO;
  return (
    <article className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">The founder</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.9] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.5rem, 9vw, 7rem)' }}
          >
            Brad Benson.
          </h1>
          <p className="mt-5 text-xl text-bone/85 max-w-2xl leading-relaxed">
            Sports journalism student. Hockey kid. Soccer kid. Track kid. Bears, Panthers, Manchester United, Florida Gators, Bulls, Cubs — in that order, on a normal week.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <section className="article-body">
          {bioParagraphs.length > 0 && (
            <>
              {bioParagraphs.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </>
          )}

          <h2>The basics</h2>
          <ul>
            <li><strong>Hometown:</strong> Boca Raton, Florida.</li>
            <li><strong>School:</strong> University of Florida — class of 2027.</li>
            <li><strong>Major:</strong> Journalism &amp; Sports Media.</li>
            <li><strong>Sports played:</strong> hockey, soccer, a little track in high school.</li>
            <li><strong>Internships:</strong> not yet — I’m a junior. The internship line on this page is going to fill up.</li>
          </ul>

          <h2>How I got here</h2>
          <p>
            I came to UF without knowing exactly what I wanted to do — only that it was going to be sports. The version of journalism I always responded to was the podcast version, where the host actually said what they thought and wasn’t saving the take for the back of a column. When I found out UF had a sports journalism program, that was instantly what I wanted to do.
          </p>
          <p>
            The version of sports media I want to make is built on three things: <strong>say what you think, source it, and be willing to be wrong in public.</strong> If a take can’t survive the comments, it shouldn’t have shipped. If a stat doesn’t have a link, it shouldn’t have made it past the draft.
          </p>

          <h2>Why this site exists</h2>
          <p>
            Most sports websites read like every paragraph was negotiated with three people in a marketing department. That isn’t how fans talk about sports. Fans take a side. Fans argue. Fans get loud. <strong>I want a website that reads the way fans actually talk about sports — with the rest of the journalism still intact.</strong>
          </p>
          <p>
            Pat McAfee figured this out for talk radio. The bet is that you can do the same thing in writing. That’s BB Sports.
          </p>

          <h2>What I’ll cover</h2>
          <p>In rough priority order: <strong>NFL, NHL, college football, soccer, NBA, MMA.</strong> Lean into college early because the season is right there and college sports change fast enough that there’s always something to argue about.</p>

          <h2>Where this is going</h2>
          <p>
            <strong>5 years from now:</strong> running my own media company. <strong>10 years from now:</strong> same answer, bigger version. If the writing-and-podcast track doesn’t end up the lane, plan B is scout / front office. I’d be lucky to do either.
          </p>

          <h2>How to reach me</h2>
          <p>
            Easiest way: <a href="https://x.com/bbsports" target="_blank" rel="noopener">@bbsports on X</a>. Tips and pitches: the <Link href="/contact">contact form</Link>. If it’s urgent and a story, mark it as such — I check tips first.
          </p>
        </section>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          <Link href="/articles" className="bb-button-primary">
            Read the takes
          </Link>
          <Link href="/coming-soon" className="bb-button-ghost">
            Get the newsletter
          </Link>
        </div>

        <div className="mt-10 p-5 border border-navy/15 bg-bone-50 rounded text-sm text-charcoal/85">
          <strong>A note on photos:</strong> a proper headshot is on the to-do list. Until then, this site uses placeholder portraits and BB Sports illustrations. If you’re a sports photographer in Gainesville and want to trade a session for a credit, hit the contact form.
        </div>
      </div>
    </article>
  );
}
