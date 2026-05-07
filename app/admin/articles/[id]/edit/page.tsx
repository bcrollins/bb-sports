import { notFound } from 'next/navigation';
import { getArticleById } from '@/lib/queries';
import { ArticleEditor } from '../../_components/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getArticleById(id);
  if (!a) notFound();
  return (
    <ArticleEditor
      mode="edit"
      initial={{
        id: a.id,
        slug: a.slug,
        title: a.title,
        dek: a.dek,
        body: a.body,
        sport: a.sport,
        hero: a.hero,
        heroAlt: a.heroAlt,
        heroCredit: a.heroCredit,
        authorName: a.authorName,
        aiAssisted: a.aiAssisted,
        bradsTake: a.bradsTake,
        published: a.published,
      }}
    />
  );
}
