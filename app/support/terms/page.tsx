import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donation Terms',
  description: 'BB Sports donation, refund, and editorial independence terms.',
};

export default function SupportTermsPage() {
  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Reader support</p>
          <h1 className="mt-3 font-display text-5xl italic uppercase leading-[0.9] text-bone sm:text-6xl">
            Donation and refund terms
          </h1>
          <p className="mt-4 text-bone/80">
            Plain-English operating terms for BB Sports reader support.
          </p>
        </div>
      </header>

      <main className="article-body prose-newspaper mx-auto max-w-readable px-4 py-10 sm:px-6">
        <p>
          BB Sports reader support is voluntary. Articles remain free, and supporting the site does not
          buy coverage, editorial influence, access, silence, or a favorable take.
        </p>
        <h2>Payments</h2>
        <p>
          Money movement is handled through Stripe when the BB Sports Stripe account is verified for public launch.
          Before that point, the site only records first-party supporter interest.
        </p>
        <h2>Refunds</h2>
        <p>
          Accidental or duplicate donations may be refunded within 30 days when requested through the contact form.
          Refunds are returned to the original payment method when Stripe supports it.
        </p>
        <h2>Tax Status</h2>
        <p>
          BB Sports is not presenting reader support as a tax-deductible charitable contribution. Supporters should
          not treat a donation as tax-deductible unless BB Sports gives written documentation saying otherwise.
        </p>
        <h2>Editorial Independence</h2>
        <p>
          Donations do not change what Brad covers, how he writes, or whether a correction is issued. Sponsored
          relationships are separate and disclosed.
        </p>
        <h2>Questions</h2>
        <p>
          Use the <Link href="/contact">contact form</Link> for refund requests, payment questions, or sponsorship
          discussions.
        </p>
      </main>
    </div>
  );
}
