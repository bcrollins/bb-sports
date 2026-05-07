import { notFound } from 'next/navigation';
import { getArticleById } from '@/lib/queries';
import { ArticleEditor } from '../../_components/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const a = await getArticleById(params.id);
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
        authorName: a.authorName,
        published: a.published,
      }}
    />
  );
}
