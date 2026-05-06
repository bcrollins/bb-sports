import Link from 'next/link';

export const metadata = {
  title: 'Editorial standards',
  description: 'How BB Sports sources, fact-checks, attributes, and corrects its work.'
};

export default function EditorialStandardsPage() {
  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Public standards</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.92] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}
          >
            Editorial standards.
          </h1>
          <p className="mt-3 text-bone/85">
            BB Sports is a one-person opinion-led sports site. The standards below are the rules of the house. They're short on purpose.
          </p>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 article-body">
        <h2>1. Bias is disclosed, not hidden.</h2>
        <p>
          The founder, Brad Benson, openly roots for the Bears (NFL), Panthers (NHL), Manchester United (Premier League), Florida Gators (NCAA), Bulls (NBA), and Cubs (MLB). When a piece materially involves one of those teams, the disclosure runs above the byline.
        </p>

        <h2>2. Sources are cited inline.</h2>
        <p>
          Every stat that isn’t common knowledge gets a link. Every direct quote gets attribution to the press conference, post, interview, or transcript it came from. If a stat is the writer’s own observation or estimate, that’s flagged in-text.
        </p>

        <h2>3. AI assistance is labeled.</h2>
        <p>
          BB Sports uses AI for transcription of voice memos, drafting injury / power-rankings / news-reaction pieces, and producing counterpoint sidebars that argue against the writer’s take. Anything AI touched carries the “AI · Brad-edited” label. AI never publishes without Brad’s approval. AI does not mimic Brad’s voice — Brad supplies the voice.
        </p>

        <h2>4. Quotes are real.</h2>
        <p>
          BB Sports does not fabricate quotes. We do not paraphrase a person’s words inside quotation marks. If a quote was lightly trimmed for length, the trim is indicated.
        </p>

        <h2>5. Anonymous sources are last-resort.</h2>
        <p>
          Sources are named where possible. When a source must be anonymous, the piece states <em>why</em> (e.g., “the source spoke on condition of anonymity because they were not authorized to discuss the matter publicly”). Brad personally vets the credibility of any anonymous source before quoting them.
        </p>

        <h2>6. Corrections are public.</h2>
        <p>
          When BB Sports gets something wrong, the correction is published on the <Link href="/corrections">corrections page</Link> with the date, the article, what was wrong, and what it should have said. The article itself is updated with a visible correction note. Silent edits are not allowed.
        </p>

        <h2>7. We do not promote sports betting.</h2>
        <p>
          BB Sports may discuss line moves, betting markets, and public-bet percentages as data. BB Sports does not publish betting tips, “locks,” +EV plays, or affiliate links to sportsbooks. This is a permanent rule.
        </p>

        <h2>8. We respect copyright.</h2>
        <p>
          Article images come from licensed sources or original BB Sports illustration. Tweets and YouTube videos are embedded via official embed code, never scraped. Excerpts from other publications are fair-use and credited; full reproductions are not.
        </p>

        <h2>9. We protect minors.</h2>
        <p>
          Recruiting and NIL coverage involving minors is restricted to publicly available facts (verbal commitments, official offers, etc.). BB Sports does not publish personal information about minors and does not run monetized content targeted at minors.
        </p>

        <h2>10. Conflicts of interest are disclosed.</h2>
        <p>
          If Brad has a personal stake in a story (e.g., he is friends with a subject, has a paid relationship with a sponsor mentioned, etc.), the disclosure runs at the top of the piece — or Brad recuses and another writer covers it.
        </p>

        <p className="text-sm text-charcoal/70 mt-10">
          These standards are a living document. Changes will be logged in the <Link href="/corrections">corrections page</Link> with a note that this page itself was updated.
        </p>
      </article>
    </div>
  );
}
